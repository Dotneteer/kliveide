use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use rtvc_core::cas::TapeBitstreamGenerator;

const CPU_HZ: u64 = 3_125_000;
const SAMPLE_RATE: u64 = 44_100;
const SILENCE: u8 = 0x80;
const POS_PEAK: u8 = 0xF8;
const NEG_PEAK: u8 = 0x08;

fn main() {
    if let Err(err) = run() {
        eprintln!("rtvc-cas2wav: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    if args[1..]
        .iter()
        .any(|arg| arg.as_str() == "-h" || arg.as_str() == "--help")
    {
        let program = args.first().map(String::as_str).unwrap_or("rtvc-cas2wav");
        println!("usage: {program} <input.cas> <output.wav> [tape-name]");
        return Ok(());
    }
    if args.len() != 3 && args.len() != 4 {
        let program = args.first().map(String::as_str).unwrap_or("rtvc-cas2wav");
        return Err(format!(
            "usage: {program} <input.cas> <output.wav> [tape-name]"
        ));
    }

    let input_path = Path::new(&args[1]);
    let output_path = Path::new(&args[2]);
    let tape_name = args
        .get(3)
        .cloned()
        .unwrap_or_else(|| default_tape_name(output_path));

    let cas_data = fs::read(input_path)
        .map_err(|err| format!("failed to read {}: {err}", input_path.display()))?;
    let generator = TapeBitstreamGenerator::new(&cas_data, &tape_name)?;
    let samples = render_samples(&generator);
    write_wav(output_path, &samples)
        .map_err(|err| format!("failed to write {}: {err}", output_path.display()))?;

    println!(
        "wrote {} samples ({:.2}s) to {}",
        samples.len(),
        samples.len() as f64 / SAMPLE_RATE as f64,
        output_path.display()
    );
    Ok(())
}

fn default_tape_name(output_path: &Path) -> String {
    output_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("PROGRAM")
        .to_string()
}

fn render_samples(generator: &TapeBitstreamGenerator) -> Vec<u8> {
    let mut samples = Vec::new();

    for (idx, interval) in generator.intervals.iter().enumerate() {
        let end_cycle = generator
            .intervals
            .get(idx + 1)
            .map(|next| next.start_cycle)
            .unwrap_or(generator.total_cycles);
        let sample_count = cycles_to_samples(end_cycle - interval.start_cycle);
        samples.extend(std::iter::repeat_n(
            level_to_sample(interval.level),
            sample_count,
        ));
    }

    samples
}

fn cycles_to_samples(cycles: u64) -> usize {
    (((cycles * SAMPLE_RATE) + (CPU_HZ / 2)) / CPU_HZ) as usize
}

fn level_to_sample(level: f32) -> u8 {
    if level < 0.25 {
        NEG_PEAK
    } else if level > 0.75 {
        POS_PEAK
    } else {
        SILENCE
    }
}

fn write_wav(path: &Path, samples: &[u8]) -> std::io::Result<()> {
    let data_len = samples.len() as u32;
    let mut wav = Vec::with_capacity(44 + samples.len());

    wav.extend_from_slice(b"RIFF");
    wav.extend_from_slice(&(36 + data_len).to_le_bytes());
    wav.extend_from_slice(b"WAVE");
    wav.extend_from_slice(b"fmt ");
    wav.extend_from_slice(&16u32.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&(SAMPLE_RATE as u32).to_le_bytes());
    wav.extend_from_slice(&(SAMPLE_RATE as u32).to_le_bytes());
    wav.extend_from_slice(&1u16.to_le_bytes());
    wav.extend_from_slice(&8u16.to_le_bytes());
    wav.extend_from_slice(b"data");
    wav.extend_from_slice(&data_len.to_le_bytes());
    wav.extend_from_slice(samples);

    let mut file = fs::File::create(PathBuf::from(path))?;
    file.write_all(&wav)
}
