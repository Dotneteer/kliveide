#![allow(dead_code)]

use crate::fd1793::FD1793;

struct MemBlock {
    name: String,
    is_ram: bool,
    data: Vec<u8>,
}

impl MemBlock {
    fn new(name: &str, is_ram: bool, size: usize) -> Self {
        MemBlock {
            name: name.to_string(),
            is_ram,
            data: vec![0; size],
        }
    }

    fn from_slice(name: &str, is_ram: bool, buffer: &[u8], offset: usize, size: usize) -> Self {
        let mut data = vec![0; size];
        let len = size.min(buffer.len().saturating_sub(offset));
        data[..len].copy_from_slice(&buffer[offset..offset + len]);
        MemBlock {
            name: name.to_string(),
            is_ram,
            data,
        }
    }
}

pub struct HBF {
    rom0: MemBlock,
    rom1: MemBlock,
    rom2: MemBlock,
    rom3: MemBlock,
    rom: usize,
    ram: MemBlock,
    fdc: FD1793,
}

impl HBF {
    pub fn new(rom: &[u8]) -> Self {
        HBF {
            rom0: MemBlock::from_slice("ROM0", false, rom, 0x0000, 0x1000),
            rom1: MemBlock::from_slice("ROM1", false, rom, 0x1000, 0x1000),
            rom2: MemBlock::from_slice("ROM2", false, rom, 0x2000, 0x1000),
            rom3: MemBlock::from_slice("ROM3", false, rom, 0x3000, 0x1000),
            rom: 0,
            ram: MemBlock::new("RAM", true, 4096),
            fdc: FD1793::new(),
        }
    }

    pub fn get_type(&self) -> u8 {
        2
    }

    pub fn read_port(&mut self, addr: u8) -> u8 {
        if addr <= 4 { self.fdc.read(addr) } else { 0 }
    }

    pub fn write_port(&mut self, addr: u8, val: u8) {
        if addr <= 4 {
            self.fdc.write(addr, val);
        } else if addr == 8 {
            self.rom = match val & 0x30 {
                0x00 => 0,
                0x10 => 1,
                0x20 => 2,
                0x30 => 3,
                _ => self.rom,
            };
        }
    }

    pub fn r8(&mut self, addr: u16) -> u8 {
        if addr >= 0x1000 {
            self.ram.data[addr as usize - 0x1000]
        } else {
            let rom = match self.rom {
                0 => &self.rom0,
                1 => &self.rom1,
                2 => &self.rom2,
                _ => &self.rom3,
            };
            rom.data[addr as usize]
        }
    }

    pub fn w8(&mut self, addr: u16, val: u8) {
        if addr >= 0x1000 {
            self.ram.data[addr as usize - 0x1000] = val;
        }
    }

    pub fn load_disk(&mut self, drive: usize, name: &str, data: &[u8]) {
        self.fdc.load_dsk(drive, name, data);
    }

    pub fn disk_bytes(&self, drive: usize) -> Option<&[u8]> {
        self.fdc.disk_bytes(drive)
    }

    pub fn disk_name(&self, drive: usize) -> Option<&str> {
        self.fdc.disk_name(drive)
    }

    pub fn disk_dirty(&self, drive: usize) -> bool {
        self.fdc.disk_dirty(drive)
    }

    pub fn clear_disk_dirty(&mut self, drive: usize) {
        self.fdc.clear_disk_dirty(drive);
    }

    pub fn get_fdc_mut(&mut self) -> &mut FD1793 {
        &mut self.fdc
    }

    pub fn write_snapshot(&self, w: &mut crate::snapshot::Writer) {
        w.usize(self.rom);
        w.raw_bytes(&self.ram.data);
        self.fdc.write_snapshot(w);
    }

    pub fn read_snapshot(
        &mut self,
        r: &mut crate::snapshot::Reader<'_>,
    ) -> crate::snapshot::Result<()> {
        self.rom = r.usize()?.min(3);
        self.ram.data.copy_from_slice(r.raw_bytes(0x1000)?);
        self.fdc.read_snapshot(r)
    }
}
