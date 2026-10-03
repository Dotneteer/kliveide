#[cfg(not(target_arch = "wasm32"))]
use std::collections::VecDeque;
#[cfg(not(target_arch = "wasm32"))]
use std::sync::{Arc, Mutex};

#[cfg(not(target_arch = "wasm32"))]
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};

#[cfg(not(target_arch = "wasm32"))]
const BUFFER_SECONDS: usize = 1;

#[cfg(not(target_arch = "wasm32"))]
pub struct NativeAudioSink {
    queue: Arc<Mutex<VecDeque<f32>>>,
    _stream: cpal::Stream,
    source_sample_rate: u32,
    output_sample_rate: u32,
    resample_phase: f64,
}

#[cfg(not(target_arch = "wasm32"))]
impl NativeAudioSink {
    pub fn new(source_sample_rate: u32) -> Result<Self, String> {
        let host = cpal::default_host();
        let device = host
            .default_output_device()
            .ok_or_else(|| "no default audio output device".to_string())?;
        let supported_config = choose_output_config(&device, source_sample_rate)?;
        let sample_format = supported_config.sample_format();
        let config: cpal::StreamConfig = supported_config.into();
        let output_sample_rate = config.sample_rate;
        let channels = config.channels as usize;
        let queue = Arc::new(Mutex::new(VecDeque::with_capacity(
            output_sample_rate as usize * BUFFER_SECONDS,
        )));
        let queue_for_stream = Arc::clone(&queue);
        let err_fn = |err| eprintln!("audio stream error: {err}");

        let stream = match sample_format {
            cpal::SampleFormat::F32 => device.build_output_stream(
                &config,
                move |data: &mut [f32], _| fill_output(data, channels, &queue_for_stream),
                err_fn,
                None,
            ),
            cpal::SampleFormat::I16 => device.build_output_stream(
                &config,
                move |data: &mut [i16], _| fill_output(data, channels, &queue_for_stream),
                err_fn,
                None,
            ),
            cpal::SampleFormat::U8 => device.build_output_stream(
                &config,
                move |data: &mut [u8], _| fill_output(data, channels, &queue_for_stream),
                err_fn,
                None,
            ),
            cpal::SampleFormat::U16 => device.build_output_stream(
                &config,
                move |data: &mut [u16], _| fill_output(data, channels, &queue_for_stream),
                err_fn,
                None,
            ),
            other => return Err(format!("unsupported audio sample format: {other:?}")),
        }
        .map_err(|err| format!("failed to build audio stream: {err}"))?;

        stream
            .play()
            .map_err(|err| format!("failed to start audio stream: {err}"))?;

        Ok(Self {
            queue,
            _stream: stream,
            source_sample_rate,
            output_sample_rate,
            resample_phase: 0.0,
        })
    }

    pub fn resume(&self) -> Result<(), String> {
        Ok(())
    }

    pub fn push_samples(&mut self, samples: &[f32]) {
        if samples.is_empty() {
            return;
        }

        if self.output_sample_rate == self.source_sample_rate {
            self.push_resampled(samples.iter().copied());
            return;
        }

        let ratio = self.output_sample_rate as f64 / self.source_sample_rate as f64;
        let mut converted = Vec::with_capacity((samples.len() as f64 * ratio).ceil() as usize);
        for sample in samples.iter().copied() {
            self.resample_phase += ratio;
            while self.resample_phase >= 1.0 {
                converted.push(sample);
                self.resample_phase -= 1.0;
            }
        }
        self.push_resampled(converted);
    }

    fn push_resampled<I>(&mut self, samples: I)
    where
        I: IntoIterator<Item = f32>,
    {
        let Ok(mut queue) = self.queue.lock() else {
            return;
        };
        let max_len = self.output_sample_rate as usize * BUFFER_SECONDS;
        for sample in samples {
            if queue.len() >= max_len {
                queue.pop_front();
            }
            queue.push_back(sample.clamp(-1.0, 1.0));
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub struct NativeAudioSink;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcAudioResume,
        catch
    )]
    fn web_audio_resume() -> Result<(), wasm_bindgen::JsValue>;

    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcAudioPush
    )]
    fn web_audio_push(samples: &js_sys::Float32Array);
}

#[cfg(target_arch = "wasm32")]
impl NativeAudioSink {
    pub fn new(_source_sample_rate: u32) -> Result<Self, String> {
        Ok(Self)
    }

    pub fn resume(&self) -> Result<(), String> {
        web_audio_resume().map_err(js_error)
    }

    pub fn push_samples(&mut self, samples: &[f32]) {
        if samples.is_empty() {
            return;
        }
        let samples_js = js_sys::Float32Array::new_with_length(samples.len() as u32);
        samples_js.copy_from(samples);
        web_audio_push(&samples_js);
    }
}

#[cfg(target_arch = "wasm32")]
fn js_error(value: wasm_bindgen::JsValue) -> String {
    value
        .as_string()
        .unwrap_or_else(|| "browser audio operation failed".to_string())
}

#[cfg(not(target_arch = "wasm32"))]
fn choose_output_config(
    device: &cpal::Device,
    sample_rate: u32,
) -> Result<cpal::SupportedStreamConfig, String> {
    let supported_configs = device
        .supported_output_configs()
        .map_err(|err| format!("failed to query audio output configs: {err}"))?;

    let mut fallback = None;
    for config in supported_configs {
        if fallback.is_none() {
            fallback = Some(config.clone().with_max_sample_rate());
        }
        let min_rate = config.min_sample_rate();
        let max_rate = config.max_sample_rate();
        if min_rate <= sample_rate && sample_rate <= max_rate {
            return Ok(config.with_sample_rate(sample_rate));
        }
    }

    fallback.ok_or_else(|| "audio output device has no supported output configs".to_string())
}

#[cfg(not(target_arch = "wasm32"))]
fn fill_output<T>(data: &mut [T], channels: usize, queue: &Arc<Mutex<VecDeque<f32>>>)
where
    T: AudioSample,
{
    let Ok(mut queue) = queue.lock() else {
        for sample in data {
            *sample = T::from_f32(0.0);
        }
        return;
    };

    for frame in data.chunks_mut(channels) {
        let sample = queue.pop_front().unwrap_or(0.0);
        for output in frame {
            *output = T::from_f32(sample);
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
trait AudioSample {
    fn from_f32(sample: f32) -> Self;
}

#[cfg(not(target_arch = "wasm32"))]
impl AudioSample for f32 {
    fn from_f32(sample: f32) -> Self {
        sample
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl AudioSample for i16 {
    fn from_f32(sample: f32) -> Self {
        (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl AudioSample for u8 {
    fn from_f32(sample: f32) -> Self {
        ((sample.clamp(-1.0, 1.0) * 0.5 + 0.5) * u8::MAX as f32).round() as u8
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl AudioSample for u16 {
    fn from_f32(sample: f32) -> Self {
        ((sample.clamp(-1.0, 1.0) * 0.5 + 0.5) * u16::MAX as f32) as u16
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
#[path = "audio_tests.rs"]
mod tests;
