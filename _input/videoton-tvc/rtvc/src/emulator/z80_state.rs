#![allow(dead_code)]
// Shared Z80 state for z80 and z80a — single source of truth for register layout.

pub const R_A: usize = 0;
pub const R_F: usize = 1;
pub const R_B: usize = 2;
pub const R_C: usize = 3;
pub const R_D: usize = 4;
pub const R_E: usize = 5;
pub const R_H: usize = 6;
pub const R_L: usize = 7;
pub const R_XH: usize = 8;
pub const R_XL: usize = 9;
pub const R_YH: usize = 10;
pub const R_YL: usize = 11;
pub const R_AA: usize = 12;
pub const R_FA: usize = 13;
pub const R_BA: usize = 14;
pub const R_CA: usize = 15;
pub const R_DA: usize = 16;
pub const R_EA: usize = 17;
pub const R_HA: usize = 18;
pub const R_LA: usize = 19;
pub const R_I: usize = 20;
pub const R_R: usize = 21;

pub const R_AF: usize = 0;
pub const R_BC: usize = 1;
pub const R_DE: usize = 2;
pub const R_HL: usize = 3;
pub const R_IX: usize = 4;
pub const R_IY: usize = 5;
pub const R_AFA: usize = 6;
pub const R_BCA: usize = 7;
pub const R_DEA: usize = 8;
pub const R_HLA: usize = 9;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Z80State {
    // 8-bit registers: A,F,B,C,D,E,H,L,IXh,IXl,IYh,IYl,A',F',B',C',D',E',H',L',I,R
    pub r8: [u8; 22],
    pub sp: u16,
    pub pc: u16,
    pub halted: u8,
    pub im: u8,
    pub iff1: u8,
    pub iff2: u8,
}

impl Z80State {
    pub fn new() -> Self {
        let mut state = Z80State {
            r8: [0; 22],
            sp: 0,
            pc: 0,
            halted: 0,
            im: 0,
            iff1: 0,
            iff2: 0,
        };
        state.initialize();
        state
    }

    pub fn initialize(&mut self) {
        self.r8 = [0; 22];
        self.r8[0..=19].fill(0xFF);
        self.sp = 0xFFFF;
        self.reset();
    }

    pub fn reset(&mut self) {
        self.halted = 0;
        self.im = 0;
        self.iff1 = 0;
        self.iff2 = 0;
        self.r8[R_I] = 0x00;
        self.r8[R_R] = 0x00;
        self.pc = 0x0000;
    }

    #[inline(always)]
    pub fn get_reg16(&self, reg: usize) -> u16 {
        match reg {
            0..=9 => ((self.r8[reg * 2] as u16) << 8) | (self.r8[reg * 2 + 1] as u16),
            10 => self.sp,
            11 => self.pc,
            12 => ((self.r8[R_I] as u16) << 8) | (self.r8[R_R] as u16),
            _ => 0,
        }
    }

    #[inline(always)]
    pub fn set_reg16(&mut self, reg: usize, val: u16) {
        match reg {
            0..=9 => {
                self.r8[reg * 2] = ((val >> 8) & 0xFF) as u8;
                self.r8[reg * 2 + 1] = (val & 0xFF) as u8;
            }
            10 => self.sp = val,
            11 => self.pc = val,
            12 => {
                self.r8[R_I] = ((val >> 8) & 0xFF) as u8;
                self.r8[R_R] = (val & 0xFF) as u8;
            }
            _ => {}
        }
    }

    #[inline(always)]
    pub fn get_bc(&self) -> u16 {
        ((self.r8[R_B] as u16) << 8) | (self.r8[R_C] as u16)
    }
    #[inline(always)]
    pub fn get_de(&self) -> u16 {
        ((self.r8[R_D] as u16) << 8) | (self.r8[R_E] as u16)
    }
    #[inline(always)]
    pub fn get_hl(&self) -> u16 {
        ((self.r8[R_H] as u16) << 8) | (self.r8[R_L] as u16)
    }
    #[inline(always)]
    pub fn get_af(&self) -> u16 {
        ((self.r8[R_A] as u16) << 8) | (self.r8[R_F] as u16)
    }
    #[inline(always)]
    pub fn get_ix(&self) -> u16 {
        ((self.r8[R_XH] as u16) << 8) | (self.r8[R_XL] as u16)
    }
    #[inline(always)]
    pub fn get_iy(&self) -> u16 {
        ((self.r8[R_YH] as u16) << 8) | (self.r8[R_YL] as u16)
    }
    #[inline(always)]
    pub fn get_bca(&self) -> u16 {
        ((self.r8[R_BA] as u16) << 8) | (self.r8[R_CA] as u16)
    }
    #[inline(always)]
    pub fn get_dea(&self) -> u16 {
        ((self.r8[R_DA] as u16) << 8) | (self.r8[R_EA] as u16)
    }
    #[inline(always)]
    pub fn get_hla(&self) -> u16 {
        ((self.r8[R_HA] as u16) << 8) | (self.r8[R_LA] as u16)
    }
    #[inline(always)]
    pub fn get_afa(&self) -> u16 {
        ((self.r8[R_AA] as u16) << 8) | (self.r8[R_FA] as u16)
    }

    #[inline(always)]
    pub fn set_bc(&mut self, val: u16) {
        self.r8[R_B] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_C] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_de(&mut self, val: u16) {
        self.r8[R_D] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_E] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_hl(&mut self, val: u16) {
        self.r8[R_H] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_L] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_af(&mut self, val: u16) {
        self.r8[R_A] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_F] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_ix(&mut self, val: u16) {
        self.r8[R_XH] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_XL] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_iy(&mut self, val: u16) {
        self.r8[R_YH] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_YL] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_bca(&mut self, val: u16) {
        self.r8[R_BA] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_CA] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_dea(&mut self, val: u16) {
        self.r8[R_DA] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_EA] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_hla(&mut self, val: u16) {
        self.r8[R_HA] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_LA] = (val & 0xFF) as u8;
    }
    #[inline(always)]
    pub fn set_afa(&mut self, val: u16) {
        self.r8[R_AA] = ((val >> 8) & 0xFF) as u8;
        self.r8[R_FA] = (val & 0xFF) as u8;
    }

    pub fn get_reg8(&self, reg: usize) -> u8 {
        self.r8[reg]
    }

    pub fn set_reg8(&mut self, reg: usize, val: u8) {
        self.r8[reg] = val;
    }
}
