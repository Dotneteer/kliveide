use crate::bus::CpuBus;
use crate::disasm::{DisassembledInstruction, disassemble_block};
use crate::instruction_trace::InstructionTrace;
use crate::tvc::{DEBUG_RUN_TO_IRQ_MAX_CYCLES, Tvc};
use crate::vid::VidModel;
use crate::z80::{Z80, Z80State};
use crate::zx82::{FRAMEBUFFER_HEIGHT as ZX82_HEIGHT, FRAMEBUFFER_WIDTH as ZX82_WIDTH, Zx82};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum System {
    Tvc,
    Zx82,
}

impl System {
    pub fn label(self) -> &'static str {
        match self {
            Self::Tvc => "TVC",
            Self::Zx82 => "Zx82 (Spectrum 48K)",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct DebugRunToIrqResult {
    pub elapsed_cycles: u32,
    pub interrupt_accepted: bool,
}

pub struct FramebufferRef<'a> {
    pub pixels: &'a [u32],
    pub width: usize,
    pub height: usize,
}

pub enum Machine {
    Tvc(Tvc),
    Zx82(Zx82),
}

impl Machine {
    pub fn system(&self) -> System {
        match self {
            Self::Tvc(_) => System::Tvc,
            Self::Zx82(_) => System::Zx82,
        }
    }

    pub fn tvc(&self) -> Option<&Tvc> {
        match self {
            Self::Tvc(tvc) => Some(tvc),
            Self::Zx82(_) => None,
        }
    }

    pub fn tvc_mut(&mut self) -> Option<&mut Tvc> {
        match self {
            Self::Tvc(tvc) => Some(tvc),
            Self::Zx82(_) => None,
        }
    }

    pub fn zx82(&self) -> Option<&Zx82> {
        match self {
            Self::Tvc(_) => None,
            Self::Zx82(zx82) => Some(zx82),
        }
    }

    pub fn zx82_mut(&mut self) -> Option<&mut Zx82> {
        match self {
            Self::Tvc(_) => None,
            Self::Zx82(zx82) => Some(zx82),
        }
    }

    pub fn reset(&mut self) {
        match self {
            Self::Tvc(tvc) => tvc.reset(),
            Self::Zx82(zx82) => zx82.reset(),
        }
    }

    pub fn run_frame(&mut self) -> bool {
        match self {
            Self::Tvc(tvc) => tvc.run_for_a_frame(),
            Self::Zx82(zx82) => zx82.run_for_a_frame(),
        }
    }

    pub fn debug_step_instruction(&mut self) -> u32 {
        match self {
            Self::Tvc(tvc) => tvc.debug_step_instruction(),
            Self::Zx82(zx82) => zx82.debug_step_instruction(),
        }
    }

    pub fn debug_run_to_interrupt(&mut self) -> DebugRunToIrqResult {
        match self {
            Self::Tvc(tvc) => {
                let result = tvc.debug_run_to_interrupt(DEBUG_RUN_TO_IRQ_MAX_CYCLES);
                DebugRunToIrqResult {
                    elapsed_cycles: result.elapsed_cycles,
                    interrupt_accepted: result.interrupt_accepted,
                }
            }
            Self::Zx82(zx82) => {
                let (elapsed_cycles, interrupt_accepted) =
                    zx82.debug_run_to_interrupt(DEBUG_RUN_TO_IRQ_MAX_CYCLES);
                DebugRunToIrqResult {
                    elapsed_cycles,
                    interrupt_accepted,
                }
            }
        }
    }

    pub fn z80_state(&self) -> &Z80State {
        match self {
            Self::Tvc(tvc) => &tvc.z80.state,
            Self::Zx82(zx82) => &zx82.z80.state,
        }
    }

    pub fn z80_mut(&mut self) -> &mut Z80 {
        match self {
            Self::Tvc(tvc) => &mut tvc.z80,
            Self::Zx82(zx82) => &mut zx82.z80,
        }
    }

    pub fn clock(&self) -> u64 {
        match self {
            Self::Tvc(tvc) => tvc.clock,
            Self::Zx82(zx82) => zx82.clock(),
        }
    }

    pub fn instruction_trace(&self) -> &InstructionTrace {
        match self {
            Self::Tvc(tvc) => tvc.instruction_trace(),
            Self::Zx82(zx82) => zx82.instruction_trace(),
        }
    }

    pub fn instruction_trace_mut(&mut self) -> &mut InstructionTrace {
        match self {
            Self::Tvc(tvc) => tvc.instruction_trace_mut(),
            Self::Zx82(zx82) => zx82.instruction_trace_mut(),
        }
    }

    pub fn framebuffer(&self) -> FramebufferRef<'_> {
        match self {
            Self::Tvc(tvc) => FramebufferRef {
                pixels: &tvc.framebuffer,
                width: 608,
                height: 288,
            },
            Self::Zx82(zx82) => FramebufferRef {
                pixels: &zx82.framebuffer,
                width: ZX82_WIDTH,
                height: ZX82_HEIGHT,
            },
        }
    }

    pub fn frame_complete(&self) -> bool {
        match self {
            Self::Tvc(tvc) => tvc.frame_complete,
            Self::Zx82(zx82) => zx82.frame_complete,
        }
    }

    pub fn clear_frame_complete(&mut self) {
        match self {
            Self::Tvc(tvc) => tvc.frame_complete = false,
            Self::Zx82(zx82) => zx82.frame_complete = false,
        }
    }

    pub fn vid_model(&self) -> VidModel {
        match self {
            Self::Tvc(tvc) => tvc.vid_model(),
            Self::Zx82(zx82) => zx82.vid_model(),
        }
    }

    pub fn set_vid_model(&mut self, model: VidModel) {
        match self {
            Self::Tvc(tvc) => tvc.set_vid_model(model),
            Self::Zx82(zx82) => zx82.set_vid_model(model),
        }
    }

    pub fn set_breakpoint(&mut self, addr: u16) {
        match self {
            Self::Tvc(tvc) => tvc.set_breakpoint(addr),
            Self::Zx82(zx82) => zx82.set_breakpoint(addr),
        }
    }

    pub fn clear_breakpoint(&mut self, addr: u16) {
        match self {
            Self::Tvc(tvc) => tvc.clear_breakpoint(addr),
            Self::Zx82(zx82) => zx82.clear_breakpoint(addr),
        }
    }

    pub fn clear_all_breakpoints(&mut self) {
        match self {
            Self::Tvc(tvc) => tvc.clear_all_breakpoints(),
            Self::Zx82(zx82) => zx82.clear_all_breakpoints(),
        }
    }

    pub fn get_breakpoints(&self) -> Vec<u16> {
        match self {
            Self::Tvc(tvc) => tvc.get_breakpoints(),
            Self::Zx82(zx82) => zx82.get_breakpoints(),
        }
    }

    pub fn read_mapped(&mut self, addr: u16, len: usize) -> Vec<u8> {
        match self {
            Self::Tvc(tvc) => (0..len)
                .map(|offset| tvc.bus.r8(addr.wrapping_add(offset as u16)))
                .collect(),
            Self::Zx82(zx82) => (0..len)
                .map(|offset| zx82.bus.r8(addr.wrapping_add(offset as u16)))
                .collect(),
        }
    }

    pub fn write_mapped(&mut self, addr: u16, bytes: &[u8]) {
        match self {
            Self::Tvc(tvc) => {
                for (offset, byte) in bytes.iter().copied().enumerate() {
                    tvc.bus.w8(addr.wrapping_add(offset as u16), byte);
                }
            }
            Self::Zx82(zx82) => {
                for (offset, byte) in bytes.iter().copied().enumerate() {
                    zx82.bus.w8(addr.wrapping_add(offset as u16), byte);
                }
                zx82.draw_full_frame();
                zx82.frame_complete = true;
            }
        }
    }

    pub fn write_raw_bank(&mut self, bank: &str, addr: usize, bytes: &[u8]) -> Option<usize> {
        match self {
            Self::Tvc(tvc) => tvc.bus.mmu.write_raw_bank(bank, addr, bytes),
            Self::Zx82(_) => None,
        }
    }

    pub fn disassemble(&mut self, addr: u16, len: usize) -> Vec<DisassembledInstruction> {
        match self {
            Self::Tvc(tvc) => disassemble_block(&mut tvc.bus, addr, len),
            Self::Zx82(zx82) => disassemble_block(&mut zx82.bus, addr, len),
        }
    }

    pub fn key_down(&mut self, code: u32) -> bool {
        match self {
            Self::Tvc(tvc) => tvc.key_down(code),
            Self::Zx82(zx82) => zx82.key_down(code),
        }
    }

    pub fn key_up(&mut self, code: u32) {
        match self {
            Self::Tvc(tvc) => tvc.key_up(code),
            Self::Zx82(zx82) => zx82.key_up(code),
        }
    }

    pub fn key_press(&mut self, ch: char) {
        match self {
            Self::Tvc(tvc) => tvc.key_press(ch),
            Self::Zx82(zx82) => zx82.key_press(ch),
        }
    }

    pub fn focus_change(&mut self, has_focus: bool) {
        match self {
            Self::Tvc(tvc) => tvc.focus_change(has_focus),
            Self::Zx82(zx82) => zx82.focus_change(has_focus),
        }
    }

    pub fn sound_sample_rate(&self) -> u32 {
        match self {
            Self::Tvc(tvc) => tvc.sound_sample_rate(),
            Self::Zx82(_) => 44_100,
        }
    }

    pub fn take_audio_samples(&mut self) -> Vec<f32> {
        match self {
            Self::Tvc(tvc) => tvc.take_audio_samples(),
            Self::Zx82(_) => Vec::new(),
        }
    }
}
