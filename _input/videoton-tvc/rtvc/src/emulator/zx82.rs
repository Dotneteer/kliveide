#![allow(dead_code)]

use std::collections::{HashMap, HashSet};

use crate::bus::CpuBus;
use crate::instruction_trace::{
    InstructionEffects, InstructionTrace, InstructionTraceEntry, TraceRegisters,
};
use crate::vid::VidModel;
use crate::z80::Z80;

pub const CPU_CLOCK_HZ: u64 = 3_500_000;
pub const FRAME_CLOCKS: u64 = 69_888;
pub const FRAMEBUFFER_WIDTH: usize = 352;
pub const FRAMEBUFFER_HEIGHT: usize = 296;

const ROM_SIZE: usize = 0x4000;
const RAM_SIZE: usize = 0xC000;
const Z80_BASE_HEADER_SIZE: usize = 30;
const Z80_PAGE_SIZE: usize = 0x4000;
const ACTIVE_WIDTH: usize = 256;
const ACTIVE_HEIGHT: usize = 192;
const LEFT_BORDER: usize = (FRAMEBUFFER_WIDTH - ACTIVE_WIDTH) / 2;
const TOP_BORDER: usize = (FRAMEBUFFER_HEIGHT - ACTIVE_HEIGHT) / 2;

#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
struct MatrixKey {
    row: usize,
    column: usize,
}

pub struct Zx82Bus {
    rom: [u8; ROM_SIZE],
    ram: [u8; RAM_SIZE],
    keyboard: [u8; 8],
    ula_latch: u8,
    ear_input: bool,
    instruction_effects: Option<InstructionEffects>,
}

impl Zx82Bus {
    pub fn new() -> Self {
        Self {
            rom: [0; ROM_SIZE],
            ram: [0; RAM_SIZE],
            keyboard: [0x1F; 8],
            ula_latch: 0,
            ear_input: false,
            instruction_effects: None,
        }
    }

    pub fn reset(&mut self) {
        self.keyboard = [0x1F; 8];
        self.ula_latch = 0;
        self.ear_input = false;
        self.instruction_effects = None;
    }

    pub fn clear_ram(&mut self) {
        self.ram.fill(0);
    }

    pub fn load_rom(&mut self, data: &[u8]) -> Result<(), String> {
        if data.len() != ROM_SIZE {
            return Err(format!(
                "ZX Spectrum 48K ROM must be {ROM_SIZE} bytes, got {}",
                data.len()
            ));
        }
        self.rom.copy_from_slice(data);
        Ok(())
    }

    pub fn rom(&self) -> &[u8] {
        &self.rom
    }

    pub fn ram(&self) -> &[u8] {
        &self.ram
    }

    pub fn ram_mut(&mut self) -> &mut [u8] {
        &mut self.ram
    }

    pub fn border_color(&self) -> u8 {
        self.ula_latch & 0x07
    }

    pub fn speaker_level(&self) -> bool {
        self.ula_latch & 0x10 != 0
    }

    pub fn set_ear_input(&mut self, high: bool) {
        self.ear_input = high;
    }

    pub fn set_border_color(&mut self, color: u8) {
        self.ula_latch = (self.ula_latch & !0x07) | (color & 0x07);
    }

    pub fn set_key(&mut self, row: usize, column: usize, pressed: bool) {
        if row >= self.keyboard.len() || column >= 5 {
            return;
        }
        let mask = 1u8 << column;
        if pressed {
            self.keyboard[row] &= !mask;
        } else {
            self.keyboard[row] |= mask;
        }
    }

    fn read_ula(&self, high_addr: u8) -> u8 {
        let mut columns = 0x1F;
        for row in 0..8 {
            if high_addr & (1 << row) == 0 {
                columns &= self.keyboard[row];
            }
        }
        0xA0 | ((self.ear_input as u8) << 6) | columns
    }

    fn begin_instruction_effects(&mut self) {
        self.instruction_effects = Some(InstructionEffects::default());
    }

    fn take_instruction_effects(&mut self) -> InstructionEffects {
        self.instruction_effects.take().unwrap_or_default()
    }
}

impl Default for Zx82Bus {
    fn default() -> Self {
        Self::new()
    }
}

impl CpuBus for Zx82Bus {
    fn r8(&mut self, addr: u16) -> u8 {
        if addr < 0x4000 {
            self.rom[addr as usize]
        } else {
            self.ram[addr as usize - 0x4000]
        }
    }

    fn w8(&mut self, addr: u16, val: u8) {
        if addr >= 0x4000 {
            if let Some(effects) = &mut self.instruction_effects {
                effects.record_memory_write(addr, val);
            }
            self.ram[addr as usize - 0x4000] = val;
        }
    }

    fn out8(&mut self, port: u8, val: u8, high_addr: u8) {
        if let Some(effects) = &mut self.instruction_effects {
            effects.record_port_write(u16::from_be_bytes([high_addr, port]), val);
        }
        if port & 1 == 0 {
            self.ula_latch = val;
        }
    }

    fn in8(&mut self, port: u8, high_addr: u8) -> u8 {
        if port & 1 == 0 {
            self.read_ula(high_addr)
        } else {
            0xFF
        }
    }
}

pub struct Zx82 {
    pub bus: Zx82Bus,
    pub z80: Z80,
    pub framebuffer: Vec<u32>,
    pub frame_complete: bool,
    vid_model: VidModel,
    clock: u64,
    next_frame_clock: u64,
    frame_counter: u64,
    last_frame_interrupt_accepted: bool,
    breakpoints: HashSet<u16>,
    pressed_bindings: HashMap<u32, Vec<MatrixKey>>,
    matrix_key_counts: [[u8; 5]; 8],
    pending_key_release: Vec<MatrixKey>,
    instruction_trace: InstructionTrace,
}

impl Zx82 {
    pub fn new() -> Self {
        Self::new_with_vid_model(VidModel::FastFrame)
    }

    pub fn new_with_vid_model(vid_model: VidModel) -> Self {
        let mut machine = Self {
            bus: Zx82Bus::new(),
            z80: Z80::new(),
            framebuffer: vec![0xFF000000; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT],
            frame_complete: false,
            vid_model,
            clock: 0,
            next_frame_clock: FRAME_CLOCKS,
            frame_counter: 0,
            last_frame_interrupt_accepted: false,
            breakpoints: HashSet::new(),
            pressed_bindings: HashMap::new(),
            matrix_key_counts: [[0; 5]; 8],
            pending_key_release: Vec::new(),
            instruction_trace: InstructionTrace::default(),
        };
        machine.reset();
        machine
    }

    pub fn reset(&mut self) {
        self.z80.reset();
        self.bus.reset();
        self.clock = 0;
        self.next_frame_clock = FRAME_CLOCKS;
        self.frame_counter = 0;
        self.last_frame_interrupt_accepted = false;
        self.release_all_keys();
        self.instruction_trace.clear();
        self.draw_full_frame();
        self.frame_complete = true;
    }

    pub fn hard_reset(&mut self) {
        self.bus.clear_ram();
        self.reset();
    }

    pub fn load_rom(&mut self, data: &[u8]) -> Result<(), String> {
        self.bus.load_rom(data)
    }

    pub fn load_z80(&mut self, data: &[u8]) -> Result<(), String> {
        if data.len() < Z80_BASE_HEADER_SIZE {
            return Err(format!(
                "Z80 snapshot must contain at least {Z80_BASE_HEADER_SIZE} bytes, got {}",
                data.len()
            ));
        }
        if data[29] & 0x03 > 2 {
            return Err(format!(
                "invalid Z80 interrupt mode {} in snapshot",
                data[29] & 0x03
            ));
        }

        let base_pc = read_word(data, 6);
        let (pc, ram) = if base_pc != 0 {
            let flags = normalized_z80_flags(data[12]);
            let memory = &data[Z80_BASE_HEADER_SIZE..];
            let ram = if flags & 0x20 != 0 {
                decompress_z80(memory, RAM_SIZE, true)?
            } else {
                if memory.len() != RAM_SIZE {
                    return Err(format!(
                        "uncompressed Z80 v1 memory must be {RAM_SIZE} bytes, got {}",
                        memory.len()
                    ));
                }
                memory.to_vec()
            };
            (base_pc, ram)
        } else {
            load_z80_extended_memory(data)?
        };

        let flags = normalized_z80_flags(data[12]);
        self.bus.ram_mut().copy_from_slice(&ram);
        self.restore_z80_registers(data, pc);
        self.bus.reset();
        self.bus.set_border_color((flags >> 1) & 0x07);
        self.clock = 0;
        self.next_frame_clock = FRAME_CLOCKS;
        self.frame_counter = 0;
        self.last_frame_interrupt_accepted = false;
        self.draw_full_frame();
        self.frame_complete = true;
        self.instruction_trace.clear();
        Ok(())
    }

    fn restore_z80_registers(&mut self, data: &[u8], pc: u16) {
        let state = &mut self.z80.state;
        state.set_reg16(0, u16::from_be_bytes([data[0], data[1]]));
        state.set_reg16(1, read_word(data, 2));
        state.set_reg16(3, read_word(data, 4));
        state.set_reg16(10, read_word(data, 8));
        state.set_reg8(20, data[10]);

        let flags = normalized_z80_flags(data[12]);
        state.set_reg8(21, (data[11] & 0x7F) | ((flags & 0x01) << 7));
        state.set_reg16(2, read_word(data, 13));
        state.set_reg16(7, read_word(data, 15));
        state.set_reg16(8, read_word(data, 17));
        state.set_reg16(9, read_word(data, 19));
        state.set_reg16(6, u16::from_be_bytes([data[21], data[22]]));
        state.set_reg16(5, read_word(data, 23));
        state.set_reg16(4, read_word(data, 25));
        state.set_reg16(11, pc);
        state.iff1 = (data[27] != 0) as u8;
        state.iff2 = (data[28] != 0) as u8;
        state.im = data[29] & 0x03;
        state.halted = 0;
    }

    pub fn vid_model(&self) -> VidModel {
        self.vid_model
    }

    pub fn set_vid_model(&mut self, vid_model: VidModel) {
        self.vid_model = vid_model;
    }

    pub fn clock(&self) -> u64 {
        self.clock
    }

    pub fn frame_counter(&self) -> u64 {
        self.frame_counter
    }

    pub fn last_frame_interrupt_accepted(&self) -> bool {
        self.last_frame_interrupt_accepted
    }

    pub fn instruction_trace(&self) -> &InstructionTrace {
        &self.instruction_trace
    }

    pub fn instruction_trace_mut(&mut self) -> &mut InstructionTrace {
        &mut self.instruction_trace
    }

    pub fn set_breakpoint(&mut self, addr: u16) {
        self.breakpoints.insert(addr);
    }

    pub fn clear_breakpoint(&mut self, addr: u16) {
        self.breakpoints.remove(&addr);
    }

    pub fn clear_all_breakpoints(&mut self) {
        self.breakpoints.clear();
    }

    pub fn get_breakpoints(&self) -> Vec<u16> {
        let mut list: Vec<_> = self.breakpoints.iter().copied().collect();
        list.sort_unstable();
        list
    }

    pub fn debug_step_instruction(&mut self) -> u32 {
        let elapsed = self.step_instruction();
        self.release_pending_keys();
        self.draw_full_frame();
        self.frame_complete = true;
        elapsed
    }

    pub fn debug_run_to_interrupt(&mut self, max_cycles: u32) -> (u32, bool) {
        let mut elapsed = 0;
        self.last_frame_interrupt_accepted = false;
        while elapsed < max_cycles && !self.last_frame_interrupt_accepted {
            elapsed = elapsed.saturating_add(self.step_instruction());
        }
        self.release_pending_keys();
        self.draw_full_frame();
        self.frame_complete = true;
        (elapsed, self.last_frame_interrupt_accepted)
    }

    pub fn run_for_a_frame(&mut self) -> bool {
        let frame_target = self.next_frame_clock;
        let mut hit_breakpoint = false;
        while self.clock < frame_target {
            self.step_instruction();
            if self.breakpoints.contains(&self.z80.state.pc) {
                hit_breakpoint = true;
                break;
            }
        }

        self.release_pending_keys();
        if hit_breakpoint {
            self.draw_full_frame();
            self.frame_complete = true;
        }
        hit_breakpoint
    }

    fn step_instruction(&mut self) -> u32 {
        let trace_entry = self.instruction_trace.is_recording().then(|| {
            let pc = self.z80.state.pc;
            let opcode = std::array::from_fn(|offset| self.bus.r8(pc.wrapping_add(offset as u16)));
            self.bus.begin_instruction_effects();
            InstructionTraceEntry {
                sequence: 0,
                clock: self.clock,
                registers: TraceRegisters::from(&self.z80.state),
                opcode,
                main_map: None,
                video_map: None,
                elapsed_cycles: 0,
                interrupt_accepted: false,
                effects: InstructionEffects::default(),
            }
        });
        let cpu_cycles = self.z80.step(&mut self.bus, 0);
        self.clock += cpu_cycles as u64;
        let irq_cycles = if self.clock >= self.next_frame_clock {
            self.finish_frame()
        } else {
            0
        };
        if let Some(mut entry) = trace_entry {
            entry.elapsed_cycles = cpu_cycles + irq_cycles;
            entry.interrupt_accepted = irq_cycles != 0;
            entry.effects = self.bus.take_instruction_effects();
            self.instruction_trace.record(entry);
        }
        cpu_cycles + irq_cycles
    }

    fn finish_frame(&mut self) -> u32 {
        let irq_cycles = self.z80.irq(&mut self.bus);
        self.last_frame_interrupt_accepted = irq_cycles != 0;
        self.clock += irq_cycles as u64;
        self.next_frame_clock += FRAME_CLOCKS;
        self.frame_counter += 1;
        // Interleaved timing remains a selectable model, but initially shares
        // the complete-frame renderer until raster effects are implemented.
        self.draw_full_frame();
        self.frame_complete = true;
        irq_cycles
    }

    pub fn key_down(&mut self, code: u32) -> bool {
        if self.pressed_bindings.contains_key(&code) {
            return true;
        }
        let Some(binding) = binding_for_code(code) else {
            return false;
        };
        for key in &binding {
            self.press_matrix_key(*key);
        }
        self.pressed_bindings.insert(code, binding);
        true
    }

    pub fn key_up(&mut self, code: u32) {
        if let Some(binding) = self.pressed_bindings.remove(&code) {
            for key in binding {
                self.release_matrix_key(key);
            }
        }
    }

    pub fn key_press(&mut self, ch: char) {
        self.release_pending_keys();
        if let Some(binding) = binding_for_char(ch) {
            for key in &binding {
                self.press_matrix_key(*key);
            }
            self.pending_key_release = binding;
        }
    }

    pub fn focus_change(&mut self, has_focus: bool) {
        if !has_focus {
            self.release_all_keys();
        }
    }

    fn press_matrix_key(&mut self, key: MatrixKey) {
        let count = &mut self.matrix_key_counts[key.row][key.column];
        *count = count.saturating_add(1);
        self.bus.set_key(key.row, key.column, true);
    }

    fn release_matrix_key(&mut self, key: MatrixKey) {
        let count = &mut self.matrix_key_counts[key.row][key.column];
        *count = count.saturating_sub(1);
        if *count == 0 {
            self.bus.set_key(key.row, key.column, false);
        }
    }

    fn release_pending_keys(&mut self) {
        for key in std::mem::take(&mut self.pending_key_release) {
            self.release_matrix_key(key);
        }
    }

    fn release_all_keys(&mut self) {
        self.pressed_bindings.clear();
        self.pending_key_release.clear();
        self.matrix_key_counts = [[0; 5]; 8];
        for row in 0..8 {
            for column in 0..5 {
                self.bus.set_key(row, column, false);
            }
        }
    }

    pub fn draw_full_frame(&mut self) {
        let border = spectrum_color(self.bus.border_color(), false);
        self.framebuffer.fill(border);

        let flash_invert = (self.frame_counter / 16) & 1 != 0;
        let ram = self.bus.ram();

        for y in 0..ACTIVE_HEIGHT {
            let bitmap_offset = ((y & 0xC0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2);
            let attribute_row = (y >> 3) * 32;
            let output_row = (TOP_BORDER + y) * FRAMEBUFFER_WIDTH + LEFT_BORDER;

            for byte_x in 0..32 {
                let pixels = ram[bitmap_offset + byte_x];
                let attribute = ram[0x1800 + attribute_row + byte_x];
                let bright = attribute & 0x40 != 0;
                let invert = attribute & 0x80 != 0 && flash_invert;
                let ink = spectrum_color(attribute & 0x07, bright);
                let paper = spectrum_color((attribute >> 3) & 0x07, bright);

                for bit in 0..8 {
                    let set = pixels & (0x80 >> bit) != 0;
                    let use_ink = set ^ invert;
                    self.framebuffer[output_row + byte_x * 8 + bit] =
                        if use_ink { ink } else { paper };
                }
            }
        }
    }
}

const fn matrix_key(row: usize, column: usize) -> MatrixKey {
    MatrixKey { row, column }
}

const CAPS_SHIFT: MatrixKey = matrix_key(0, 0);
const SYMBOL_SHIFT: MatrixKey = matrix_key(7, 1);

fn binding_for_code(code: u32) -> Option<Vec<MatrixKey>> {
    let key = match code {
        16 => CAPS_SHIFT,
        17 | 18 | 225 => SYMBOL_SHIFT,
        8 | 46 => return Some(vec![CAPS_SHIFT, matrix_key(4, 0)]),
        13 => matrix_key(6, 0),
        32 => matrix_key(7, 0),
        37 => return Some(vec![CAPS_SHIFT, matrix_key(3, 4)]),
        38 => return Some(vec![CAPS_SHIFT, matrix_key(4, 3)]),
        39 => return Some(vec![CAPS_SHIFT, matrix_key(4, 2)]),
        40 => return Some(vec![CAPS_SHIFT, matrix_key(4, 4)]),
        48 => matrix_key(4, 0),
        49 => matrix_key(3, 0),
        50 => matrix_key(3, 1),
        51 => matrix_key(3, 2),
        52 => matrix_key(3, 3),
        53 => matrix_key(3, 4),
        54 => matrix_key(4, 4),
        55 => matrix_key(4, 3),
        56 => matrix_key(4, 2),
        57 => matrix_key(4, 1),
        65 => matrix_key(1, 0),
        66 => matrix_key(7, 4),
        67 => matrix_key(0, 3),
        68 => matrix_key(1, 2),
        69 => matrix_key(2, 2),
        70 => matrix_key(1, 3),
        71 => matrix_key(1, 4),
        72 => matrix_key(6, 4),
        73 => matrix_key(5, 2),
        74 => matrix_key(6, 3),
        75 => matrix_key(6, 2),
        76 => matrix_key(6, 1),
        77 => matrix_key(7, 2),
        78 => matrix_key(7, 3),
        79 => matrix_key(5, 1),
        80 => matrix_key(5, 0),
        81 => matrix_key(2, 0),
        82 => matrix_key(2, 3),
        83 => matrix_key(1, 1),
        84 => matrix_key(2, 4),
        85 => matrix_key(5, 3),
        86 => matrix_key(0, 4),
        87 => matrix_key(2, 1),
        88 => matrix_key(0, 2),
        89 => matrix_key(5, 4),
        90 => matrix_key(0, 1),
        _ => return None,
    };
    Some(vec![key])
}

fn binding_for_char(ch: char) -> Option<Vec<MatrixKey>> {
    if ch.is_ascii_alphabetic() {
        return binding_for_code(ch.to_ascii_uppercase() as u32);
    }
    if ch.is_ascii_digit() || matches!(ch, '\r' | ' ') {
        return binding_for_code(ch as u32);
    }
    Some(match ch {
        '"' => vec![SYMBOL_SHIFT, matrix_key(5, 0)],
        ';' => vec![SYMBOL_SHIFT, matrix_key(5, 1)],
        ':' => vec![SYMBOL_SHIFT, matrix_key(0, 1)],
        ',' => vec![SYMBOL_SHIFT, matrix_key(7, 3)],
        '.' => vec![SYMBOL_SHIFT, matrix_key(7, 2)],
        '/' => vec![SYMBOL_SHIFT, matrix_key(0, 4)],
        '-' => vec![SYMBOL_SHIFT, matrix_key(6, 3)],
        '+' => vec![SYMBOL_SHIFT, matrix_key(6, 2)],
        '=' => vec![SYMBOL_SHIFT, matrix_key(6, 1)],
        _ => return None,
    })
}

impl Default for Zx82 {
    fn default() -> Self {
        Self::new()
    }
}

fn spectrum_color(color: u8, bright: bool) -> u32 {
    if color & 0x07 == 0 {
        return 0xFF000000;
    }
    let level = if bright { 0xFF } else { 0xCD };
    let r = if color & 0x02 != 0 { level } else { 0 };
    let g = if color & 0x04 != 0 { level } else { 0 };
    let b = if color & 0x01 != 0 { level } else { 0 };
    0xFF000000 | ((b as u32) << 16) | ((g as u32) << 8) | r as u32
}

fn read_word(data: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([data[offset], data[offset + 1]])
}

fn normalized_z80_flags(flags: u8) -> u8 {
    if flags == 0xFF { 1 } else { flags }
}

fn load_z80_extended_memory(data: &[u8]) -> Result<(u16, Vec<u8>), String> {
    if data.len() < 32 {
        return Err("Z80 v2/v3 snapshot is missing its extended header".to_string());
    }
    let header_len = read_word(data, 30) as usize;
    if !matches!(header_len, 23 | 54 | 55) {
        return Err(format!(
            "unsupported Z80 extended header length {header_len}"
        ));
    }
    let block_start = 32usize
        .checked_add(header_len)
        .ok_or_else(|| "Z80 extended header length overflow".to_string())?;
    if data.len() < block_start {
        return Err("truncated Z80 extended header".to_string());
    }

    let hardware_mode = data[34];
    if hardware_mode != 0 {
        return Err(format!(
            "unsupported Z80 hardware mode {hardware_mode}; Zx82 accepts only plain 48K snapshots"
        ));
    }
    if data.get(37).is_some_and(|flags| flags & 0x80 != 0) {
        return Err("unsupported modified 16K Z80 hardware mode".to_string());
    }

    let mut ram = vec![0; RAM_SIZE];
    let mut loaded_pages = 0u8;
    let mut offset = block_start;
    while offset < data.len() {
        if data.len() - offset < 3 {
            return Err("truncated Z80 memory block header".to_string());
        }
        let compressed_len = read_word(data, offset);
        let page = data[offset + 2];
        offset += 3;

        let ram_offset = match page {
            8 => 0,
            4 => Z80_PAGE_SIZE,
            5 => Z80_PAGE_SIZE * 2,
            _ => {
                return Err(format!("unsupported Z80 page {page} in plain 48K snapshot"));
            }
        };
        let page_bit = match page {
            8 => 1,
            4 => 2,
            5 => 4,
            _ => unreachable!(),
        };
        if loaded_pages & page_bit != 0 {
            return Err(format!("duplicate Z80 memory page {page}"));
        }

        let page_data = if compressed_len == 0xFFFF {
            let end = offset
                .checked_add(Z80_PAGE_SIZE)
                .ok_or_else(|| "Z80 page length overflow".to_string())?;
            if end > data.len() {
                return Err(format!("truncated uncompressed Z80 page {page}"));
            }
            let decoded = data[offset..end].to_vec();
            offset = end;
            decoded
        } else {
            let compressed_len = compressed_len as usize;
            let end = offset
                .checked_add(compressed_len)
                .ok_or_else(|| "Z80 page length overflow".to_string())?;
            if end > data.len() {
                return Err(format!("truncated compressed Z80 page {page}"));
            }
            let decoded = decompress_z80(&data[offset..end], Z80_PAGE_SIZE, false)?;
            offset = end;
            decoded
        };

        ram[ram_offset..ram_offset + Z80_PAGE_SIZE].copy_from_slice(&page_data);
        loaded_pages |= page_bit;
    }

    if loaded_pages != 0x07 {
        return Err(format!(
            "incomplete 48K Z80 snapshot: expected pages 4, 5, and 8, mask is 0x{loaded_pages:02X}"
        ));
    }
    Ok((read_word(data, 32), ram))
}

fn decompress_z80(data: &[u8], expected_len: usize, v1: bool) -> Result<Vec<u8>, String> {
    let mut output = Vec::with_capacity(expected_len);
    let mut offset = 0;

    while output.len() < expected_len {
        if v1
            && data
                .get(offset..offset + 4)
                .is_some_and(|bytes| bytes == [0x00, 0xED, 0xED, 0x00])
        {
            break;
        }
        let Some(&byte) = data.get(offset) else {
            return Err(format!(
                "truncated Z80 compressed data at {} of {expected_len} output bytes",
                output.len()
            ));
        };
        if byte == 0xED && data.get(offset + 1) == Some(&0xED) {
            let count = *data
                .get(offset + 2)
                .ok_or_else(|| "truncated Z80 run length".to_string())?;
            let value = *data
                .get(offset + 3)
                .ok_or_else(|| "truncated Z80 run value".to_string())?;
            let count = if count == 0 { 256 } else { count as usize };
            if output.len() + count > expected_len {
                return Err("Z80 compressed run exceeds expected memory size".to_string());
            }
            output.resize(output.len() + count, value);
            offset += 4;
        } else {
            output.push(byte);
            offset += 1;
        }
    }

    if output.len() != expected_len {
        return Err(format!(
            "Z80 compressed data produced {} bytes, expected {expected_len}",
            output.len()
        ));
    }
    Ok(output)
}

#[cfg(test)]
#[path = "zx82_tests.rs"]
mod tests;
