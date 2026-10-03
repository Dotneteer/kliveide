#![allow(dead_code)]

/// CPU-facing memory and I/O bus used by the Z80 core.
pub trait CpuBus {
    fn r8(&mut self, addr: u16) -> u8;
    fn w8(&mut self, addr: u16, val: u8);

    fn r8s(&mut self, addr: u16) -> i8 {
        self.r8(addr) as i8
    }

    fn r16(&mut self, addr: u16) -> u16 {
        self.r8(addr) as u16 | ((self.r8(addr.wrapping_add(1)) as u16) << 8)
    }

    fn r16nolog(&mut self, addr: u16) -> u16 {
        self.r16(addr)
    }

    fn w16(&mut self, addr: u16, val: u16) {
        self.w8(addr, (val & 0xFF) as u8);
        self.w8(addr.wrapping_add(1), ((val >> 8) & 0xFF) as u8);
    }

    fn w16reverse(&mut self, addr: u16, val: u16) {
        self.w8(addr.wrapping_add(1), ((val >> 8) & 0xFF) as u8);
        self.w8(addr, (val & 0xFF) as u8);
    }

    fn out8(&mut self, _port: u8, _val: u8, _expected_val: u8) {}

    fn in8(&mut self, _port: u8, val: u8) -> u8 {
        val
    }
}

/// Simple flat CPU bus for testing.
pub struct FakeBus {
    pub mem: [u8; 0x10000],
    pub log: Vec<String>,
    pub logging_enabled: bool,
}

impl FakeBus {
    pub fn new() -> Self {
        FakeBus {
            mem: [0; 0x10000],
            log: Vec::new(),
            logging_enabled: false,
        }
    }

    pub fn clear(&mut self) {
        self.mem = [0; 0x10000];
    }
}

impl CpuBus for FakeBus {
    fn r8(&mut self, addr: u16) -> u8 {
        let val = self.mem[addr as usize];
        if self.logging_enabled {
            self.log.push(format!("MR {:04X} {:02X}", addr, val));
        }
        val
    }

    fn w8(&mut self, addr: u16, val: u8) {
        if self.logging_enabled {
            self.log.push(format!("MW {:04X} {:02X}", addr, val));
        }
        self.mem[addr as usize] = val;
    }

    fn r16nolog(&mut self, addr: u16) -> u16 {
        let was_logging = self.logging_enabled;
        self.logging_enabled = false;
        let val = self.r16(addr);
        self.logging_enabled = was_logging;
        val
    }

    fn out8(&mut self, port: u8, val: u8, expected_val: u8) {
        if self.logging_enabled {
            self.log
                .push(format!("PW {:02X}{:02X} {:02X}", expected_val, port, val));
        }
    }

    fn in8(&mut self, port: u8, val: u8) -> u8 {
        if self.logging_enabled {
            self.log
                .push(format!("PR {:02X}{:02X} {:02X}", val, port, val));
        }
        val
    }
}
