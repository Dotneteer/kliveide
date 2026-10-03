use std::collections::VecDeque;

use crate::z80::Z80State;

pub const DEFAULT_TRACE_CAPACITY: usize = 100_000;
pub const MIN_TRACE_CAPACITY: usize = 1_000;
pub const MAX_TRACE_CAPACITY: usize = 1_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(
    any(feature = "native", feature = "wasm-full"),
    derive(serde::Serialize)
)]
pub struct TraceRegisters {
    pub af: u16,
    pub bc: u16,
    pub de: u16,
    pub hl: u16,
    pub ix: u16,
    pub iy: u16,
    pub sp: u16,
    pub pc: u16,
    pub af_alt: u16,
    pub bc_alt: u16,
    pub de_alt: u16,
    pub hl_alt: u16,
    pub i: u8,
    pub r: u8,
    pub im: u8,
    pub iff1: bool,
    pub iff2: bool,
    pub halted: bool,
}

impl From<&Z80State> for TraceRegisters {
    fn from(state: &Z80State) -> Self {
        Self {
            af: state.get_reg16(0),
            bc: state.get_reg16(1),
            de: state.get_reg16(2),
            hl: state.get_reg16(3),
            ix: state.get_reg16(4),
            iy: state.get_reg16(5),
            af_alt: state.get_reg16(6),
            bc_alt: state.get_reg16(7),
            de_alt: state.get_reg16(8),
            hl_alt: state.get_reg16(9),
            sp: state.get_reg16(10),
            pc: state.get_reg16(11),
            i: state.get_reg8(20),
            r: state.get_reg8(21),
            im: state.im,
            iff1: state.iff1 != 0,
            iff2: state.iff2 != 0,
            halted: state.halted != 0,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(
    any(feature = "native", feature = "wasm-full"),
    derive(serde::Serialize)
)]
pub struct TraceMemoryWrite {
    pub addr: u16,
    pub value: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[cfg_attr(
    any(feature = "native", feature = "wasm-full"),
    derive(serde::Serialize)
)]
pub struct TracePortWrite {
    pub port: u16,
    pub value: u8,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
#[cfg_attr(
    any(feature = "native", feature = "wasm-full"),
    derive(serde::Serialize)
)]
pub struct InstructionEffects {
    pub memory_writes: Vec<TraceMemoryWrite>,
    pub port_writes: Vec<TracePortWrite>,
}

impl InstructionEffects {
    pub fn record_memory_write(&mut self, addr: u16, value: u8) {
        self.memory_writes.push(TraceMemoryWrite { addr, value });
    }

    pub fn record_port_write(&mut self, port: u16, value: u8) {
        self.port_writes.push(TracePortWrite { port, value });
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[cfg_attr(
    any(feature = "native", feature = "wasm-full"),
    derive(serde::Serialize)
)]
pub struct InstructionTraceEntry {
    pub sequence: u64,
    pub clock: u64,
    pub registers: TraceRegisters,
    pub opcode: [u8; 4],
    pub main_map: Option<u8>,
    pub video_map: Option<u8>,
    pub elapsed_cycles: u32,
    pub interrupt_accepted: bool,
    pub effects: InstructionEffects,
}

impl InstructionTraceEntry {
    pub fn pc(&self) -> u16 {
        self.registers.pc
    }
}

pub struct InstructionTrace {
    entries: VecDeque<InstructionTraceEntry>,
    capacity: usize,
    recording: bool,
    next_sequence: u64,
}

impl Default for InstructionTrace {
    fn default() -> Self {
        Self {
            entries: VecDeque::new(),
            capacity: DEFAULT_TRACE_CAPACITY,
            recording: false,
            next_sequence: 1,
        }
    }
}

impl InstructionTrace {
    pub fn start(&mut self, capacity: usize) {
        self.capacity = capacity.clamp(MIN_TRACE_CAPACITY, MAX_TRACE_CAPACITY);
        self.clear();
        self.recording = true;
    }

    pub fn stop(&mut self) {
        self.recording = false;
    }

    pub fn clear(&mut self) {
        self.entries.clear();
        self.next_sequence = 1;
    }

    pub fn is_recording(&self) -> bool {
        self.recording
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    pub fn entries(&self) -> &VecDeque<InstructionTraceEntry> {
        &self.entries
    }

    pub fn record(&mut self, mut entry: InstructionTraceEntry) {
        if !self.recording {
            return;
        }
        entry.sequence = self.next_sequence;
        self.next_sequence = self.next_sequence.wrapping_add(1).max(1);
        if self.entries.len() == self.capacity {
            self.entries.pop_front();
        }
        self.entries.push_back(entry);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(pc: u16) -> InstructionTraceEntry {
        InstructionTraceEntry {
            sequence: 0,
            clock: 0,
            registers: TraceRegisters {
                af: 0,
                bc: 0,
                de: 0,
                hl: 0,
                ix: 0,
                iy: 0,
                sp: 0,
                pc,
                af_alt: 0,
                bc_alt: 0,
                de_alt: 0,
                hl_alt: 0,
                i: 0,
                r: 0,
                im: 0,
                iff1: false,
                iff2: false,
                halted: false,
            },
            opcode: [0; 4],
            main_map: None,
            video_map: None,
            elapsed_cycles: 0,
            interrupt_accepted: false,
            effects: InstructionEffects::default(),
        }
    }

    #[test]
    fn records_only_while_enabled_and_assigns_sequences() {
        let mut trace = InstructionTrace::default();
        trace.record(entry(1));
        assert!(trace.is_empty());

        trace.start(MIN_TRACE_CAPACITY);
        trace.record(entry(2));
        trace.record(entry(3));
        trace.stop();
        trace.record(entry(4));

        assert_eq!(trace.len(), 2);
        assert_eq!(trace.entries()[0].sequence, 1);
        assert_eq!(trace.entries()[1].sequence, 2);
    }

    #[test]
    fn start_clamps_capacity_and_clears_old_entries() {
        let mut trace = InstructionTrace::default();
        trace.start(1);
        trace.record(entry(1));
        trace.start(MAX_TRACE_CAPACITY + 1);

        assert_eq!(trace.capacity(), MAX_TRACE_CAPACITY);
        assert!(trace.is_empty());
    }
}
