use std::collections::{HashMap, VecDeque};
use std::io::Read;
use std::io::Write;
use std::path::{Path, PathBuf};

use crate::cas::TapeBitstreamGenerator;
use crate::disasm::DisassembledInstruction;
use crate::instruction_trace::{InstructionTrace, InstructionTraceEntry};
use crate::machine::{DebugRunToIrqResult, FramebufferRef, Machine, System};
use crate::mmu::RomBank;
use crate::snapshot::{self, Reader, SnapshotError, Writer};
use crate::tvc::{ExecutionTrace, Tvc};
use crate::vid::VidModel;
use crate::z80::Z80State;
use crate::zx82::Zx82;

const GAMEBASE_BOOT_SNAPSHOT: &[u8] = include_bytes!("../../snapshots/boot12dos.rtvcsnap.zip");
const TYPED_KEY_HOLD_FRAMES: u32 = 3;
const TYPED_KEY_GAP_FRAMES: u32 = 1;

#[derive(Clone, Copy)]
pub struct DiskGeometry {
    pub label: &'static str,
    pub file_name: &'static str,
    pub bytes: usize,
    pub total_sectors: u32,
    pub heads: u16,
    pub media: u8,
}

impl DiskGeometry {
    pub const TVC_360K: Self = Self {
        label: "360K",
        file_name: "new-360k.dsk",
        bytes: 368_640,
        total_sectors: 720,
        heads: 1,
        media: 0xf8,
    };

    pub const TVC_720K: Self = Self {
        label: "720K",
        file_name: "new-720k.dsk",
        bytes: 737_280,
        total_sectors: 1440,
        heads: 2,
        media: 0xf9,
    };
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum RomVersion {
    V1_2,
    V2_2,
}

#[cfg(test)]
#[path = "emu_tests.rs"]
mod tests;

#[derive(Clone, Copy, PartialEq, Debug)]
pub struct MachineType {
    pub is_plus: bool,
    pub rom_version: RomVersion,
    pub has_dos: bool,
}

impl MachineType {
    pub fn label(&self) -> String {
        match (self.is_plus, self.rom_version, self.has_dos) {
            (true, RomVersion::V1_2, true) => "64k+ 1.2, VT-DOS",
            (true, RomVersion::V2_2, true) => "64k+ 2.2, VT-DOS",
            (false, RomVersion::V1_2, false) => "64k  1.2",
            (true, RomVersion::V1_2, false) => "64k+ 1.2",
            (true, RomVersion::V2_2, false) => "64k+ 2.2",
            _ => "64k  1.2",
        }
        .to_string()
    }

    pub fn all_types() -> Vec<MachineType> {
        vec![
            MachineType {
                is_plus: true,
                rom_version: RomVersion::V1_2,
                has_dos: true,
            },
            MachineType {
                is_plus: true,
                rom_version: RomVersion::V2_2,
                has_dos: true,
            },
            MachineType {
                is_plus: false,
                rom_version: RomVersion::V1_2,
                has_dos: false,
            },
            MachineType {
                is_plus: true,
                rom_version: RomVersion::V1_2,
                has_dos: false,
            },
            MachineType {
                is_plus: true,
                rom_version: RomVersion::V2_2,
                has_dos: false,
            },
        ]
    }

    pub fn for_snapshot(is_plus: bool, has_dos: bool, preferred_rom_version: RomVersion) -> Self {
        Self::all_types()
            .into_iter()
            .find(|machine_type| {
                machine_type.is_plus == is_plus
                    && machine_type.has_dos == has_dos
                    && machine_type.rom_version == preferred_rom_version
            })
            .or_else(|| {
                Self::all_types().into_iter().find(|machine_type| {
                    machine_type.is_plus == is_plus && machine_type.has_dos == has_dos
                })
            })
            .unwrap_or(MachineType {
                is_plus,
                rom_version: RomVersion::V1_2,
                has_dos,
            })
    }

    fn rom_version_id(&self) -> u8 {
        match self.rom_version {
            RomVersion::V1_2 => 0,
            RomVersion::V2_2 => 1,
        }
    }

    fn from_snapshot_chunk(data: &[u8]) -> snapshot::Result<Self> {
        let mut reader = Reader::new(data);
        let is_plus = reader.u8()? != 0;
        let rom_version = match reader.u8()? {
            0 => RomVersion::V1_2,
            1 => RomVersion::V2_2,
            value => {
                return Err(SnapshotError::InvalidData(format!(
                    "unknown machine ROM version {value}"
                )));
            }
        };
        let has_dos = reader.u8()? != 0;
        Self::all_types()
            .into_iter()
            .find(|machine_type| {
                machine_type.is_plus == is_plus
                    && machine_type.rom_version == rom_version
                    && machine_type.has_dos == has_dos
            })
            .ok_or_else(|| SnapshotError::InvalidData("unknown machine type".to_string()))
    }

    fn write_snapshot_chunk(&self) -> Vec<u8> {
        let mut writer = Writer::new();
        writer.u8(self.is_plus as u8);
        writer.u8(self.rom_version_id());
        writer.u8(self.has_dos as u8);
        writer.into_inner()
    }

    fn rom_files(&self) -> Vec<&'static str> {
        let mut files = match self.rom_version {
            RomVersion::V1_2 => vec!["TVC12_D3.64K", "TVC12_D4.64K", "TVC12_D7.64K"],
            RomVersion::V2_2 => vec!["TVC22_D4.64K", "TVC22_D6.64K", "TVC22_D7.64K"],
        };
        if self.has_dos {
            files.push("VT-DOS12-DISK.ROM");
        }
        files
    }
}

#[derive(Default)]
struct EmuSnapshotState {
    machine_type: Option<MachineType>,
    selected_prog_file_name: Option<String>,
    loaded_disk_file_names: [Option<String>; 2],
}

#[derive(Clone)]
pub struct WasmRecentFile {
    pub name: String,
    pub bytes: Vec<u8>,
}

#[derive(Clone)]
pub struct ProgEntry {
    pub name: String,
    pub file_name: String,
    pub is_cas: bool,
    pub is_disk: bool,
}

pub struct Emu {
    machine: Machine,
    pub running: bool,
    pub roms_loaded: bool,
    pub machine_type: MachineType,
    pub progs: Vec<ProgEntry>,
    pub selected_prog: usize,
    pub loaded_tape: Option<String>,
    pub loaded_disk: [Option<String>; 2],
    pub loaded_tape_file_name: Option<String>,
    pub loaded_disk_file_name: [Option<String>; 2],
    pub recent_tapes: Vec<String>,
    pub recent_disks: Vec<String>,
    #[cfg(target_arch = "wasm32")]
    pub recent_tapes_wasm: Vec<WasmRecentFile>,
    #[cfg(target_arch = "wasm32")]
    pub recent_disks_wasm: Vec<WasmRecentFile>,
    #[cfg(target_arch = "wasm32")]
    loaded_tape_wasm: Option<WasmRecentFile>,
    #[cfg(target_arch = "wasm32")]
    loaded_disk_wasm: [Option<WasmRecentFile>; 2],
    #[cfg(target_arch = "wasm32")]
    loaded_tape_was_injected: bool,
    typed_text: VecDeque<char>,
    typed_key: Option<u32>,
    typed_key_frames: u32,
    typed_gap_frames: u32,
    timed_keys: HashMap<u32, u32>,
    tvc_fast_boot: bool,
}

impl Emu {
    pub fn new(machine_type: MachineType) -> Self {
        let mut emu = Emu {
            machine: Machine::Tvc(Tvc::new(machine_type.is_plus)),
            running: true,
            roms_loaded: false,
            machine_type,
            progs: Vec::new(),
            selected_prog: 0,
            loaded_tape: None,
            loaded_disk: [None, None],
            loaded_tape_file_name: None,
            loaded_disk_file_name: [None, None],
            recent_tapes: Vec::new(),
            recent_disks: Vec::new(),
            #[cfg(target_arch = "wasm32")]
            recent_tapes_wasm: Vec::new(),
            #[cfg(target_arch = "wasm32")]
            recent_disks_wasm: Vec::new(),
            #[cfg(target_arch = "wasm32")]
            loaded_tape_wasm: None,
            #[cfg(target_arch = "wasm32")]
            loaded_disk_wasm: [None, None],
            #[cfg(target_arch = "wasm32")]
            loaded_tape_was_injected: false,
            typed_text: VecDeque::new(),
            typed_key: None,
            typed_key_frames: 0,
            typed_gap_frames: 0,
            timed_keys: HashMap::new(),
            tvc_fast_boot: false,
        };
        emu.scan_progs();
        emu
    }

    pub fn system(&self) -> System {
        self.machine.system()
    }

    pub fn system_label(&self) -> &'static str {
        self.system().label()
    }

    pub fn tvc(&self) -> Option<&Tvc> {
        self.machine.tvc()
    }

    pub fn tvc_mut(&mut self) -> Option<&mut Tvc> {
        self.machine.tvc_mut()
    }

    pub fn z80_state(&self) -> &Z80State {
        self.machine.z80_state()
    }

    pub fn clock(&self) -> u64 {
        self.machine.clock()
    }

    pub fn framebuffer(&self) -> FramebufferRef<'_> {
        self.machine.framebuffer()
    }

    pub fn frame_complete(&self) -> bool {
        self.machine.frame_complete()
    }

    pub fn clear_frame_complete(&mut self) {
        self.machine.clear_frame_complete();
    }

    pub fn vid_model(&self) -> VidModel {
        self.machine.vid_model()
    }

    pub fn set_vid_model(&mut self, model: VidModel) {
        self.machine.set_vid_model(model);
    }

    pub fn fast_boot(&self) -> bool {
        self.tvc().map_or(self.tvc_fast_boot, Tvc::fast_boot)
    }

    pub fn set_fast_boot(&mut self, enabled: bool) {
        self.tvc_fast_boot = enabled;
        if let Some(tvc) = self.tvc_mut() {
            tvc.set_fast_boot(enabled);
        }
    }

    pub fn key_down(&mut self, code: u32) -> bool {
        self.machine.key_down(code)
    }

    pub fn key_up(&mut self, code: u32) {
        self.timed_keys.remove(&code);
        self.machine.key_up(code);
    }

    pub fn key_press_frames(&mut self, code: u32, duration: u32) -> Result<(), String> {
        if duration == 0 {
            return Err("key press duration must be at least one frame".to_string());
        }
        if !self.machine.key_down(code) {
            let character = default_character_for_key_code(code)
                .ok_or_else(|| format!("key code {code} has no known mapping"))?;
            self.machine.key_press(character);
        }
        self.timed_keys.insert(code, duration);
        Ok(())
    }

    pub fn key_press(&mut self, ch: char) {
        self.machine.key_press(ch);
    }

    pub fn type_text(&mut self, text: &str) {
        self.queue_typed_text(text);
    }

    pub fn focus_change(&mut self, has_focus: bool) {
        if !has_focus {
            self.release_timed_keys();
        }
        self.machine.focus_change(has_focus);
    }

    pub fn sound_sample_rate(&self) -> u32 {
        self.machine.sound_sample_rate()
    }

    pub fn take_audio_samples(&mut self) -> Vec<f32> {
        self.machine.take_audio_samples()
    }

    pub fn set_breakpoint(&mut self, addr: u16) {
        self.machine.set_breakpoint(addr);
    }

    pub fn clear_breakpoint(&mut self, addr: u16) {
        self.machine.clear_breakpoint(addr);
    }

    pub fn clear_all_breakpoints(&mut self) {
        self.machine.clear_all_breakpoints();
    }

    pub fn get_breakpoints(&self) -> Vec<u16> {
        self.machine.get_breakpoints()
    }

    pub fn instruction_trace(&self) -> &InstructionTrace {
        self.machine.instruction_trace()
    }

    pub fn start_instruction_trace(&mut self, capacity: usize) {
        self.machine.instruction_trace_mut().start(capacity);
    }

    pub fn stop_instruction_trace(&mut self) {
        self.machine.instruction_trace_mut().stop();
    }

    pub fn clear_instruction_trace(&mut self) {
        self.machine.instruction_trace_mut().clear();
    }

    pub fn recent_instruction_trace(&self, limit: usize) -> Vec<InstructionTraceEntry> {
        let entries = self.machine.instruction_trace().entries();
        let start = entries.len().saturating_sub(limit);
        entries.iter().skip(start).cloned().collect()
    }

    pub fn read_mapped_memory(&mut self, addr: u16, len: usize) -> Vec<u8> {
        self.machine.read_mapped(addr, len)
    }

    pub fn write_mapped_memory(&mut self, addr: u16, bytes: &[u8]) {
        self.machine.write_mapped(addr, bytes);
    }

    pub fn write_raw_bank(&mut self, bank: &str, addr: usize, bytes: &[u8]) -> Option<usize> {
        self.machine.write_raw_bank(bank, addr, bytes)
    }

    pub fn set_z80_register(&mut self, name: &str, value: u16) {
        self.machine.z80_mut().set_reg_val(name, value);
    }

    pub fn write_port(&mut self, port: u8, value: u8) -> Result<(), String> {
        let Some(tvc) = self.tvc_mut() else {
            return Err("port writes are currently implemented for TVC only".to_string());
        };
        tvc.bus.write_port(port, value);
        Ok(())
    }

    pub fn disassemble(&mut self, addr: u16, len: usize) -> Vec<DisassembledInstruction> {
        self.machine.disassemble(addr, len)
    }

    pub fn mapping_summary(&self) -> Option<String> {
        let tvc = self.tvc()?;
        let map = tvc.bus.mmu.map_labels();
        Some(format!(
            "MMU {},{},{},{}  paging {:02X}",
            map[0],
            map[1],
            map[2],
            map[3],
            tvc.bus.mmu.get_map_val()
        ))
    }

    /// Physical ROM tracepoints as (bank, bank-offset) pairs; each fires
    /// whenever execution reaches that ROM byte in any paging view.
    pub fn set_tracepoints(&mut self, tracepoints: &[(RomBank, u16)]) {
        if let Some(tvc) = self.tvc_mut() {
            tvc.set_tracepoints(tracepoints);
        }
    }

    pub fn tracepoints_enabled(&self) -> bool {
        self.tvc().is_some_and(Tvc::tracepoints_enabled)
    }

    pub fn take_trace_events(&mut self) -> Vec<ExecutionTrace> {
        self.tvc_mut()
            .map(Tvc::take_trace_events)
            .unwrap_or_default()
    }

    pub fn log_entries(&self) -> &[crate::log::LogEntry] {
        self.tvc().map(Tvc::log_entries).unwrap_or(&[])
    }

    pub fn clear_log(&mut self) {
        if let Some(tvc) = self.tvc_mut() {
            tvc.clear_log();
        }
    }

    pub fn load_z80_bytes(&mut self, data: &[u8]) -> Result<(), String> {
        self.clear_typed_text();
        self.release_timed_keys();
        let mut zx82 = Zx82::new_with_vid_model(self.vid_model());
        load_zx82_rom(&mut zx82)?;
        zx82.load_z80(data)?;
        self.activate_zx82(zx82);
        Ok(())
    }

    pub fn switch_to_zx82(&mut self) -> Result<(), String> {
        self.clear_typed_text();
        self.release_timed_keys();
        let mut zx82 = Zx82::new_with_vid_model(self.vid_model());
        load_zx82_rom(&mut zx82)?;
        self.activate_zx82(zx82);
        Ok(())
    }

    fn activate_zx82(&mut self, zx82: Zx82) {
        self.tvc_fast_boot = self.fast_boot();
        self.machine = Machine::Zx82(zx82);
        self.roms_loaded = true;
        self.loaded_tape = None;
        self.loaded_disk = [None, None];
        self.loaded_tape_file_name = None;
        self.loaded_disk_file_name = [None, None];
    }

    pub fn load_z80_file(&mut self, path: &Path) -> Result<(), String> {
        let data = std::fs::read(path)
            .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
        self.load_z80_bytes(&data)
            .map_err(|error| format!("failed to load {}: {error}", path.display()))
    }

    pub fn tick(&mut self) -> bool {
        if !self.running {
            return false;
        }
        self.advance_typed_text();
        let hit_breakpoint = self.machine.run_frame();
        if !hit_breakpoint {
            self.advance_timed_keys();
        }
        hit_breakpoint
    }

    pub fn reset(&mut self) {
        self.clear_typed_text();
        self.release_timed_keys();
        self.machine.reset();
    }

    fn clear_typed_text(&mut self) {
        if let Some(code) = self.typed_key.take() {
            self.machine.key_up(code);
        }
        self.typed_key_frames = 0;
        self.typed_gap_frames = 0;
        self.typed_text.clear();
    }

    fn queue_typed_text(&mut self, text: &str) {
        self.clear_typed_text();
        self.typed_text.extend(text.chars());
    }

    fn advance_typed_text(&mut self) {
        if let Some(code) = self.typed_key {
            if self.typed_key_frames > 1 {
                self.typed_key_frames -= 1;
                return;
            }
            self.machine.key_up(code);
            self.typed_key = None;
            self.typed_key_frames = 0;
            self.typed_gap_frames = TYPED_KEY_GAP_FRAMES;
            return;
        }
        if self.typed_gap_frames != 0 {
            self.typed_gap_frames -= 1;
            return;
        }
        let Some(ch) = self.typed_text.pop_front() else {
            return;
        };
        let code = ch as u32;
        self.machine.key_down(code);
        if ch != '\r' {
            self.machine.key_press(ch);
        }
        self.typed_key = Some(code);
        self.typed_key_frames = TYPED_KEY_HOLD_FRAMES;
    }

    fn advance_timed_keys(&mut self) {
        let mut released = Vec::new();
        for (&code, remaining) in &mut self.timed_keys {
            if *remaining <= 1 {
                released.push(code);
            } else {
                *remaining -= 1;
            }
        }
        for code in released {
            self.timed_keys.remove(&code);
            self.machine.key_up(code);
        }
    }

    fn release_timed_keys(&mut self) {
        for code in self.timed_keys.drain().map(|(code, _)| code) {
            self.machine.key_up(code);
        }
    }

    pub fn save_snapshot(&self) -> Vec<u8> {
        let Some(tvc) = self.machine.tvc() else {
            return Vec::new();
        };
        let core_snapshot = tvc.save_snapshot();
        let Ok(core_chunks) = snapshot::read_file(&core_snapshot) else {
            return core_snapshot;
        };
        let mut chunks: Vec<_> = core_chunks
            .into_iter()
            .map(|chunk| (chunk.id, chunk.data.to_vec()))
            .collect();
        chunks.push((*b"EMUT", self.machine_type.write_snapshot_chunk()));
        let mut writer = Writer::new();
        writer.string(
            self.progs
                .get(self.selected_prog)
                .map(|entry| entry.file_name.as_str())
                .unwrap_or(""),
        );
        writer.string(self.loaded_disk_file_name[0].as_deref().unwrap_or(""));
        writer.string(self.loaded_disk_file_name[1].as_deref().unwrap_or(""));
        chunks.push((*b"EMUI", writer.into_inner()));
        snapshot::write_file(&chunks)
    }

    pub fn capture_debug_snapshot(&self) -> Result<Vec<u8>, String> {
        if self.system() != System::Tvc {
            return Err("frame history is currently available only for TVC".to_string());
        }
        Ok(self.save_snapshot())
    }

    pub fn restore_debug_snapshot(&mut self, data: &[u8]) -> Result<(), String> {
        self.running = false;
        self.clear_typed_text();
        self.release_timed_keys();
        self.machine.focus_change(false);
        let tvc = self
            .machine
            .tvc_mut()
            .ok_or_else(|| "frame history is currently available only for TVC".to_string())?;
        tvc.load_snapshot(data).map_err(|err| err.to_string())?;
        tvc.refresh_framebuffer_from_state();
        Ok(())
    }

    pub fn load_snapshot(&mut self, data: &[u8]) -> crate::snapshot::Result<()> {
        self.clear_typed_text();
        self.release_timed_keys();
        let fast_boot = self.fast_boot();
        let snapshot_state = Self::read_emu_snapshot_state(data)?;
        #[cfg(target_arch = "wasm32")]
        let snapshot_disks: [Option<WasmRecentFile>; 2] = [
            snapshot_state.loaded_disk_file_names[0]
                .as_ref()
                .and_then(|name| {
                    self.loaded_disk_wasm
                        .iter()
                        .flatten()
                        .chain(self.recent_disks_wasm.iter())
                        .find(|media| recent_media_key(&media.name) == recent_media_key(name))
                        .cloned()
                }),
            snapshot_state.loaded_disk_file_names[1]
                .as_ref()
                .and_then(|name| {
                    self.loaded_disk_wasm
                        .iter()
                        .flatten()
                        .chain(self.recent_disks_wasm.iter())
                        .find(|media| recent_media_key(&media.name) == recent_media_key(name))
                        .cloned()
                }),
        ];
        let machine_type = snapshot_state.machine_type.unwrap_or_else(|| {
            self.machine.tvc().map_or(self.machine_type, |tvc| {
                MachineType::for_snapshot(
                    tvc.is_plus(),
                    tvc.has_hbf(),
                    self.machine_type.rom_version,
                )
            })
        });
        self.machine_type = machine_type;
        self.machine = Machine::Tvc(Tvc::new(machine_type.is_plus));
        self.roms_loaded = false;
        self.load_roms();
        let tvc = self.machine.tvc_mut().expect("new TVC machine");
        tvc.set_fast_boot(fast_boot);
        self.tvc_fast_boot = fast_boot;
        tvc.load_snapshot(data)?;
        self.loaded_tape = None;
        self.loaded_disk = [None, None];
        self.loaded_tape_file_name = None;
        self.loaded_disk_file_name = [None, None];
        #[cfg(target_arch = "wasm32")]
        {
            self.loaded_tape_wasm = None;
            self.loaded_disk_wasm = [None, None];
            self.loaded_tape_was_injected = false;
        }
        if let Some(file_name) = snapshot_state
            .selected_prog_file_name
            .as_deref()
            .filter(|name| !name.is_empty())
        {
            self.select_prog_by_file_name(&file_name);
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let mut any_disk_restored = false;
            for drive in 0..2 {
                if let Some(file_name) = snapshot_state.loaded_disk_file_names[drive].clone() {
                    self.insert_disk_by_file_name_drive(drive, &file_name);
                    any_disk_restored = true;
                }
            }
            if !any_disk_restored {
                self.restore_accessible_selected_media();
            }
        }
        #[cfg(target_arch = "wasm32")]
        {
            let mut any_disk_restored = false;
            for drive in 0..2 {
                if let Some(media) = snapshot_disks[drive].clone() {
                    let _ = self.insert_disk_bytes_drive(drive, &media.name, &media.bytes);
                    any_disk_restored = true;
                }
            }
            if !any_disk_restored {
                self.restore_accessible_selected_media();
            }
        }
        Ok(())
    }

    fn read_emu_snapshot_state(data: &[u8]) -> crate::snapshot::Result<EmuSnapshotState> {
        let chunks = snapshot::read_file(data)?;
        let mut state = EmuSnapshotState::default();
        for chunk in chunks {
            match &chunk.id {
                b"EMUT" => state.machine_type = Some(MachineType::from_snapshot_chunk(chunk.data)?),
                b"EMUI" => {
                    let mut reader = Reader::new(chunk.data);
                    state.selected_prog_file_name = Some(reader.string()?);
                    let disk_file_name_0 = reader.string()?;
                    if !disk_file_name_0.is_empty() {
                        state.loaded_disk_file_names[0] = Some(disk_file_name_0);
                    }
                    // Drive B file name — absent in older snapshots
                    if let Ok(disk_file_name_1) = reader.string() {
                        if !disk_file_name_1.is_empty() {
                            state.loaded_disk_file_names[1] = Some(disk_file_name_1);
                        }
                    }
                }
                _ => {}
            }
        }
        Ok(state)
    }

    pub fn save_snapshot_file(&self, path: &std::path::Path) -> std::io::Result<()> {
        if self.system() != System::Tvc {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Unsupported,
                "project snapshots are not implemented for Zx82; use the original .z80 file",
            ));
        }
        let snapshot = self.save_snapshot();
        if is_zip_path(path) {
            std::fs::write(path, zip_snapshot(&snapshot)?)
        } else {
            std::fs::write(path, snapshot)
        }
    }

    pub fn load_snapshot_file(
        &mut self,
        path: &std::path::Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("z80"))
        {
            return self.load_z80_file(path).map_err(Into::into);
        }
        let mut data = std::fs::read(path)?;
        if is_zip_data(&data) {
            data = unzip_snapshot(&data)?;
        }
        self.load_snapshot(&data)?;
        Ok(())
    }

    pub fn toggle_running(&mut self) {
        self.running = !self.running;
    }

    pub fn debug_step(&mut self, count: u32) {
        self.running = false;
        for _ in 0..count {
            self.machine.debug_step_instruction();
        }
    }

    pub fn debug_run_to_interrupt(&mut self) -> DebugRunToIrqResult {
        self.running = false;
        self.machine.debug_run_to_interrupt()
    }

    pub fn reload(&mut self, machine_type: MachineType) -> Result<(), String> {
        let fast_boot = self.fast_boot();
        #[cfg(target_arch = "wasm32")]
        let loaded_disk = self.loaded_disk_wasm.clone();
        #[cfg(target_arch = "wasm32")]
        let loaded_tape = self.loaded_tape_wasm.clone();
        #[cfg(target_arch = "wasm32")]
        let tape_was_injected = self.loaded_tape_was_injected;

        self.machine_type = machine_type;
        self.machine = Machine::Tvc(Tvc::new(machine_type.is_plus));
        self.machine
            .tvc_mut()
            .expect("new TVC machine")
            .set_fast_boot(fast_boot);
        self.tvc_fast_boot = fast_boot;
        self.roms_loaded = false;
        self.load_roms();

        #[cfg(target_arch = "wasm32")]
        {
            let mut errors = Vec::new();
            for drive in 0..2 {
                if let Some(media) = loaded_disk[drive].clone() {
                    if let Err(err) = self.insert_disk_bytes_drive(drive, &media.name, &media.bytes)
                    {
                        self.loaded_disk[drive] = None;
                        self.loaded_disk_file_name[drive] = None;
                        self.loaded_disk_wasm[drive] = None;
                        errors.push(format!("disk {} restore failed: {err}", drive));
                    }
                }
            }
            if let Some(media) = loaded_tape {
                let result = if tape_was_injected {
                    self.inject_tape_bytes(&media.name, &media.bytes)
                } else {
                    self.play_tape_bytes(&media.name, &media.bytes)
                };
                if let Err(err) = result {
                    self.loaded_tape = None;
                    self.loaded_tape_file_name = None;
                    self.loaded_tape_wasm = None;
                    self.loaded_tape_was_injected = false;
                    errors.push(format!("tape restore failed: {err}"));
                }
            }
            if errors.is_empty() {
                Ok(())
            } else {
                Err(errors.join("; "))
            }
        }

        #[cfg(not(target_arch = "wasm32"))]
        {
            let mut errors = Vec::new();
            for drive in 0..2 {
                if let Some(file_name) = self.loaded_disk_file_name[drive].clone() {
                    if !self.insert_disk_by_file_name_drive(drive, &file_name) {
                        self.loaded_disk[drive] = None;
                        self.loaded_disk_file_name[drive] = None;
                        errors.push(format!("disk {} restore failed: {file_name}", drive));
                    }
                }
            }

            if let Some(file_name) = self.loaded_tape_file_name.clone() {
                let was_injected = self
                    .loaded_tape
                    .as_ref()
                    .map(|s| s.contains("(Injected)"))
                    .unwrap_or(false);
                let restored = if was_injected {
                    self.inject_tape_by_file_name(&file_name)
                } else {
                    let path = Path::new(&file_name);
                    if path.exists() && path.is_file() {
                        self.play_tape_file_path(path).is_ok()
                    } else {
                        let path = data_dir("progs").join(&file_name);
                        self.play_tape_file_path(&path).is_ok()
                    }
                };
                if !restored {
                    self.loaded_tape = None;
                    self.loaded_tape_file_name = None;
                    errors.push(format!("tape restore failed: {file_name}"));
                }
            }
            if errors.is_empty() {
                Ok(())
            } else {
                Err(errors.join("; "))
            }
        }
    }

    pub fn select_prog_by_file_name(&mut self, file_name: &str) -> bool {
        if let Some(index) = self
            .progs
            .iter()
            .position(|entry| entry.file_name == file_name)
        {
            self.selected_prog = index;
            true
        } else {
            false
        }
    }

    fn restore_accessible_selected_media(&mut self) {
        if self.progs.is_empty() || self.selected_prog >= self.progs.len() {
            return;
        }
        if self.progs[self.selected_prog].is_disk {
            self.insert_selected_disk();
        }
    }

    pub fn load_roms(&mut self) {
        #[cfg(target_arch = "wasm32")]
        {
            let roms: &[(&str, &[u8])] = &[
                ("TVC12_D3.64K", include_bytes!("../../roms/TVC12_D3.64K")),
                ("TVC12_D4.64K", include_bytes!("../../roms/TVC12_D4.64K")),
                ("TVC12_D7.64K", include_bytes!("../../roms/TVC12_D7.64K")),
                ("TVC22_D4.64K", include_bytes!("../../roms/TVC22_D4.64K")),
                ("TVC22_D6.64K", include_bytes!("../../roms/TVC22_D6.64K")),
                ("TVC22_D7.64K", include_bytes!("../../roms/TVC22_D7.64K")),
                (
                    "VT-DOS12-DISK.ROM",
                    include_bytes!("../../roms/VT-DOS12-DISK.ROM"),
                ),
            ];
            for name in self.machine_type.rom_files() {
                if let Some((_, data)) = roms.iter().find(|(n, _)| *n == name) {
                    self.tvc_mut().expect("TVC ROM loading").add_rom(name, data);
                }
            }
            self.roms_loaded = true;
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let roms_dir = data_dir("roms");
            if !roms_dir.exists() && roms_dir == Path::new("roms") {
                std::fs::create_dir_all(&roms_dir).ok();
            }
            let mut any_loaded = false;

            for name in self.machine_type.rom_files() {
                match std::fs::read(roms_dir.join(name)) {
                    Ok(data) => {
                        self.tvc_mut()
                            .expect("TVC ROM loading")
                            .add_rom(name, &data);
                        any_loaded = true;
                    }
                    Err(_) => {}
                }
            }

            if any_loaded {
                self.roms_loaded = true;
            }
        }
    }

    pub fn scan_progs(&mut self) {
        #[cfg(target_arch = "wasm32")]
        {
            self.progs.clear();
            self.selected_prog = 0;
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            self.progs.clear();
            let dir = data_dir("progs");
            if !dir.exists() {
                return;
            }
            let mut entries: Vec<_> = match std::fs::read_dir(&dir) {
                Ok(rd) => rd
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        let path = e.path();
                        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                        ext.eq_ignore_ascii_case("zip")
                            || ext.eq_ignore_ascii_case("cas")
                            || ext.eq_ignore_ascii_case("dsk")
                    })
                    .collect(),
                Err(_) => return,
            };
            entries.sort_by_key(|e| e.file_name());
            for entry in entries {
                let file_name = entry.file_name().to_string_lossy().to_string();
                let name = if file_name.to_lowercase().ends_with(".zip") {
                    file_name
                        .strip_suffix(".zip")
                        .unwrap_or(&file_name)
                        .to_string()
                } else {
                    file_name
                        .strip_suffix(".cas")
                        .or_else(|| file_name.strip_suffix(".dsk"))
                        .unwrap_or(&file_name)
                        .to_string()
                };

                let path = dir.join(&file_name);
                let mut is_cas = false;
                let mut is_disk = false;
                if file_name.to_lowercase().ends_with(".cas") {
                    is_cas = true;
                } else if file_name.to_lowercase().ends_with(".dsk") {
                    is_disk = true;
                } else if file_name.to_lowercase().ends_with(".zip") {
                    if let Ok(data) = std::fs::read(&path) {
                        let reader = std::io::Cursor::new(data);
                        if let Ok(mut archive) = zip::ZipArchive::new(reader) {
                            for i in 0..archive.len() {
                                if let Ok(file) = archive.by_index(i) {
                                    let entry_name = file.name().to_lowercase();
                                    if entry_name.ends_with(".cas") {
                                        is_cas = true;
                                    } else if entry_name.ends_with(".dsk") {
                                        is_disk = true;
                                    }
                                    if is_cas && is_disk {
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                self.progs.push(ProgEntry {
                    name,
                    file_name,
                    is_cas,
                    is_disk,
                });
            }
            if self.selected_prog >= self.progs.len() {
                self.selected_prog = 0;
            }
        }
    }

    pub fn load_selected_prog(&mut self) {
        if self
            .progs
            .get(self.selected_prog)
            .map(|entry| entry.is_disk)
            .unwrap_or(false)
        {
            self.insert_selected_disk();
        } else {
            self.inject_selected_tape();
        }
    }

    pub fn inject_selected_tape(&mut self) {
        if self.progs.is_empty() || self.selected_prog >= self.progs.len() {
            return;
        }
        let entry = &self.progs[self.selected_prog];
        if !entry.is_cas {
            return;
        }
        let path = data_dir("progs").join(&entry.file_name);
        if let Err(err) = self.inject_tape_file_path(&path) {
            eprintln!("failed to inject selected tape: {err}");
        }
    }

    pub fn can_inject_tape(&self) -> bool {
        #[cfg(target_arch = "wasm32")]
        if self.loaded_tape_wasm.is_some() {
            return true;
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.loaded_tape_file_name.is_some() {
            return true;
        }

        self.progs
            .get(self.selected_prog)
            .map(|entry| entry.is_cas)
            .unwrap_or(false)
    }

    pub fn inject_tape(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        #[cfg(target_arch = "wasm32")]
        if let Some(media) = self.loaded_tape_wasm.clone() {
            return self.inject_tape_bytes(&media.name, &media.bytes);
        }

        #[cfg(not(target_arch = "wasm32"))]
        if let Some(file_name) = self.loaded_tape_file_name.clone() {
            return self.inject_tape_file_path(Path::new(&file_name));
        }

        let entry = self
            .progs
            .get(self.selected_prog)
            .filter(|entry| entry.is_cas)
            .ok_or("No cassette tape is selected")?;
        let path = data_dir("progs").join(&entry.file_name);
        self.inject_tape_file_path(&path)
    }

    pub fn insert_selected_disk(&mut self) {
        if self.progs.is_empty() || self.selected_prog >= self.progs.len() {
            return;
        }
        let entry = &self.progs[self.selected_prog];
        if !entry.is_disk {
            return;
        }
        let path = data_dir("progs").join(&entry.file_name);
        if let Err(err) = self.insert_disk_file_path_drive(0, &path) {
            eprintln!("failed to insert selected disk: {err}");
        }
    }

    pub fn inject_tape_by_file_name(&mut self, file_name: &str) -> bool {
        let path = Path::new(file_name);
        if path.exists() && path.is_file() {
            if self.inject_tape_file_path(path).is_ok() {
                return true;
            }
        }
        if self.select_prog_by_file_name(file_name) {
            self.inject_selected_tape();
            self.loaded_tape_file_name.as_deref() == Some(file_name)
        } else {
            false
        }
    }

    pub fn insert_disk_by_file_name(&mut self, file_name: &str) -> bool {
        self.insert_disk_by_file_name_drive(0, file_name)
    }

    pub fn insert_disk_by_file_name_drive(&mut self, drive: usize, file_name: &str) -> bool {
        let path = Path::new(file_name);
        if path.exists() && path.is_file() {
            if self.insert_disk_file_path_drive(drive, path).is_ok() {
                return true;
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(recent_path) = self
            .recent_disks
            .iter()
            .find(|recent| {
                recent_media_key(recent) == recent_media_key(file_name)
                    && Path::new(recent).is_file()
            })
            .cloned()
        {
            if self
                .insert_disk_file_path_drive(drive, Path::new(&recent_path))
                .is_ok()
            {
                return true;
            }
        }
        if drive == 0 {
            if self.select_prog_by_file_name(file_name) {
                self.insert_selected_disk();
                self.loaded_disk_file_name[0].as_deref() == Some(file_name)
            } else {
                false
            }
        } else {
            false
        }
    }

    pub fn play_tape(&mut self) {
        if self.progs.is_empty() || self.selected_prog >= self.progs.len() {
            return;
        }
        let entry = &self.progs[self.selected_prog];
        if !entry.is_cas {
            return;
        }
        let path = data_dir("progs").join(&entry.file_name);
        if let Err(err) = self.play_tape_file_path(&path) {
            eprintln!("failed to play selected tape: {err}");
        }
    }

    pub fn play_tape_file_path(&mut self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let (display_name, buf) = read_cas_data(path)?;
        let generator = TapeBitstreamGenerator::new(&buf, &display_name)?;
        self.tvc_mut()
            .ok_or("tape playback is available only on TVC")?
            .bus
            .play_tape(generator);
        self.loaded_tape = Some(display_name);
        let path_str = path.to_string_lossy().to_string();
        self.loaded_tape_file_name = Some(path_str.clone());
        self.add_recent_tape(path_str);
        Ok(())
    }

    pub fn inject_tape_file_path(&mut self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let (display_name, buf) = read_cas_data(path)?;
        if self
            .tvc_mut()
            .ok_or("tape injection is available only on TVC")?
            .load_cas(&buf)
        {
            self.loaded_tape = Some(format!("{} (Injected)", display_name));
            let path_str = path.to_string_lossy().to_string();
            self.loaded_tape_file_name = Some(path_str.clone());
            self.add_recent_tape(path_str);
            Ok(())
        } else {
            Err("Failed to inject CAS data into memory".into())
        }
    }

    pub fn insert_disk_file_path(&mut self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        self.insert_disk_file_path_drive(0, path)
    }

    pub fn insert_disk_file_path_drive(
        &mut self,
        drive: usize,
        path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let (display_name, buf) = read_dsk_data(path)?;
        self.tvc_mut()
            .ok_or("disk loading is available only on TVC")?
            .load_disk(drive, &display_name, &buf);
        self.loaded_disk[drive] = Some(display_name);
        let path_str = path.to_string_lossy().to_string();
        self.loaded_disk_file_name[drive] = Some(path_str.clone());
        self.add_recent_disk(path_str);
        Ok(())
    }

    pub fn eject_disk(&mut self, drive: usize) {
        self.loaded_disk[drive] = None;
        self.loaded_disk_file_name[drive] = None;
        #[cfg(target_arch = "wasm32")]
        {
            self.loaded_disk_wasm[drive] = None;
        }
    }

    pub fn save_disk_bytes(&self, drive: usize) -> Option<Vec<u8>> {
        let tvc = self.tvc()?;
        let ext = tvc.bus.extensions.slot0()?;
        ext.disk_bytes(drive).map(|b| b.to_vec())
    }

    pub fn disk_dirty(&self, drive: usize) -> bool {
        self.tvc().is_some_and(|tvc| tvc.disk_dirty(drive))
    }

    pub fn clear_disk_dirty(&mut self, drive: usize) {
        if let Some(tvc) = self.tvc_mut() {
            tvc.clear_disk_dirty(drive);
        }
    }

    pub fn save_disk_file(
        &mut self,
        drive: usize,
        path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let bytes = self.save_disk_bytes(drive).ok_or("no disk in drive")?;
        std::fs::write(path, bytes)?;
        self.clear_disk_dirty(drive);
        let path_str = path.to_string_lossy().to_string();
        if drive < self.loaded_disk_file_name.len() {
            self.loaded_disk_file_name[drive] = Some(path_str.clone());
            if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
                self.loaded_disk[drive] = Some(file_name.to_string());
            }
        }
        self.add_recent_disk(path_str);
        Ok(())
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn flush_dirty_disk_files(&mut self) -> Vec<String> {
        let mut errors = Vec::new();
        for drive in 0..self.loaded_disk_file_name.len() {
            if !self.disk_dirty(drive) {
                continue;
            }
            let Some(path_str) = self.loaded_disk_file_name[drive].clone() else {
                continue;
            };
            let path = Path::new(&path_str);
            if !path.exists()
                || !path
                    .extension()
                    .and_then(|extension| extension.to_str())
                    .is_some_and(|extension| extension.eq_ignore_ascii_case("dsk"))
            {
                continue;
            }
            let Some(bytes) = self.save_disk_bytes(drive) else {
                continue;
            };
            match std::fs::write(path, bytes) {
                Ok(()) => self.clear_disk_dirty(drive),
                Err(err) => {
                    errors.push(format!("Disk auto-save failed: {}: {err}", path.display()))
                }
            }
        }
        errors
    }

    pub fn stop_tape(&mut self) {
        if let Some(tvc) = self.tvc_mut() {
            tvc.bus.stop_tape();
        }
    }

    pub fn get_current_tape_level(&self) -> f32 {
        if let Some(tvc) = self.tvc()
            && tvc.bus.tape_play_active()
        {
            return tvc.bus.current_tape_level();
        }
        0.5
    }

    pub fn add_recent_tape(&mut self, path_str: String) {
        let key = recent_media_key(&path_str);
        self.recent_tapes
            .retain(|existing| recent_media_key(existing) != key);
        self.recent_tapes.insert(0, path_str);
        self.recent_tapes.truncate(5);
    }

    pub fn add_recent_disk(&mut self, path_str: String) {
        let key = recent_media_key(&path_str);
        self.recent_disks
            .retain(|existing| recent_media_key(existing) != key);
        self.recent_disks.insert(0, path_str);
        self.recent_disks.truncate(5);
    }

    pub fn get_screenshot_png(&self) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
        let frame = self.framebuffer();
        let (out_w, out_h) = match self.system() {
            System::Tvc => (768, 576),
            System::Zx82 => (frame.width * 2, frame.height * 2),
        };

        let mut buf = Vec::new();
        {
            let writer = std::io::Cursor::new(&mut buf);
            let mut encoder = png::Encoder::new(writer, out_w as u32, out_h as u32);
            encoder.set_color(png::ColorType::Rgba);
            encoder.set_depth(png::BitDepth::Eight);
            let mut png_writer = encoder.write_header()?;

            let mut pixels = vec![0; out_w * out_h * 4];
            for y in 0..out_h {
                let src_y = y * frame.height / out_h;
                for x in 0..out_w {
                    let src_x = x * frame.width / out_w;
                    let rgba = frame.pixels[src_y * frame.width + src_x].to_ne_bytes();
                    let offset = (y * out_w + x) * 4;
                    pixels[offset..offset + 4].copy_from_slice(&rgba);
                }
            }

            png_writer.write_image_data(&pixels)?;
        }
        Ok(buf)
    }

    pub fn save_screenshot(&self, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
        let png = self.get_screenshot_png()?;
        std::fs::write(path, png)?;
        Ok(())
    }

    pub fn play_tape_bytes(
        &mut self,
        name: &str,
        bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let (display_name, buf) = unpack_cas_bytes(name, bytes)?;
        let generator = TapeBitstreamGenerator::new(&buf, &display_name)?;
        self.tvc_mut()
            .ok_or("tape playback is available only on TVC")?
            .bus
            .play_tape(generator);
        self.loaded_tape = Some(display_name);
        self.loaded_tape_file_name = Some(name.to_string());
        #[cfg(target_arch = "wasm32")]
        {
            let media = WasmRecentFile {
                name: name.to_string(),
                bytes: bytes.to_vec(),
            };
            self.loaded_tape_wasm = Some(media.clone());
            self.loaded_tape_was_injected = false;
            self.add_recent_tape_wasm(media.name, media.bytes);
        }
        Ok(())
    }

    pub fn inject_tape_bytes(
        &mut self,
        name: &str,
        bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let (display_name, buf) = unpack_cas_bytes(name, bytes)?;
        if self
            .tvc_mut()
            .ok_or("tape injection is available only on TVC")?
            .load_cas(&buf)
        {
            self.loaded_tape = Some(format!("{} (Injected)", display_name));
            self.loaded_tape_file_name = Some(name.to_string());
            #[cfg(target_arch = "wasm32")]
            {
                let media = WasmRecentFile {
                    name: name.to_string(),
                    bytes: bytes.to_vec(),
                };
                self.loaded_tape_wasm = Some(media.clone());
                self.loaded_tape_was_injected = true;
                self.add_recent_tape_wasm(media.name, media.bytes);
            }
            Ok(())
        } else {
            Err("Failed to inject CAS data into memory".into())
        }
    }

    pub fn insert_disk_bytes(
        &mut self,
        name: &str,
        bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.insert_disk_bytes_drive(0, name, bytes)
    }

    pub fn insert_disk_bytes_drive(
        &mut self,
        drive: usize,
        name: &str,
        bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let (display_name, buf) = unpack_dsk_bytes(name, bytes)?;
        self.tvc_mut()
            .ok_or("disk loading is available only on TVC")?
            .load_disk(drive, &display_name, &buf);
        self.loaded_disk[drive] = Some(display_name);
        self.loaded_disk_file_name[drive] = Some(name.to_string());
        #[cfg(target_arch = "wasm32")]
        {
            let media = WasmRecentFile {
                name: name.to_string(),
                bytes: bytes.to_vec(),
            };
            self.loaded_disk_wasm[drive] = Some(media.clone());
            self.add_recent_disk_wasm(media.name, media.bytes);
        }
        Ok(())
    }

    pub fn insert_empty_disk_drive(
        &mut self,
        drive: usize,
        geometry: DiskGeometry,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let mut disk_data = vec![0u8; geometry.bytes];
        let mut cursor = std::io::Cursor::new(&mut disk_data);

        let options = fatfs::FormatVolumeOptions::new()
            .bytes_per_sector(512)
            .bytes_per_cluster(1024)
            .fats(2)
            .max_root_dir_entries(112)
            .total_sectors(geometry.total_sectors)
            .media(geometry.media)
            .sectors_per_track(9)
            .heads(geometry.heads);

        fatfs::format_volume(&mut cursor, options)?;

        // VT-DOS boot sector patch
        cursor.set_position(0);
        let mut boot_sector = [0u8; 512];
        std::io::Read::read_exact(&mut cursor, &mut boot_sector)?;
        boot_sector[0] = 0xEB;
        boot_sector[1] = 0xFE;
        boot_sector[2] = 0x90;
        boot_sector[3..11].copy_from_slice(b"DiskMgr1");
        cursor.set_position(0);
        std::io::Write::write_all(&mut cursor, &boot_sector)?;

        self.tvc_mut()
            .ok_or("disk loading is available only on TVC")?
            .load_disk(drive, geometry.file_name, &disk_data);

        self.loaded_disk[drive] = Some(geometry.file_name.to_string());
        self.loaded_disk_file_name[drive] = None;
        #[cfg(target_arch = "wasm32")]
        {
            let media = WasmRecentFile {
                name: geometry.file_name.to_string(),
                bytes: disk_data,
            };
            self.loaded_disk_wasm[drive] = Some(media.clone());
            self.add_recent_disk_wasm(media.name, media.bytes);
        }
        Ok(())
    }

    pub fn load_game_archive_bytes(
        &mut self,
        file_to_run: &str,
        archive_bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        let bytes = extract_game_archive_member(file_to_run, archive_bytes)?;
        self.start_gamebase_media_bytes(file_to_run, &bytes)
    }

    pub fn start_gamebase_media_bytes(
        &mut self,
        file_to_run: &str,
        bytes: &[u8],
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.load_gamebase_boot()?;
        let lower_name = file_to_run.to_ascii_lowercase();
        if lower_name.ends_with(".cas") {
            self.inject_tape_bytes(file_to_run, bytes)?;
            self.finish_gamebase_start("RUN\r");
        } else if lower_name.ends_with(".dsk") {
            self.insert_disk_bytes(file_to_run, bytes)?;
            self.finish_gamebase_start("LOAD \"*\"\r");
        } else {
            return Err(format!("Unsupported game media: {file_to_run}").into());
        }
        Ok(())
    }

    pub fn start_gamebase_media_file(
        &mut self,
        file_to_run: &str,
        path: &Path,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.load_gamebase_boot()?;
        let lower_name = file_to_run.to_ascii_lowercase();
        if lower_name.ends_with(".cas") {
            self.inject_tape_file_path(path)?;
            self.finish_gamebase_start("RUN\r");
        } else if lower_name.ends_with(".dsk") {
            self.insert_disk_file_path(path)?;
            self.finish_gamebase_start("LOAD \"*\"\r");
        } else {
            return Err(format!("Unsupported game media: {file_to_run}").into());
        }
        Ok(())
    }

    fn load_gamebase_boot(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        self.running = false;
        let snapshot = unzip_snapshot(GAMEBASE_BOOT_SNAPSHOT)?;
        self.load_snapshot(&snapshot)?;
        Ok(())
    }

    fn finish_gamebase_start(&mut self, command: &str) {
        self.queue_typed_text(command);
        self.running = true;
    }

    #[cfg(target_arch = "wasm32")]
    pub fn add_recent_tape_wasm(&mut self, name: String, bytes: Vec<u8>) {
        self.recent_tapes_wasm.retain(|x| x.name != name);
        self.recent_tapes_wasm
            .insert(0, WasmRecentFile { name, bytes });
        self.recent_tapes_wasm.truncate(5);
    }

    #[cfg(target_arch = "wasm32")]
    pub fn add_recent_disk_wasm(&mut self, name: String, bytes: Vec<u8>) {
        self.recent_disks_wasm.retain(|x| x.name != name);
        self.recent_disks_wasm
            .insert(0, WasmRecentFile { name, bytes });
        self.recent_disks_wasm.truncate(5);
    }

    pub fn read_raw_bank(&self, bank: &str, addr: usize, len: usize) -> Option<Vec<u8>> {
        self.tvc()?.bus.mmu.read_raw_bank(bank, addr, len)
    }
}

fn load_zx82_rom(zx82: &mut Zx82) -> Result<(), String> {
    #[cfg(target_arch = "wasm32")]
    let rom = include_bytes!("../../roms/48.rom").as_slice();
    #[cfg(not(target_arch = "wasm32"))]
    let rom = std::fs::read(data_dir("roms").join("48.rom"))
        .map_err(|error| format!("failed to read ZX Spectrum ROM roms/48.rom: {error}"))?;

    zx82.load_rom(&rom)
}

pub fn extract_game_archive_member(
    file_to_run: &str,
    archive_bytes: &[u8],
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let reader = std::io::Cursor::new(archive_bytes);
    let mut archive = zip::ZipArchive::new(reader)?;
    let target_name = file_to_run.replace('\\', "/");
    let target_file_name = target_name.rsplit('/').next().unwrap_or(&target_name);

    for index in 0..archive.len() {
        let mut file = archive.by_index(index)?;
        let entry_name = file.name().replace('\\', "/");
        let entry_file_name = entry_name.rsplit('/').next().unwrap_or(&entry_name);
        if entry_name.eq_ignore_ascii_case(&target_name)
            || entry_file_name.eq_ignore_ascii_case(target_file_name)
        {
            let mut bytes = Vec::new();
            file.read_to_end(&mut bytes)?;
            return Ok(bytes);
        }
    }

    Err(format!("{file_to_run} was not found in the game archive").into())
}

fn recent_media_key(path: &str) -> String {
    Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or(path)
        .to_lowercase()
}

fn data_dir(name: &str) -> PathBuf {
    let cwd_dir = PathBuf::from(name);
    if cwd_dir.exists() {
        return cwd_dir;
    }

    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.join(name)))
        .filter(|path| path.exists())
        .unwrap_or(cwd_dir)
}

fn default_character_for_key_code(code: u32) -> Option<char> {
    match code {
        48..=57 => char::from_u32(code),
        65..=90 => char::from_u32(code + 32),
        _ => None,
    }
}

fn is_zip_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("zip"))
        .unwrap_or(false)
}

pub fn is_zip_data(data: &[u8]) -> bool {
    data.starts_with(b"PK\x03\x04")
}

pub fn zip_snapshot(snapshot: &[u8]) -> std::io::Result<Vec<u8>> {
    let cursor = std::io::Cursor::new(Vec::new());
    let mut archive = zip::ZipWriter::new(cursor);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    archive.start_file("snapshot.rtvcsnap", options)?;
    archive.write_all(snapshot)?;
    Ok(archive.finish()?.into_inner())
}

pub fn unzip_snapshot(data: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let reader = std::io::Cursor::new(data);
    let mut archive = zip::ZipArchive::new(reader)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
        let name = file.name().to_ascii_lowercase();
        if name.ends_with(".rtvcsnap") {
            let mut snapshot = Vec::new();
            file.read_to_end(&mut snapshot)?;
            return Ok(snapshot);
        }
    }

    Err("zip archive does not contain a .rtvcsnap file".into())
}

fn read_cas_data(path: &Path) -> Result<(String, Vec<u8>), Box<dyn std::error::Error>> {
    let file_name = path
        .file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_string();
    let data = std::fs::read(path)?;
    unpack_cas_bytes(&file_name, &data)
}

fn read_dsk_data(path: &Path) -> Result<(String, Vec<u8>), Box<dyn std::error::Error>> {
    let file_name = path
        .file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_string();
    let data = std::fs::read(path)?;
    unpack_dsk_bytes(&file_name, &data)
}

pub fn unpack_cas_bytes(
    file_name: &str,
    data: &[u8],
) -> Result<(String, Vec<u8>), Box<dyn std::error::Error>> {
    if file_name.to_lowercase().ends_with(".cas") {
        Ok((file_name.to_string(), data.to_vec()))
    } else if file_name.to_lowercase().ends_with(".zip") {
        let reader = std::io::Cursor::new(data);
        let mut archive = zip::ZipArchive::new(reader)?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let entry_name = file.name().to_string();
            if entry_name.to_lowercase().ends_with(".cas") {
                let mut buf = Vec::new();
                file.read_to_end(&mut buf)?;
                let display_name = std::path::Path::new(&entry_name)
                    .file_name()
                    .unwrap_or(file.name().as_ref())
                    .to_string_lossy()
                    .to_string();
                return Ok((display_name, buf));
            }
        }
        Err("No .cas file found in zip archive".into())
    } else {
        Err("Unsupported file format (expected .cas or .zip)".into())
    }
}

pub fn unpack_dsk_bytes(
    file_name: &str,
    data: &[u8],
) -> Result<(String, Vec<u8>), Box<dyn std::error::Error>> {
    if file_name.to_lowercase().ends_with(".dsk") {
        Ok((file_name.to_string(), data.to_vec()))
    } else if file_name.to_lowercase().ends_with(".zip") {
        let reader = std::io::Cursor::new(data);
        let mut archive = zip::ZipArchive::new(reader)?;
        for i in 0..archive.len() {
            let mut file = archive.by_index(i)?;
            let entry_name = file.name().to_string();
            if entry_name.to_lowercase().ends_with(".dsk") {
                let mut buf = Vec::new();
                file.read_to_end(&mut buf)?;
                let display_name = std::path::Path::new(&entry_name)
                    .file_name()
                    .unwrap_or(file.name().as_ref())
                    .to_string_lossy()
                    .to_string();
                return Ok((display_name, buf));
            }
        }
        Err("No .dsk file found in zip archive".into())
    } else {
        Err("Unsupported file format (expected .dsk or .zip)".into())
    }
}
