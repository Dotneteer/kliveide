#![allow(dead_code)]

const ST_NOTREADY: u8 = 0x80;
const ST_READONLY: u8 = 0x40;
const ST_WRFAULT: u8 = 0x20;
const ST_HEADLOADED: u8 = 0x20;
const ST_RECTYPE: u8 = 0x20;
const ST_SEEKERR: u8 = 0x10;
const ST_RECNF: u8 = 0x10;
const ST_CRCERR: u8 = 0x08;
const ST_TRACK0: u8 = 0x04;
const ST_LOSTDATA: u8 = 0x04;
const ST_INDEX: u8 = 0x02;
const ST_DRQ: u8 = 0x02;
const ST_BUSY: u8 = 0x01;

const PRT_INTRQ: u8 = 0x01;
const PRT_DRQ: u8 = 0x80;

const CMD_READSEC: u8 = 1;
const CMD_READADDR: u8 = 2;
const CMD_WRITESEC: u8 = 3;

struct FDisk {
    log: bool,
    name: String,
    dsk: Option<Vec<u8>>,
    sectors_per_track: u16,
    sector_size: u16,
    tot_sec: u16,
    num_heads: u16,
    tracks_per_side: u16,
    data: u8,
    sector: u8,
    track: u8,
    side: u8,
    position: usize,
    read_offset: usize,
    read_length: usize,
    read_source: u8,
    read_buffer: [u8; 6],
    write_offset: usize,
    write_length: usize,
    writing: bool,
    dirty: bool,
}

impl FDisk {
    fn new() -> Self {
        FDisk {
            log: false,
            name: String::new(),
            dsk: None,
            sectors_per_track: 9,
            sector_size: 512,
            tot_sec: 720,
            num_heads: 1,
            tracks_per_side: 80,
            data: 0,
            sector: 0,
            track: 0,
            side: 0,
            position: 0,
            read_offset: 0,
            read_length: 0,
            read_source: 0,
            read_buffer: [0; 6],
            write_offset: 0,
            write_length: 0,
            writing: false,
            dirty: false,
        }
    }

    fn is_ready(&self) -> bool {
        self.dsk.is_some()
    }

    fn load_dsk(&mut self, name: &str, dsk: &[u8]) {
        self.name = name.to_string();
        self.dsk = Some(dsk.to_vec());
        self.dirty = false;
        self.parse();
    }

    fn disk_bytes(&self) -> Option<&[u8]> {
        self.dsk.as_deref()
    }

    fn disk_name(&self) -> Option<&str> {
        if self.dsk.is_some() {
            Some(&self.name)
        } else {
            None
        }
    }

    fn is_dirty(&self) -> bool {
        self.dirty
    }

    fn clear_dirty(&mut self) {
        self.dirty = false;
    }

    fn sector_position(&self, track: u8, sector: u8, side: u8) -> Option<usize> {
        let dsk = self.dsk.as_ref()?;
        let track = track as u16;
        let sector = sector as u16;
        let side = side as u16;
        if sector == 0
            || sector > self.sectors_per_track
            || side >= self.num_heads
            || track >= self.tracks_per_side
        {
            return None;
        }

        let sector_index = (track as usize)
            .checked_mul((self.sectors_per_track * self.num_heads) as usize)?
            .checked_add((self.sectors_per_track * side) as usize)?
            .checked_add((sector - 1) as usize)?;
        let position = sector_index.checked_mul(self.sector_size as usize)?;
        let end = position.checked_add(self.sector_size as usize)?;
        (end <= dsk.len()).then_some(position)
    }

    fn seek(&mut self, track: u8, sector: u8, side: u8) -> bool {
        if let Some(position) = self.sector_position(track, sector, side) {
            self.position = position;
            self.track = track;
            self.side = side;
            true
        } else {
            false
        }
    }

    fn read_sector(&mut self, track: u8, sector: u8, side: u8) -> bool {
        if !self.seek(track, sector, side) {
            return false;
        }
        self.read_length = self.sector_size as usize;
        self.read_offset = 0;
        self.read_source = 0;
        self.writing = false;
        true
    }

    fn write_sector(&mut self, track: u8, sector: u8, side: u8) -> bool {
        if !self.seek(track, sector, side) {
            return false;
        }
        self.write_length = self.sector_size as usize;
        self.write_offset = 0;
        self.writing = true;
        true
    }

    fn read_address(&mut self, track: u8, side: u8) {
        self.read_length = 6;
        self.read_source = 1;
        self.read_offset = 0;
        self.writing = false;
        self.read_buffer[0] = track;
        self.read_buffer[1] = side;
        self.read_buffer[2] = 1;
        self.read_buffer[3] = self.sector_length_code();
        self.read_buffer[4] = 0;
        self.read_buffer[5] = 0;
    }

    fn sector_length_code(&self) -> u8 {
        match self.sector_size {
            128 => 0,
            256 => 1,
            512 => 2,
            1024 => 3,
            _ => 2,
        }
    }

    fn read(&mut self) -> bool {
        if self.read_offset < self.read_length {
            if self.read_source != 0 {
                self.data = self.read_buffer[self.read_offset];
            } else if let Some(ref dsk) = self.dsk {
                let addr = self.position + self.read_offset;
                self.data = if addr < dsk.len() { dsk[addr] } else { 0 };
            }
            self.read_offset += 1;
            false
        } else {
            true
        }
    }

    /// Write one byte into the DSK image. Returns `true` when the sector is
    /// fully written (transfer complete).
    fn write_byte(&mut self, val: u8) -> bool {
        if self.write_offset < self.write_length {
            if let Some(ref mut dsk) = self.dsk {
                let addr = self.position + self.write_offset;
                if addr < dsk.len() {
                    dsk[addr] = val;
                    self.dirty = true;
                }
            }
            self.write_offset += 1;
            self.write_offset >= self.write_length
        } else {
            true
        }
    }

    fn parse(&mut self) {
        if !self.is_ready() {
            return;
        }
        let dsk = self.dsk.as_ref().unwrap();
        if dsk.len() < 28 {
            return;
        }
        if dsk[0] == 0xEB {
            // TVC images commonly use `EB FE 90`; standard FAT images use
            // `EB xx 90`. Geometry is still in the BPB either way.
        } else if dsk[0] != 0xE9 {
            return;
        }
        let sector_size = dsk[11] as u16 | ((dsk[12] as u16) << 8);
        let sectors_per_cluster = dsk[13];
        let rsvd_sec_cnt = dsk[14] as u16 | ((dsk[15] as u16) << 8);
        let num_fat = dsk[16];
        let root_ent_cnt = dsk[17] as u16 | ((dsk[18] as u16) << 8);
        let tot_sec = dsk[19] as u16 | ((dsk[20] as u16) << 8);
        let fat_size = dsk[22] as u16 | ((dsk[23] as u16) << 8);
        let sec_per_trk = dsk[24] as u16 | ((dsk[25] as u16) << 8);
        let num_heads = dsk[26] as u16 | ((dsk[27] as u16) << 8);

        if sector_size == 0 || sec_per_trk == 0 || num_heads == 0 {
            return;
        }

        let root_dir_sectors =
            (root_ent_cnt as u32 * 32 + sector_size as u32 - 1) / sector_size as u32;
        let data_sec = tot_sec as u32
            - (rsvd_sec_cnt as u32 + (num_fat as u32 * fat_size as u32) + root_dir_sectors);
        let _count_of_clusters = data_sec / sectors_per_cluster.max(1) as u32;

        self.sector_size = sector_size;
        self.sectors_per_track = sec_per_trk;
        self.tot_sec = tot_sec;
        self.num_heads = num_heads;
        self.tracks_per_side = tot_sec / sec_per_trk / num_heads;
    }

    fn write_snapshot(&self, w: &mut crate::snapshot::Writer) {
        w.u8(self.data);
        w.u8(self.sector);
        w.u8(self.track);
        w.u8(self.side);
        w.usize(self.position);
        w.usize(self.read_offset);
        w.usize(self.read_length);
        w.u8(self.read_source);
        w.raw_bytes(&self.read_buffer);
        // v2 extension: write state
        w.usize(self.write_offset);
        w.usize(self.write_length);
        w.u8(self.writing as u8);
    }

    fn read_snapshot(
        &mut self,
        r: &mut crate::snapshot::Reader<'_>,
        has_write_state: bool,
    ) -> crate::snapshot::Result<()> {
        self.data = r.u8()?;
        self.sector = r.u8()?;
        self.track = r.u8()?;
        self.side = r.u8()?;
        self.position = r.usize()?;
        self.read_offset = r.usize()?;
        self.read_length = r.usize()?;
        self.read_source = r.u8()?;
        self.read_buffer.copy_from_slice(r.raw_bytes(6)?);
        if has_write_state {
            self.write_offset = r.usize()?;
            self.write_length = r.usize()?;
            self.writing = r.u8()? != 0;
        } else {
            self.write_offset = 0;
            self.write_length = 0;
            self.writing = false;
        }
        self.dirty = false;
        Ok(())
    }
}

#[cfg(test)]
#[path = "fd1793_tests.rs"]
mod tests;

impl Default for FDisk {
    fn default() -> Self {
        Self::new()
    }
}

pub struct FD1793 {
    log: bool,
    disks: [FDisk; 4],
    pr: u8,
    side: u8,
    dsk_idx: usize,
    active_dsk_idx: usize,
    intrq: u8,
    data: u8,
    track: u8,
    sector: u8,
    command: u8,
    commandtr: u8,
    status: u8,
}

impl FD1793 {
    pub fn new() -> Self {
        FD1793 {
            log: false,
            disks: [FDisk::new(), FDisk::new(), FDisk::new(), FDisk::new()],
            pr: 0,
            side: 0,
            dsk_idx: 0,
            active_dsk_idx: 0,
            intrq: 0,
            data: 0,
            track: 0,
            sector: 0,
            command: 0,
            commandtr: 0,
            status: 0,
        }
    }

    pub fn load_dsk(&mut self, drive: usize, name: &str, dsk: &[u8]) {
        if drive > 3 {
            return;
        }
        self.disks[drive].load_dsk(name, dsk);
    }

    pub fn disk_bytes(&self, drive: usize) -> Option<&[u8]> {
        self.disks.get(drive).and_then(FDisk::disk_bytes)
    }

    pub fn disk_name(&self, drive: usize) -> Option<&str> {
        self.disks.get(drive).and_then(FDisk::disk_name)
    }

    pub fn disk_dirty(&self, drive: usize) -> bool {
        self.disks.get(drive).is_some_and(FDisk::is_dirty)
    }

    pub fn clear_disk_dirty(&mut self, drive: usize) {
        if let Some(disk) = self.disks.get_mut(drive) {
            disk.clear_dirty();
        }
    }

    pub fn write_snapshot(&self, w: &mut crate::snapshot::Writer) {
        for disk in &self.disks {
            disk.write_snapshot(w);
        }
        w.u8(self.pr);
        w.u8(self.side);
        w.usize(self.dsk_idx);
        w.u8(self.intrq);
        w.u8(self.data);
        w.u8(self.track);
        w.u8(self.sector);
        w.u8(self.command);
        w.u8(self.commandtr);
        w.u8(self.status);
    }

    pub fn read_snapshot(
        &mut self,
        r: &mut crate::snapshot::Reader<'_>,
    ) -> crate::snapshot::Result<()> {
        const OLD_FDISK_SNAPSHOT_BYTES: usize = 35;
        const NEW_FDISK_SNAPSHOT_BYTES: usize = 52;
        const FD1793_SNAPSHOT_BYTES: usize = 17;
        let has_write_state = r.remaining() >= NEW_FDISK_SNAPSHOT_BYTES * 4 + FD1793_SNAPSHOT_BYTES;
        debug_assert!(
            has_write_state
                || r.remaining() >= OLD_FDISK_SNAPSHOT_BYTES * 4 + FD1793_SNAPSHOT_BYTES
        );
        for disk in &mut self.disks {
            disk.read_snapshot(r, has_write_state)?;
        }
        self.pr = r.u8()?;
        self.side = r.u8()?;
        self.dsk_idx = r.usize()?.min(3);
        self.active_dsk_idx = self.dsk_idx;
        self.intrq = r.u8()?;
        self.data = r.u8()?;
        self.track = r.u8()?;
        self.sector = r.u8()?;
        self.command = r.u8()?;
        self.commandtr = r.u8()?;
        self.status = r.u8()?;
        Ok(())
    }

    fn service_read_transfer(&mut self) {
        match self.commandtr {
            CMD_READSEC | CMD_READADDR => {
                let finished = self.disks[self.active_dsk_idx].read();
                if finished {
                    self.status &= !ST_BUSY;
                    self.intrq = PRT_INTRQ;
                } else {
                    self.status |= ST_DRQ;
                    self.data = self.disks[self.active_dsk_idx].data;
                }
            }
            _ => {}
        }
    }

    fn accept_write_data(&mut self, val: u8) {
        self.data = val;
        if self.commandtr != CMD_WRITESEC
            || (self.status & ST_BUSY) == 0
            || (self.status & ST_DRQ) == 0
        {
            return;
        }

        self.status &= !ST_DRQ;
        let finished = self.disks[self.active_dsk_idx].write_byte(val);
        if finished {
            self.status &= !ST_BUSY;
            self.intrq = PRT_INTRQ;
        } else {
            self.status |= ST_DRQ;
        }
    }

    fn selected_status_drive(&self) -> usize {
        if (self.status & ST_BUSY) != 0 {
            self.active_dsk_idx
        } else {
            self.dsk_idx
        }
    }

    fn finish_command_with_error(&mut self, error: u8) {
        self.commandtr = 0;
        self.status &= !(ST_BUSY | ST_DRQ);
        self.status |= error;
        self.intrq = PRT_INTRQ;
    }

    pub fn read(&mut self, addr: u8) -> u8 {
        if self.disks[self.selected_status_drive()].is_ready() {
            self.status &= !ST_NOTREADY;
        } else {
            self.status |= ST_NOTREADY;
        }

        match addr {
            0 => {
                let return_status = self.status;
                self.intrq = 0;
                return_status
            }
            1 => self.track,
            2 => self.sector,
            3 => {
                if (self.status & ST_DRQ) == 0 {
                    return 0;
                }
                let result = self.data;
                if self.commandtr != CMD_WRITESEC {
                    self.status &= !ST_DRQ;
                }
                result
            }
            4 => {
                if (self.status & ST_BUSY) != 0 && self.commandtr != CMD_WRITESEC {
                    self.service_read_transfer();
                }
                self.intrq
                    | if (self.status & ST_DRQ) != 0 {
                        PRT_DRQ
                    } else {
                        0
                    }
            }
            _ => 0,
        }
    }

    fn command(&mut self, val: u8) {
        let cmd = val >> 4;
        self.intrq = 0;
        self.command = val;
        self.commandtr = 0;
        self.status &= !(ST_BUSY | ST_DRQ | ST_RECNF | ST_CRCERR | ST_LOSTDATA);

        match cmd {
            // Restore
            0x00 => {
                self.intrq = PRT_INTRQ;
                if self.disks[self.dsk_idx].is_ready() {
                    self.track = 0;
                    let side = self.side;
                    if !self.disks[self.dsk_idx].seek(0, 1, side) {
                        self.status |= ST_SEEKERR;
                    }
                } else {
                    self.status |= ST_SEEKERR;
                }
            }
            // Seek
            0x01 => {
                let data = self.data;
                let sector = self.sector;
                let side = self.side;
                if self.disks[self.dsk_idx].seek(data, sector, side) {
                    self.track = self.data;
                } else {
                    self.status |= ST_SEEKERR;
                }
                self.intrq = PRT_INTRQ;
            }
            // Step In
            0x02 | 0x03 => {
                if self.disks[self.dsk_idx].is_ready() {
                    self.track = self.track.saturating_add(1);
                    let track = self.track;
                    let sector = self.sector;
                    let side = self.side;
                    if !self.disks[self.dsk_idx].seek(track, sector, side) {
                        self.status |= ST_SEEKERR;
                    }
                }
                self.intrq = PRT_INTRQ;
            }
            // Step Out
            0x04 | 0x05 => {
                if self.disks[self.dsk_idx].is_ready() {
                    self.track = self.track.saturating_sub(1);
                    let track = self.track;
                    let sector = self.sector;
                    let side = self.side;
                    if !self.disks[self.dsk_idx].seek(track, sector, side) {
                        self.status |= ST_SEEKERR;
                    }
                }
                self.intrq = PRT_INTRQ;
            }
            // Step (direction maintained)
            0x06 | 0x07 => {
                self.intrq = PRT_INTRQ;
            }
            // Read Sector
            0x08 | 0x09 => {
                let track = self.track;
                let sector = self.sector;
                if !self.disks[self.dsk_idx].is_ready() {
                    self.finish_command_with_error(ST_NOTREADY);
                } else if self.disks[self.dsk_idx].read_sector(track, sector, self.side) {
                    self.active_dsk_idx = self.dsk_idx;
                    self.commandtr = CMD_READSEC;
                    self.status |= ST_BUSY;
                } else {
                    self.finish_command_with_error(ST_RECNF);
                }
            }
            // Write Sector
            0x0A | 0x0B => {
                if !self.disks[self.dsk_idx].is_ready() {
                    self.status |= ST_NOTREADY;
                    self.intrq = PRT_INTRQ;
                } else {
                    let track = self.track;
                    let sector = self.sector;
                    if self.disks[self.dsk_idx].write_sector(track, sector, self.side) {
                        self.active_dsk_idx = self.dsk_idx;
                        self.commandtr = CMD_WRITESEC;
                        self.status |= ST_BUSY | ST_DRQ;
                    } else {
                        self.finish_command_with_error(ST_RECNF);
                    }
                }
            }
            // Read Address
            0x0C => {
                self.active_dsk_idx = self.dsk_idx;
                self.commandtr = CMD_READADDR;
                self.status |= ST_BUSY;
                self.disks[self.dsk_idx].read_address(self.track, self.side);
            }
            // Force Interrupt
            0x0D => {
                self.commandtr = 0;
                self.status &= !ST_BUSY;
                self.intrq = PRT_INTRQ;
            }
            // Read Track / Write Track (not implemented)
            0x0E | 0x0F => {}
            _ => {}
        }
    }

    pub fn write(&mut self, addr: u8, val: u8) {
        match addr {
            0 => self.command(val),
            1 => {
                self.track = val;
                if (self.status & ST_BUSY) == 0 {
                    self.status &= !ST_DRQ;
                }
            }
            2 => {
                self.sector = val;
                if (self.status & ST_BUSY) == 0 {
                    self.status &= !ST_DRQ;
                }
            }
            3 => {
                if self.commandtr == CMD_WRITESEC && (self.status & ST_BUSY) != 0 {
                    self.accept_write_data(val);
                } else {
                    self.data = val;
                    if (self.status & ST_BUSY) == 0 {
                        self.status &= !ST_DRQ;
                    }
                }
            }
            4 => {
                self.pr = val;
                if (val & 1) != 0 {
                    self.dsk_idx = 0;
                } else if (val & 2) != 0 {
                    self.dsk_idx = 1;
                } else if (val & 4) != 0 {
                    self.dsk_idx = 2;
                } else if (val & 8) != 0 {
                    self.dsk_idx = 3;
                } else {
                    self.dsk_idx = 0;
                }
                self.side = (self.pr & 0x80) >> 7;
            }
            _ => {}
        }
    }
}
