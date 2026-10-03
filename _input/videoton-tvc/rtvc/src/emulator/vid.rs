//! TVC video pipeline.
//!
//! The interleaved renderer deliberately has three hardware boundaries:
//! [`CrtcState`] emits timing/address signals, [`TvcVideoGenerator`] resolves
//! those signals and current TVC state into final IGRB video, and
//! [`TelevisionReceiver`] sees only that final video and its external sync.

#![allow(dead_code)]

const CPU_CLOCKS_PER_CHARACTER: u32 = 2;
const FRAMEBUFFER_WIDTH: usize = 608;
const FRAMEBUFFER_HEIGHT: usize = 288;
const FRAMEBUFFER_CHARACTER_CLOCKS: usize = FRAMEBUFFER_WIDTH / 8;

const SIGNAL_RING_SIZE: usize = 1 << 20;
const SIGNAL_RING_MASK: usize = SIGNAL_RING_SIZE - 1;
const MAX_LINE_CHARACTER_CLOCKS: usize = 256;

// Connected PAL-TV policy. These are receiver acceptance/aperture values, not
// CRTC limits. At 1.5625 MHz, 100 character clocks are a 64 us PAL line.
const MIN_H_PERIOD: usize = 90;
const MAX_H_PERIOD: usize = 110;
const H_LOCK_PERIODS: u8 = 3;
const H_MISSING_TIMEOUT: usize = MAX_H_PERIOD * 2;
const H_APERTURE_AFTER_SYNC: usize = 19;
const V_APERTURE_AFTER_SYNC: usize = 22;
// Capture starts 22 lines after VS and fills 288 lines, so a locked vertical
// period must leave room for the full aperture before the next VS.
const MIN_V_PERIOD: usize = V_APERTURE_AFTER_SYNC + FRAMEBUFFER_HEIGHT;
const MAX_V_PERIOD: usize = 340;

// The TVC's SN74LS123 circuits reshape raw CRTC sync. Their edge behavior is
// important here; exact board-variant RC widths remain an explicit
// approximation until measured component values are available.
const EXTERNAL_HSYNC_CHARACTER_CLOCKS: u8 = 8;
const EXTERNAL_VSYNC_LINES: u8 = 4;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum VidModel {
    FastFrame,
    Interleaved,
}

const fn port_color_to_igrb(value: u8) -> u8 {
    ((value & 0x40) >> 3) | ((value & 0x10) >> 2) | ((value & 0x04) >> 1) | (value & 0x01)
}

const fn igrb_to_rgba(value: u8) -> u32 {
    let intensity = if value & 8 != 0 { 0xff } else { 0x7f };
    let green = if value & 4 != 0 { intensity } else { 0 };
    let red = if value & 2 != 0 { intensity } else { 0 };
    let blue = if value & 1 != 0 { intensity } else { 0 };
    0xff00_0000 | (blue << 16) | (green << 8) | red
}

const IGRB_TO_RGBA: [u32; 16] = {
    let mut colors = [0; 16];
    let mut index = 0;
    while index < 16 {
        colors[index] = igrb_to_rgba(index as u8);
        index += 1;
    }
    colors
};

fn gen_address(ma: u16, raster: u8) -> u16 {
    let ma = ma & 0x0fff;
    ((raster as u16 & 3) << 6) | (ma & 0x003f) | ((ma & 0x3fc0) << 2)
}

#[derive(Clone, Copy)]
struct Color {
    port_value: u8,
    igrb: u8,
}

impl Color {
    const fn new() -> Self {
        Self {
            port_value: 0,
            igrb: 0,
        }
    }

    fn set(&mut self, value: u8) {
        self.port_value = value;
        self.igrb = port_color_to_igrb(value);
    }
}

#[derive(Clone, Copy, Debug, Default)]
struct CrtcTick {
    ma: u16,
    ra: u8,
    display_enable: bool,
    raw_hsync: bool,
    raw_vsync: bool,
    line_start: bool,
    cursor: bool,
}

struct CrtcState {
    reg_idx: u8,
    reg: [u8; 18],
    configured: bool,
    h_count: u16,
    row: u16,
    raster: u16,
    adjust_line: u16,
    in_adjust: bool,
    row_address: u16,
    hsync_remaining: u8,
    vsync_lines_remaining: u8,
}

impl CrtcState {
    fn new() -> Self {
        Self {
            reg_idx: 0,
            reg: [0; 18],
            configured: false,
            h_count: 0,
            row: 0,
            raster: 0,
            adjust_line: 0,
            in_adjust: false,
            row_address: 0,
            hsync_remaining: 0,
            vsync_lines_remaining: 0,
        }
    }

    fn reset_transient(&mut self) {
        self.h_count = 0;
        self.row = 0;
        self.raster = 0;
        self.adjust_line = 0;
        self.in_adjust = false;
        self.row_address = self.display_start();
        self.hsync_remaining = 0;
        self.vsync_lines_remaining = 0;
    }

    fn display_start(&self) -> u16 {
        (((self.reg[12] as u16 & 0x3f) << 8) | self.reg[13] as u16) & 0x3fff
    }

    fn cursor_address(&self) -> u16 {
        (((self.reg[14] as u16 & 0x3f) << 8) | self.reg[15] as u16) & 0x3fff
    }

    fn cursor_enabled(&self) -> bool {
        self.reg[10] & 0x60 != 0x20
    }

    fn horizontal_total(&self) -> u16 {
        self.reg[0] as u16
    }

    fn horizontal_displayed(&self) -> u16 {
        self.reg[1] as u16
    }

    fn line_character_clocks(&self) -> u16 {
        self.horizontal_total() + 1
    }

    fn max_raster(&self) -> u16 {
        (self.reg[9] & 0x1f) as u16
    }

    fn horizontal_sync_width(&self) -> u8 {
        let width = self.reg[3] & 0x0f;
        if width == 0 { 16 } else { width }
    }

    fn tick(&mut self) -> CrtcTick {
        let line_start = self.h_count == 0;
        if line_start
            && !self.in_adjust
            && self.row == (self.reg[7] & 0x7f) as u16
            && self.raster == 0
        {
            self.vsync_lines_remaining = 16;
        }
        if self.h_count == self.reg[2] as u16 {
            self.hsync_remaining = self.horizontal_sync_width();
        }

        let ma = self.row_address.wrapping_add(self.h_count) & 0x3fff;
        let display_enable = !self.in_adjust
            && self.row < (self.reg[6] & 0x7f) as u16
            && self.h_count < self.horizontal_displayed();
        let cursor_start = (self.reg[10] & 0x1f) as u16;
        let cursor_end = (self.reg[11] & 0x1f) as u16;
        let cursor = self.cursor_enabled()
            && display_enable
            && ma == self.cursor_address()
            && self.raster >= cursor_start
            && self.raster <= cursor_end;

        let result = CrtcTick {
            ma,
            ra: self.raster as u8,
            display_enable,
            raw_hsync: self.hsync_remaining != 0,
            raw_vsync: self.vsync_lines_remaining != 0,
            line_start,
            cursor,
        };

        self.advance();
        result
    }

    fn advance(&mut self) {
        if self.hsync_remaining != 0 {
            self.hsync_remaining -= 1;
        }
        if self.h_count != self.horizontal_total() {
            self.h_count = self.h_count.wrapping_add(1) & 0x00ff;
            return;
        }

        self.h_count = 0;
        if self.vsync_lines_remaining != 0 {
            self.vsync_lines_remaining -= 1;
        }

        if self.in_adjust {
            self.adjust_line += 1;
            if self.adjust_line >= (self.reg[5] & 0x1f) as u16 {
                self.start_frame();
            }
            return;
        }

        if self.raster != self.max_raster() {
            self.raster = self.raster.wrapping_add(1) & 0x001f;
        } else {
            self.raster = 0;
            if self.row != (self.reg[4] & 0x7f) as u16 {
                self.row = self.row.wrapping_add(1) & 0x007f;
                self.row_address =
                    self.row_address.wrapping_add(self.horizontal_displayed()) & 0x3fff;
            } else if self.reg[5] & 0x1f != 0 {
                self.in_adjust = true;
                self.adjust_line = 0;
            } else {
                self.start_frame();
            }
        }
    }

    fn start_frame(&mut self) {
        self.row = 0;
        self.raster = 0;
        self.adjust_line = 0;
        self.in_adjust = false;
        self.row_address = self.display_start();
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
struct VideoSignal {
    /// Eight final four-bit IGRB pixels, leftmost pixel in the low nibble.
    pixels: u32,
    hsync: bool,
    vsync: bool,
    blanked: bool,
}

impl VideoSignal {
    fn pixel(self, index: usize) -> u8 {
        ((self.pixels >> (index * 4)) & 0x0f) as u8
    }
}

struct TvcVideoGenerator {
    mode: u8,
    palette: [Color; 4],
    border_port_value: u8,
    border_igrb: u8,
    previous_raw_hsync: bool,
    previous_raw_vsync: bool,
    external_hsync_remaining: u8,
    external_vsync_remaining: u8,
    vertical_blanked: bool,
}

impl TvcVideoGenerator {
    fn new() -> Self {
        Self {
            mode: 0,
            palette: [Color::new(); 4],
            border_port_value: 0,
            border_igrb: 0,
            previous_raw_hsync: false,
            previous_raw_vsync: false,
            external_hsync_remaining: 0,
            external_vsync_remaining: 0,
            vertical_blanked: false,
        }
    }

    fn reset_transient(&mut self) {
        self.previous_raw_hsync = false;
        self.previous_raw_vsync = false;
        self.external_hsync_remaining = 0;
        self.external_vsync_remaining = 0;
        self.vertical_blanked = false;
    }

    fn emit(&mut self, tick: CrtcTick, vram: &[u8]) -> VideoSignal {
        if tick.raw_hsync && !self.previous_raw_hsync {
            self.external_hsync_remaining = EXTERNAL_HSYNC_CHARACTER_CLOCKS;
        }
        if tick.raw_vsync && !self.previous_raw_vsync {
            self.external_vsync_remaining = EXTERNAL_VSYNC_LINES;
            self.vertical_blanked = true;
        }
        // The TVC blanking latch is set by VS and released by CRTC MA9.
        if tick.ma & 0x0200 != 0 {
            self.vertical_blanked = false;
        }

        let hsync = self.external_hsync_remaining != 0;
        let vsync = self.external_vsync_remaining != 0;
        let blanked = hsync || self.vertical_blanked;
        let pixels = if blanked {
            0
        } else if tick.display_enable {
            let address = gen_address(tick.ma, tick.ra) as usize;
            self.paper_pixels(vram.get(address).copied().unwrap_or(0))
        } else {
            repeat_igrb(self.border_igrb)
        };

        if self.external_hsync_remaining != 0 {
            self.external_hsync_remaining -= 1;
        }
        if tick.line_start && self.external_vsync_remaining != 0 {
            self.external_vsync_remaining -= 1;
        }
        self.previous_raw_hsync = tick.raw_hsync;
        self.previous_raw_vsync = tick.raw_vsync;
        VideoSignal {
            pixels,
            hsync,
            vsync,
            blanked,
        }
    }

    fn paper_pixels(&self, byte: u8) -> u32 {
        match self.mode {
            0 => {
                let mut packed = 0;
                for pixel in 0..8 {
                    let index = ((byte >> (7 - pixel)) & 1) as usize;
                    packed |= (self.palette[index].igrb as u32) << (pixel * 4);
                }
                packed
            }
            1 => {
                let mut packed = 0;
                for source_pixel in 0..4 {
                    let index = (((byte >> (3 - source_pixel)) & 1) << 1)
                        | ((byte >> (7 - source_pixel)) & 1);
                    let color = self.palette[index as usize].igrb as u32;
                    packed |= color << (source_pixel * 8);
                    packed |= color << (source_pixel * 8 + 4);
                }
                packed
            }
            _ => {
                let left = port_color_to_igrb(byte >> 1) as u32;
                let right = port_color_to_igrb(byte) as u32;
                repeat_igrb(left as u8) & 0x0000_ffff | (repeat_igrb(right as u8) & 0xffff_0000)
            }
        }
    }
}

const fn repeat_igrb(color: u8) -> u32 {
    (color as u32) * 0x1111_1111
}

struct SignalRing {
    samples: Vec<VideoSignal>,
    head: usize,
    tail: usize,
    dropped: bool,
}

impl SignalRing {
    fn new() -> Self {
        Self {
            samples: vec![VideoSignal::default(); SIGNAL_RING_SIZE],
            head: 0,
            tail: 0,
            dropped: false,
        }
    }

    fn clear(&mut self) {
        self.head = 0;
        self.tail = 0;
        self.dropped = false;
    }

    fn push(&mut self, signal: VideoSignal) {
        let next = (self.head + 1) & SIGNAL_RING_MASK;
        if next == self.tail {
            self.tail = (self.tail + 1) & SIGNAL_RING_MASK;
            self.dropped = true;
        }
        self.samples[self.head] = signal;
        self.head = next;
    }

    fn pop(&mut self) -> Option<VideoSignal> {
        if self.head == self.tail {
            None
        } else {
            let signal = self.samples[self.tail];
            self.tail = (self.tail + 1) & SIGNAL_RING_MASK;
            Some(signal)
        }
    }

    fn take_dropped(&mut self) -> bool {
        std::mem::take(&mut self.dropped)
    }
}

struct TelevisionReceiver {
    previous_hsync: bool,
    previous_vsync: bool,
    clocks_since_hsync: usize,
    lines_since_vsync: usize,
    measured_h_period: Option<usize>,
    measured_v_period: Option<usize>,
    stable_h_periods: u8,
    horizontal_locked: bool,
    vertical_origin_seen: bool,
    vertical_locked: bool,
    line: [VideoSignal; MAX_LINE_CHARACTER_CLOCKS],
    line_len: usize,
    output_y: usize,
}

impl TelevisionReceiver {
    fn new() -> Self {
        Self {
            previous_hsync: false,
            previous_vsync: false,
            clocks_since_hsync: 0,
            lines_since_vsync: 0,
            measured_h_period: None,
            measured_v_period: None,
            stable_h_periods: 0,
            horizontal_locked: false,
            vertical_origin_seen: false,
            vertical_locked: false,
            line: [VideoSignal::default(); MAX_LINE_CHARACTER_CLOCKS],
            line_len: 0,
            output_y: 0,
        }
    }

    fn lose_vertical_lock(&mut self) {
        self.measured_v_period = None;
        self.vertical_origin_seen = false;
        self.vertical_locked = false;
        self.output_y = 0;
    }

    fn lose_lock(&mut self) {
        self.previous_hsync = false;
        self.previous_vsync = false;
        self.clocks_since_hsync = 0;
        self.lines_since_vsync = 0;
        self.measured_h_period = None;
        self.stable_h_periods = 0;
        self.horizontal_locked = false;
        self.line_len = 0;
        self.lose_vertical_lock();
    }

    fn consume(&mut self, signal: VideoSignal, framebuffer: &mut [u32], width: usize) -> bool {
        let hsync_edge = signal.hsync && !self.previous_hsync;
        let vsync_edge = signal.vsync && !self.previous_vsync;
        let mut frame_complete = false;

        if hsync_edge {
            let period = self.clocks_since_hsync;
            self.observe_horizontal_period(period);
            if self.horizontal_locked && self.vertical_locked {
                frame_complete = self.copy_completed_line(framebuffer, width);
            }
            self.line_len = 0;
            self.clocks_since_hsync = 0;
            if self.horizontal_locked {
                self.lines_since_vsync += 1;
                if self.lines_since_vsync > MAX_V_PERIOD {
                    self.lose_vertical_lock();
                }
            }
        }

        if vsync_edge {
            self.observe_vertical_period();
        }

        if self.line_len < MAX_LINE_CHARACTER_CLOCKS {
            self.line[self.line_len] = signal;
            self.line_len += 1;
        }
        self.clocks_since_hsync += 1;
        if self.clocks_since_hsync > H_MISSING_TIMEOUT {
            self.lose_lock();
        }
        self.previous_hsync = signal.hsync;
        self.previous_vsync = signal.vsync;
        frame_complete
    }

    fn observe_horizontal_period(&mut self, period: usize) {
        if !(MIN_H_PERIOD..=MAX_H_PERIOD).contains(&period) {
            self.measured_h_period = None;
            self.stable_h_periods = 0;
            self.horizontal_locked = false;
            self.lose_vertical_lock();
            return;
        }
        let stable = self
            .measured_h_period
            .is_some_and(|old| old.abs_diff(period) <= 1);
        if stable {
            self.stable_h_periods = self.stable_h_periods.saturating_add(1);
        } else {
            self.stable_h_periods = 1;
            self.lose_vertical_lock();
        }
        self.measured_h_period = Some(period);
        self.horizontal_locked = self.stable_h_periods >= H_LOCK_PERIODS;
    }

    fn observe_vertical_period(&mut self) {
        if !self.horizontal_locked {
            self.lose_vertical_lock();
            self.lines_since_vsync = 0;
            return;
        }
        if !self.vertical_origin_seen {
            self.vertical_origin_seen = true;
            self.vertical_locked = false;
            self.measured_v_period = None;
            self.lines_since_vsync = 0;
            self.output_y = 0;
            return;
        }
        let period = self.lines_since_vsync;
        let plausible = (MIN_V_PERIOD..=MAX_V_PERIOD).contains(&period);
        self.vertical_locked = plausible;
        self.measured_v_period = plausible.then_some(period);
        self.lines_since_vsync = 0;
        self.output_y = 0;
    }

    fn copy_completed_line(&mut self, framebuffer: &mut [u32], width: usize) -> bool {
        if self.lines_since_vsync < V_APERTURE_AFTER_SYNC || self.output_y >= FRAMEBUFFER_HEIGHT {
            return false;
        }
        if width < FRAMEBUFFER_WIDTH || framebuffer.len() < width * FRAMEBUFFER_HEIGHT {
            return false;
        }
        let Some(period) = self.measured_h_period else {
            return false;
        };
        if self.line_len < period.min(MAX_LINE_CHARACTER_CLOCKS) {
            return false;
        }
        let base = self.output_y * width;
        for character in 0..FRAMEBUFFER_CHARACTER_CLOCKS {
            let source = (H_APERTURE_AFTER_SYNC + character) % period;
            let signal = self.line[source];
            for pixel in 0..8 {
                let igrb = if signal.blanked {
                    0
                } else {
                    signal.pixel(pixel)
                };
                framebuffer[base + character * 8 + pixel] = IGRB_TO_RGBA[igrb as usize];
            }
        }
        self.output_y += 1;
        self.output_y == FRAMEBUFFER_HEIGHT
    }
}

pub struct Vid {
    crtc: CrtcState,
    generator: TvcVideoGenerator,
    ring: SignalRing,
    television: TelevisionReceiver,
    run_for: u32,
}

impl Vid {
    pub fn new() -> Self {
        Self {
            crtc: CrtcState::new(),
            generator: TvcVideoGenerator::new(),
            ring: SignalRing::new(),
            television: TelevisionReceiver::new(),
            run_for: 0,
        }
    }

    pub fn reset(&mut self) {
        self.crtc.reg_idx = 0;
        self.crtc.reg = [0; 18];
        self.crtc.configured = false;
        self.crtc.reset_transient();
        self.generator = TvcVideoGenerator::new();
        self.ring.clear();
        self.television.lose_lock();
        self.run_for = 0;
    }

    pub fn set_reg_idx(&mut self, index: u8) {
        self.crtc.reg_idx = index & 0x1f;
    }

    pub fn get_reg_idx(&self) -> u8 {
        self.crtc.reg_idx
    }

    pub fn raw_reg(&self, index: u8) -> Option<u8> {
        self.crtc.reg.get(index as usize).copied()
    }

    pub fn set_reg(&mut self, value: u8) {
        let index = self.crtc.reg_idx as usize;
        if index < 16 {
            self.crtc.reg[index] = value;
            self.crtc.configured = true;
            // Configuration performed before the first tick must use the new
            // start address immediately. A live mid-frame R12/R13 write is
            // instead picked up at the next CRTC frame restart.
            if matches!(index, 12 | 13)
                && self.crtc.h_count == 0
                && self.crtc.row == 0
                && self.crtc.raster == 0
            {
                self.crtc.row_address = self.crtc.display_start();
            }
        }
    }

    pub fn get_reg(&self) -> u8 {
        match self.crtc.reg_idx {
            12 | 14 | 16 => self.crtc.reg[self.crtc.reg_idx as usize] & 0x3f,
            13 | 15 | 17 => self.crtc.reg[self.crtc.reg_idx as usize],
            _ => 0xff,
        }
    }

    pub fn write_crtc_port(&mut self, port: u8, value: u8) {
        if port & 1 == 0 {
            self.set_reg_idx(value);
        } else {
            self.set_reg(value);
        }
    }

    pub fn read_crtc_port(&self, port: u8) -> u8 {
        if port & 1 == 0 { 0xff } else { self.get_reg() }
    }

    pub fn set_palette(&mut self, index: u8, color: u8) {
        if let Some(entry) = self.generator.palette.get_mut(index as usize) {
            entry.set(color);
        }
    }

    pub fn get_palette(&self, index: u8) -> u8 {
        self.generator
            .palette
            .get(index as usize)
            .map_or(0, |entry| entry.port_value)
    }

    pub fn set_border(&mut self, color: u8) {
        self.generator.border_port_value = color;
        // Unlike palette ports, the border latch uses bits 7,5,3,1.
        self.generator.border_igrb = port_color_to_igrb(color >> 1);
    }

    pub fn set_mode(&mut self, mode: u8) {
        self.generator.mode = mode & 3;
    }

    pub fn is_initialized(&self) -> bool {
        self.crtc.configured
            && self.crtc.horizontal_displayed() <= self.crtc.line_character_clocks()
    }

    pub fn cursor_enabled(&self) -> bool {
        self.crtc.cursor_enabled()
    }

    pub fn display_start_address(&self) -> u16 {
        self.crtc.display_start()
    }

    pub fn cursor_interrupt_setup(&self) -> (u16, Option<u16>) {
        let cursor = self.crtc.cursor_address();
        let start = self.display_start_address();
        let relative = cursor.wrapping_sub(start) & 0x3fff;
        let hd = self.crtc.horizontal_displayed();
        let vd = (self.crtc.reg[6] & 0x7f) as u16;
        let raster = (self.crtc.reg[10] & 0x1f) as u16;
        let max_raster = self.crtc.max_raster();
        let line = (hd != 0 && relative < hd * vd && raster <= max_raster)
            .then(|| relative / hd * (max_raster + 1) + raster);
        (cursor, line)
    }

    pub fn write_snapshot(&self, writer: &mut crate::snapshot::Writer) {
        writer.u8(self.generator.mode);
        writer.u8(self.crtc.reg_idx);
        writer.raw_bytes(&self.crtc.reg);
        for color in &self.generator.palette {
            writer.u8(color.port_value);
        }
        writer.u8(self.generator.border_port_value);
    }

    pub fn read_snapshot(
        &mut self,
        reader: &mut crate::snapshot::Reader<'_>,
    ) -> crate::snapshot::Result<()> {
        self.reset();
        self.generator.mode = reader.u8()? & 3;
        self.crtc.reg_idx = reader.u8()? & 0x1f;
        self.crtc.reg.copy_from_slice(reader.raw_bytes(18)?);
        self.crtc.configured = true;
        self.crtc.reset_transient();
        for index in 0..4 {
            let color = reader.u8()?;
            self.set_palette(index, color);
        }
        let border = reader.u8()?;
        self.set_border(border);
        Ok(())
    }

    /// Advance the CRTC and TVC output by CPU clocks. The ring receives only
    /// final colors and external sync; palette/VRAM cannot leak downstream.
    pub fn stream_some(&mut self, vram: &[u8], run_for: u32) -> bool {
        self.run_for = self.run_for.saturating_add(run_for);
        while self.run_for >= CPU_CLOCKS_PER_CHARACTER {
            let tick = self.crtc.tick();
            let cursor_interrupt = tick.cursor && tick.ra == (self.crtc.reg[10] & 0x1f);
            let signal = self.generator.emit(tick, vram);
            self.ring.push(signal);
            self.run_for -= CPU_CLOCKS_PER_CHARACTER;
            if cursor_interrupt {
                return true;
            }
        }
        false
    }

    #[cfg(test)]
    pub(crate) fn stream_position(&self) -> (i32, u16, u16, u32) {
        (
            self.crtc.row as i32,
            self.crtc.raster,
            self.crtc.h_count,
            self.run_for,
        )
    }

    #[cfg(test)]
    pub(crate) fn rendered_frame_for_test(&mut self, vram: &[u8]) -> Vec<u32> {
        let mut framebuffer = vec![0u32; FRAMEBUFFER_WIDTH * FRAMEBUFFER_HEIGHT];
        for _ in 0..4 {
            self.stream_some(vram, 62_500);
            if self.render_stream(&mut framebuffer, FRAMEBUFFER_WIDTH) {
                break;
            }
        }
        framebuffer
    }

    pub fn render_stream(&mut self, framebuffer: &mut [u32], width: usize) -> bool {
        if self.ring.take_dropped() {
            self.television.lose_lock();
        }
        while let Some(signal) = self.ring.pop() {
            if self.television.consume(signal, framebuffer, width) {
                return true;
            }
        }
        false
    }

    /// Simplified current-state renderer. It intentionally does not emulate
    /// sync acquisition, retrace blanking, or mid-frame register changes.
    pub fn draw_frame(&self, vram: &[u8], framebuffer: &mut [u32]) {
        let programmed_width = self.crtc.horizontal_displayed() as usize;
        let active_width = programmed_width.min(FRAMEBUFFER_CHARACTER_CLOCKS);
        let rows = (self.crtc.reg[6] & 0x7f) as usize;
        let rasters = self.crtc.max_raster() as usize + 1;
        let active_height = rows.saturating_mul(rasters).min(FRAMEBUFFER_HEIGHT);
        let top = (FRAMEBUFFER_HEIGHT - active_height) / 2;
        let left = (FRAMEBUFFER_CHARACTER_CLOCKS - active_width) / 2;
        let border = IGRB_TO_RGBA[self.generator.border_igrb as usize];
        framebuffer.fill(border);

        for y in 0..active_height {
            let row = y / rasters;
            let raster = y % rasters;
            for character in 0..active_width {
                let ma = self
                    .crtc
                    .display_start()
                    .wrapping_add((row * programmed_width + character) as u16)
                    & 0x3fff;
                let byte = vram
                    .get(gen_address(ma, raster as u8) as usize)
                    .copied()
                    .unwrap_or(0);
                let packed = self.generator.paper_pixels(byte);
                let base = (top + y) * FRAMEBUFFER_WIDTH + (left + character) * 8;
                for pixel in 0..8 {
                    let igrb = ((packed >> (pixel * 4)) & 0x0f) as usize;
                    framebuffer[base + pixel] = IGRB_TO_RGBA[igrb];
                }
            }
        }
    }
}

impl Default for Vid {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
#[path = "vid_tests.rs"]
mod vid_tests;
