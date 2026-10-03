use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::OnceLock;

use crate::emu::{Emu, RomVersion};
use crate::frame_history::{
    FrameHistory, FrameThumbnail, HistoryMode, MAX_HISTORY_SECONDS, MIN_HISTORY_SECONDS,
    TVC_FRAMES_PER_SECOND,
};
use crate::instruction_trace::{DEFAULT_TRACE_CAPACITY, MAX_TRACE_CAPACITY, MIN_TRACE_CAPACITY};
use crate::machine::System;
use crate::mmu::RomBank;
use eframe::egui::{self, Color32, ColorImage, TextureHandle};
use serde::Deserialize;

const EVENT_LIMIT: usize = 200;
const DISASSEMBLY_BYTES: usize = 96;
const MEMORY_BYTES: usize = 256;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum MemorySource {
    Mapped,
    U0,
    U1,
    U2,
    U3,
    Vid0,
    Vid1,
    Vid2,
    Vid3,
    Sys,
    Cart,
    Exth,
}

impl MemorySource {
    const ALL: [Self; 12] = [
        Self::Mapped,
        Self::U0,
        Self::U1,
        Self::U2,
        Self::U3,
        Self::Vid0,
        Self::Vid1,
        Self::Vid2,
        Self::Vid3,
        Self::Sys,
        Self::Cart,
        Self::Exth,
    ];

    fn label(self) -> &'static str {
        match self {
            Self::Mapped => "Mapped CPU",
            Self::U0 => "U0 RAM",
            Self::U1 => "U1 RAM",
            Self::U2 => "U2 RAM",
            Self::U3 => "U3 RAM",
            Self::Vid0 => "VID0",
            Self::Vid1 => "VID1",
            Self::Vid2 => "VID2",
            Self::Vid3 => "VID3",
            Self::Sys => "SYS ROM",
            Self::Cart => "CART ROM",
            Self::Exth => "EXTH ROM",
        }
    }

    fn bank_name(self) -> Option<&'static str> {
        match self {
            Self::Mapped => None,
            Self::U0 => Some("u0"),
            Self::U1 => Some("u1"),
            Self::U2 => Some("u2"),
            Self::U3 => Some("u3"),
            Self::Vid0 => Some("vid0"),
            Self::Vid1 => Some("vid1"),
            Self::Vid2 => Some("vid2"),
            Self::Vid3 => Some("vid3"),
            Self::Sys => Some("sys"),
            Self::Cart => Some("cart"),
            Self::Exth => Some("exth"),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DebugEventKind {
    Control,
    Breakpoint,
    RomTrace,
}

impl DebugEventKind {
    fn label(self) -> &'static str {
        match self {
            Self::Control => "control",
            Self::Breakpoint => "breakpoint",
            Self::RomTrace => "rom",
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DebugEvent {
    pub sequence: u64,
    pub kind: DebugEventKind,
    pub address: Option<u16>,
    pub bank: Option<RomBank>,
    pub summary: String,
}

pub struct DebuggerUi {
    disassembly_address: u16,
    disassembly_address_text: String,
    follow_pc: bool,
    memory_address: u16,
    memory_address_text: String,
    memory_source: MemorySource,
    breakpoint_address_text: String,
    symbol_search: String,
    trace_rom_landmarks: bool,
    events: VecDeque<DebugEvent>,
    next_event_sequence: u64,
    frame_history: FrameHistory,
    frame_history_textures: HashMap<u64, TextureHandle>,
    frame_history_error: Option<String>,
    frame_history_restored: bool,
    save_history_snapshot_requested: bool,
    instruction_trace_capacity: usize,
}

impl Default for DebuggerUi {
    fn default() -> Self {
        Self {
            disassembly_address: 0,
            disassembly_address_text: "0000".to_string(),
            follow_pc: true,
            memory_address: 0,
            memory_address_text: "0000".to_string(),
            memory_source: MemorySource::Mapped,
            breakpoint_address_text: String::new(),
            symbol_search: String::new(),
            trace_rom_landmarks: false,
            events: VecDeque::new(),
            next_event_sequence: 1,
            frame_history: FrameHistory::default(),
            frame_history_textures: HashMap::new(),
            frame_history_error: None,
            frame_history_restored: false,
            save_history_snapshot_requested: false,
            instruction_trace_capacity: DEFAULT_TRACE_CAPACITY,
        }
    }
}

impl DebuggerUi {
    pub fn capture_history_frame(&mut self, emu: &Emu) -> Result<(), String> {
        if !self.frame_history.is_recording() {
            return Ok(());
        }
        let snapshot = match emu.capture_debug_snapshot() {
            Ok(snapshot) => snapshot,
            Err(error) => {
                self.frame_history.stop();
                self.frame_history_error = Some(error.clone());
                return Err(error);
            }
        };
        let frame = emu.framebuffer();
        let thumbnail = FrameThumbnail::from_framebuffer(frame.pixels, frame.width, frame.height);
        let pc = emu.z80_state().pc;
        self.frame_history.record_frame(snapshot, thumbnail, pc);
        self.prune_history_textures();
        Ok(())
    }

    pub fn take_history_restored(&mut self) -> bool {
        std::mem::take(&mut self.frame_history_restored)
    }

    pub fn take_save_history_snapshot_requested(&mut self) -> bool {
        std::mem::take(&mut self.save_history_snapshot_requested)
    }

    pub fn prepare_history_resume(&mut self) {
        if self.frame_history.branch_from_selected() {
            self.prune_history_textures();
        }
    }

    pub fn draw_frame_history(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        ui.horizontal_wrapped(|ui| {
            if ui
                .add_enabled(
                    !self.frame_history.is_recording() && emu.system() == System::Tvc,
                    egui::Button::new("Record"),
                )
                .clicked()
            {
                self.frame_history.start();
                self.frame_history_textures.clear();
                let _ = self.capture_history_frame(emu);
            }
            if ui
                .add_enabled(self.frame_history.is_recording(), egui::Button::new("Stop"))
                .clicked()
            {
                self.frame_history.stop();
            }
            if ui
                .add_enabled(!self.frame_history.is_empty(), egui::Button::new("Clear"))
                .clicked()
            {
                self.frame_history.clear();
                self.frame_history_textures.clear();
                self.frame_history_error = None;
            }

            ui.separator();
            let mut mode = self.frame_history.mode();
            egui::ComboBox::from_id_salt("frame_history_mode")
                .selected_text(mode.label())
                .show_ui(ui, |ui| {
                    ui.selectable_value(&mut mode, HistoryMode::PerFrame, "Per frame");
                    ui.selectable_value(&mut mode, HistoryMode::LongTerm, "Long term");
                });
            if mode != self.frame_history.mode() {
                self.frame_history.set_mode(mode);
                self.frame_history_textures.clear();
                self.frame_history_error = None;
            }
            if mode == HistoryMode::PerFrame {
                ui.label("History:");
                let mut duration = self.frame_history.duration_seconds();
                if ui
                    .add(
                        egui::DragValue::new(&mut duration)
                            .range(MIN_HISTORY_SECONDS..=MAX_HISTORY_SECONDS)
                            .suffix(" s"),
                    )
                    .changed()
                {
                    self.frame_history.set_duration_seconds(duration);
                    self.prune_history_textures();
                }
            } else {
                ui.label("Latest 1 s: every frame · to 10 s: every second · to 30 s: every 10 s");
            }
        });

        ui.horizontal_wrapped(|ui| {
            let can_back = self
                .frame_history
                .selected_index()
                .is_some_and(|index| index > 0);
            let can_forward = self
                .frame_history
                .selected_index()
                .is_some_and(|index| index + 1 < self.frame_history.len());
            let can_live = self
                .frame_history
                .selected_offset()
                .is_some_and(|offset| offset != 0);

            if ui
                .add_enabled(can_back, egui::Button::new("Back Snapshot"))
                .clicked()
                && self.frame_history.select_previous()
            {
                self.restore_selected_history_frame(emu);
            }
            if ui
                .add_enabled(can_forward, egui::Button::new("Forward Snapshot"))
                .clicked()
                && self.frame_history.select_next()
            {
                self.restore_selected_history_frame(emu);
            }
            if ui
                .add_enabled(can_live, egui::Button::new("Return to Live"))
                .clicked()
                && self.frame_history.select_latest()
            {
                self.restore_selected_history_frame(emu);
            }
            ui.separator();
            ui.strong(history_position_label(self.frame_history.selected_offset()));
            ui.label(format!(
                "{} / {} snapshots, {}",
                self.frame_history.len(),
                self.frame_history.capacity(),
                format_memory_size(self.frame_history.memory_bytes())
            ));
        });

        ui.horizontal_wrapped(|ui| {
            if ui
                .add_enabled(
                    !self.frame_history.is_empty(),
                    egui::Button::new("Save Selected Snapshot..."),
                )
                .clicked()
            {
                self.save_history_snapshot_requested = true;
            }
            if emu.system() != System::Tvc {
                ui.label("Frame history is currently available only for TVC.");
            }
            if let Some(error) = &self.frame_history_error {
                ui.colored_label(Color32::LIGHT_RED, error);
            }
        });
        ui.separator();

        self.ensure_history_textures(ui.ctx());
        let selected = self.frame_history.selected_index();
        let mut clicked = None;
        let thumbnail_rows = self.frame_history.thumbnail_rows();
        egui::ScrollArea::both()
            .id_salt("frame_history_timeline")
            .auto_shrink([false, false])
            .show(ui, |ui| {
                ui.vertical(|ui| {
                    for row in thumbnail_rows {
                        ui.horizontal(|ui| {
                            for index in row {
                                let frame = &self.frame_history.frames()[index];
                                let Some(texture) = self.frame_history_textures.get(&frame.id)
                                else {
                                    continue;
                                };
                                let offset = self.frame_history.frame_offset(index).unwrap_or(0);
                                let label = if offset == 0 {
                                    format!("Live  PC {:04X}", frame.pc)
                                } else {
                                    format!(
                                        "{}  PC {:04X}",
                                        history_position_label(Some(offset)),
                                        frame.pc
                                    )
                                };
                                ui.vertical(|ui| {
                                    let image = egui::Image::new(texture)
                                        .fit_to_exact_size(egui::vec2(160.0, 76.0));
                                    let response = ui.add(
                                        egui::ImageButton::new(image)
                                            .selected(selected == Some(index))
                                            .frame(true),
                                    );
                                    if response.clicked() {
                                        clicked = Some(index);
                                    }
                                    ui.small(label);
                                });
                            }
                        });
                    }
                });
            });
        if let Some(index) = clicked {
            if self.frame_history.select(index) {
                self.restore_selected_history_frame(emu);
            }
        }
    }

    pub fn draw_instruction_trace(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        let recording = emu.instruction_trace().is_recording();
        ui.horizontal_wrapped(|ui| {
            if ui
                .add_enabled(!recording, egui::Button::new("Record"))
                .on_hover_text("Clear the old trace and begin recording instructions")
                .clicked()
            {
                emu.start_instruction_trace(self.instruction_trace_capacity);
            }
            if ui
                .add_enabled(recording, egui::Button::new("Stop"))
                .clicked()
            {
                emu.stop_instruction_trace();
            }
            if ui.button("Clear").clicked() {
                emu.clear_instruction_trace();
            }
            ui.separator();
            ui.label("Capacity:");
            ui.add_enabled(
                !recording,
                egui::DragValue::new(&mut self.instruction_trace_capacity)
                    .range(MIN_TRACE_CAPACITY..=MAX_TRACE_CAPACITY)
                    .speed(1_000),
            );
            let trace = emu.instruction_trace();
            ui.label(format!(
                "{} / {} instructions",
                trace.len(),
                trace.capacity()
            ));
        });
        ui.small(
            "Newest first. Registers and opcode bytes are captured before execution; writes include an interrupt accepted immediately after that instruction.",
        );
        ui.separator();

        let trace = emu.instruction_trace();
        if trace.is_empty() {
            ui.label(if trace.is_recording() {
                "Recording; waiting for the next instruction."
            } else {
                "No instruction trace recorded."
            });
            return;
        }

        let entries = trace.entries();
        egui::ScrollArea::vertical()
            .auto_shrink([false; 2])
            .show_rows(ui, 20.0, entries.len(), |ui, rows| {
                for row in rows {
                    let entry = &entries[entries.len() - 1 - row];
                    let instruction =
                        crate::disasm::disassemble_captured(entry.pc(), &entry.opcode);
                    ui.horizontal(|ui| {
                        ui.monospace(format!("#{:08}", entry.sequence));
                        if ui
                            .link(format!("{:04X}", entry.pc()))
                            .on_hover_text("Show this address in Disassembly")
                            .clicked()
                        {
                            self.follow_pc = false;
                            self.set_disassembly_address(entry.pc());
                        }
                        ui.monospace(format_bytes(&instruction.bytes, 4));
                        ui.monospace(format!("{:<20}", instruction.text));
                        let r = entry.registers;
                        ui.monospace(format!(
                            "AF={:04X} BC={:04X} DE={:04X} HL={:04X} SP={:04X}",
                            r.af, r.bc, r.de, r.hl, r.sp
                        ));
                        if let Some(map) = entry.main_map {
                            ui.monospace(format!(
                                "M={map:02X} V={:02X}",
                                entry.video_map.unwrap_or(0)
                            ));
                        }
                        for write in &entry.effects.memory_writes {
                            ui.colored_label(
                                Color32::LIGHT_GREEN,
                                format!("[{:04X}]={:02X}", write.addr, write.value),
                            );
                        }
                        for write in &entry.effects.port_writes {
                            ui.colored_label(
                                Color32::LIGHT_BLUE,
                                format!("OUT({:04X})={:02X}", write.port, write.value),
                            );
                        }
                        if entry.interrupt_accepted {
                            ui.colored_label(Color32::LIGHT_YELLOW, "IRQ");
                        }
                    });
                }
            });
    }

    fn restore_selected_history_frame(&mut self, emu: &mut Emu) {
        let Some(snapshot) = self
            .frame_history
            .selected()
            .map(|frame| frame.snapshot.clone())
        else {
            return;
        };
        match emu.restore_debug_snapshot(&snapshot) {
            Ok(()) => {
                self.frame_history_error = None;
                self.frame_history_restored = true;
            }
            Err(error) => self.frame_history_error = Some(error),
        }
    }

    fn ensure_history_textures(&mut self, ctx: &egui::Context) {
        for frame in self.frame_history.frames() {
            self.frame_history_textures
                .entry(frame.id)
                .or_insert_with(|| {
                    ctx.load_texture(
                        format!("frame-history-{}", frame.id),
                        thumbnail_image(&frame.thumbnail),
                        egui::TextureOptions::LINEAR,
                    )
                });
        }
        self.prune_history_textures();
    }

    fn prune_history_textures(&mut self) {
        let retained: HashSet<u64> = self
            .frame_history
            .frames()
            .iter()
            .map(|frame| frame.id)
            .collect();
        self.frame_history_textures
            .retain(|id, _| retained.contains(id));
    }

    pub fn draw_cpu(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        let mut state_changed = false;
        ui.horizontal(|ui| {
            if ui
                .button(if emu.running { "Pause" } else { "Run" })
                .clicked()
            {
                if !emu.running {
                    self.prepare_history_resume();
                }
                emu.running = !emu.running;
                self.record_control(if emu.running { "Continued" } else { "Paused" });
                state_changed = true;
            }
            if ui.button("Step").clicked() {
                self.prepare_history_resume();
                emu.debug_step(1);
                self.record_control("Stepped 1 instruction");
                state_changed = true;
            }
            if ui.button("Step 10").clicked() {
                self.prepare_history_resume();
                emu.debug_step(10);
                self.record_control("Stepped 10 instructions");
                state_changed = true;
            }
            if ui
                .button("Run to IRQ")
                .on_hover_text("Run until the Z80 accepts an interrupt")
                .clicked()
            {
                self.prepare_history_resume();
                let result = emu.debug_run_to_interrupt();
                if result.interrupt_accepted {
                    self.record_control(&format!(
                        "Ran {} cycles to interrupt",
                        result.elapsed_cycles
                    ));
                } else {
                    self.record_control(&format!(
                        "No interrupt accepted within {} cycles",
                        result.elapsed_cycles
                    ));
                }
                state_changed = true;
            }
            if ui.button("Reset").clicked() {
                emu.reset();
                emu.running = false;
                self.record_control("Reset and paused");
                state_changed = true;
            }
        });
        // The CPU pane may be drawn after the disassembly pane in a docked
        // workspace. Redraw immediately after a debugger action so Follow PC
        // observes the post-step state instead of waiting for the idle timer.
        if state_changed {
            ui.ctx().request_repaint();
        }
        ui.separator();

        egui::ScrollArea::vertical().show(ui, |ui| {
            let state = emu.z80_state();
            let registers = [
                ("PC", state.get_reg16(11)),
                ("SP", state.get_reg16(10)),
                ("AF", state.get_reg16(0)),
                ("BC", state.get_reg16(1)),
                ("DE", state.get_reg16(2)),
                ("HL", state.get_reg16(3)),
                ("IX", state.get_reg16(4)),
                ("IY", state.get_reg16(5)),
                ("AF'", state.get_reg16(6)),
                ("BC'", state.get_reg16(7)),
                ("DE'", state.get_reg16(8)),
                ("HL'", state.get_reg16(9)),
            ];
            egui::Grid::new("debug_cpu_registers")
                .num_columns(4)
                .striped(true)
                .show(ui, |ui| {
                    for chunk in registers.chunks(2) {
                        for (name, value) in chunk {
                            ui.strong(*name);
                            ui.monospace(format!("{value:04X}"));
                        }
                        ui.end_row();
                    }
                });

            let flags = state.get_reg16(0) as u8;
            ui.horizontal_wrapped(|ui| {
                ui.strong("Flags");
                for (mask, name) in [
                    (0x80, "S"),
                    (0x40, "Z"),
                    (0x10, "H"),
                    (0x04, "P/V"),
                    (0x02, "N"),
                    (0x01, "C"),
                ] {
                    ui.label(format!("{name}:{}", u8::from(flags & mask != 0)));
                }
            });
            ui.label(format!(
                "IM {}  IFF1 {}  IFF2 {}  HALT {}",
                state.im,
                state.iff1,
                state.iff2,
                u8::from(state.halted != 0)
            ));
            if let Some(tvc) = emu.tvc() {
                let start_address = tvc.bus.vid.display_start_address();
                let (address, raster_line) = tvc.bus.vid.cursor_interrupt_setup();
                let raster_line =
                    raster_line.map_or_else(|| "?".to_string(), |line| line.to_string());
                ui.monospace(format!(
                    "VID START {start_address:04X}  IRQ {address:04X}/{raster_line}"
                ));
            }
            let mapping = emu
                .mapping_summary()
                .unwrap_or_else(|| "fixed 16K ROM + 48K RAM".to_string());
            ui.monospace(format!("Clock {}  {mapping}", emu.clock()));
            if let Some(symbol) = current_symbol(emu) {
                ui.separator();
                ui.strong(format!("{} ({})", symbol.name, symbol.bank.name()));
                ui.label(&symbol.summary);
            }
        });
    }

    pub fn draw_disassembly(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        let pc = emu.z80_state().get_reg16(11);
        if self.follow_pc {
            self.set_disassembly_address(pc);
        }
        ui.horizontal(|ui| {
            ui.checkbox(&mut self.follow_pc, "Follow PC");
            ui.label("Address");
            let response = ui.add(
                egui::TextEdit::singleline(&mut self.disassembly_address_text)
                    .desired_width(70.0)
                    .font(egui::TextStyle::Monospace),
            );
            if response.lost_focus()
                && ui.input(|input| input.key_pressed(egui::Key::Enter))
                && let Some(address) = parse_address(&self.disassembly_address_text)
            {
                self.disassembly_address = address;
                self.follow_pc = false;
                self.disassembly_address_text = format!("{address:04X}");
            }
            if ui.button("PC").clicked() {
                self.follow_pc = true;
                self.set_disassembly_address(pc);
            }
        });

        let instructions = emu.disassemble(self.disassembly_address, DISASSEMBLY_BYTES);
        let breakpoints = emu.get_breakpoints();
        egui::ScrollArea::vertical()
            .auto_shrink([false; 2])
            .show(ui, |ui| {
                for instruction in instructions {
                    let at_pc = instruction.addr == pc;
                    let has_breakpoint = breakpoints.binary_search(&instruction.addr).is_ok();
                    let symbol = symbol_at_mapped_address(emu, instruction.addr);
                    let background = at_pc.then_some(egui::Color32::from_rgb(35, 70, 105));
                    egui::Frame::NONE
                        .fill(background.unwrap_or(egui::Color32::TRANSPARENT))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                let marker = if has_breakpoint { "●" } else { "○" };
                                if ui
                                    .small_button(marker)
                                    .on_hover_text("Toggle breakpoint")
                                    .clicked()
                                {
                                    if has_breakpoint {
                                        emu.clear_breakpoint(instruction.addr);
                                    } else {
                                        emu.set_breakpoint(instruction.addr);
                                    }
                                }
                                ui.monospace(format!("{:04X}", instruction.addr));
                                ui.monospace(format_bytes(&instruction.bytes, 4));
                                let response = ui.monospace(&instruction.text);
                                let mut details = Vec::new();
                                if let Some(t_states) = instruction.t_states {
                                    details.push(format!("{t_states} T"));
                                }
                                if let Some(flags) = instruction.flags {
                                    details.push(format!("flags {flags}"));
                                }
                                if let Some(effect) = instruction.effect {
                                    details.push(effect.to_string());
                                }
                                if !details.is_empty() {
                                    response.on_hover_text(details.join("\n"));
                                }
                            });
                            if let Some(symbol) = symbol {
                                ui.horizontal(|ui| {
                                    ui.add_space(28.0);
                                    ui.colored_label(
                                        egui::Color32::from_rgb(130, 190, 255),
                                        format!("{}: {}", symbol.name, symbol.summary),
                                    );
                                });
                            }
                        });
                }
            });
    }

    pub fn draw_memory(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        if emu.system() != System::Tvc {
            self.memory_source = MemorySource::Mapped;
        }
        ui.horizontal(|ui| {
            egui::ComboBox::from_id_salt("debug_memory_source")
                .selected_text(self.memory_source.label())
                .show_ui(ui, |ui| {
                    for source in MemorySource::ALL {
                        ui.selectable_value(&mut self.memory_source, source, source.label());
                    }
                });
            ui.label("Address");
            let response = ui.add(
                egui::TextEdit::singleline(&mut self.memory_address_text)
                    .desired_width(70.0)
                    .font(egui::TextStyle::Monospace),
            );
            if response.lost_focus()
                && ui.input(|input| input.key_pressed(egui::Key::Enter))
                && let Some(address) = parse_address(&self.memory_address_text)
            {
                self.set_memory_address(address);
            }
            if ui.button("PC").clicked() {
                self.set_memory_address(emu.z80_state().get_reg16(11));
                self.memory_source = MemorySource::Mapped;
            }
            if ui.button("SP").clicked() {
                self.set_memory_address(emu.z80_state().get_reg16(10));
                self.memory_source = MemorySource::Mapped;
            }
        });

        let bytes = if let Some(bank) = self.memory_source.bank_name() {
            emu.read_raw_bank(bank, self.memory_address as usize, MEMORY_BYTES)
        } else {
            Some(emu.read_mapped_memory(self.memory_address, MEMORY_BYTES))
        };

        egui::ScrollArea::both()
            .auto_shrink([false; 2])
            .show(ui, |ui| match bytes {
                Some(bytes) if !bytes.is_empty() => {
                    ui.set_min_width(650.0);
                    for (row, chunk) in bytes.chunks(16).enumerate() {
                        let address = self.memory_address.wrapping_add((row * 16) as u16);
                        let hex = chunk
                            .iter()
                            .map(|byte| format!("{byte:02X}"))
                            .collect::<Vec<_>>()
                            .join(" ");
                        let ascii: String = chunk
                            .iter()
                            .map(|byte| {
                                if byte.is_ascii_graphic() {
                                    *byte as char
                                } else {
                                    '.'
                                }
                            })
                            .collect();
                        ui.monospace(format!("{address:04X}  {hex:<47}  {ascii}"));
                    }
                }
                Some(_) => {
                    ui.label("Address is outside this bank.");
                }
                None => {
                    ui.label("This bank is not available on the selected machine.");
                }
            });
    }

    pub fn draw_breakpoints(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        ui.horizontal(|ui| {
            ui.label("Address");
            let response = ui.add(
                egui::TextEdit::singleline(&mut self.breakpoint_address_text)
                    .desired_width(80.0)
                    .font(egui::TextStyle::Monospace),
            );
            let submit =
                response.lost_focus() && ui.input(|input| input.key_pressed(egui::Key::Enter));
            if (ui.button("Add").clicked() || submit)
                && let Some(address) = parse_address(&self.breakpoint_address_text)
            {
                emu.set_breakpoint(address);
                self.breakpoint_address_text = format!("{address:04X}");
            }
            if ui.button("Clear All").clicked() {
                emu.clear_all_breakpoints();
            }
        });
        ui.separator();

        let breakpoints = emu.get_breakpoints();
        if breakpoints.is_empty() {
            ui.label("No execution breakpoints.");
            return;
        }
        egui::ScrollArea::vertical().show(ui, |ui| {
            for address in breakpoints {
                ui.horizontal(|ui| {
                    if ui.small_button("×").clicked() {
                        emu.clear_breakpoint(address);
                    }
                    if ui
                        .link(format!("{address:04X}"))
                        .on_hover_text("Show in disassembly")
                        .clicked()
                    {
                        self.follow_pc = false;
                        self.set_disassembly_address(address);
                    }
                    if let Some(symbol) = symbol_at_mapped_address(emu, address) {
                        ui.label(&symbol.name);
                    }
                });
            }
        });
    }

    pub fn draw_rom_symbols(&mut self, ui: &mut egui::Ui, emu: &mut Emu) {
        if emu.system() != System::Tvc {
            ui.label("ROM symbols are currently available only for TVC BASIC 1.2.");
            return;
        }
        if emu.machine_type.rom_version != RomVersion::V1_2 {
            ui.label("A ROM symbol database for BASIC 2.2 is not available yet.");
            return;
        }
        ui.add(
            egui::TextEdit::singleline(&mut self.symbol_search)
                .hint_text("Search name, summary, tag, address...")
                .desired_width(f32::INFINITY),
        );
        ui.separator();
        let search = self.symbol_search.trim().to_ascii_lowercase();
        egui::ScrollArea::vertical()
            .auto_shrink([false; 2])
            .show(ui, |ui| {
                for symbol in rom_symbols()
                    .iter()
                    .filter(|symbol| symbol.matches(&search))
                {
                    ui.horizontal(|ui| {
                        if ui.small_button("Disasm").clicked() {
                            self.follow_pc = false;
                            self.set_disassembly_address(symbol.address);
                        }
                        if ui.small_button("Memory").clicked() {
                            self.memory_source = match symbol.bank {
                                RomBank::Sys => MemorySource::Sys,
                                RomBank::Exth => MemorySource::Exth,
                            };
                            self.set_memory_address(symbol.offset);
                        }
                        if ui.small_button("BP").clicked() {
                            emu.set_breakpoint(symbol.address);
                        }
                        ui.monospace(format!("{}:{:04X}", symbol.bank.name(), symbol.address));
                        ui.strong(&symbol.name);
                        if !symbol.alt_names.is_empty() {
                            ui.weak(format!("(aka {})", symbol.alt_names.join(", ")));
                        }
                    });
                    ui.label(&symbol.summary);
                    if !symbol.input.is_empty() || !symbol.output.is_empty() {
                        ui.horizontal_wrapped(|ui| {
                            if !symbol.input.is_empty() {
                                ui.label(format!("In: {}", symbol.input));
                            }
                            if !symbol.output.is_empty() {
                                ui.label(format!("Out: {}", symbol.output));
                            }
                        });
                    }
                    ui.separator();
                }
            });
    }

    pub fn draw_events(&mut self, ui: &mut egui::Ui, emu: &Emu) {
        ui.horizontal(|ui| {
            ui.checkbox(&mut self.trace_rom_landmarks, "Trace ROM landmarks");
            if ui.small_button("Clear").clicked() {
                self.events.clear();
            }
        });
        if emu.system() != System::Tvc {
            ui.label("ROM tracing is currently available only for TVC.");
        } else if emu.machine_type.rom_version != RomVersion::V1_2 {
            ui.label("ROM tracing requires the BASIC 1.2 symbol database.");
        }
        ui.separator();
        egui::ScrollArea::vertical()
            .stick_to_bottom(true)
            .auto_shrink([false; 2])
            .show(ui, |ui| {
                for event in &self.events {
                    ui.horizontal_wrapped(|ui| {
                        ui.monospace(format!("#{:04}", event.sequence));
                        ui.strong(event.kind.label());
                        if let Some(address) = event.address {
                            if let Some(bank) = event.bank {
                                ui.monospace(format!("{}:{address:04X}", bank.name()));
                            } else {
                                ui.monospace(format!("{address:04X}"));
                            }
                        }
                        ui.label(&event.summary);
                    });
                }
            });
    }

    pub fn record_breakpoint_hit(&mut self, pc: u16, emu: &Emu) {
        let symbol = symbol_at_mapped_address(emu, pc);
        let bank = emu.tvc().and_then(|tvc| tvc.bus.mmu.mapped_rom_bank(pc));
        let summary = symbol
            .map(|symbol| format!("Hit {}", symbol.name))
            .unwrap_or_else(|| "Execution breakpoint hit".to_string());
        self.push_event(DebugEventKind::Breakpoint, Some(pc), bank, summary);
        self.follow_pc = true;
    }

    pub fn drain_trace_events(&mut self, emu: &mut Emu) {
        for event in emu.take_trace_events() {
            let symbol = symbol_at(event.bank, event.offset);
            let summary = symbol
                .map(|symbol| format!("{}: {}", symbol.name, symbol.summary))
                .unwrap_or_else(|| "ROM tracepoint".to_string());
            self.push_event(
                DebugEventKind::RomTrace,
                Some(event.pc),
                Some(event.bank),
                summary,
            );
        }
    }

    pub fn update_tracing(&mut self, emu: &mut Emu, events_visible: bool) {
        let should_trace = events_visible
            && self.trace_rom_landmarks
            && emu.system() == System::Tvc
            && emu.machine_type.rom_version == RomVersion::V1_2;
        if should_trace == emu.tracepoints_enabled() {
            return;
        }
        if should_trace {
            // Tracepoints are (bank, bank-offset) pairs, so each landmark
            // fires in whatever paging view the CPU reaches it through.
            let tracepoints: Vec<_> = rom_symbols()
                .iter()
                .filter(|symbol| symbol.usage.iter().any(|usage| usage == "trace"))
                .map(|symbol| (symbol.bank, symbol.offset))
                .collect();
            emu.set_tracepoints(&tracepoints);
        } else {
            emu.set_tracepoints(&[]);
        }
    }

    fn record_control(&mut self, summary: &str) {
        self.push_event(DebugEventKind::Control, None, None, summary.to_string());
    }

    fn push_event(
        &mut self,
        kind: DebugEventKind,
        address: Option<u16>,
        bank: Option<RomBank>,
        summary: String,
    ) {
        self.events.push_back(DebugEvent {
            sequence: self.next_event_sequence,
            kind,
            address,
            bank,
            summary,
        });
        self.next_event_sequence += 1;
        while self.events.len() > EVENT_LIMIT {
            self.events.pop_front();
        }
    }

    fn set_disassembly_address(&mut self, address: u16) {
        self.disassembly_address = address;
        self.disassembly_address_text = format!("{address:04X}");
    }

    fn set_memory_address(&mut self, address: u16) {
        self.memory_address = address;
        self.memory_address_text = format!("{address:04X}");
    }
}

#[derive(Deserialize)]
struct RomSymbolDocument {
    symbols: Vec<RomSymbolRaw>,
}

#[derive(Deserialize)]
struct RomSymbolRaw {
    bank: String,
    address: String,
    offset: String,
    name: String,
    #[serde(default)]
    alt_names: Vec<String>,
    #[serde(default)]
    usage: Vec<String>,
    summary: String,
    #[serde(default)]
    input: String,
    #[serde(default)]
    output: String,
    #[serde(default)]
    tags: Vec<String>,
}

#[derive(Debug)]
struct RomSymbol {
    bank: RomBank,
    address: u16,
    offset: u16,
    name: String,
    /// Other stacked labels for the same physical byte.
    alt_names: Vec<String>,
    usage: Vec<String>,
    summary: String,
    input: String,
    output: String,
    tags: Vec<String>,
}

impl RomSymbol {
    fn matches(&self, search: &str) -> bool {
        search.is_empty()
            || self.name.to_ascii_lowercase().contains(search)
            || self
                .alt_names
                .iter()
                .any(|name| name.to_ascii_lowercase().contains(search))
            || self.summary.to_ascii_lowercase().contains(search)
            || self
                .tags
                .iter()
                .any(|tag| tag.to_ascii_lowercase().contains(search))
            || format!("{:04x}", self.address).contains(search)
            || self.bank.name().contains(search)
    }
}

fn rom_symbols() -> &'static [RomSymbol] {
    static SYMBOLS: OnceLock<Vec<RomSymbol>> = OnceLock::new();
    SYMBOLS.get_or_init(|| {
        let document: RomSymbolDocument =
            serde_json::from_str(include_str!("../../roms/rom_symbols_1_2.json"))
                .expect("embedded ROM symbol database must be valid");
        document
            .symbols
            .into_iter()
            .filter_map(|symbol| {
                let bank = match symbol.bank.as_str() {
                    "sys" => RomBank::Sys,
                    "exth" => RomBank::Exth,
                    _ => return None,
                };
                Some(RomSymbol {
                    bank,
                    address: parse_address(&symbol.address)?,
                    offset: parse_address(&symbol.offset)?,
                    name: symbol.name,
                    alt_names: symbol.alt_names,
                    usage: symbol.usage,
                    summary: symbol.summary,
                    input: symbol.input,
                    output: symbol.output,
                    tags: symbol.tags,
                })
            })
            .collect()
    })
}

fn current_symbol(emu: &Emu) -> Option<&'static RomSymbol> {
    symbol_at_mapped_address(emu, emu.z80_state().get_reg16(11))
}

fn symbol_at_mapped_address(emu: &Emu, address: u16) -> Option<&'static RomSymbol> {
    if emu.system() != System::Tvc || emu.machine_type.rom_version != RomVersion::V1_2 {
        return None;
    }
    let (bank, offset) = emu.tvc()?.bus.mmu.mapped_rom_offset(address)?;
    symbol_at(bank, offset)
}

/// Offset-keyed lookup: (physical bank, image offset) is the stable identity
/// of a ROM byte across all paging views.
fn symbol_at(bank: RomBank, offset: u16) -> Option<&'static RomSymbol> {
    let index = rom_symbol_index();
    index
        .get(&(bank, offset))
        .and_then(|position| rom_symbols().get(*position))
}

fn rom_symbol_index() -> &'static HashMap<(RomBank, u16), usize> {
    static INDEX: OnceLock<HashMap<(RomBank, u16), usize>> = OnceLock::new();
    INDEX.get_or_init(|| {
        rom_symbols()
            .iter()
            .enumerate()
            .map(|(position, symbol)| ((symbol.bank, symbol.offset), position))
            .collect()
    })
}

fn parse_address(text: &str) -> Option<u16> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    let (digits, radix) = if let Some(value) = trimmed
        .strip_prefix("0x")
        .or_else(|| trimmed.strip_prefix("0X"))
    {
        (value, 16)
    } else if let Some(value) = trimmed.strip_prefix('$') {
        (value, 16)
    } else if let Some(value) = trimmed
        .strip_suffix('H')
        .or_else(|| trimmed.strip_suffix('h'))
    {
        (value, 16)
    } else {
        (trimmed, 16)
    };
    u16::from_str_radix(digits, radix).ok()
}

fn format_bytes(bytes: &[u8], width: usize) -> String {
    let mut text = bytes
        .iter()
        .map(|byte| format!("{byte:02X}"))
        .collect::<Vec<_>>()
        .join(" ");
    while text.len() < width * 3 - 1 {
        text.push(' ');
    }
    text
}

fn history_position_label(offset: Option<isize>) -> String {
    match offset {
        Some(0) => "Live".to_string(),
        Some(-1) => "-1 frame".to_string(),
        Some(offset) => format!(
            "{offset} frames ({:.2} s)",
            offset as f64 / TVC_FRAMES_PER_SECOND as f64
        ),
        None => "No frames".to_string(),
    }
}

fn format_memory_size(bytes: usize) -> String {
    if bytes < 1024 * 1024 {
        format!("{:.1} KiB", bytes as f64 / 1024.0)
    } else {
        format!("{:.1} MiB", bytes as f64 / (1024.0 * 1024.0))
    }
}

fn thumbnail_image(thumbnail: &FrameThumbnail) -> ColorImage {
    let pixels = thumbnail
        .pixels
        .iter()
        .copied()
        .map(|pixel| {
            Color32::from_rgba_unmultiplied(
                pixel as u8,
                (pixel >> 8) as u8,
                (pixel >> 16) as u8,
                (pixel >> 24) as u8,
            )
        })
        .collect();
    ColorImage {
        size: [thumbnail.width, thumbnail.height],
        pixels,
    }
}

#[cfg(test)]
#[path = "debug_ui_tests.rs"]
mod tests;
