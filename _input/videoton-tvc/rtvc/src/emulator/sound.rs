const CPU_CLOCK_HZ: u64 = 3_125_000;
pub const AUDIO_SAMPLE_RATE: u32 = 44_100;
const MAX_BUFFERED_SAMPLES: usize = AUDIO_SAMPLE_RATE as usize;
const AUDIO_OUTPUT_LEVEL: f32 = 0.25;
const AUDIO_HIGHPASS_CUTOFF_HZ: f32 = 20.0;
const SOUND_COUNTER_OUTPUT: u8 = 0x08;

pub(crate) struct SoundTimer {
    pub(crate) freq_low: u8,
    pub(crate) ctrl: u8,
    amplitude: u8,
    programmable_period_cycles: Option<u64>,
    programmable_counter: u64,
    running: bool,
    sound_counter: u8,
    sample_accum: u64,
    filter_prev_input: f32,
    filter_prev_output: f32,
    samples: Vec<f32>,
}

impl SoundTimer {
    pub(crate) fn new() -> Self {
        Self {
            freq_low: 0,
            ctrl: 0,
            amplitude: 0,
            programmable_period_cycles: Some(0x1000),
            programmable_counter: 0,
            running: false,
            sound_counter: 0,
            sample_accum: 0,
            filter_prev_input: 0.0,
            filter_prev_output: 0.0,
            samples: Vec::new(),
        }
    }

    pub(crate) fn reset(&mut self) {
        self.freq_low = 0;
        self.ctrl = 0;
        self.amplitude = 0;
        self.programmable_period_cycles = Some(0x1000);
        self.programmable_counter = 0;
        self.running = false;
        self.sound_counter = 0;
        self.sample_accum = 0;
        self.filter_prev_input = 0.0;
        self.filter_prev_output = 0.0;
        self.samples.clear();
    }

    pub(crate) fn write_low(&mut self, val: u8) {
        self.freq_low = val;
        self.update_period_cycles();
    }

    pub(crate) fn write_control(&mut self, val: u8) {
        self.ctrl = val;
        self.update_period_cycles();
    }

    pub(crate) fn write_amplitude(&mut self, val: u8) {
        self.amplitude = (val >> 2) & 0x0F;
    }

    pub(crate) fn amplitude(&self) -> u8 {
        self.amplitude
    }

    pub(crate) fn divisor(&self) -> u16 {
        ((self.ctrl as u16 & 0x0F) << 8) | self.freq_low as u16
    }

    fn update_period_cycles(&mut self) {
        let divisor = self.divisor();
        self.programmable_period_cycles = if divisor == 0x0FFF {
            None
        } else {
            Some(0x1000u64 - divisor as u64)
        };
        match self.programmable_period_cycles {
            Some(period) if !self.running => {
                self.programmable_counter = period;
                self.running = true;
            }
            Some(period) if self.running && self.programmable_counter > period => {
                self.programmable_counter = period;
            }
            Some(period) if self.running && self.programmable_counter == 0 => {
                self.programmable_counter = period;
            }
            None => {
                self.running = false;
                self.programmable_counter = 0;
                self.sound_counter = 0;
            }
            _ => {}
        }
    }

    pub(crate) fn interrupt_enabled(&self) -> bool {
        (self.ctrl & 0x20) != 0
    }

    fn oscillator_enabled(&self) -> bool {
        (self.ctrl & 0x10) != 0
    }

    pub(crate) fn audible_oscillator_enabled(&self) -> bool {
        self.oscillator_enabled() && self.programmable_period_cycles.is_some()
    }

    pub(crate) fn frequency_hz(&self) -> Option<f64> {
        let divisor = self.divisor();
        if divisor == 0x0FFF {
            None
        } else {
            Some(CPU_CLOCK_HZ as f64 / 16.0 / (0x1000u64 - divisor as u64) as f64)
        }
    }

    pub(crate) fn sample_rate(&self) -> u32 {
        AUDIO_SAMPLE_RATE
    }

    pub(crate) fn take_samples(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.samples)
    }

    #[cfg(test)]
    pub(crate) fn counter(&self) -> u64 {
        self.programmable_counter
    }

    #[cfg(test)]
    pub(crate) fn running(&self) -> bool {
        self.running
    }

    #[cfg(test)]
    pub(crate) fn filter_state_bits(&self) -> (u32, u32) {
        (
            self.filter_prev_input.to_bits(),
            self.filter_prev_output.to_bits(),
        )
    }

    pub(crate) fn restart(&mut self) {
        self.programmable_counter = self.programmable_period_cycles.unwrap_or(0);
        self.running = self.programmable_counter != 0;
        self.sound_counter = 0;
    }

    pub(crate) fn advance(&mut self, cycles: u64) -> bool {
        let mut remaining = cycles;
        let mut fired = false;
        while remaining > 0 {
            let step = if self.running {
                remaining.min(self.programmable_counter.max(1))
            } else {
                remaining
            };

            self.render_audio(step);
            remaining -= step;

            if self.running {
                self.programmable_counter = self.programmable_counter.saturating_sub(step);
                if self.programmable_counter == 0 {
                    fired |= self.advance_sound_counter();
                    if let Some(period) = self.programmable_period_cycles {
                        self.programmable_counter = period;
                    } else {
                        self.running = false;
                    }
                }
            }
        }
        fired
    }

    fn advance_sound_counter(&mut self) -> bool {
        let old_counter = self.sound_counter;
        self.sound_counter = self.sound_counter.wrapping_add(1) & 0x0F;
        old_counter == 0x0F && self.sound_counter == 0 && self.interrupt_enabled()
    }

    fn render_audio(&mut self, cycles: u64) {
        let mut remaining = cycles;
        while remaining > 0 {
            let cycles_until_sample =
                ((CPU_CLOCK_HZ - self.sample_accum) + AUDIO_SAMPLE_RATE as u64 - 1)
                    / AUDIO_SAMPLE_RATE as u64;
            let step = remaining.min(cycles_until_sample.max(1));
            self.sample_accum += step * AUDIO_SAMPLE_RATE as u64;
            remaining -= step;

            if self.sample_accum >= CPU_CLOCK_HZ {
                self.sample_accum -= CPU_CLOCK_HZ;
                self.push_sample();
            }
        }
    }

    fn push_sample(&mut self) {
        if self.samples.len() >= MAX_BUFFERED_SAMPLES {
            let overflow = self.samples.len() + 1 - MAX_BUFFERED_SAMPLES;
            self.samples.drain(..overflow);
        }
        let raw = self.raw_sample();
        let sample = self.filter_sample(raw);
        self.samples.push(sample);
    }

    fn raw_sample(&self) -> f32 {
        let level = self.amplitude as f32 / 15.0 * AUDIO_OUTPUT_LEVEL;
        if self.oscillator_enabled() {
            if !self.running {
                return 0.0;
            }
            if self.programmable_period_cycles.is_some() {
                if (self.sound_counter & SOUND_COUNTER_OUTPUT) != 0 {
                    level
                } else {
                    0.0
                }
            } else {
                0.0
            }
        } else {
            level
        }
    }

    fn filter_sample(&mut self, input: f32) -> f32 {
        let dt = 1.0 / AUDIO_SAMPLE_RATE as f32;
        let rc = 1.0 / (2.0 * std::f32::consts::PI * AUDIO_HIGHPASS_CUTOFF_HZ);
        let alpha = rc / (rc + dt);
        let output = alpha * (self.filter_prev_output + input - self.filter_prev_input);
        self.filter_prev_input = input;
        self.filter_prev_output = output;
        output
    }

    pub(crate) fn write_snapshot(&self, w: &mut crate::snapshot::Writer) {
        w.u8(self.freq_low);
        w.u8(self.ctrl);
        w.u64(self.programmable_counter);
        w.u8(self.running as u8);
        w.u8(self.amplitude);
        w.u64(self.sound_counter as u64);
        w.u64(self.sample_accum);
        w.u32(self.filter_prev_input.to_bits());
        w.u32(self.filter_prev_output.to_bits());
    }

    pub(crate) fn read_snapshot(
        &mut self,
        r: &mut crate::snapshot::Reader<'_>,
    ) -> crate::snapshot::Result<()> {
        self.freq_low = r.u8()?;
        self.ctrl = r.u8()?;
        self.update_period_cycles();
        self.programmable_counter = r.u64()?;
        self.running = r.u8()? != 0;
        self.amplitude = if r.remaining() > 0 { r.u8()? & 0x0F } else { 0 };
        self.sound_counter = if r.remaining() > 0 {
            (r.u64()? & 0x0F) as u8
        } else {
            0
        };
        self.sample_accum = if r.remaining() > 0 {
            r.u64()? % CPU_CLOCK_HZ
        } else {
            0
        };
        self.filter_prev_input = if r.remaining() > 0 {
            f32::from_bits(r.u32()?)
        } else {
            0.0
        };
        self.filter_prev_output = if r.remaining() > 0 {
            f32::from_bits(r.u32()?)
        } else {
            0.0
        };
        self.samples.clear();
        Ok(())
    }
}
