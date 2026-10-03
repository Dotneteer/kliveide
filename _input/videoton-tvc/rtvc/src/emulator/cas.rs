pub const TVC_CAS_HEADER_LEN: usize = 144;
pub const TVC_CAS_TYPE_BASIC: u8 = 0x01;

pub struct TapeInterval {
    pub level: f32, // 0.0 for low, 1.0 for high, 0.5 for silence
    pub start_cycle: u64,
}

/// Build a TVC CAS container: 144-byte header followed by payload.
pub fn encode_tvc_cas(payload: &[u8], file_type: u8, autostart: u8, load_addr: u16) -> Vec<u8> {
    let dfsize = TVC_CAS_HEADER_LEN + payload.len();
    let blocks = dfsize / 128;
    let remainder = dfsize % 128;
    let mut cas = vec![0; dfsize];
    cas[0] = 0x11;
    cas[2] = (blocks & 0xFF) as u8;
    cas[3] = (blocks >> 8) as u8;
    cas[4] = (remainder & 0xFF) as u8;
    cas[5] = (remainder >> 8) as u8;
    cas[0x80] = 0x00;
    cas[0x81] = file_type;
    cas[0x82] = (payload.len() & 0xFF) as u8;
    cas[0x83] = (payload.len() >> 8) as u8;
    cas[0x84] = autostart;
    cas[0x87] = (load_addr & 0xFF) as u8;
    cas[0x88] = (load_addr >> 8) as u8;
    cas[TVC_CAS_HEADER_LEN..].copy_from_slice(payload);
    cas
}

pub struct TapeBitstreamGenerator {
    pub intervals: Vec<TapeInterval>,
    pub total_cycles: u64,
    crc: u16,
}

impl TapeBitstreamGenerator {
    pub fn new(cas_data: &[u8], filename: &str) -> Result<Self, String> {
        let mut generator = TapeBitstreamGenerator {
            intervals: Vec::new(),
            total_cycles: 0,
            crc: 0,
        };
        generator.generate(cas_data, filename)?;
        Ok(generator)
    }

    fn push_interval(&mut self, level: f32, duration: u32) {
        self.intervals.push(TapeInterval {
            level,
            start_cycle: self.total_cycles,
        });
        self.total_cycles += duration as u64;
    }

    fn write_silence(&mut self, seconds: f32) {
        // The original cas2wav routine writes two 11,026-byte buffers for
        // each nominal second of silence.
        let cycles_silence = (22_052.0 * seconds) * (3_125_000.0 / 44_100.0);
        self.push_interval(0.5, cycles_silence as u32);
    }

    fn write_pre(&mut self, count: u32) {
        for _ in 0..count {
            self.push_interval(1.0, 638);
            self.push_interval(0.0, 638);
        }
    }

    fn write_sync(&mut self) {
        self.push_interval(1.0, 1205);
        self.push_interval(0.0, 1205);
    }

    fn write_bit(&mut self, bit: u8) {
        if bit == 0 {
            self.push_interval(1.0, 779);
            self.push_interval(0.0, 779);
        } else {
            self.push_interval(1.0, 567);
            self.push_interval(0.0, 567);
        }
    }

    fn update_crc(&mut self, bit: u8) {
        let bh = ((self.crc >> 8) & 0xFF) as u8;
        let al = if bit != 0 { 0x80 } else { 0x00 };
        let xor_al = al ^ bh;
        let cy = (xor_al & 0x80) != 0;

        if cy {
            self.crc ^= 0x0810;
        }
        self.crc = (self.crc << 1) & 0xFFFF;
        if cy {
            self.crc = (self.crc | 1) & 0xFFFF;
        }
    }

    fn write_byte(&mut self, b: u8, calculate_crc: bool) {
        for i in 0..8 {
            let bit = (b >> i) & 1;
            self.write_bit(bit);
            if calculate_crc {
                self.update_crc(bit);
            }
        }
    }

    fn write_word(&mut self, w: u16, calculate_crc: bool) {
        self.write_byte((w & 0xFF) as u8, calculate_crc);
        self.write_byte(((w >> 8) & 0xFF) as u8, calculate_crc);
    }

    pub fn get_signal_at_cycle(&self, cycle: u64) -> f32 {
        if cycle >= self.total_cycles {
            return 0.5;
        }
        match self
            .intervals
            .binary_search_by_key(&cycle, |interval| interval.start_cycle)
        {
            Ok(idx) => self.intervals[idx].level,
            Err(idx) => {
                if idx > 0 {
                    self.intervals[idx - 1].level
                } else {
                    0.5
                }
            }
        }
    }

    fn generate(&mut self, data: &[u8], filename: &str) -> Result<(), String> {
        if data.is_empty() || data[0] != 0x11 {
            return Err("Invalid CAS file: Missing standard 0x11 file identifier.".to_string());
        }
        if data.len() < 144 {
            return Err("Invalid CAS file: File too short.".to_string());
        }

        let bsl = data[2] as u16;
        let bsh = data[3] as u16;
        let brl = data[4] as u16;
        let brh = data[5] as u16;
        let dfsize = ((bsl + bsh * 256) as u32 * 128) + (brl + brh * 256) as u32;
        let payload_size = if dfsize > 144 { dfsize - 144 } else { 0 } as usize;

        if data.len() < 144 + payload_size {
            return Err("Invalid CAS file: Payload size mismatch.".to_string());
        }

        // Match the historical cas2wav converter's header read positions. Its
        // Pascal seek loop overshoots by one byte, so these fields start at
        // 0x81 rather than 0x80.
        let typecas = data[0x81];
        let _casauto = data[0x84];

        let payload = &data[144..144 + payload_size];

        let filename_clean = filename
            .to_uppercase()
            .chars()
            .filter(|c| c.is_ascii())
            .take(16)
            .collect::<String>();

        // --- 1. HEAD BLOCK ---
        self.write_silence(2.0);
        self.write_pre(10240);
        self.write_sync();

        self.write_byte(0x00, false);
        self.crc = 0;
        self.write_byte(0x6A, true);
        self.write_byte(0xFF, true); // head tmb
        self.write_byte(0x11, true); // non-buffered
        self.write_byte(0x00, true); // non writeprotected
        self.write_byte(0x01, true); // 1 sector in head
        self.write_byte(0x00, true); // sector number 0

        let bihs = 1 + filename_clean.len() + 16;
        self.write_byte(bihs as u8, true);
        self.write_byte(filename_clean.len() as u8, true);
        for c in filename_clean.chars() {
            self.write_byte(c as u8, true);
        }
        self.write_byte(0x00, true); // fill byte
        self.write_byte(typecas, true);
        self.write_word(payload_size as u16, true); // length of file
        // Match the historical cas2wav converter: it reads the CAS autostart
        // byte but writes zero into the generated tape header.
        self.write_byte(0x00, true);

        for _ in 0..10 {
            self.write_byte(0x00, true);
        }
        self.write_byte(0x00, true); // version number
        self.write_byte(0x00, true); // not last sector

        // write head CRC
        let head_crc = self.crc;
        self.write_word(head_crc, false);
        self.write_pre(5);

        // --- 2. DATA BLOCK HEAD ---
        self.write_silence(1.0);
        self.write_pre(5120);
        self.write_sync();

        self.write_byte(0x00, false);
        self.crc = 0;
        self.write_byte(0x6A, true);
        self.write_byte(0x00, true); // data tmb
        self.write_byte(0x11, true); // non-buffered
        self.write_byte(0x00, true); // non-writeprotected

        let sector_count = payload_size.div_ceil(256);
        if sector_count > u8::MAX as usize {
            return Err("Invalid CAS file: Payload has too many sectors.".to_string());
        }
        self.write_byte(sector_count as u8, true);

        // --- 3. DATA SECTORS ---
        let mut payload_ptr = 0;
        for secnum in 1..=sector_count {
            if secnum > 1 {
                self.crc = 0;
            }

            self.write_byte(secnum as u8, true);

            let sector_size = (payload_size - payload_ptr).min(256);
            let size = if sector_size == 256 {
                0
            } else {
                sector_size as u8
            };
            self.write_byte(size, true);

            if size == 0 {
                let end = payload_ptr + 256;
                for byte in &payload[payload_ptr..end] {
                    self.write_byte(*byte, true);
                }
                payload_ptr = end;
                self.write_byte(0x00, true); // standard sector end padding
            } else {
                let end = payload_ptr + sector_size;
                for byte in &payload[payload_ptr..end] {
                    self.write_byte(*byte, true);
                }
                payload_ptr = end;
                self.write_byte(0xFF, true); // partial sector end padding
            }

            let sector_crc = self.crc;
            self.write_word(sector_crc, false);
        }

        self.write_pre(5);
        self.write_silence(2.0);

        Ok(())
    }
}

#[cfg(test)]
#[path = "cas_tests.rs"]
mod tests;
