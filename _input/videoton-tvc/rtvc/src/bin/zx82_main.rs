use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;

use eframe::egui::{self, ColorImage, TextureHandle, TextureOptions, Vec2};
use rtvc_core::vid::VidModel;
use rtvc_core::zx82::{FRAMEBUFFER_HEIGHT, FRAMEBUFFER_WIDTH, Zx82};

const APP_ICON_PNG: &[u8] = include_bytes!("../../assets/rtvc-app-icon.png");

fn main() -> eframe::Result<()> {
    let mut headless = false;
    let mut frames = 100u64;
    let mut screenshot: Option<PathBuf> = None;
    let mut rom_path = PathBuf::from("roms/48.rom");
    let mut z80_path: Option<PathBuf> = None;

    let args = std::env::args().skip(1).collect::<Vec<_>>();
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--headless" => {
                headless = true;
                index += 1;
            }
            "--frames" if index + 1 < args.len() => {
                frames = args[index + 1].parse().unwrap_or(frames);
                index += 2;
            }
            "--screenshot" if index + 1 < args.len() => {
                screenshot = Some(PathBuf::from(&args[index + 1]));
                index += 2;
            }
            "--rom" if index + 1 < args.len() => {
                rom_path = PathBuf::from(&args[index + 1]);
                index += 2;
            }
            "--z80" if index + 1 < args.len() => {
                z80_path = Some(PathBuf::from(&args[index + 1]));
                index += 2;
            }
            "-h" | "--help" => {
                println!("Usage: zx82 [game.z80] [--rom path] [--z80 path]");
                println!("            [--headless] [--frames count]");
                println!("            [--screenshot path.png]");
                return Ok(());
            }
            unknown => {
                if unknown.starts_with('-') || z80_path.is_some() {
                    eprintln!("unknown option or extra input file: {unknown}");
                    std::process::exit(2);
                }
                z80_path = Some(PathBuf::from(unknown));
                index += 1;
            }
        }
    }

    let rom = match std::fs::read(&rom_path) {
        Ok(rom) => rom,
        Err(error) => {
            eprintln!("failed to read {}: {error}", rom_path.display());
            std::process::exit(1);
        }
    };
    let mut zx82 = Zx82::new();
    if let Err(error) = zx82.load_rom(&rom) {
        eprintln!("failed to load {}: {error}", rom_path.display());
        std::process::exit(1);
    }
    let loaded_snapshot = z80_path
        .as_deref()
        .map(|path| load_z80_path(&mut zx82, path))
        .transpose();
    if let Err(error) = loaded_snapshot {
        eprintln!("{error}");
        std::process::exit(1);
    }

    if headless {
        for _ in 0..frames {
            zx82.run_for_a_frame();
        }
        if let Some(path) = screenshot {
            if let Err(error) = save_screenshot(&zx82, &path) {
                eprintln!("failed to save {}: {error}", path.display());
                std::process::exit(1);
            }
        }
        println!(
            "Zx82 ran {frames} frames, PC={:04X}, clock={}, interrupt={}",
            zx82.z80.state.pc,
            zx82.clock(),
            zx82.last_frame_interrupt_accepted()
        );
        return Ok(());
    }

    let app = Zx82App {
        zx82,
        running: true,
        texture: None,
        pressed_bindings: HashMap::new(),
        matrix_key_counts: [[0; 5]; 8],
        status: z80_path.map(|path| format!("Loaded {}", path.display())),
    };
    let icon =
        eframe::icon_data::from_png_bytes(APP_ICON_PNG).expect("invalid embedded rtvc app icon");
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([704.0, 650.0])
            .with_resizable(true)
            .with_icon(icon)
            .with_title("Zx82 - ZX Spectrum 48K"),
        ..Default::default()
    };
    eframe::run_native("Zx82", options, Box::new(|_| Ok(Box::new(app))))
}

struct Zx82App {
    zx82: Zx82,
    running: bool,
    texture: Option<TextureHandle>,
    pressed_bindings: HashMap<egui::Key, Vec<MatrixKey>>,
    matrix_key_counts: [[u8; 5]; 8],
    status: Option<String>,
}

impl eframe::App for Zx82App {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.handle_keyboard(ctx);

        if self.running {
            self.zx82.run_for_a_frame();
        }

        let image = framebuffer_image(&self.zx82.framebuffer);
        match &mut self.texture {
            Some(texture) => texture.set(image, TextureOptions::NEAREST),
            None => {
                self.texture =
                    Some(ctx.load_texture("zx82-screen", image, TextureOptions::NEAREST));
            }
        }

        egui::TopBottomPanel::top("controls").show(ctx, |ui| {
            ui.horizontal(|ui| {
                if ui
                    .button(if self.running { "Pause" } else { "Run" })
                    .clicked()
                {
                    self.running = !self.running;
                }
                if ui.button("Reset").clicked() {
                    self.zx82.hard_reset();
                    self.release_all_keys();
                    self.status = Some("Reset to 48K ROM".to_string());
                }
                if ui.button("Load Z80").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("Z80 snapshot", &["z80", "Z80"])
                        .pick_file()
                    {
                        self.release_all_keys();
                        self.status = Some(match load_z80_path(&mut self.zx82, &path) {
                            Ok(()) => format!("Loaded {}", path.display()),
                            Err(error) => error,
                        });
                    }
                }
                ui.separator();
                ui.label("Video:");
                if ui
                    .selectable_label(self.zx82.vid_model() == VidModel::FastFrame, "Full frame")
                    .clicked()
                {
                    self.zx82.set_vid_model(VidModel::FastFrame);
                }
                if ui
                    .selectable_label(
                        self.zx82.vid_model() == VidModel::Interleaved,
                        "Interleaved (full-frame fallback)",
                    )
                    .clicked()
                {
                    self.zx82.set_vid_model(VidModel::Interleaved);
                }
                ui.separator();
                ui.monospace(format!(
                    "PC {:04X}  frame {}",
                    self.zx82.z80.state.pc,
                    self.zx82.frame_counter()
                ));
            });
            ui.label(
                "Keyboard active: letters and digits use the Spectrum matrix. \
                 Shift = Caps Shift, Ctrl/Alt = Symbol Shift, Backspace = Caps Shift+0.",
            );
            if let Some(status) = &self.status {
                ui.label(status);
            }
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            let available = ui.available_size();
            let scale = (available.x / FRAMEBUFFER_WIDTH as f32)
                .min(available.y / FRAMEBUFFER_HEIGHT as f32)
                .max(1.0);
            let size = Vec2::new(
                FRAMEBUFFER_WIDTH as f32 * scale,
                FRAMEBUFFER_HEIGHT as f32 * scale,
            );
            if let Some(texture) = &self.texture {
                ui.centered_and_justified(|ui| {
                    ui.image((texture.id(), size));
                });
            }
        });

        ctx.request_repaint_after(Duration::from_millis(20));
    }
}

impl Zx82App {
    fn handle_keyboard(&mut self, ctx: &egui::Context) {
        let focused = ctx.input(|input| input.focused);
        if !focused {
            self.release_all_keys();
            return;
        }

        ctx.input(|input| {
            for event in &input.events {
                let egui::Event::Key {
                    key,
                    physical_key,
                    pressed,
                    repeat,
                    modifiers,
                } = event
                else {
                    continue;
                };
                let key = physical_key.unwrap_or(*key);
                if *pressed {
                    if !repeat && !self.pressed_bindings.contains_key(&key) {
                        if let Some(binding) = host_binding(key, *modifiers) {
                            for matrix_key in &binding {
                                self.press_matrix_key(*matrix_key);
                            }
                            self.pressed_bindings.insert(key, binding);
                        }
                    }
                } else if let Some(binding) = self.pressed_bindings.remove(&key) {
                    for matrix_key in binding {
                        self.release_matrix_key(matrix_key);
                    }
                }
            }
        });
    }

    fn press_matrix_key(&mut self, key: MatrixKey) {
        let count = &mut self.matrix_key_counts[key.row][key.column];
        *count = count.saturating_add(1);
        self.zx82.bus.set_key(key.row, key.column, true);
    }

    fn release_matrix_key(&mut self, key: MatrixKey) {
        let count = &mut self.matrix_key_counts[key.row][key.column];
        *count = count.saturating_sub(1);
        if *count == 0 {
            self.zx82.bus.set_key(key.row, key.column, false);
        }
    }

    fn release_all_keys(&mut self) {
        self.pressed_bindings.clear();
        self.matrix_key_counts = [[0; 5]; 8];
        for row in 0..8 {
            for column in 0..5 {
                self.zx82.bus.set_key(row, column, false);
            }
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct MatrixKey {
    row: usize,
    column: usize,
}

const fn matrix_key(row: usize, column: usize) -> MatrixKey {
    MatrixKey { row, column }
}

const CAPS_SHIFT: MatrixKey = matrix_key(0, 0);
const SYMBOL_SHIFT: MatrixKey = matrix_key(7, 1);

fn host_binding(key: egui::Key, modifiers: egui::Modifiers) -> Option<Vec<MatrixKey>> {
    let plain = match key {
        egui::Key::A => matrix_key(1, 0),
        egui::Key::B => matrix_key(7, 4),
        egui::Key::C => matrix_key(0, 3),
        egui::Key::D => matrix_key(1, 2),
        egui::Key::E => matrix_key(2, 2),
        egui::Key::F => matrix_key(1, 3),
        egui::Key::G => matrix_key(1, 4),
        egui::Key::H => matrix_key(6, 4),
        egui::Key::I => matrix_key(5, 2),
        egui::Key::J => matrix_key(6, 3),
        egui::Key::K => matrix_key(6, 2),
        egui::Key::L => matrix_key(6, 1),
        egui::Key::M => matrix_key(7, 2),
        egui::Key::N => matrix_key(7, 3),
        egui::Key::O => matrix_key(5, 1),
        egui::Key::P => matrix_key(5, 0),
        egui::Key::Q => matrix_key(2, 0),
        egui::Key::R => matrix_key(2, 3),
        egui::Key::S => matrix_key(1, 1),
        egui::Key::T => matrix_key(2, 4),
        egui::Key::U => matrix_key(5, 3),
        egui::Key::V => matrix_key(0, 4),
        egui::Key::W => matrix_key(2, 1),
        egui::Key::X => matrix_key(0, 2),
        egui::Key::Y => matrix_key(5, 4),
        egui::Key::Z => matrix_key(0, 1),
        egui::Key::Num0 => matrix_key(4, 0),
        egui::Key::Num1 => matrix_key(3, 0),
        egui::Key::Num2 => matrix_key(3, 1),
        egui::Key::Num3 => matrix_key(3, 2),
        egui::Key::Num4 => matrix_key(3, 3),
        egui::Key::Num5 => matrix_key(3, 4),
        egui::Key::Num6 => matrix_key(4, 4),
        egui::Key::Num7 => matrix_key(4, 3),
        egui::Key::Num8 => matrix_key(4, 2),
        egui::Key::Num9 => matrix_key(4, 1),
        egui::Key::Enter => matrix_key(6, 0),
        egui::Key::Space => matrix_key(7, 0),
        _ => return special_binding(key, modifiers),
    };

    if modifiers.shift && is_digit_key(key) {
        Some(vec![SYMBOL_SHIFT, plain])
    } else if modifiers.shift {
        Some(vec![CAPS_SHIFT, plain])
    } else if modifiers.ctrl || modifiers.alt {
        Some(vec![SYMBOL_SHIFT, plain])
    } else {
        Some(vec![plain])
    }
}

fn is_digit_key(key: egui::Key) -> bool {
    matches!(
        key,
        egui::Key::Num0
            | egui::Key::Num1
            | egui::Key::Num2
            | egui::Key::Num3
            | egui::Key::Num4
            | egui::Key::Num5
            | egui::Key::Num6
            | egui::Key::Num7
            | egui::Key::Num8
            | egui::Key::Num9
    )
}

fn special_binding(key: egui::Key, modifiers: egui::Modifiers) -> Option<Vec<MatrixKey>> {
    Some(match key {
        egui::Key::Backspace | egui::Key::Delete => vec![CAPS_SHIFT, matrix_key(4, 0)],
        egui::Key::ArrowLeft => vec![CAPS_SHIFT, matrix_key(3, 4)],
        egui::Key::ArrowDown => vec![CAPS_SHIFT, matrix_key(4, 4)],
        egui::Key::ArrowUp => vec![CAPS_SHIFT, matrix_key(4, 3)],
        egui::Key::ArrowRight => vec![CAPS_SHIFT, matrix_key(4, 2)],
        egui::Key::Quote => vec![SYMBOL_SHIFT, matrix_key(5, 0)],
        egui::Key::Semicolon if modifiers.shift => vec![SYMBOL_SHIFT, matrix_key(0, 1)],
        egui::Key::Semicolon => vec![SYMBOL_SHIFT, matrix_key(5, 1)],
        egui::Key::Comma => vec![SYMBOL_SHIFT, matrix_key(7, 3)],
        egui::Key::Period => vec![SYMBOL_SHIFT, matrix_key(7, 2)],
        egui::Key::Slash => vec![SYMBOL_SHIFT, matrix_key(0, 4)],
        egui::Key::Minus => vec![SYMBOL_SHIFT, matrix_key(6, 3)],
        egui::Key::Equals if modifiers.shift => vec![SYMBOL_SHIFT, matrix_key(6, 2)],
        egui::Key::Equals => vec![SYMBOL_SHIFT, matrix_key(6, 1)],
        _ => return None,
    })
}

fn framebuffer_image(framebuffer: &[u32]) -> ColorImage {
    let mut rgba = Vec::with_capacity(framebuffer.len() * 4);
    for pixel in framebuffer {
        rgba.extend_from_slice(&pixel.to_le_bytes());
    }
    ColorImage::from_rgba_unmultiplied([FRAMEBUFFER_WIDTH, FRAMEBUFFER_HEIGHT], &rgba)
}

fn load_z80_path(zx82: &mut Zx82, path: &Path) -> Result<(), String> {
    let data = std::fs::read(path)
        .map_err(|error| format!("failed to read {}: {error}", path.display()))?;
    zx82.load_z80(&data)
        .map_err(|error| format!("failed to load {}: {error}", path.display()))
}

fn save_screenshot(zx82: &Zx82, path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    let file = std::fs::File::create(path)?;
    let mut encoder = png::Encoder::new(file, FRAMEBUFFER_WIDTH as u32, FRAMEBUFFER_HEIGHT as u32);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder.write_header()?;
    let mut rgba = Vec::with_capacity(zx82.framebuffer.len() * 4);
    for pixel in &zx82.framebuffer {
        rgba.extend_from_slice(&pixel.to_le_bytes());
    }
    writer.write_image_data(&rgba)?;
    Ok(())
}

#[cfg(test)]
#[path = "zx82_main_tests.rs"]
mod tests;
