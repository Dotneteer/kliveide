#![allow(dead_code)]
// z80.rs — simplified Z80 core (retired original 10k-line version, promoted from z80a.rs).
// Design: handwritten helpers (flags, ALU, shifts) + compact dispatch.
// Match is kept for perf, but bulk decode (LD r,r / ALU / CB / indexed)
// is table/decoded instead of 10k lines of expanded arms.
// DD/FD and DDCB/FDCB share one generic implementation.

use crate::bus::CpuBus;
pub use crate::z80_state::Z80State;
use crate::z80_state::{
    R_A, R_AA, R_B, R_BA, R_C, R_CA, R_D, R_DA, R_E, R_EA, R_F, R_FA, R_H, R_HA, R_I, R_IX, R_IY,
    R_L, R_LA, R_R, R_XH, R_XL, R_YH, R_YL,
};

// Flag constants — identical to z80.rs
const F_S: u8 = 0x80;
const F_Z: u8 = 0x40;
const F_5: u8 = 0x20;
const F_H: u8 = 0x10;
const F_3: u8 = 0x08;
const F_PV: u8 = 0x04;
const F_N: u8 = 0x02;
const F_C: u8 = 0x01;

pub struct Z80 {
    pub state: Z80State,
    pub sz53_table: [u8; 256],
    pub sz53p_table: [u8; 256],
}
pub type Z80A = Z80;

impl Z80 {
    pub fn new() -> Self {
        let mut z = Z80 {
            state: Z80State::new(),
            sz53_table: [0; 256],
            sz53p_table: [0; 256],
        };
        for i in 0..256 {
            let mut flags = (i as u8 & F_S) | (i as u8 & F_5) | (i as u8 & F_3);
            if i == 0 {
                flags |= F_Z;
            }
            z.sz53_table[i] = flags;
            let mut parity = 0;
            let mut temp = i as u8;
            for _ in 0..8 {
                parity ^= temp & 1;
                temp >>= 1;
            }
            z.sz53p_table[i] = flags | if parity == 0 { F_PV } else { 0 };
        }
        z
    }

    pub fn reset(&mut self) {
        self.state.reset();
    }
    pub fn initialize(&mut self) {
        self.state.initialize();
    }

    #[inline(always)]
    pub fn push16<M: CpuBus>(&mut self, bus: &mut M, val: u16) {
        let sp = self.state.sp.wrapping_sub(1);
        bus.w8(sp, ((val >> 8) & 0xFF) as u8);
        let sp = sp.wrapping_sub(1);
        bus.w8(sp, (val & 0xFF) as u8);
        self.state.sp = sp;
    }
    #[inline(always)]
    pub fn pop16<M: CpuBus>(&mut self, bus: &mut M) -> u16 {
        let sp = self.state.sp;
        let lo = bus.r8(sp) as u16;
        let sp = sp.wrapping_add(1);
        let hi = bus.r8(sp) as u16;
        self.state.sp = sp.wrapping_add(1);
        (hi << 8) | lo
    }

    // ---- ALU helpers — identical to z80.rs ----
    #[inline(always)]
    pub fn add8(&self, a: u8, b: u8, cin: bool) -> (u8, u8) {
        let cin_val = if cin { 1 } else { 0 };
        let res = (a as u16) + (b as u16) + cin_val;
        let res4 = ((a & 0x0F) as u16) + ((b & 0x0F) as u16) + cin_val;
        let res8 = (res & 0xFF) as u8;
        let a_s = (a & 0x80) != 0;
        let b_s = (b & 0x80) != 0;
        let r_s = (res8 & 0x80) != 0;
        let overflow = a_s == b_s && a_s != r_s;
        let mut flags = self.sz53_table[res8 as usize];
        if overflow {
            flags |= F_PV;
        }
        if res4 > 0x0F {
            flags |= F_H;
        }
        if res > 0xFF {
            flags |= F_C;
        }
        (res8, flags)
    }
    #[inline(always)]
    pub fn sub8(&self, a: u8, b: u8, cin: bool) -> (u8, u8) {
        let (res, mut flags) = self.add8(a, !b, !cin);
        flags ^= F_H | F_C;
        flags |= F_N;
        (res, flags)
    }
    #[inline(always)]
    pub fn add16(&self, a: u16, b: u16, cin: bool) -> (u16, u8) {
        let (res_l, flags_l) = self.add8((a & 0xFF) as u8, (b & 0xFF) as u8, cin);
        let (res_h, flags_h) = self.add8(
            ((a >> 8) & 0xFF) as u8,
            ((b >> 8) & 0xFF) as u8,
            flags_l & F_C != 0,
        );
        let res16 = ((res_h as u16) << 8) | (res_l as u16);
        let mut flags = 0;
        flags |= res_h & F_S;
        if res16 == 0 {
            flags |= F_Z;
        }
        flags |= res_h & F_5;
        flags |= flags_h & F_H;
        flags |= res_h & F_3;
        flags |= flags_h & F_PV;
        flags |= flags_h & F_C;
        (res16, flags)
    }
    #[inline(always)]
    pub fn sub16(&self, a: u16, b: u16, cin: bool) -> (u16, u8) {
        let (res, mut flags) = self.add16(a, !b, !cin);
        flags ^= F_C | F_H;
        flags |= F_N;
        (res, flags)
    }
    #[inline(always)]
    pub fn shl8(&self, val: u8, right_in: bool) -> (u8, u8) {
        let cout = (val & 0x80) != 0;
        let res = ((val << 1) | if right_in { 1 } else { 0 }) & 0xFF;
        let mut flags = self.sz53p_table[res as usize];
        if cout {
            flags |= F_C;
        }
        (res, flags)
    }
    #[inline(always)]
    pub fn shr8(&self, val: u8, left_in: bool) -> (u8, u8) {
        let cout = (val & 0x01) != 0;
        let res = ((val >> 1) | if left_in { 0x80 } else { 0 }) & 0xFF;
        let mut flags = self.sz53p_table[res as usize];
        if cout {
            flags |= F_C;
        }
        (res, flags)
    }

    // ---- small helpers ----
    #[inline(always)]
    fn reg_code_to_r8(code: u8) -> usize {
        match code {
            0 => R_B,
            1 => R_C,
            2 => R_D,
            3 => R_E,
            4 => R_H,
            5 => R_L,
            7 => R_A,
            _ => 0, // 6 is (HL), handled separately
        }
    }
    #[inline(always)]
    fn preserve_c(&self, new_flags: u8) -> u8 {
        (new_flags & !F_C) | (self.state.r8[R_F] & F_C)
    }
    #[inline(always)]
    fn alu_y(&mut self, y: u8, val: u8) {
        match y {
            0 => {
                let (r, f) = self.add8(self.state.r8[R_A], val, false);
                self.state.r8[R_A] = r;
                self.state.r8[R_F] = f;
            }
            1 => {
                let (r, f) = self.add8(self.state.r8[R_A], val, self.state.r8[R_F] & F_C != 0);
                self.state.r8[R_A] = r;
                self.state.r8[R_F] = f;
            }
            2 => {
                let (r, f) = self.sub8(self.state.r8[R_A], val, false);
                self.state.r8[R_A] = r;
                self.state.r8[R_F] = f;
            }
            3 => {
                let (r, f) = self.sub8(self.state.r8[R_A], val, self.state.r8[R_F] & F_C != 0);
                self.state.r8[R_A] = r;
                self.state.r8[R_F] = f;
            }
            4 => {
                self.state.r8[R_A] &= val;
                self.state.r8[R_F] = self.sz53p_table[self.state.r8[R_A] as usize] | F_H;
            }
            5 => {
                self.state.r8[R_A] ^= val;
                self.state.r8[R_F] = self.sz53p_table[self.state.r8[R_A] as usize];
            }
            6 => {
                self.state.r8[R_A] |= val;
                self.state.r8[R_F] = self.sz53p_table[self.state.r8[R_A] as usize];
            }
            7 => {
                let (_, f) = self.sub8(self.state.r8[R_A], val, false);
                self.state.r8[R_F] = (f & !(F_5 | F_3)) | (val & (F_5 | F_3));
            }
            _ => unreachable!(),
        }
    }

    pub fn get_reg_val(&self, name: &str) -> u16 {
        match name {
            "AF" => self.state.get_af(),
            "BC" => self.state.get_bc(),
            "DE" => self.state.get_de(),
            "HL" => self.state.get_hl(),
            "AFa" => self.state.get_afa(),
            "BCa" => self.state.get_bca(),
            "DEa" => self.state.get_dea(),
            "HLa" => self.state.get_hla(),
            "IX" => self.state.get_ix(),
            "IY" => self.state.get_iy(),
            "SP" => self.state.sp,
            "PC" => self.state.pc,
            "A" => self.state.r8[R_A] as u16,
            "F" => self.state.r8[R_F] as u16,
            "B" => self.state.r8[R_B] as u16,
            "C" => self.state.r8[R_C] as u16,
            "D" => self.state.r8[R_D] as u16,
            "E" => self.state.r8[R_E] as u16,
            "H" => self.state.r8[R_H] as u16,
            "L" => self.state.r8[R_L] as u16,
            "I" => self.state.r8[R_I] as u16,
            "R" => self.state.r8[R_R] as u16,
            "IFF1" => self.state.iff1 as u16,
            "IFF2" => self.state.iff2 as u16,
            "im" => self.state.im as u16,
            "halted" => self.state.halted as u16,
            _ => 0,
        }
    }
    pub fn set_reg_val(&mut self, name: &str, val: u16) {
        match name {
            "AF" => self.state.set_af(val),
            "BC" => self.state.set_bc(val),
            "DE" => self.state.set_de(val),
            "HL" => self.state.set_hl(val),
            "AFa" => self.state.set_afa(val),
            "BCa" => self.state.set_bca(val),
            "DEa" => self.state.set_dea(val),
            "HLa" => self.state.set_hla(val),
            "IX" => self.state.set_ix(val),
            "IY" => self.state.set_iy(val),
            "SP" => self.state.sp = val,
            "PC" => self.state.pc = val,
            "A" => self.state.r8[R_A] = (val & 0xFF) as u8,
            "F" => self.state.r8[R_F] = (val & 0xFF) as u8,
            "B" => self.state.r8[R_B] = (val & 0xFF) as u8,
            "C" => self.state.r8[R_C] = (val & 0xFF) as u8,
            "D" => self.state.r8[R_D] = (val & 0xFF) as u8,
            "E" => self.state.r8[R_E] = (val & 0xFF) as u8,
            "H" => self.state.r8[R_H] = (val & 0xFF) as u8,
            "L" => self.state.r8[R_L] = (val & 0xFF) as u8,
            "I" => self.state.r8[R_I] = (val & 0xFF) as u8,
            "R" => self.state.r8[R_R] = (val & 0xFF) as u8,
            "IFF1" => self.state.iff1 = (val & 1) as u8,
            "IFF2" => self.state.iff2 = (val & 1) as u8,
            "im" => self.state.im = (val & 3) as u8,
            "halted" => self.state.halted = (val & 1) as u8,
            _ => {}
        }
    }

    pub fn irq<M: CpuBus>(&mut self, bus: &mut M) -> u32 {
        if self.state.iff1 != 0 {
            self.state.halted = 0;
            self.state.iff1 = 0;
            self.state.iff2 = 0;
            let pc = self.state.pc;
            self.push16(bus, pc);
            self.state.pc = 0x0038;
            13
        } else {
            0
        }
    }

    pub fn step<M: CpuBus>(&mut self, bus: &mut M, _run_for: i32) -> u32 {
        if self.state.halted != 0 {
            return 4;
        }
        let mut pc = self.state.pc;
        let mut r_add = 0u8;
        let mut t_add = 0u32;
        let mut displ = 0i8;
        let mut opcode = bus.r8(pc) as u32;
        if opcode == 0xDD || opcode == 0xFD {
            let mut pc_loop = pc;
            let mut opcodeb2: u32;
            loop {
                opcodeb2 = bus.r8(pc_loop.wrapping_add(1)) as u32;
                if opcodeb2 == 0xDD || opcodeb2 == 0xFD {
                    opcode = opcodeb2;
                    t_add += 4;
                    pc_loop = pc_loop.wrapping_add(1);
                    r_add += 1;
                } else {
                    break;
                }
            }
            self.state.pc = pc_loop;
            pc = pc_loop;
            opcode = (opcode << 8) | opcodeb2;
            r_add += 2;
            if opcode == 0xFDCB || opcode == 0xDDCB {
                displ = bus.r8s(pc_loop.wrapping_add(2));
                opcode = (opcode << 8) | bus.r8(pc_loop.wrapping_add(3)) as u32;
            }
        } else if opcode == 0xED || opcode == 0xCB {
            opcode = (opcode << 8) | bus.r8(pc.wrapping_add(1)) as u32;
            r_add += 2;
        } else {
            r_add += 1;
        }
        self.state.r8[R_R] =
            (self.state.r8[R_R] & 0x80) | ((self.state.r8[R_R].wrapping_add(r_add)) & 0x7F);
        let (t, m) = self.execute(opcode, displ, bus, &mut t_add, &mut pc);
        if t == 0 {
            panic!("Opcode not implemented: 0x{:04X}", opcode);
        }
        if m > 0 && (self.state.halted == 0 || opcode == 0x76) {
            self.state.pc = pc.wrapping_add(m as u16);
        }
        t + t_add
    }

    pub fn execute<M: CpuBus>(
        &mut self,
        opcode: u32,
        displ: i8,
        bus: &mut M,
        t_add: &mut u32,
        pc: &mut u16,
    ) -> (u32, u8) {
        if opcode <= 0xFF {
            return self.execute_base(opcode as u8, bus);
        }
        let hi = opcode >> 8;
        if hi == 0xCB {
            return self.execute_cb((opcode & 0xFF) as u8, bus);
        }
        if hi == 0xED {
            return self.execute_ed((opcode & 0xFF) as u8, bus);
        }
        if hi == 0xDD {
            let res = self.execute_indexed((opcode & 0xFF) as u8, displ, bus, R_IX);
            if res.0 != 0 || res.1 != 0 {
                return res;
            }
            *t_add += 4;
            *pc = pc.wrapping_add(1);
            return self.execute_base((opcode & 0xFF) as u8, bus);
        }
        if hi == 0xFD {
            let res = self.execute_indexed((opcode & 0xFF) as u8, displ, bus, R_IY);
            if res.0 != 0 || res.1 != 0 {
                return res;
            }
            *t_add += 4;
            *pc = pc.wrapping_add(1);
            return self.execute_base((opcode & 0xFF) as u8, bus);
        }
        if hi == 0xDDCB {
            return self.execute_indexed_cb((opcode & 0xFF) as u8, displ, bus, R_IX);
        }
        if hi == 0xFDCB {
            return self.execute_indexed_cb((opcode & 0xFF) as u8, displ, bus, R_IY);
        }
        (0, 0)
    }

    // ---------- base ----------
    pub fn execute_base<M: CpuBus>(&mut self, opcode: u8, bus: &mut M) -> (u32, u8) {
        // Keep match for perf, but collapse 96 LD/ALU arms into ranges.
        match opcode {
            0x00 => (4, 1), // NOP
            0x01 => {
                // LD BC,nn
                let nn = bus.r16(self.state.pc.wrapping_add(1));
                self.state.set_bc(nn);
                (10, 3)
            }
            0x02 => {
                // LD (BC),A
                bus.w8(self.state.get_bc(), self.state.r8[R_A]);
                (7, 1)
            }
            0x03 => {
                // INC BC
                self.state.set_bc(self.state.get_bc().wrapping_add(1));
                (6, 1)
            }
            0x04 => {
                // INC B
                let (res, flags) = self.add8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x05 => {
                // DEC B
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x06 => {
                // LD B,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_B] = n;
                (7, 2)
            }
            0x07 => {
                // RLCA
                let a = self.state.r8[R_A];
                let (res, flags) = self.shl8(a, (a & 0x80) != 0);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] =
                    (self.state.r8[R_F] & (F_S | F_Z | F_PV)) | (flags & !(F_S | F_Z | F_PV));
                (4, 1)
            }
            0x08 => {
                // EX AF,AF'
                let a = self.state.r8[R_A];
                self.state.r8[R_A] = self.state.r8[R_AA];
                self.state.r8[R_AA] = a;
                let f = self.state.r8[R_F];
                self.state.r8[R_F] = self.state.r8[R_FA];
                self.state.r8[R_FA] = f;
                (4, 1)
            }
            0x09 => {
                // ADD HL,BC
                let hl = self.state.get_hl();
                let (res, flags) = self.add16(hl, self.state.get_bc(), false);
                self.state.set_hl(res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (11, 1)
            }
            0x0A => {
                // LD A,(BC)
                self.state.r8[R_A] = bus.r8(self.state.get_bc());
                (7, 1)
            }
            0x0B => {
                // DEC BC
                self.state.set_bc(self.state.get_bc().wrapping_sub(1));
                (6, 1)
            }
            0x0C => {
                // INC C
                let (res, flags) = self.add8(self.state.r8[R_C], 1, false);
                self.state.r8[R_C] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x0D => {
                // DEC C
                let (res, flags) = self.sub8(self.state.r8[R_C], 1, false);
                self.state.r8[R_C] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x0E => {
                // LD C,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_C] = n;
                (7, 2)
            }
            0x0F => {
                // RRCA
                let a = self.state.r8[R_A];
                let (res, flags) = self.shr8(a, (a & 0x01) != 0);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] =
                    (self.state.r8[R_F] & (F_S | F_Z | F_PV)) | (flags & !(F_S | F_Z | F_PV));
                (4, 1)
            }
            0x10 => {
                // DJNZ e
                let pc = self.state.pc;
                self.state.r8[R_B] = self.state.r8[R_B].wrapping_sub(1);
                if self.state.r8[R_B] == 0 {
                    (8, 2)
                } else {
                    let e = bus.r8s(pc.wrapping_add(1)) as i16;
                    self.state.pc = pc.wrapping_add(2).wrapping_add(e as u16);
                    (13, 0)
                }
            }
            0x11 => {
                // LD DE,nn
                let nn = bus.r16(self.state.pc.wrapping_add(1));
                self.state.set_de(nn);
                (10, 3)
            }
            0x12 => {
                // LD (DE),A
                bus.w8(self.state.get_de(), self.state.r8[R_A]);
                (7, 1)
            }
            0x13 => {
                // INC DE
                self.state.set_de(self.state.get_de().wrapping_add(1));
                (6, 1)
            }
            0x14 => {
                // INC D
                let (res, flags) = self.add8(self.state.r8[R_D], 1, false);
                self.state.r8[R_D] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x15 => {
                // DEC D
                let (res, flags) = self.sub8(self.state.r8[R_D], 1, false);
                self.state.r8[R_D] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x16 => {
                // LD D,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_D] = n;
                (7, 2)
            }
            0x17 => {
                // RLA
                let a = self.state.r8[R_A];
                let (res, flags) = self.shl8(a, (self.state.r8[R_F] & F_C) != 0);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] =
                    (self.state.r8[R_F] & (F_S | F_Z | F_PV)) | (flags & !(F_S | F_Z | F_PV));
                (4, 1)
            }
            0x18 => {
                // JR e
                let pc = self.state.pc;
                let e = bus.r8s(pc.wrapping_add(1)) as i16;
                self.state.pc = pc.wrapping_add(2).wrapping_add(e as u16);
                (12, 0)
            }
            0x19 => {
                // ADD HL,DE
                let hl = self.state.get_hl();
                let (res, flags) = self.add16(hl, self.state.get_de(), false);
                self.state.set_hl(res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (11, 1)
            }
            0x1A => {
                // LD A,(DE)
                self.state.r8[R_A] = bus.r8(self.state.get_de());
                (7, 1)
            }
            0x1B => {
                // DEC DE
                self.state.set_de(self.state.get_de().wrapping_sub(1));
                (6, 1)
            }
            0x1C => {
                // INC E
                let (res, flags) = self.add8(self.state.r8[R_E], 1, false);
                self.state.r8[R_E] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x1D => {
                // DEC E
                let (res, flags) = self.sub8(self.state.r8[R_E], 1, false);
                self.state.r8[R_E] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x1E => {
                // LD E,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_E] = n;
                (7, 2)
            }
            0x1F => {
                // RRA
                let a = self.state.r8[R_A];
                let (res, flags) = self.shr8(a, (self.state.r8[R_F] & F_C) != 0);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] =
                    (self.state.r8[R_F] & (F_S | F_Z | F_PV)) | (flags & !(F_S | F_Z | F_PV));
                (4, 1)
            }
            0x20 => {
                // JR NZ e
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_Z != 0 {
                    (7, 2)
                } else {
                    let e = bus.r8s(pc.wrapping_add(1)) as i16;
                    self.state.pc = pc.wrapping_add(2).wrapping_add(e as u16);
                    (12, 0)
                }
            }
            0x21 => {
                // LD HL,nn
                let nn = bus.r16(self.state.pc.wrapping_add(1));
                self.state.set_hl(nn);
                (10, 3)
            }
            0x22 => {
                // LD (nn),HL
                let pc = self.state.pc;
                let nn = bus.r16(pc.wrapping_add(1));
                bus.w16(nn, self.state.get_hl());
                (16, 3)
            }
            0x23 => {
                // INC HL
                self.state.set_hl(self.state.get_hl().wrapping_add(1));
                (6, 1)
            }
            0x24 => {
                // INC H
                let (res, flags) = self.add8(self.state.r8[R_H], 1, false);
                self.state.r8[R_H] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x25 => {
                // DEC H
                let (res, flags) = self.sub8(self.state.r8[R_H], 1, false);
                self.state.r8[R_H] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x26 => {
                // LD H,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_H] = n;
                (7, 2)
            }
            0x27 => {
                // DAA — keep verbatim
                let a = self.state.r8[R_A];
                let mut add = 0u8;
                let carry = self.state.r8[R_F] & F_C;
                let lownibble = a & 0x0F;
                if (self.state.r8[R_F] & F_H) != 0 || lownibble > 9 {
                    add = 6;
                }
                let mut new_carry = carry;
                if carry != 0 || a > 0x99 {
                    add |= 0x60;
                    new_carry = F_C;
                }
                let (res, flags) = if (self.state.r8[R_F] & F_N) != 0 {
                    self.sub8(a, add, false)
                } else {
                    self.add8(a, add, false)
                };
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = (self.state.r8[R_F] & F_N)
                    | self.sz53p_table[res as usize]
                    | (flags & F_H)
                    | new_carry;
                (4, 1)
            }
            0x28 => {
                // JR Z e
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_Z != 0 {
                    let e = bus.r8s(pc.wrapping_add(1)) as i16;
                    self.state.pc = pc.wrapping_add(2).wrapping_add(e as u16);
                    (12, 0)
                } else {
                    (7, 2)
                }
            }
            0x29 => {
                // ADD HL,HL
                let hl = self.state.get_hl();
                let (res, flags) = self.add16(hl, hl, false);
                self.state.set_hl(res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (11, 1)
            }
            0x2A => {
                // LD HL,(nn)
                let pc = self.state.pc;
                let nn = bus.r16(pc.wrapping_add(1));
                self.state.set_hl(bus.r16(nn));
                (16, 3)
            }
            0x2B => {
                // DEC HL
                self.state.set_hl(self.state.get_hl().wrapping_sub(1));
                (6, 1)
            }
            0x2C => {
                // INC L
                let (res, flags) = self.add8(self.state.r8[R_L], 1, false);
                self.state.r8[R_L] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x2D => {
                // DEC L
                let (res, flags) = self.sub8(self.state.r8[R_L], 1, false);
                self.state.r8[R_L] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x2E => {
                // LD L,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_L] = n;
                (7, 2)
            }
            0x2F => {
                // CPL
                self.state.r8[R_A] = !self.state.r8[R_A];
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_PV | F_C))
                    | F_H
                    | F_N
                    | (self.state.r8[R_A] & F_5)
                    | (self.state.r8[R_A] & F_3);
                (4, 1)
            }
            0x30 => {
                // JR NC e
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_C != 0 {
                    (7, 2)
                } else {
                    let e = bus.r8s(pc.wrapping_add(1)) as i16;
                    self.state.pc = pc.wrapping_add(2).wrapping_add(e as u16);
                    (12, 0)
                }
            }
            0x31 => {
                // LD SP,nn
                let nn = bus.r16(self.state.pc.wrapping_add(1));
                self.state.sp = nn;
                (10, 3)
            }
            0x32 => {
                // LD (nn),A
                let pc = self.state.pc;
                let nn = bus.r16(pc.wrapping_add(1));
                bus.w8(nn, self.state.r8[R_A]);
                (13, 3)
            }
            0x33 => {
                // INC SP
                self.state.sp = self.state.sp.wrapping_add(1);
                (6, 1)
            }
            0x34 => {
                // INC (HL)
                let addr = self.state.get_hl();
                let v = bus.r8(addr);
                let (res, flags) = self.add8(v, 1, false);
                bus.w8(addr, res);
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (11, 1)
            }
            0x35 => {
                // DEC (HL)
                let addr = self.state.get_hl();
                let v = bus.r8(addr);
                let (res, flags) = self.sub8(v, 1, false);
                bus.w8(addr, res);
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (11, 1)
            }
            0x36 => {
                // LD (HL),n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                bus.w8(self.state.get_hl(), n);
                (10, 2)
            }
            0x37 => {
                // SCF
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_PV))
                    | (self.state.r8[R_A] & F_5)
                    | (self.state.r8[R_A] & F_3)
                    | F_C;
                (4, 1)
            }
            0x38 => {
                // JR C e
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_C != 0 {
                    let e = bus.r8s(pc.wrapping_add(1)) as i16;
                    self.state.pc = pc.wrapping_add(2).wrapping_add(e as u16);
                    (12, 0)
                } else {
                    (7, 2)
                }
            }
            0x39 => {
                // ADD HL,SP
                let hl = self.state.get_hl();
                let (res, flags) = self.add16(hl, self.state.sp, false);
                self.state.set_hl(res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (11, 1)
            }
            0x3A => {
                // LD A,(nn)
                let pc = self.state.pc;
                let nn = bus.r16(pc.wrapping_add(1));
                self.state.r8[R_A] = bus.r8(nn);
                (13, 3)
            }
            0x3B => {
                // DEC SP
                self.state.sp = self.state.sp.wrapping_sub(1);
                (6, 1)
            }
            0x3C => {
                // INC A
                let (res, flags) = self.add8(self.state.r8[R_A], 1, false);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x3D => {
                // DEC A
                let (res, flags) = self.sub8(self.state.r8[R_A], 1, false);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (4, 1)
            }
            0x3E => {
                // LD A,n
                let n = bus.r8(self.state.pc.wrapping_add(1));
                self.state.r8[R_A] = n;
                (7, 2)
            }
            0x3F => {
                // CCF
                let cf = self.state.r8[R_F] & F_C;
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_PV))
                    | (self.state.r8[R_A] & F_5)
                    | (self.state.r8[R_A] & F_3)
                    | (cf << 4)
                    | (cf ^ F_C);
                (4, 1)
            }
            // 0x40-0x7F: LD r,r'  y=dst 0..7=B,C,D,E,H,L,(HL),A  z=src 0..7=B,C,D,E,H,L,(HL),A
            // 0x40 LD B,B  0x41 LD B,C  0x42 LD B,D  0x43 LD B,E  0x44 LD B,H  0x45 LD B,L  0x46 LD B,(HL) 0x47 LD B,A
            // 0x48 LD C,B  ... 0x4F LD C,A  0x50 LD D,B ... 0x57 LD D,A  0x58 LD E,B ... 0x5F LD E,A
            // 0x60 LD H,B ... 0x67 LD H,A  0x68 LD L,B ... 0x6F LD L,A  0x70 LD (HL),B ... 0x75 LD (HL),L 0x76 HALT 0x77 LD (HL),A
            // 0x78 LD A,B ... 0x7F LD A,A  (see src/emulator/z80.rs:945 for full list)
            0x40..=0x7F => {
                if opcode == 0x76 {
                    // HALT
                    self.state.halted = 1;
                    (4, 1)
                } else {
                    let dst = (opcode >> 3) & 7;
                    let src = opcode & 7;
                    let src_val = if src == 6 {
                        bus.r8(self.state.get_hl()) // (HL)
                    } else {
                        self.state.r8[Self::reg_code_to_r8(src)] // B,C,D,E,H,L,A
                    };
                    if dst == 6 {
                        bus.w8(self.state.get_hl(), src_val); // LD (HL),r
                        (7, 1)
                    } else {
                        self.state.r8[Self::reg_code_to_r8(dst)] = src_val; // LD r,r' / LD r,(HL)
                        (if src == 6 { 7 } else { 4 }, 1)
                    }
                }
            }
            // 0x80-0xBF: ALU A,r  y=0 ADD 1 ADC 2 SUB 3 SBC 4 AND 5 XOR 6 OR 7 CP ; z=0..7=B,C,D,E,H,L,(HL),A
            // 0x80 ADD A,B ... 0x87 ADD A,A  0x88 ADC A,B ... 0x8F ADC A,A  0x90 SUB B ... 0x97 SUB A
            // 0x98 SBC A,B ... 0x9F SBC A,A  0xA0 AND B ... 0xA7 AND A  0xA8 XOR B ... 0xAF XOR A
            // 0xB0 OR B ... 0xB7 OR A  0xB8 CP B ... 0xBF CP A  (src/emulator/z80.rs:1265)
            0x80..=0xBF => {
                let y = (opcode >> 3) & 7; // 0=ADD 1=ADC 2=SUB 3=SBC 4=AND 5=XOR 6=OR 7=CP
                let z = opcode & 7; // 0=B 1=C 2=D 3=E 4=H 5=L 6=(HL) 7=A
                let val = if z == 6 {
                    bus.r8(self.state.get_hl())
                } else {
                    self.state.r8[Self::reg_code_to_r8(z)]
                };
                self.alu_y(y, val);
                (if z == 6 { 7 } else { 4 }, 1)
            }
            0xC0 => {
                // RET NZ
                if self.state.r8[R_F] & F_Z != 0 {
                    (5, 1)
                } else {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                }
            }
            0xC1 => {
                // POP BC
                let val = self.pop16(bus);
                self.state.set_bc(val);
                (10, 1)
            }
            0xC2 => {
                // JP NZ,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_Z != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                }
            }
            0xC3 => {
                // JP nn
                let pc = self.state.pc;
                let nn = bus.r16(pc.wrapping_add(1));
                self.state.pc = nn;
                (10, 0)
            }
            0xC4 => {
                // CALL NZ,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_Z != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                }
            }
            0xC5 => {
                // PUSH BC
                self.push16(bus, self.state.get_bc());
                (11, 1)
            }
            0xC6 => {
                // ADD A,n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                let (res, flags) = self.add8(self.state.r8[R_A], n, false);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = flags;
                (7, 2)
            }
            0xC7 => {
                // RST 00H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x00;
                (11, 0)
            }
            0xC8 => {
                // RET Z
                if self.state.r8[R_F] & F_Z != 0 {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                } else {
                    (5, 1)
                }
            }
            0xC9 => {
                // RET
                let addr = self.pop16(bus);
                self.state.pc = addr;
                (10, 0)
            }
            0xCA => {
                // JP Z,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_Z != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xCB => (4, 1), // CB
            0xCC => {
                // CALL Z,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_Z != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xCD => {
                // CALL nn
                let pc = self.state.pc;
                let nn = bus.r16(pc.wrapping_add(1));
                self.push16(bus, pc.wrapping_add(3));
                self.state.pc = nn;
                (17, 0)
            }
            0xCE => {
                // ADC A,n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                let (res, flags) =
                    self.add8(self.state.r8[R_A], n, (self.state.r8[R_F] & F_C) != 0);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = flags;
                (7, 2)
            }
            0xCF => {
                // RST 08H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x08;
                (11, 0)
            }
            0xD0 => {
                // RET NC
                if self.state.r8[R_F] & F_C != 0 {
                    (5, 1)
                } else {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                }
            }
            0xD1 => {
                // POP DE
                let val = self.pop16(bus);
                self.state.set_de(val);
                (10, 1)
            }
            0xD2 => {
                // JP NC,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_C != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                }
            }
            0xD3 => {
                // OUT (n),A
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                bus.out8(n, self.state.r8[R_A], self.state.r8[R_A]);
                (11, 2)
            }
            0xD4 => {
                // CALL NC,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_C != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                }
            }
            0xD5 => {
                // PUSH DE
                self.push16(bus, self.state.get_de());
                (11, 1)
            }
            0xD6 => {
                // SUB n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                let (res, flags) = self.sub8(self.state.r8[R_A], n, false);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = flags;
                (7, 2)
            }
            0xD7 => {
                // RST 10H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x10;
                (11, 0)
            }
            0xD8 => {
                // RET C
                if self.state.r8[R_F] & F_C != 0 {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                } else {
                    (5, 1)
                }
            }
            0xD9 => {
                // EXX
                let b = self.state.r8[R_B];
                self.state.r8[R_B] = self.state.r8[R_BA];
                self.state.r8[R_BA] = b;
                let c = self.state.r8[R_C];
                self.state.r8[R_C] = self.state.r8[R_CA];
                self.state.r8[R_CA] = c;
                let d = self.state.r8[R_D];
                self.state.r8[R_D] = self.state.r8[R_DA];
                self.state.r8[R_DA] = d;
                let e = self.state.r8[R_E];
                self.state.r8[R_E] = self.state.r8[R_EA];
                self.state.r8[R_EA] = e;
                let h = self.state.r8[R_H];
                self.state.r8[R_H] = self.state.r8[R_HA];
                self.state.r8[R_HA] = h;
                let l = self.state.r8[R_L];
                self.state.r8[R_L] = self.state.r8[R_LA];
                self.state.r8[R_LA] = l;
                (4, 1)
            }
            0xDA => {
                // JP C,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_C != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xDB => {
                // IN A,(n)
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                self.state.r8[R_A] = bus.in8(n, self.state.r8[R_A]);
                (11, 2)
            }
            0xDC => {
                // CALL C,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_C != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xDD => (4, 1), // DD
            0xDE => {
                // SBC A,n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                let (res, flags) =
                    self.sub8(self.state.r8[R_A], n, (self.state.r8[R_F] & F_C) != 0);
                self.state.r8[R_A] = res;
                self.state.r8[R_F] = flags;
                (7, 2)
            }
            0xDF => {
                // RST 18H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x18;
                (11, 0)
            }
            0xE0 => {
                // RET PO
                if self.state.r8[R_F] & F_PV != 0 {
                    (5, 1)
                } else {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                }
            }
            0xE1 => {
                // POP HL
                let val = self.pop16(bus);
                self.state.set_hl(val);
                (10, 1)
            }
            0xE2 => {
                // JP PO,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_PV != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                }
            }
            0xE3 => {
                // EX (SP),HL
                let sp = self.state.sp;
                let memval = bus.r16(sp);
                bus.w16reverse(sp, self.state.get_hl());
                self.state.set_hl(memval);
                (19, 1)
            }
            0xE4 => {
                // CALL PO,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_PV != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                }
            }
            0xE5 => {
                // PUSH HL
                self.push16(bus, self.state.get_hl());
                (11, 1)
            }
            0xE6 => {
                // AND n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                self.state.r8[R_A] &= n;
                self.state.r8[R_F] = self.sz53p_table[self.state.r8[R_A] as usize] | F_H;
                (7, 2)
            }
            0xE7 => {
                // RST 20H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x20;
                (11, 0)
            }
            0xE8 => {
                // RET PE
                if self.state.r8[R_F] & F_PV != 0 {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                } else {
                    (5, 1)
                }
            }
            0xE9 => {
                // JP (HL)
                self.state.pc = self.state.get_hl();
                (4, 0)
            }
            0xEA => {
                // JP PE,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_PV != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xEB => {
                // EX DE,HL
                let de = self.state.get_de();
                self.state.set_de(self.state.get_hl());
                self.state.set_hl(de);
                (4, 1)
            }
            0xEC => {
                // CALL PE,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_PV != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xED => (4, 1), // ED
            0xEE => {
                // XOR n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                self.state.r8[R_A] ^= n;
                self.state.r8[R_F] = self.sz53p_table[self.state.r8[R_A] as usize];
                (7, 2)
            }
            0xEF => {
                // RST 28H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x28;
                (11, 0)
            }
            0xF0 => {
                // RET P
                if self.state.r8[R_F] & F_S != 0 {
                    (5, 1)
                } else {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                }
            }
            0xF1 => {
                // POP AF
                let val = self.pop16(bus);
                self.state.set_af(val);
                (10, 1)
            }
            0xF2 => {
                // JP P,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_S != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                }
            }
            0xF3 => {
                // DI
                self.state.iff1 = 0;
                self.state.iff2 = 0;
                (4, 1)
            }
            0xF4 => {
                // CALL P,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_S != 0 {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                } else {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                }
            }
            0xF5 => {
                // PUSH AF
                self.push16(bus, self.state.get_af());
                (11, 1)
            }
            0xF6 => {
                // OR n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                self.state.r8[R_A] |= n;
                self.state.r8[R_F] = self.sz53p_table[self.state.r8[R_A] as usize];
                (7, 2)
            }
            0xF7 => {
                // RST 30H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x30;
                (11, 0)
            }
            0xF8 => {
                // RET M
                if self.state.r8[R_F] & F_S != 0 {
                    let addr = self.pop16(bus);
                    self.state.pc = addr;
                    (11, 0)
                } else {
                    (5, 1)
                }
            }
            0xF9 => {
                // LD SP,HL
                self.state.sp = self.state.get_hl();
                (6, 1)
            }
            0xFA => {
                // JP M,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_S != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.state.pc = nn;
                    (10, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xFB => {
                // EI
                self.state.iff1 = 1;
                self.state.iff2 = 1;
                (4, 1)
            }
            0xFC => {
                // CALL M,nn
                let pc = self.state.pc;
                if self.state.r8[R_F] & F_S != 0 {
                    let nn = bus.r16(pc.wrapping_add(1));
                    self.push16(bus, pc.wrapping_add(3));
                    self.state.pc = nn;
                    (17, 0)
                } else {
                    bus.r16nolog(pc.wrapping_add(1));
                    (10, 3)
                }
            }
            0xFD => (4, 1), // FD
            0xFE => {
                // CP n
                let pc = self.state.pc;
                let n = bus.r8(pc.wrapping_add(1));
                let (_, flags) = self.sub8(self.state.r8[R_A], n, false);
                self.state.r8[R_F] = (flags & !(F_5 | F_3)) | (n & (F_5 | F_3));
                (7, 2)
            }
            0xFF => {
                // RST 38H
                let pc = self.state.pc;
                self.push16(bus, pc.wrapping_add(1));
                self.state.pc = 0x38;
                (11, 0)
            }
        }
    }

    // CB prefixed: x = 0 ROT/SHIFT y=0 RLC 1 RRC 2 RL 3 RR 4 SLA 5 SRA 6 SLL 7 SRL
    //              x = 1 BIT y,z   x=2 RES y,z   x=3 SET y,z   z=0..7 B C D E H L (HL) A
    // collapses src/emulator/z80.rs:2297 256 arms (see CB table in info/tvc.md)
    pub fn execute_cb<M: CpuBus>(&mut self, opcode: u8, bus: &mut M) -> (u32, u8) {
        let hl = self.state.get_hl();
        let x = opcode >> 6;
        let y = (opcode >> 3) & 7;
        let z = opcode & 7;
        match x {
            0 => {
                // ROT/SHIFT y=0 RLC 1 RRC 2 RL 3 RR 4 SLA 5 SRA 6 SLL 7 SRL
                let is_hl = z == 6;
                let val = if is_hl {
                    bus.r8(hl)
                } else {
                    self.state.r8[Self::reg_code_to_r8(z)]
                };
                let (res, flags) = match y {
                    0 => self.shl8(val, (val & 0x80) != 0),             // RLC
                    1 => self.shr8(val, (val & 0x01) != 0),             // RRC
                    2 => self.shl8(val, self.state.r8[R_F] & F_C != 0), // RL
                    3 => self.shr8(val, self.state.r8[R_F] & F_C != 0), // RR
                    4 => self.shl8(val, false),                         // SLA
                    5 => self.shr8(val, (val & 0x80) != 0),             // SRA
                    6 => self.shl8(val, true),                          // SLL
                    7 => self.shr8(val, false),                         // SRL
                    _ => unreachable!(),
                };
                if is_hl {
                    bus.w8(hl, res);
                    self.state.r8[R_F] = flags;
                    (15, 2)
                } else {
                    self.state.r8[Self::reg_code_to_r8(z)] = res;
                    self.state.r8[R_F] = flags;
                    (8, 2)
                }
            }
            1 => {
                // BIT y,z  y=bit 0..7
                let srcval = if z == 6 {
                    bus.r8(hl)
                } else {
                    self.state.r8[Self::reg_code_to_r8(z)]
                };
                let mask = 1u8 << y;
                let val = srcval & mask;
                self.state.r8[R_F] = (val & F_S)
                    | (if val != 0 { 0 } else { F_Z | F_PV })
                    | (srcval & (F_3 | F_5))
                    | F_H
                    | (self.state.r8[R_F] & F_C);
                (if z == 6 { 12 } else { 8 }, 2)
            }
            2 => {
                // RES y,z  reset bit y
                let bit = !(1u8 << y);
                if z == 6 {
                    let v = bus.r8(hl) & bit;
                    bus.w8(hl, v);
                    (15, 2)
                } else {
                    self.state.r8[Self::reg_code_to_r8(z)] &= bit;
                    (8, 2)
                }
            }
            3 => {
                // SET y,z  set bit y
                let bit = 1u8 << y;
                if z == 6 {
                    let v = bus.r8(hl) | bit;
                    bus.w8(hl, v);
                    (15, 2)
                } else {
                    self.state.r8[Self::reg_code_to_r8(z)] |= bit;
                    (8, 2)
                }
            }
            _ => unreachable!(),
        }
    }

    pub fn execute_ed<M: CpuBus>(&mut self, opcode: u8, bus: &mut M) -> (u32, u8) {
        let x = opcode >> 6;
        let y = (opcode >> 3) & 7;
        let z = opcode & 7;
        let p = y >> 1;
        let q = y & 1;
        if x == 1 {
            match z {
                0 => {
                    // IN r,(C)
                    let reg = match y {
                        0 => R_B,
                        1 => R_C,
                        2 => R_D,
                        3 => R_E,
                        4 => R_H,
                        5 => R_L,
                        6 => 255, // F
                        7 => R_A,
                        _ => unreachable!(),
                    };
                    let val = bus.in8(self.state.r8[R_C], self.state.r8[R_B]);
                    if reg == 255 {
                        self.state.r8[R_F] =
                            (self.state.r8[R_F] & F_C) | self.sz53p_table[val as usize];
                    } else {
                        self.state.r8[reg] = val;
                        self.state.r8[R_F] =
                            (self.state.r8[R_F] & F_C) | self.sz53p_table[val as usize];
                    }
                    return (12, 2);
                }
                1 => {
                    // OUT (C),r  / OUT (C),0
                    let val = match y {
                        0 => self.state.r8[R_B],
                        1 => self.state.r8[R_C],
                        2 => self.state.r8[R_D],
                        3 => self.state.r8[R_E],
                        4 => self.state.r8[R_H],
                        5 => self.state.r8[R_L],
                        6 => 0,
                        7 => self.state.r8[R_A],
                        _ => unreachable!(),
                    };
                    bus.out8(self.state.r8[R_C], val, self.state.r8[R_B]);
                    return (12, 2);
                }
                2 => {
                    // SBC/ADC HL, rp
                    let rp = match p {
                        0 => self.state.get_bc(),
                        1 => self.state.get_de(),
                        2 => self.state.get_hl(),
                        3 => self.state.sp,
                        _ => unreachable!(),
                    };
                    let hl = self.state.get_hl();
                    if q == 0 {
                        let (res, flags) = self.sub16(hl, rp, self.state.r8[R_F] & F_C != 0);
                        self.state.set_hl(res);
                        self.state.r8[R_F] = flags;
                    } else {
                        let (res, flags) = self.add16(hl, rp, self.state.r8[R_F] & F_C != 0);
                        self.state.set_hl(res);
                        self.state.r8[R_F] = flags;
                    }
                    return (15, 2);
                }
                3 => {
                    // LD (nn),rp / LD rp,(nn)
                    let pc = self.state.pc;
                    let nn = bus.r16(pc.wrapping_add(2));
                    let rp_idx = p as usize + 1; // BC=1, DE=2, HL=3, SP special
                    if q == 0 {
                        // LD (nn),rp
                        let val = if p == 3 {
                            self.state.sp
                        } else {
                            self.state.get_reg16(rp_idx)
                        };
                        bus.w16(nn, val);
                    } else {
                        // LD rp,(nn)
                        let val = bus.r16(nn);
                        if p == 3 {
                            self.state.sp = val;
                        } else {
                            self.state.set_reg16(rp_idx, val);
                        }
                    }
                    return (20, 4);
                }
                4 => {
                    // NEG — 8 mirrors
                    let (res, flags) = self.sub8(0, self.state.r8[R_A], false);
                    self.state.r8[R_A] = res;
                    self.state.r8[R_F] = flags;
                    return (8, 2);
                }
                5 => {
                    // RETN / RETI
                    if y == 1 {
                        // RETI
                        let addr = self.pop16(bus);
                        self.state.pc = addr;
                    } else {
                        // RETN — 7 mirrors
                        self.state.iff1 = self.state.iff2;
                        let addr = self.pop16(bus);
                        self.state.pc = addr;
                    }
                    return (14, 0);
                }
                6 => {
                    // IM
                    match y {
                        0 | 1 | 4 | 5 => self.state.im = 0,
                        2 | 6 => self.state.im = 1,
                        3 | 7 => self.state.im = 2,
                        _ => unreachable!(),
                    }
                    return (8, 2);
                }
                7 => {
                    match y {
                        0 => self.state.r8[R_I] = self.state.r8[R_A],
                        1 => self.state.r8[R_R] = self.state.r8[R_A],
                        2 => {
                            self.state.r8[R_A] = self.state.r8[R_I];
                            self.state.r8[R_F] = (self.state.r8[R_F] & F_C)
                                | self.sz53_table[self.state.r8[R_A] as usize]
                                | (if self.state.iff2 != 0 { F_PV } else { 0 });
                        }
                        3 => {
                            self.state.r8[R_A] = self.state.r8[R_R];
                            self.state.r8[R_F] = (self.state.r8[R_F] & F_C)
                                | self.sz53_table[self.state.r8[R_A] as usize]
                                | (if self.state.iff2 != 0 { F_PV } else { 0 });
                        }
                        4 => {
                            let addr = self.state.get_hl();
                            let memval = bus.r8(addr);
                            bus.w8(addr, ((self.state.r8[R_A] & 0x0F) << 4) | (memval >> 4));
                            self.state.r8[R_A] = (self.state.r8[R_A] & 0xF0) | (memval & 0x0F);
                            self.state.r8[R_F] = (self.state.r8[R_F] & F_C)
                                | self.sz53p_table[self.state.r8[R_A] as usize];
                        }
                        5 => {
                            let addr = self.state.get_hl();
                            let memval = bus.r8(addr);
                            bus.w8(addr, ((memval & 0x0F) << 4) | (self.state.r8[R_A] & 0x0F));
                            self.state.r8[R_A] = (self.state.r8[R_A] & 0xF0) | (memval >> 4);
                            self.state.r8[R_F] = (self.state.r8[R_F] & F_C)
                                | self.sz53p_table[self.state.r8[R_A] as usize];
                        }
                        _ => {} // fall through to block ops for 0x77, 0x7F NOPs
                    }
                    if y <= 5 {
                        return (if y <= 3 { 9 } else { 18 }, 2);
                    }
                }
                _ => unreachable!(),
            }
        }
        // block ops
        match opcode {
            0xA0 => {
                // LDI
                let de = self.state.get_de();
                let hl = self.state.get_hl();
                let bc = self.state.get_bc();
                let memval = bus.r8(hl);
                bus.w8(de, memval);
                let de = de.wrapping_add(1);
                let hl = hl.wrapping_add(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_de(de);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = memval.wrapping_add(self.state.r8[R_A]);
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_C))
                    | (if bc != 0 { F_PV } else { 0 })
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 });
                (16, 2)
            }
            0xA1 => {
                // RES 4,(IY+d),C
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let (_, flags) = self.sub8(self.state.r8[R_A], memval, false);
                let hl = hl.wrapping_add(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = self.state.r8[R_A]
                    .wrapping_sub(memval)
                    .wrapping_sub(if (flags & F_H) != 0 { 1 } else { 0 });
                self.state.r8[R_F] = F_N
                    | (self.state.r8[R_F] & F_C)
                    | (flags & (F_S | F_Z | F_H))
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 })
                    | (if bc != 0 { F_PV } else { 0 });
                (16, 2)
            }
            0xA2 => {
                // RES 4,(IY+d),D
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let regval = bus.in8(self.state.r8[R_C], self.state.r8[R_B]);
                bus.w8(hl, regval);
                let hl = hl.wrapping_add(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                let tmp = (regval as u16).wrapping_add((bc.wrapping_add(1)) & 0xFF);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (regval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((regval.wrapping_add((bc.wrapping_add(1) & 0xFF) as u8))
                        & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                (16, 2)
            }
            0xA3 => {
                // RES 4,(IY+d),E
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let hl = hl.wrapping_add(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                bus.out8(self.state.r8[R_C], memval, self.state.r8[R_B]);
                let tmp = (memval as u16).wrapping_add(self.state.r8[R_L] as u16);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (memval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((memval.wrapping_add(self.state.r8[R_L])) & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                (16, 2)
            }
            0xA8 => {
                // RES 5,(IY+d),B
                let de = self.state.get_de();
                let hl = self.state.get_hl();
                let bc = self.state.get_bc();
                let memval = bus.r8(hl);
                bus.w8(de, memval);
                let de = de.wrapping_sub(1);
                let hl = hl.wrapping_sub(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_de(de);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = memval.wrapping_add(self.state.r8[R_A]);
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_C))
                    | (if bc != 0 { F_PV } else { 0 })
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 });
                (16, 2)
            }
            0xA9 => {
                // RES 5,(IY+d),C
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let (_, flags) = self.sub8(self.state.r8[R_A], memval, false);
                let hl = hl.wrapping_sub(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = self.state.r8[R_A]
                    .wrapping_sub(memval)
                    .wrapping_sub(if (flags & F_H) != 0 { 1 } else { 0 });
                self.state.r8[R_F] = F_N
                    | (self.state.r8[R_F] & F_C)
                    | (flags & (F_S | F_Z | F_H))
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 })
                    | (if bc != 0 { F_PV } else { 0 });
                (16, 2)
            }
            0xAA => {
                // RES 5,(IY+d),D
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let regval = bus.in8(self.state.r8[R_C], self.state.r8[R_B]);
                bus.w8(hl, regval);
                let hl = hl.wrapping_sub(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                let tmp = (regval as u16).wrapping_add((bc.wrapping_sub(1)) & 0xFF);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (regval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((regval.wrapping_add((bc.wrapping_sub(1) & 0xFF) as u8))
                        & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                (16, 2)
            }
            0xAB => {
                // RES 5,(IY+d),E
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let hl = hl.wrapping_sub(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                bus.out8(self.state.r8[R_C], memval, self.state.r8[R_B]);
                let tmp = (memval as u16).wrapping_add(self.state.r8[R_L] as u16);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (memval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((memval.wrapping_add(self.state.r8[R_L])) & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                (16, 2)
            }
            0xB0 => {
                // RES 6,(IY+d),B
                let de = self.state.get_de();
                let hl = self.state.get_hl();
                let bc = self.state.get_bc();
                let memval = bus.r8(hl);
                bus.w8(de, memval);
                let de = de.wrapping_add(1);
                let hl = hl.wrapping_add(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_de(de);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = memval.wrapping_add(self.state.r8[R_A]);
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_C))
                    | (if bc != 0 { F_PV } else { 0 })
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 });
                if self.state.get_bc() != 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0xB1 => {
                // RES 6,(IY+d),C
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let (_, flags) = self.sub8(self.state.r8[R_A], memval, false);
                let hl = hl.wrapping_add(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = self.state.r8[R_A]
                    .wrapping_sub(memval)
                    .wrapping_sub(if (flags & F_H) != 0 { 1 } else { 0 });
                self.state.r8[R_F] = F_N
                    | (self.state.r8[R_F] & F_C)
                    | (flags & (F_S | F_Z | F_H))
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 })
                    | (if bc != 0 { F_PV } else { 0 });
                if self.state.get_bc() != 0 && (self.state.r8[R_F] & F_Z) == 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0xB2 => {
                // RES 6,(IY+d),D
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let regval = bus.in8(self.state.r8[R_C], self.state.r8[R_B]);
                bus.w8(hl, regval);
                let hl = hl.wrapping_add(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                let tmp = (regval as u16).wrapping_add((bc.wrapping_add(1)) & 0xFF);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (regval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((regval.wrapping_add((bc.wrapping_add(1) & 0xFF) as u8))
                        & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                if self.state.r8[R_B] != 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0xB3 => {
                // RES 6,(IY+d),E
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let hl = hl.wrapping_add(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                bus.out8(self.state.r8[R_C], memval, self.state.r8[R_B]);
                let tmp = (memval as u16).wrapping_add(self.state.r8[R_L] as u16);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (memval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((memval.wrapping_add(self.state.r8[R_L])) & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                if self.state.r8[R_B] != 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0xB8 => {
                // RES 7,(IY+d),B
                let de = self.state.get_de();
                let hl = self.state.get_hl();
                let bc = self.state.get_bc();
                let memval = bus.r8(hl);
                bus.w8(de, memval);
                let de = de.wrapping_sub(1);
                let hl = hl.wrapping_sub(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_de(de);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = memval.wrapping_add(self.state.r8[R_A]);
                self.state.r8[R_F] = (self.state.r8[R_F] & (F_S | F_Z | F_C))
                    | (if bc != 0 { F_PV } else { 0 })
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 });
                if self.state.get_bc() != 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0xB9 => {
                // RES 7,(IY+d),C
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let (_, flags) = self.sub8(self.state.r8[R_A], memval, false);
                let hl = hl.wrapping_sub(1);
                let bc = bc.wrapping_sub(1);
                self.state.set_hl(hl);
                self.state.set_bc(bc);
                let tmp = self.state.r8[R_A]
                    .wrapping_sub(memval)
                    .wrapping_sub(if (flags & F_H) != 0 { 1 } else { 0 });
                self.state.r8[R_F] = F_N
                    | (self.state.r8[R_F] & F_C)
                    | (flags & (F_S | F_Z | F_H))
                    | (tmp & F_3)
                    | (if (tmp & 0x02) != 0 { F_5 } else { 0 })
                    | (if bc != 0 { F_PV } else { 0 });
                if self.state.get_bc() != 0 && (self.state.r8[R_F] & F_Z) == 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0xBA => {
                // RES 7,(IY+d),D
                let bc = self.state.get_bc();
                let hl = self.state.get_hl();
                let regval = bus.in8(self.state.r8[R_C], self.state.r8[R_B]);
                bus.w8(hl, regval);
                let hl = hl.wrapping_sub(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                let tmp = (regval as u16).wrapping_add((bc.wrapping_sub(1)) & 0xFF);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (regval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((regval.wrapping_add((bc.wrapping_sub(1) & 0xFF) as u8))
                        & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                if self.state.r8[R_B] != 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            0x77 => (8, 2), // BIT 6,(IY+d)
            0x7F => (8, 2), // BIT 7,(IY+d)
            0xBB => {
                // RES 7,(IY+d),E
                let hl = self.state.get_hl();
                let memval = bus.r8(hl);
                let hl = hl.wrapping_sub(1);
                self.state.set_hl(hl);
                let (res, flags) = self.sub8(self.state.r8[R_B], 1, false);
                self.state.r8[R_B] = res;
                bus.out8(self.state.r8[R_C], memval, self.state.r8[R_B]);
                let tmp = (memval as u16).wrapping_add(self.state.r8[R_L] as u16);
                self.state.r8[R_F] = (flags & (F_S | F_Z | F_5 | F_3))
                    | (if (memval & 0x80) != 0 { F_N } else { 0 })
                    | (if tmp > 0xFF { F_H | F_C } else { 0 })
                    | (self.sz53p_table[(((memval.wrapping_add(self.state.r8[R_L])) & 7)
                        ^ self.state.r8[R_B]) as usize]
                        & F_PV);
                if self.state.r8[R_B] != 0 {
                    (21, 0)
                } else {
                    (16, 2)
                }
            }
            _ => (0, 0),
        }
    }

    fn execute_indexed<M: CpuBus>(
        &mut self,
        opcode: u8,
        displ: i8,
        bus: &mut M,
        base: usize,
    ) -> (u32, u8) {
        // Generic DD/FD — replaces two 577-line copies
        let is_ix = base == R_IX;
        let prefix_ir = if is_ix { "IX" } else { "IY" };
        let _ = prefix_ir;
        match opcode {
            0x09 => {
                // RRC (IY+d),C
                let v = self.state.get_reg16(base);
                let (res, flags) = self.add16(v, self.state.get_bc(), false);
                self.state.set_reg16(base, res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (15, 2)
            }
            0x19 => {
                // RR (IY+d),C
                let v = self.state.get_reg16(base);
                let (res, flags) = self.add16(v, self.state.get_de(), false);
                self.state.set_reg16(base, res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (15, 2)
            }
            0x29 => {
                // SRA (IY+d),C
                let v = self.state.get_reg16(base);
                let (res, flags) = self.add16(v, v, false);
                self.state.set_reg16(base, res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (15, 2)
            }
            0x39 => {
                // SRL (IY+d),C
                let v = self.state.get_reg16(base);
                let (res, flags) = self.add16(v, self.state.sp, false);
                self.state.set_reg16(base, res);
                self.state.r8[R_F] =
                    (flags & !(F_S | F_Z | F_PV)) | (self.state.r8[R_F] & (F_S | F_Z | F_PV));
                (15, 2)
            }
            // helper to get IXH/IXL etc mapping
            0x21 => {
                // SLA (IY+d),C
                let nn = bus.r16(self.state.pc.wrapping_add(2));
                self.state.set_reg16(base, nn);
                (14, 4)
            }
            0x22 => {
                // SLA (IY+d),D
                let nn = bus.r16(self.state.pc.wrapping_add(2));
                bus.w16(nn, self.state.get_reg16(base));
                (20, 4)
            }
            0x2A => {
                // SRA (IY+d),D
                let nn = bus.r16(self.state.pc.wrapping_add(2));
                self.state.set_reg16(base, bus.r16(nn));
                (20, 4)
            }
            0x23 => {
                // SLA (IY+d),E
                self.state
                    .set_reg16(base, self.state.get_reg16(base).wrapping_add(1));
                (10, 2)
            }
            0x2B => {
                // SRA (IY+d),E
                self.state
                    .set_reg16(base, self.state.get_reg16(base).wrapping_sub(1));
                (10, 2)
            }
            0x34 => {
                // SLL (IY+d),H
                let d = bus.r8s(self.state.pc.wrapping_add(2));
                let addr = (self.state.get_reg16(base) as i32 + d as i32) as u16;
                let v = bus.r8(addr);
                let (res, flags) = self.add8(v, 1, false);
                bus.w8(addr, res);
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (23, 3)
            }
            0x35 => {
                // SLL (IY+d),L
                let d = bus.r8s(self.state.pc.wrapping_add(2));
                let addr = (self.state.get_reg16(base) as i32 + d as i32) as u16;
                let v = bus.r8(addr);
                let (res, flags) = self.sub8(v, 1, false);
                bus.w8(addr, res);
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (23, 3)
            }
            0x36 => {
                // SLL (IY+d)
                let d = bus.r8s(self.state.pc.wrapping_add(2));
                let addr = (self.state.get_reg16(base) as i32 + d as i32) as u16;
                let n = bus.r8(self.state.pc.wrapping_add(3));
                bus.w8(addr, n);
                (19, 4)
            }
            0x24 => {
                // INC IXH / IYH
                let idx = if is_ix { R_XH } else { R_YH };
                let (res, flags) = self.add8(self.state.r8[idx], 1, false);
                self.state.r8[idx] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (8, 2)
            }
            0x25 => {
                // SLA (IY+d),L
                let idx = if is_ix { R_XH } else { R_YH };
                let (res, flags) = self.sub8(self.state.r8[idx], 1, false);
                self.state.r8[idx] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (8, 2)
            }
            0x26 => {
                // SLA (IY+d)
                let idx = if is_ix { R_XH } else { R_YH };
                let n = bus.r8(self.state.pc.wrapping_add(2));
                self.state.r8[idx] = n;
                (11, 3)
            }
            0x2C => {
                // SRA (IY+d),H
                let idx = if is_ix { R_XL } else { R_YL };
                let (res, flags) = self.add8(self.state.r8[idx], 1, false);
                self.state.r8[idx] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (8, 2)
            }
            0x2D => {
                // SRA (IY+d),L
                let idx = if is_ix { R_XL } else { R_YL };
                let (res, flags) = self.sub8(self.state.r8[idx], 1, false);
                self.state.r8[idx] = res;
                self.state.r8[R_F] = (flags & !F_C) | (self.state.r8[R_F] & F_C);
                (8, 2)
            }
            0x2E => {
                // SRA (IY+d)
                let idx = if is_ix { R_XL } else { R_YL };
                let n = bus.r8(self.state.pc.wrapping_add(2));
                self.state.r8[idx] = n;
                (11, 3)
            }
            0xE1 => {
                // SET 4,(IY+d),C
                let v = self.pop16(bus);
                self.state.set_reg16(base, v);
                (14, 2)
            }
            0xE3 => {
                // SET 4,(IY+d),E
                let sp = self.state.sp;
                let memval = bus.r16(sp);
                bus.w16reverse(sp, self.state.get_reg16(base));
                self.state.set_reg16(base, memval);
                (23, 2)
            }
            0xE5 => {
                // SET 4,(IY+d),L
                self.push16(bus, self.state.get_reg16(base));
                (15, 2)
            }
            0xE9 => {
                // SET 5,(IY+d),C
                self.state.pc = self.state.get_reg16(base);
                (8, 0)
            }
            0xF9 => {
                // SET 7,(IY+d),C
                self.state.sp = self.state.get_reg16(base);
                (10, 2)
            }
            // indexed LD r,(IX+d) and LD (IX+d),r and ALU (IX+d)
            _ => {
                // Decode remaining indexed ops via y/z like base but with d
                // 0x46/0x4E etc are LD r,(IX+d); 0x70-0x77 are LD (IX+d),r; 0x86/0x8E etc ALU
                let x = opcode >> 6;
                let y = (opcode >> 3) & 7;
                let z = opcode & 7;
                if x == 1 {
                    // LD r,(IX+d) or LD (IX+d),r
                    if y == 6 && z != 6 {
                        // LD (IX+d),r  — z is src reg
                        let d = bus.r8s(self.state.pc.wrapping_add(2));
                        let addr = (self.state.get_reg16(base) as i32 + d as i32) as u16;
                        let val = self.state.r8[Self::reg_code_to_r8(z)];
                        bus.w8(addr, val);
                        return (19, 3);
                    } else if z == 6 && y != 6 {
                        // LD r,(IX+d)
                        let d = bus.r8s(self.state.pc.wrapping_add(2));
                        let addr = (self.state.get_reg16(base) as i32 + d as i32) as u16;
                        let val = bus.r8(addr);
                        self.state.r8[Self::reg_code_to_r8(y)] = val;
                        return (19, 3);
                    } else if y == 4 || y == 5 || z == 4 || z == 5 {
                        // LD IXH/IXL,r  or LD r,IXH/IXL
                        // already handled some above; handle generically
                        let dst_is_idx = y == 4 || y == 5;
                        let src_is_idx = z == 4 || z == 5;
                        if dst_is_idx || src_is_idx {
                            let dst_idx = if y == 4 {
                                if is_ix { R_XH } else { R_YH }
                            } else if y == 5 {
                                if is_ix { R_XL } else { R_YL }
                            } else {
                                Self::reg_code_to_r8(y)
                            };
                            let src_idx = if z == 4 {
                                if is_ix { R_XH } else { R_YH }
                            } else if z == 5 {
                                if is_ix { R_XL } else { R_YL }
                            } else {
                                Self::reg_code_to_r8(z)
                            };
                            // avoid (HL) case which is not index
                            if y != 6 && z != 6 {
                                self.state.r8[dst_idx] = self.state.r8[src_idx];
                                return (8, 2);
                            }
                        }
                    }
                } else if x == 2 && z == 6 {
                    // ALU (IX+d)
                    let d = bus.r8s(self.state.pc.wrapping_add(2));
                    let addr = (self.state.get_reg16(base) as i32 + d as i32) as u16;
                    let val = bus.r8(addr);
                    self.alu_y(y, val);
                    return (19, 3);
                } else if x == 2 && (z == 4 || z == 5) {
                    // ALU A,IXH/IXL
                    let src_idx = if z == 4 {
                        if is_ix { R_XH } else { R_YH }
                    } else {
                        if is_ix { R_XL } else { R_YL }
                    };
                    let val = self.state.r8[src_idx];
                    self.alu_y(y, val);
                    return (8, 2);
                }
                // check displ use for 0x86 etc fallback via original: need handle 0xCB
                let _ = displ;
                return (0, 0);
            }
        }
    }

    fn execute_indexed_cb<M: CpuBus>(
        &mut self,
        opcode: u8,
        displ: i8,
        bus: &mut M,
        base: usize,
    ) -> (u32, u8) {
        // Single implementation replaces 2*2157 lines
        let addr = (self.state.get_reg16(base) as i32 + displ as i32) as u16;
        let x = opcode >> 6;
        let y = (opcode >> 3) & 7;
        let z = opcode & 7;
        match x {
            0 => {
                let val = bus.r8(addr);
                let (res, flags) = match y {
                    0 => self.shl8(val, (val & 0x80) != 0),
                    1 => self.shr8(val, (val & 0x01) != 0),
                    2 => self.shl8(val, self.state.r8[R_F] & F_C != 0),
                    3 => self.shr8(val, self.state.r8[R_F] & F_C != 0),
                    4 => self.shl8(val, false),
                    5 => self.shr8(val, (val & 0x80) != 0),
                    6 => self.shl8(val, true),
                    7 => self.shr8(val, false),
                    _ => unreachable!(),
                };
                bus.w8(addr, res);
                if z != 6 {
                    self.state.r8[Self::reg_code_to_r8(z)] = res;
                }
                self.state.r8[R_F] = flags;
                (23, 4)
            }
            1 => {
                let val = bus.r8(addr);
                let mask = 1u8 << y;
                let bit = val & mask;
                self.state.r8[R_F] = (bit & F_S)
                    | (if bit != 0 { 0 } else { F_Z | F_PV })
                    | ((addr >> 8) as u8 & (F_3 | F_5))
                    | F_H
                    | (self.state.r8[R_F] & F_C);
                (20, 4)
            }
            2 => {
                let v = bus.r8(addr) & !(1u8 << y);
                bus.w8(addr, v);
                if z != 6 {
                    self.state.r8[Self::reg_code_to_r8(z)] = v;
                }
                (23, 4)
            }
            3 => {
                let v = bus.r8(addr) | (1u8 << y);
                bus.w8(addr, v);
                if z != 6 {
                    self.state.r8[Self::reg_code_to_r8(z)] = v;
                }
                (23, 4)
            }
            _ => unreachable!(),
        }
    }
}
