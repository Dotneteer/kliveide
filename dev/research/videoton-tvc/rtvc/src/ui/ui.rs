#[cfg(not(target_arch = "wasm32"))]
use std::time::{Duration, Instant};
#[cfg(target_arch = "wasm32")]
use web_time::{Duration, Instant};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;
#[cfg(target_arch = "wasm32")]
use wasm_bindgen_futures::JsFuture;

use std::collections::{HashMap, HashSet, VecDeque};

use crate::app_state::{AppState, AppStateFile};
use crate::audio::NativeAudioSink;
use crate::debug_ui::DebuggerUi;
use crate::emu::{DiskGeometry, Emu, MachineType, ProgEntry};
use crate::machine::System;
use crate::vid::VidModel;
use crate::workspace::{self, Workspace, WorkspaceMode, WorkspaceTab};
use eframe::egui::{self, Color32, ColorImage, TextureHandle};

#[cfg(all(feature = "native", not(target_arch = "wasm32")))]
pub type DebuggerType = crate::debugger::DebuggerInterface;
#[cfg(not(all(feature = "native", not(target_arch = "wasm32"))))]
pub type DebuggerType = ();

pub enum PendingFile {
    Tape {
        name: String,
        bytes: Vec<u8>,
    },
    Disk {
        drive: usize,
        name: String,
        bytes: Vec<u8>,
    },
    Snapshot {
        name: String,
        bytes: Vec<u8>,
    },
    StorageResult {
        error: Option<String>,
    },
    RecentCleared {
        kind: String,
    },
}

const GAME_CATALOG_URL: &str = "https://teki.one/tvc_games/tvc_games.json";
const GAME_BASE_URL: &str = "https://teki.one/tvc_games/Games/";
const GAME_PICTURE_URL: &str = "https://teki.one/tvc_games/Pictures/";

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct GameEntry {
    #[serde(default)]
    id: u32,
    #[serde(default)]
    name: String,
    #[serde(default)]
    filename: String,
    #[serde(default)]
    file_to_run: String,
    #[serde(default)]
    screenshot: String,
    #[serde(default)]
    year: String,
    #[serde(default)]
    genre: String,
    #[serde(default)]
    publisher: String,
    #[serde(default)]
    developer: String,
    #[serde(default)]
    programmer: String,
    #[serde(default)]
    musician: String,
    #[serde(default)]
    language: String,
    #[serde(default)]
    description: String,
    #[serde(default)]
    comment: String,
    #[serde(default)]
    rating: i32,
    #[serde(default)]
    control_code: i32,
    #[serde(default)]
    sid_file: String,
}

impl GameEntry {
    fn is_loadable(&self) -> bool {
        let lower_name = self.file_to_run.to_ascii_lowercase();
        lower_name.ends_with(".cas") || lower_name.ends_with(".dsk")
    }

    fn matches(&self, search: &str) -> bool {
        search.is_empty() || normalize_game_name(&self.name).contains(search)
    }
}

fn normalize_game_name(value: &str) -> String {
    value
        .chars()
        .flat_map(char::to_lowercase)
        .map(|ch| match ch {
            'á' => 'a',
            'é' => 'e',
            'í' => 'i',
            'ó' | 'ö' | 'ő' => 'o',
            'ú' | 'ü' | 'ű' => 'u',
            _ => ch,
        })
        .collect()
}

enum GameEvent {
    Catalog(Result<Vec<GameEntry>, String>),
    Image {
        name: String,
        result: Result<Vec<u8>, String>,
    },
    Archive {
        game: GameEntry,
        result: Result<Vec<u8>, String>,
    },
}

struct GameLibraryState {
    open: bool,
    loading_catalog: bool,
    catalog_error: Option<String>,
    entries: Vec<GameEntry>,
    search: String,
    selected_id: Option<u32>,
    loading_game_id: Option<u32>,
    textures: HashMap<String, TextureHandle>,
    image_order: VecDeque<String>,
    pending_images: HashSet<String>,
    failed_images: HashSet<String>,
}

impl Default for GameLibraryState {
    fn default() -> Self {
        Self {
            open: false,
            loading_catalog: false,
            catalog_error: None,
            entries: Vec::new(),
            search: String::new(),
            selected_id: None,
            loading_game_id: None,
            textures: HashMap::new(),
            image_order: VecDeque::new(),
            pending_images: HashSet::new(),
            failed_images: HashSet::new(),
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub fn download_file(name: &str, data: &[u8], mime_type: &str) {
    if let Some(window) = web_sys::window() {
        if let Some(document) = window.document() {
            if let Some(body) = document.body() {
                let uint8_array = unsafe { js_sys::Uint8Array::view(data) };
                let array = js_sys::Array::new();
                array.push(&uint8_array);
                let blob_options = web_sys::BlobPropertyBag::new();
                blob_options.set_type(mime_type);
                if let Ok(blob) =
                    web_sys::Blob::new_with_u8_array_sequence_and_options(&array, &blob_options)
                {
                    if let Ok(url) = web_sys::Url::create_object_url_with_blob(&blob) {
                        if let Ok(a) = document.create_element("a") {
                            if let Ok(a) = a.dyn_into::<web_sys::HtmlAnchorElement>() {
                                a.set_href(&url);
                                a.set_download(name);
                                a.style().set_property("display", "none").ok();
                                body.append_child(&a).ok();
                                a.click();
                                body.remove_child(&a).ok();
                                web_sys::Url::revoke_object_url(&url).ok();
                            }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
extern "C" {
    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcTakeKeyboardEvents
    )]
    fn web_take_keyboard_events() -> js_sys::Array;

    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcStoreRecentMedia
    )]
    fn web_store_recent_media(
        kind: &str,
        name: &str,
        bytes: &js_sys::Uint8Array,
    ) -> js_sys::Promise;

    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcClearRecentMedia
    )]
    fn web_clear_recent_media(kind: &str) -> js_sys::Promise;

    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcFetchText
    )]
    fn web_fetch_text(url: &str) -> js_sys::Promise;

    #[wasm_bindgen::prelude::wasm_bindgen(
        js_namespace = globalThis,
        js_name = rtvcFetchBytes
    )]
    fn web_fetch_bytes(url: &str) -> js_sys::Promise;
}

const TVC_REFRESH_HZ: u32 = 50;
const TVC_FRAME_DT: f64 = 1.0 / TVC_REFRESH_HZ as f64;

#[cfg(not(target_arch = "wasm32"))]
fn egui_key_to_js_code(key: egui::Key) -> Option<u32> {
    Some(match key {
        egui::Key::Backspace => 8,
        egui::Key::Tab => 9,
        egui::Key::Enter => 13,
        egui::Key::Space => 32,
        egui::Key::Escape => 27,
        egui::Key::Delete => 46,
        egui::Key::ArrowLeft => 37,
        egui::Key::ArrowUp => 38,
        egui::Key::ArrowRight => 39,
        egui::Key::ArrowDown => 40,
        egui::Key::Home => 36,
        egui::Key::End => 35,
        egui::Key::PageUp => 33,
        egui::Key::PageDown => 34,
        egui::Key::Insert => 45,
        egui::Key::A => 65,
        egui::Key::B => 66,
        egui::Key::C => 67,
        egui::Key::D => 68,
        egui::Key::E => 69,
        egui::Key::F => 70,
        egui::Key::G => 71,
        egui::Key::H => 72,
        egui::Key::I => 73,
        egui::Key::J => 74,
        egui::Key::K => 75,
        egui::Key::L => 76,
        egui::Key::M => 77,
        egui::Key::N => 78,
        egui::Key::O => 79,
        egui::Key::P => 80,
        egui::Key::Q => 81,
        egui::Key::R => 82,
        egui::Key::S => 83,
        egui::Key::T => 84,
        egui::Key::U => 85,
        egui::Key::V => 86,
        egui::Key::W => 87,
        egui::Key::X => 88,
        egui::Key::Y => 89,
        egui::Key::Z => 90,
        egui::Key::Num0 => 48,
        egui::Key::Num1 => 49,
        egui::Key::Num2 => 50,
        egui::Key::Num3 => 51,
        egui::Key::Num4 => 52,
        egui::Key::Num5 => 53,
        egui::Key::Num6 => 54,
        egui::Key::Num7 => 55,
        egui::Key::Num8 => 56,
        egui::Key::Num9 => 57,
        egui::Key::Minus => 189,
        egui::Key::Equals => 187,
        egui::Key::Comma => 188,
        egui::Key::Period => 190,
        egui::Key::Semicolon => 186,
        egui::Key::Quote => 222,
        egui::Key::Backslash => 220,
        egui::Key::Slash => 191,
        egui::Key::OpenBracket => 219,
        egui::Key::CloseBracket => 221,
        egui::Key::Backtick => 192,
        _ => return None,
    })
}

fn selected_media_matches<F>(emu: &Emu, filter: F) -> bool
where
    F: Fn(&ProgEntry) -> bool,
{
    emu.progs
        .get(emu.selected_prog)
        .map(|entry| filter(entry))
        .unwrap_or(false)
}

fn media_entries<F>(progs: &[ProgEntry], filter: F) -> Vec<(usize, String)>
where
    F: Fn(&ProgEntry) -> bool,
{
    progs
        .iter()
        .enumerate()
        .filter(|(_, entry)| filter(entry))
        .map(|(index, entry)| (index, entry.name.clone()))
        .collect()
}

pub struct EmuApp {
    pub emu: Emu,
    screen_texture: Option<TextureHandle>,
    last_frame_time: Instant,
    last_repaint_time: Instant,
    emu_frame_accumulator: f64,
    frame_count: u32,
    fps: u32,
    prev_shift: bool,
    prev_ctrl: bool,
    prev_alt: bool,
    workspace: Workspace,
    debugger_ui: DebuggerUi,
    screen_captured: bool,
    file_status: Option<String>,
    machine_types: Vec<MachineType>,
    selected_machine: usize,
    audio: Option<NativeAudioSink>,
    audio_status: Option<String>,
    app_state_file: AppStateFile,
    pub debugger: Option<DebuggerType>,
    pressed_keys: std::collections::HashSet<u32>,
    #[cfg(target_arch = "wasm32")]
    pub file_tx: std::sync::mpsc::Sender<PendingFile>,
    #[cfg(target_arch = "wasm32")]
    pub file_rx: std::sync::mpsc::Receiver<PendingFile>,
    game_tx: std::sync::mpsc::Sender<GameEvent>,
    game_rx: std::sync::mpsc::Receiver<GameEvent>,
    game_library: Box<GameLibraryState>,
    show_help: bool,
}

impl EmuApp {
    pub fn new(mut emu: Emu, app_state_file: AppStateFile, debugger: Option<DebuggerType>) -> Self {
        let machine_types = MachineType::all_types();
        let selected_machine = Self::selected_machine_index(&machine_types, emu.machine_type);
        let (audio, audio_status) = match NativeAudioSink::new(emu.sound_sample_rate()) {
            Ok(sink) => (Some(sink), None),
            Err(err) => (None, Some(format!("Audio unavailable: {err}"))),
        };
        #[cfg(target_arch = "wasm32")]
        let (file_tx, file_rx) = std::sync::mpsc::channel();
        let (game_tx, game_rx) = std::sync::mpsc::channel();
        let workspace = Workspace::load(&app_state_file.path);

        emu.recent_tapes = dedupe_recent_paths(&app_state_file.state.recent_tapes);
        emu.recent_disks = dedupe_recent_paths(&app_state_file.state.recent_disks);
        EmuApp {
            emu,
            screen_texture: None,
            last_frame_time: Instant::now(),
            last_repaint_time: Instant::now(),
            emu_frame_accumulator: 0.0,
            frame_count: 0,
            fps: 0,
            prev_shift: false,
            prev_ctrl: false,
            prev_alt: false,
            workspace,
            debugger_ui: DebuggerUi::default(),
            screen_captured: false,
            file_status: None,
            machine_types,
            selected_machine,
            audio,
            audio_status,
            app_state_file,
            debugger,
            pressed_keys: std::collections::HashSet::new(),
            #[cfg(target_arch = "wasm32")]
            file_tx,
            #[cfg(target_arch = "wasm32")]
            file_rx,
            game_tx,
            game_rx,
            game_library: Box::new(GameLibraryState::default()),
            show_help: false,
        }
    }

    fn selected_machine_index(machine_types: &[MachineType], machine_type: MachineType) -> usize {
        machine_types
            .iter()
            .position(|candidate| *candidate == machine_type)
            .unwrap_or(0)
    }

    pub fn set_audio_status(&mut self, status: String) {
        self.audio_status = Some(status);
    }

    pub fn set_file_status(&mut self, status: String) {
        self.file_status = Some(status);
    }

    fn sync_selection_from_emu(&mut self) {
        self.selected_machine =
            Self::selected_machine_index(&self.machine_types, self.emu.machine_type);
    }

    fn update_screen_texture(&mut self, ctx: &egui::Context) {
        if !self.emu.frame_complete() {
            return;
        }

        let frame = self.emu.framebuffer();
        let size = [frame.width, frame.height];
        let image = framebuffer_image(frame.pixels, size);
        if let Some(texture) = &mut self.screen_texture {
            texture.set(image, Default::default());
        } else {
            self.screen_texture =
                Some(ctx.load_texture("machine-screen", image, Default::default()));
        }
        self.emu.clear_frame_complete();
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn handle_modifier(&mut self, new_shift: bool, new_ctrl: bool, new_alt: bool) {
        if new_shift != self.prev_shift {
            if new_shift {
                self.emu.key_down(16);
            } else {
                self.emu.key_up(16);
            }
            self.prev_shift = new_shift;
        }
        if new_ctrl != self.prev_ctrl {
            if new_ctrl {
                self.emu.key_down(17);
            } else {
                self.emu.key_up(17);
            }
            self.prev_ctrl = new_ctrl;
        }
        if new_alt != self.prev_alt {
            if new_alt {
                self.emu.key_down(18);
            } else {
                self.emu.key_up(18);
            }
            self.prev_alt = new_alt;
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn save_screenshot(&self, path: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
        self.emu.save_screenshot(path)
    }

    fn save_snapshot_dialog(&mut self) {
        #[cfg(target_arch = "wasm32")]
        {
            let snapshot = self.emu.save_snapshot();
            match crate::emu::zip_snapshot(&snapshot) {
                Ok(zipped) => {
                    download_file("snapshot.rtvcsnap.zip", &zipped, "application/zip");
                    self.file_status = Some("Snapshot download started".to_string());
                }
                Err(err) => {
                    self.file_status = Some(format!("Snapshot zip failed: {err}"));
                }
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("compressed rtvc snapshot", &["zip"])
                .add_filter("rtvc snapshot", &["rtvcsnap"])
                .set_file_name("snapshot.rtvcsnap.zip")
                .save_file()
            {
                match self.emu.save_snapshot_file(&path) {
                    Ok(()) => {
                        self.file_status = Some(format!("Saved: {}", path.display()));
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Save failed: {}", err));
                    }
                }
            }
        }
    }

    fn load_snapshot_dialog(&mut self, _ctx: egui::Context) {
        #[cfg(target_arch = "wasm32")]
        {
            let file_tx = self.file_tx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let file = rfd::AsyncFileDialog::new()
                    .add_filter("machine state", &["rtvcsnap", "zip", "z80"])
                    .pick_file()
                    .await;
                if let Some(file) = file {
                    let name = file.file_name();
                    let bytes = file.read().await;
                    let _ = file_tx.send(PendingFile::Snapshot { name, bytes });
                    _ctx.request_repaint();
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("machine state", &["rtvcsnap", "zip", "z80"])
                .pick_file()
            {
                match self.emu.load_snapshot_file(&path) {
                    Ok(()) => {
                        self.sync_selection_from_emu();
                        self.file_status = Some(format!("Loaded: {}", path.display()));
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Load failed: {}", err));
                    }
                }
            }
        }
    }

    fn load_tape_dialog(&mut self, _ctx: egui::Context) {
        #[cfg(target_arch = "wasm32")]
        {
            let file_tx = self.file_tx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let file = rfd::AsyncFileDialog::new()
                    .add_filter("tape image", &["cas", "zip"])
                    .pick_file()
                    .await;
                if let Some(file) = file {
                    let name = file.file_name();
                    let bytes = file.read().await;
                    let _ = file_tx.send(PendingFile::Tape { name, bytes });
                    _ctx.request_repaint();
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("tape image", &["cas", "zip"])
                .pick_file()
            {
                match self.emu.play_tape_file_path(&path) {
                    Ok(()) => {
                        self.save_app_state();
                        self.file_status = Some(format!("Loaded tape: {}", path.display()));
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Tape load failed: {}", err));
                    }
                }
            }
        }
    }

    fn load_disk_dialog(&mut self, drive: usize, _ctx: egui::Context) {
        #[cfg(target_arch = "wasm32")]
        {
            let file_tx = self.file_tx.clone();
            wasm_bindgen_futures::spawn_local(async move {
                let file = rfd::AsyncFileDialog::new()
                    .add_filter("disk image", &["dsk", "zip"])
                    .pick_file()
                    .await;
                if let Some(file) = file {
                    let name = file.file_name();
                    let bytes = file.read().await;
                    let _ = file_tx.send(PendingFile::Disk { drive, name, bytes });
                    _ctx.request_repaint();
                }
            });
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("disk image", &["dsk", "zip"])
                .pick_file()
            {
                match self.emu.insert_disk_file_path_drive(drive, &path) {
                    Ok(()) => {
                        self.save_app_state();
                        self.file_status = Some(format!("Loaded disk: {}", path.display()));
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Disk load failed: {}", err));
                    }
                }
            }
        }
    }

    fn save_disk_dialog(&mut self, drive: usize) {
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(bytes) = self.emu.save_disk_bytes(drive) {
                let default_name = self.emu.loaded_disk[drive]
                    .as_deref()
                    .unwrap_or("disk.dsk")
                    .to_string();
                download_file(&default_name, &bytes, "application/octet-stream");
                self.file_status = Some(format!("Disk download started: {default_name}"));
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let default_name = self.emu.loaded_disk[drive]
                .as_deref()
                .unwrap_or("disk.dsk")
                .to_string();
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("disk image", &["dsk"])
                .set_file_name(&default_name)
                .save_file()
            {
                match self.emu.save_disk_file(drive, &path) {
                    Ok(()) => {
                        self.file_status = Some(format!("Saved disk: {}", path.display()));
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Disk save failed: {}", err));
                    }
                }
            }
        }
    }

    fn open_game_library(&mut self, ctx: egui::Context) {
        self.game_library.open = true;
        if self.game_library.entries.is_empty() && !self.game_library.loading_catalog {
            self.game_library.loading_catalog = true;
            self.game_library.catalog_error = None;
            let tx = self.game_tx.clone();
            #[cfg(target_arch = "wasm32")]
            wasm_bindgen_futures::spawn_local(async move {
                let result = async {
                    let value = JsFuture::from(web_fetch_text(GAME_CATALOG_URL))
                        .await
                        .map_err(js_error_string)?;
                    let json = value
                        .as_string()
                        .ok_or_else(|| "Game catalog response was not text".to_string())?;
                    serde_json::from_str(&json).map_err(|err| err.to_string())
                }
                .await;
                let _ = tx.send(GameEvent::Catalog(result));
                ctx.request_repaint();
            });
            #[cfg(not(target_arch = "wasm32"))]
            std::thread::spawn(move || {
                let result = native_fetch_text(GAME_CATALOG_URL)
                    .and_then(|json| serde_json::from_str(&json).map_err(|err| err.to_string()));
                let _ = tx.send(GameEvent::Catalog(result));
                ctx.request_repaint();
            });
        }
    }

    fn request_game_image(&mut self, name: String, ctx: egui::Context) {
        if name.is_empty()
            || self.game_library.textures.contains_key(&name)
            || self.game_library.pending_images.contains(&name)
            || self.game_library.failed_images.contains(&name)
        {
            return;
        }

        self.game_library.pending_images.insert(name.clone());
        let tx = self.game_tx.clone();
        let url = game_asset_url(GAME_PICTURE_URL, &name);
        #[cfg(target_arch = "wasm32")]
        wasm_bindgen_futures::spawn_local(async move {
            let result = JsFuture::from(web_fetch_bytes(&url))
                .await
                .map(|value| js_sys::Uint8Array::new(&value).to_vec())
                .map_err(js_error_string);
            let _ = tx.send(GameEvent::Image { name, result });
            ctx.request_repaint();
        });
        #[cfg(not(target_arch = "wasm32"))]
        std::thread::spawn(move || {
            let result = native_fetch_bytes(&url);
            let _ = tx.send(GameEvent::Image { name, result });
            ctx.request_repaint();
        });
    }

    fn request_game_archive(&mut self, game: GameEntry, ctx: egui::Context) {
        if self.game_library.loading_game_id.is_some() {
            return;
        }
        self.game_library.loading_game_id = Some(game.id);
        let tx = self.game_tx.clone();
        let url = game_asset_url(GAME_BASE_URL, &game.filename);
        #[cfg(target_arch = "wasm32")]
        wasm_bindgen_futures::spawn_local(async move {
            let result = JsFuture::from(web_fetch_bytes(&url))
                .await
                .map(|value| js_sys::Uint8Array::new(&value).to_vec())
                .map_err(js_error_string);
            let _ = tx.send(GameEvent::Archive { game, result });
            ctx.request_repaint();
        });
        #[cfg(not(target_arch = "wasm32"))]
        std::thread::spawn(move || {
            let result = native_fetch_bytes(&url);
            let _ = tx.send(GameEvent::Archive { game, result });
            ctx.request_repaint();
        });
    }

    fn draw_game_library(&mut self, ctx: &egui::Context) {
        if !self.game_library.open {
            return;
        }

        let mut open = self.game_library.open;
        let dialog_rect = ctx.available_rect().shrink(8.0);
        egui::Window::new("TVC Gamebase")
            .open(&mut open)
            .collapsible(false)
            .resizable(false)
            .fixed_rect(dialog_rect)
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label("Search:");
                    ui.add_sized(
                        [ui.available_width(), 24.0],
                        egui::TextEdit::singleline(&mut self.game_library.search)
                            .hint_text("Program name..."),
                    );
                });
                ui.separator();

                if self.game_library.loading_catalog {
                    ui.centered_and_justified(|ui| {
                        ui.spinner();
                        ui.label("Loading game catalog...");
                    });
                    return;
                }
                if let Some(error) = self.game_library.catalog_error.clone() {
                    ui.vertical_centered(|ui| {
                        ui.colored_label(egui::Color32::LIGHT_RED, error);
                        if ui.button("Retry").clicked() {
                            self.open_game_library(ctx.clone());
                        }
                    });
                    return;
                }

                let search = normalize_game_name(self.game_library.search.trim());
                let filtered: Vec<usize> = self
                    .game_library
                    .entries
                    .iter()
                    .enumerate()
                    .filter_map(|(index, game)| game.matches(&search).then_some(index))
                    .collect();
                ui.label(format!("{} programs", filtered.len()));

                let available = ui.available_size();
                let pane_gutter = 24.0;
                let right_width = (available.x * 0.32)
                    .clamp(220.0, 360.0)
                    .min((available.x - pane_gutter) * 0.42);
                let left_width = (available.x - right_width - pane_gutter).max(240.0);
                let panel_height = available.y;
                let mut requested_images = Vec::new();
                let mut clicked_id = None;

                ui.horizontal(|ui| {
                    ui.allocate_ui_with_layout(
                        egui::vec2(left_width, panel_height),
                        egui::Layout::top_down(egui::Align::Min),
                        |ui| {
                            let item_spacing = ui.spacing().item_spacing.x;
                            let scroll = &ui.spacing().scroll;
                            let scrollbar_width = if scroll.floating {
                                scroll.floating_allocated_width.max(6.0)
                            } else {
                                scroll.bar_width + scroll.bar_inner_margin + scroll.bar_outer_margin
                            };
                            let grid_width =
                                (ui.available_width() - scrollbar_width - 4.0).max(200.0);
                            let columns = (((grid_width + item_spacing) / (140.0 + item_spacing))
                                .floor() as usize)
                                .clamp(4, 6);
                            let tile_width = (grid_width
                                - item_spacing * columns.saturating_sub(1) as f32)
                                / columns as f32;
                            let row_height = tile_width * 0.75 + 42.0;
                            let row_count = filtered.len().div_ceil(columns);
                            egui::ScrollArea::vertical()
                                .id_salt("gamebase_grid")
                                .hscroll(false)
                                .auto_shrink([false, false])
                                .show_rows(ui, row_height, row_count, |ui, rows| {
                                    ui.set_width(grid_width);
                                    for row in rows {
                                        ui.push_id(row, |ui| {
                                            ui.horizontal(|ui| {
                                                ui.spacing_mut().item_spacing.x = item_spacing;
                                                for column in 0..columns {
                                                    let position = row * columns + column;
                                                    let Some(&entry_index) = filtered.get(position)
                                                    else {
                                                        break;
                                                    };
                                                    let game =
                                                        &self.game_library.entries[entry_index];
                                                    if !game.screenshot.is_empty()
                                                        && !self
                                                            .game_library
                                                            .textures
                                                            .contains_key(&game.screenshot)
                                                    {
                                                        requested_images
                                                            .push(game.screenshot.clone());
                                                    }
                                                    let response = ui
                                                        .push_id(game.id, |ui| {
                                                            draw_game_tile(
                                                                ui,
                                                                game,
                                                                self.game_library
                                                                    .textures
                                                                    .get(&game.screenshot),
                                                                self.game_library.selected_id
                                                                    == Some(game.id),
                                                                tile_width,
                                                            )
                                                        })
                                                        .inner;
                                                    if response.clicked() {
                                                        clicked_id = Some(game.id);
                                                    }
                                                }
                                            });
                                        });
                                    }
                                });
                        },
                    );

                    ui.separator();
                    ui.allocate_ui_with_layout(
                        egui::vec2(right_width, panel_height),
                        egui::Layout::top_down(egui::Align::Min),
                        |ui| {
                            let selected = self
                                .game_library
                                .selected_id
                                .and_then(|id| {
                                    self.game_library.entries.iter().find(|game| game.id == id)
                                })
                                .cloned();
                            let Some(game) = selected else {
                                ui.centered_and_justified(|ui| {
                                    ui.label("Select a program to see its details.");
                                });
                                return;
                            };

                            ui.heading(&game.name);
                            let detail_height = (panel_height - 48.0).max(180.0);
                            egui::ScrollArea::vertical()
                                .id_salt("gamebase_details")
                                .max_height(detail_height)
                                .show(ui, |ui| {
                                    let image_names = game_image_names(&game);
                                    for name in image_names {
                                        if let Some(texture) = self.game_library.textures.get(&name)
                                        {
                                            draw_detail_image(ui, texture);
                                            ui.add_space(6.0);
                                        } else if self.game_library.failed_images.contains(&name) {
                                            break;
                                        } else {
                                            requested_images.push(name);
                                            break;
                                        }
                                    }
                                    metadata_label(ui, "Year", &game.year);
                                    metadata_label(ui, "Genre", &game.genre);
                                    metadata_label(ui, "Publisher", &game.publisher);
                                    metadata_label(ui, "Developer", &game.developer);
                                    metadata_label(ui, "Programmer", &game.programmer);
                                    metadata_label(ui, "Musician", &game.musician);
                                    metadata_label(ui, "Language", &game.language);
                                    metadata_label(ui, "Media", &game.file_to_run);
                                    if game.rating != 0 {
                                        metadata_label(ui, "Rating", &game.rating.to_string());
                                    }
                                    if game.control_code != 0 {
                                        metadata_label(
                                            ui,
                                            "Control",
                                            &game.control_code.to_string(),
                                        );
                                    }
                                    metadata_label(ui, "SID", &game.sid_file);
                                    if !game.description.is_empty() {
                                        ui.separator();
                                        ui.strong("Description");
                                        ui.label(&game.description);
                                    }
                                    if !game.comment.is_empty() {
                                        ui.separator();
                                        ui.strong("Comment");
                                        ui.label(&game.comment);
                                    }
                                });

                            let loading = self.game_library.loading_game_id == Some(game.id);
                            let button_text = if loading {
                                "Loading..."
                            } else if game.is_loadable() {
                                "Load"
                            } else {
                                "Unsupported media"
                            };
                            if ui
                                .push_id("gamebase_load", |ui| {
                                    ui.add_enabled(
                                        self.game_library.loading_game_id.is_none()
                                            && !game.filename.is_empty()
                                            && game.is_loadable(),
                                        egui::Button::new(button_text)
                                            .min_size(egui::vec2(ui.available_width(), 32.0)),
                                    )
                                })
                                .inner
                                .clicked()
                            {
                                self.request_game_archive(game, ctx.clone());
                            }
                        },
                    );
                });

                if let Some(id) = clicked_id {
                    self.game_library.selected_id = Some(id);
                }
                requested_images.sort();
                requested_images.dedup();
                for name in requested_images {
                    self.request_game_image(name, ctx.clone());
                }
            });
        self.game_library.open = open;
    }

    fn handle_game_events(&mut self, ctx: &egui::Context) {
        while let Ok(event) = self.game_rx.try_recv() {
            match event {
                GameEvent::Catalog(result) => {
                    self.game_library.loading_catalog = false;
                    match result {
                        Ok(entries) => {
                            self.game_library.entries = entries;
                            self.game_library.catalog_error = None;
                            self.game_library.selected_id = None;
                        }
                        Err(err) => {
                            self.game_library.catalog_error =
                                Some(format!("Game catalog load failed: {err}"));
                        }
                    }
                }
                GameEvent::Image { name, result } => {
                    self.game_library.pending_images.remove(&name);
                    match result.and_then(|bytes| decode_game_image(&bytes)) {
                        Ok(image) => {
                            let texture = ctx.load_texture(
                                format!("gamebase:{name}"),
                                image,
                                egui::TextureOptions::LINEAR,
                            );
                            self.game_library.textures.insert(name.clone(), texture);
                            self.game_library.image_order.push_back(name);
                            while self.game_library.image_order.len() > 96 {
                                if let Some(stale) = self.game_library.image_order.pop_front() {
                                    self.game_library.textures.remove(&stale);
                                }
                            }
                        }
                        Err(_) => {
                            self.game_library.failed_images.insert(name);
                        }
                    }
                }
                GameEvent::Archive { game, result } => {
                    self.game_library.loading_game_id = None;
                    match result.and_then(|bytes| self.load_game_archive(&game, &bytes)) {
                        Ok(()) => {
                            self.selected_machine = Self::selected_machine_index(
                                &self.machine_types,
                                self.emu.machine_type,
                            );
                            let kind = if game.file_to_run.to_ascii_lowercase().ends_with(".cas") {
                                #[cfg(target_arch = "wasm32")]
                                if let Some(recent) = self.emu.recent_tapes_wasm.first().cloned() {
                                    self.persist_wasm_recent("tape", recent, ctx.clone());
                                }
                                "tape"
                            } else {
                                #[cfg(target_arch = "wasm32")]
                                if let Some(recent) = self.emu.recent_disks_wasm.first().cloned() {
                                    self.persist_wasm_recent("disk", recent, ctx.clone());
                                }
                                "disk"
                            };
                            #[cfg(not(target_arch = "wasm32"))]
                            self.save_app_state();
                            self.file_status =
                                Some(format!("Loaded {kind} from Gamebase: {}", game.name));
                            self.game_library.open = false;
                        }
                        Err(err) => {
                            self.file_status =
                                Some(format!("Gamebase load failed for {}: {err}", game.name));
                        }
                    }
                }
            }
        }
    }

    fn load_game_archive(&mut self, game: &GameEntry, bytes: &[u8]) -> Result<(), String> {
        #[cfg(target_arch = "wasm32")]
        {
            self.emu
                .load_game_archive_bytes(&game.file_to_run, bytes)
                .map_err(|err| err.to_string())
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            let media = crate::emu::extract_game_archive_member(&game.file_to_run, bytes)
                .map_err(|err| err.to_string())?;
            let path = native_game_media_path(&self.app_state_file, game);
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
            }
            std::fs::write(&path, media).map_err(|err| err.to_string())?;

            self.emu
                .start_gamebase_media_file(&game.file_to_run, &path)
                .map_err(|err| err.to_string())
        }
    }

    fn save_screenshot_dialog(&mut self) {
        #[cfg(target_arch = "wasm32")]
        {
            match self.emu.get_screenshot_png() {
                Ok(png) => {
                    download_file("rtvc-screen.png", &png, "image/png");
                    self.file_status = Some("Screenshot download started".to_string());
                }
                Err(err) => {
                    self.file_status = Some(format!("Screenshot failed: {err}"));
                }
            }
        }
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("png image", &["png"])
                .set_file_name("rtvc-screen.png")
                .save_file()
            {
                match self.save_screenshot(&path) {
                    Ok(()) => {
                        self.file_status = Some(format!("Saved: {}", path.display()));
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Screenshot failed: {}", err));
                    }
                }
            }
        }
    }

    fn draw_menu_bar(&mut self, ctx: &egui::Context) {
        egui::TopBottomPanel::top("menu_bar").show(ctx, |ui| {
            egui::menu::bar(ui, |ui| {
                self.draw_file_menu(ui);
                self.draw_machine_menu(ui);
                self.draw_tape_menu(ui);
                self.draw_disk_menu(ui);
                self.draw_view_menu(ui);
                self.draw_help_menu(ui);
            });
        });
    }

    fn draw_file_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("File", |ui| {
            if ui.button("Browse Gamebase...").clicked() {
                self.open_game_library(ui.ctx().clone());
                ui.close_menu();
            }
            ui.separator();
            if ui.button("Load Tape...").clicked() {
                self.load_tape_dialog(ui.ctx().clone());
                ui.close_menu();
            }
            if ui.button("Load Disk...").clicked() {
                self.load_disk_dialog(0, ui.ctx().clone());
                ui.close_menu();
            }
            ui.separator();
            if ui.button("Load State...").clicked() {
                self.load_snapshot_dialog(ui.ctx().clone());
                ui.close_menu();
            }
            if ui.button("Save Snapshot...").clicked() {
                self.save_snapshot_dialog();
                ui.close_menu();
            }
            ui.separator();
            if ui.button("Save Screenshot...").clicked() {
                self.save_screenshot_dialog();
                ui.close_menu();
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                ui.separator();
                if ui.button("Quit").clicked() {
                    self.save_app_state();
                    self.save_workspace();
                    ui.ctx().send_viewport_cmd(egui::ViewportCommand::Close);
                    ui.close_menu();
                }
            }
        });
    }

    fn draw_machine_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Machine", |ui| {
            if ui
                .button(if self.emu.running { "Pause" } else { "Run" })
                .clicked()
            {
                if !self.emu.running {
                    self.debugger_ui.prepare_history_resume();
                }
                self.emu.toggle_running();
                self.last_repaint_time = Instant::now();
                self.emu_frame_accumulator = 0.0;
                self.save_app_state();
                ui.close_menu();
            }

            if ui.button("Reset").clicked() {
                self.emu.reset();
                self.emu_frame_accumulator = 0.0;
                self.save_app_state();
                ui.close_menu();
            }

            if self.emu.system() == System::Tvc {
                let mut fast_boot = self.emu.fast_boot();
                if ui.checkbox(&mut fast_boot, "Fast boot").changed() {
                    self.emu.set_fast_boot(fast_boot);
                    self.save_app_state();
                }
            }

            ui.separator();
            ui.label("System");
            if ui
                .selectable_label(self.emu.system() == System::Tvc, "TVC")
                .clicked()
            {
                let vid_model = self.emu.vid_model();
                if let Err(err) = self.emu.reload(self.emu.machine_type) {
                    self.file_status = Some(err);
                }
                self.emu.set_vid_model(vid_model);
                self.save_app_state();
                ui.close_menu();
            }
            #[cfg(not(target_arch = "wasm32"))]
            {
                if ui
                    .selectable_label(self.emu.system() == System::Zx82, "Zx82 (Spectrum 48K)")
                    .clicked()
                {
                    if let Err(err) = self.emu.switch_to_zx82() {
                        self.file_status = Some(err);
                    } else {
                        self.file_status = Some("Booted Zx82 from roms/48.rom".to_string());
                    }
                    ui.close_menu();
                }
            }

            if self.emu.system() == System::Tvc {
                ui.separator();
                ui.label("TVC type");
                let machine_types = self.machine_types.clone();
                for (index, machine_type) in machine_types.into_iter().enumerate() {
                    if ui
                        .selectable_label(self.selected_machine == index, machine_type.label())
                        .clicked()
                    {
                        self.selected_machine = index;
                        let vid_model = self.emu.vid_model();
                        if let Err(err) = self.emu.reload(machine_type) {
                            self.file_status = Some(err);
                        }
                        self.emu.set_vid_model(vid_model);
                        self.save_app_state();
                        ui.close_menu();
                    }
                }
            }

            ui.separator();
            ui.label("Video");
            let vid_model = self.emu.vid_model();
            if ui
                .selectable_label(vid_model == VidModel::FastFrame, "Fast frame")
                .clicked()
            {
                self.emu.set_vid_model(VidModel::FastFrame);
                self.save_app_state();
                ui.close_menu();
            }
            if ui
                .selectable_label(vid_model == VidModel::Interleaved, "Interleaved")
                .clicked()
            {
                self.emu.set_vid_model(VidModel::Interleaved);
                self.save_app_state();
                ui.close_menu();
            }
        });
    }

    fn draw_tape_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Tape", |ui| {
            if self.emu.system() != System::Tvc {
                ui.label("Tape controls are not implemented for Zx82.");
                return;
            }
            if ui.button("Open Tape File...").clicked() {
                self.load_tape_dialog(ui.ctx().clone());
                ui.close_menu();
            }

            #[cfg(target_arch = "wasm32")]
            {
                if !self.emu.recent_tapes_wasm.is_empty() {
                    ui.separator();
                    ui.label("Recent Tapes:");
                    for recent in self.emu.recent_tapes_wasm.clone() {
                        if ui.button(&recent.name).clicked() {
                            if let Err(err) = self.emu.play_tape_bytes(&recent.name, &recent.bytes)
                            {
                                self.file_status = Some(format!("Tape load failed: {}", err));
                            } else {
                                self.persist_wasm_recent("tape", recent, ui.ctx().clone());
                            }
                            ui.close_menu();
                        }
                    }
                }
                if !self.emu.recent_tapes_wasm.is_empty() {
                    if ui.button("Clear Recent Tapes").clicked() {
                        self.clear_wasm_recents("tape", ui.ctx().clone());
                        ui.close_menu();
                    }
                }
            }

            #[cfg(not(target_arch = "wasm32"))]
            {
                if !self.emu.recent_tapes.is_empty() {
                    ui.separator();
                    ui.label("Recent Tapes:");
                    for path_str in self.emu.recent_tapes.clone() {
                        let display_name = std::path::Path::new(&path_str)
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| path_str.clone());

                        if ui.button(display_name).clicked() {
                            let path = std::path::Path::new(&path_str);
                            if let Err(err) = self.emu.play_tape_file_path(path) {
                                self.file_status = Some(format!("Tape load failed: {}", err));
                            } else {
                                self.save_app_state();
                            }
                            ui.close_menu();
                        }
                    }
                }
            }

            ui.separator();

            let entries = media_entries(&self.emu.progs, |entry| entry.is_cas);
            if entries.is_empty() {
                ui.add_enabled(false, egui::Label::new("No tape images"));
            } else {
                for (index, name) in entries {
                    if ui
                        .selectable_label(self.emu.selected_prog == index, name)
                        .clicked()
                    {
                        self.emu.selected_prog = index;
                        self.emu.play_tape();
                        self.save_app_state();
                        ui.close_menu();
                    }
                }
            }

            ui.separator();
            let tape_selected = selected_media_matches(&self.emu, |entry| entry.is_cas);
            let tape_injectable = self.emu.can_inject_tape();
            if ui
                .add_enabled(tape_injectable, egui::Button::new("Inject"))
                .clicked()
            {
                match self.emu.inject_tape() {
                    Ok(()) => {
                        self.file_status = self
                            .emu
                            .loaded_tape
                            .as_ref()
                            .map(|name| format!("Injected tape: {name}"));
                        self.save_app_state();
                    }
                    Err(err) => {
                        self.file_status = Some(format!("Tape injection failed: {err}"));
                    }
                }
                ui.close_menu();
            }

            if self.emu.tvc().is_some_and(|tvc| tvc.bus.tape_play_active()) {
                if ui.button("Stop").clicked() {
                    self.emu.stop_tape();
                    self.save_app_state();
                    ui.close_menu();
                }
            } else if ui
                .add_enabled(tape_selected, egui::Button::new("Play"))
                .clicked()
            {
                self.emu.play_tape();
                self.save_app_state();
                ui.close_menu();
            }
        });
    }

    fn draw_disk_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Disk", |ui| {
            if self.emu.system() != System::Tvc {
                ui.label("Disk controls are not implemented for Zx82.");
                return;
            }

            let drive_labels = ["Drive A:", "Drive B:"];
            for drive in 0..2 {
                ui.menu_button(drive_labels[drive], |ui| {
                    if ui.button("Open Disk File...").clicked() {
                        self.load_disk_dialog(drive, ui.ctx().clone());
                        ui.close_menu();
                    }
                    for geometry in [DiskGeometry::TVC_360K, DiskGeometry::TVC_720K] {
                        if ui.button(format!("New {} Disk", geometry.label)).clicked() {
                            if let Err(err) = self.emu.insert_empty_disk_drive(drive, geometry) {
                                self.file_status = Some(format!("Failed to create disk: {}", err));
                            } else {
                                self.save_app_state();
                            }
                            ui.close_menu();
                        }
                    }

                    let has_disk = self.emu.loaded_disk[drive].is_some();
                    if ui
                        .add_enabled(has_disk, egui::Button::new("Save Disk..."))
                        .clicked()
                    {
                        self.save_disk_dialog(drive);
                        ui.close_menu();
                    }
                    if ui
                        .add_enabled(has_disk, egui::Button::new("Eject"))
                        .clicked()
                    {
                        self.emu.eject_disk(drive);
                        self.save_app_state();
                        ui.close_menu();
                    }

                    #[cfg(target_arch = "wasm32")]
                    {
                        if !self.emu.recent_disks_wasm.is_empty() {
                            ui.separator();
                            ui.label("Recent Disks:");
                            for recent in self.emu.recent_disks_wasm.clone() {
                                if ui.button(&recent.name).clicked() {
                                    if let Err(err) = self.emu.insert_disk_bytes_drive(
                                        drive,
                                        &recent.name,
                                        &recent.bytes,
                                    ) {
                                        self.file_status =
                                            Some(format!("Disk load failed: {}", err));
                                    } else {
                                        self.persist_wasm_recent("disk", recent, ui.ctx().clone());
                                    }
                                    ui.close_menu();
                                }
                            }
                        }
                        if !self.emu.recent_disks_wasm.is_empty() {
                            if ui.button("Clear Recent Disks").clicked() {
                                self.clear_wasm_recents("disk", ui.ctx().clone());
                                ui.close_menu();
                            }
                        }
                    }

                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        if !self.emu.recent_disks.is_empty() {
                            ui.separator();
                            ui.label("Recent Disks:");
                            for path_str in self.emu.recent_disks.clone() {
                                let display_name = std::path::Path::new(&path_str)
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_else(|| path_str.clone());

                                if ui.button(display_name).clicked() {
                                    let path = std::path::Path::new(&path_str);
                                    if let Err(err) =
                                        self.emu.insert_disk_file_path_drive(drive, path)
                                    {
                                        self.file_status =
                                            Some(format!("Disk load failed: {}", err));
                                    } else {
                                        self.save_app_state();
                                    }
                                    ui.close_menu();
                                }
                            }
                        }
                    }

                    if let Some(name) = self.emu.loaded_disk[drive].clone() {
                        ui.separator();
                        ui.label(format!("Loaded: {name}"));
                    }
                });
            }

            ui.separator();

            let entries = media_entries(&self.emu.progs, |entry| entry.is_disk);
            if entries.is_empty() {
                ui.add_enabled(false, egui::Label::new("No built-in disk images"));
            } else {
                ui.label("Built-in Disks:");
                for (index, name) in entries {
                    if ui
                        .selectable_label(self.emu.selected_prog == index, name)
                        .clicked()
                    {
                        self.emu.selected_prog = index;
                        self.emu.insert_selected_disk();
                        self.save_app_state();
                        ui.close_menu();
                    }
                }
            }

            ui.separator();
            let disk_selected = selected_media_matches(&self.emu, |entry| entry.is_disk);
            if ui
                .add_enabled(disk_selected, egui::Button::new("Insert"))
                .clicked()
            {
                self.emu.insert_selected_disk();
                self.save_app_state();
                ui.close_menu();
            }
        });
    }

    fn draw_view_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("View", |ui| {
            let mut developer = self.workspace.is_developer();
            if ui.checkbox(&mut developer, "Developer Workspace").changed() {
                if !developer {
                    self.release_screen_capture();
                }
                self.workspace.set_mode(if developer {
                    WorkspaceMode::Developer
                } else {
                    WorkspaceMode::Simple
                });
                self.save_workspace();
            }

            ui.add_enabled_ui(developer, |ui| {
                ui.menu_button("Panes", |ui| {
                    for (tab, label) in [
                        (WorkspaceTab::IoLog, "IO Log"),
                        (WorkspaceTab::Cpu, "CPU"),
                        (WorkspaceTab::Disassembly, "Disassembly"),
                        (WorkspaceTab::Memory, "Memory"),
                        (WorkspaceTab::Breakpoints, "Breakpoints"),
                        (WorkspaceTab::RomSymbols, "ROM Symbols"),
                        (WorkspaceTab::Events, "Events"),
                        (WorkspaceTab::FrameHistory, "Frame History"),
                        (WorkspaceTab::InstructionTrace, "Instruction Trace"),
                    ] {
                        let is_open = self.workspace.has_tab(tab);
                        if ui.selectable_label(is_open, label).clicked() {
                            if is_open {
                                self.workspace.close_tab(tab);
                            } else {
                                self.workspace.open_tab(tab);
                            }
                            self.save_workspace();
                            ui.close_menu();
                        }
                    }
                });

                if ui.button("Debugger Layout").clicked() {
                    self.release_screen_capture();
                    self.workspace.debugger_layout();
                    self.save_workspace();
                    ui.close_menu();
                }

                if ui.button("Reset Workspace").clicked() {
                    self.release_screen_capture();
                    self.workspace.reset_layout();
                    self.save_workspace();
                    ui.close_menu();
                }
            });
        });
    }

    fn draw_help_menu(&mut self, ui: &mut egui::Ui) {
        ui.menu_button("Help", |ui| {
            if ui.button("Help Contents...").clicked() {
                self.show_help = true;
                ui.close_menu();
            }
        });
    }

    fn draw_help_window(&mut self, ctx: &egui::Context) {
        if !self.show_help {
            return;
        }

        let mut open = self.show_help;
        egui::Window::new("Help")
            .open(&mut open)
            .collapsible(false)
            .resizable(true)
            .default_size([560.0, 400.0])
            .show(ctx, |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    ui.heading("VT-DOS Reference");
                    ui.separator();
                    ui.label(
                        "The VT-DOS compatible floppy controller provides disk storage
from BASIC without requiring a separate DOS cartridge.

Use standard BASIC commands with drive prefixes for loading
and saving (see TVC BASIC Reference below):

  LOAD \"*\"       load first file from current drive
  LOAD \"B:CYRUS\"       load CYRUS from drive B
  SAVE \"PROG\"           save to PROG.CAS on current drive
  LOAD \"B:\\BOOT\\GAME\"   load from \\BOOT directory on B
",
                    );
                    ui.label(
                        "Type EXT2 at the BASIC prompt to enter the BASIC CLI (Command
Line Interpreter).  Your BASIC program and variables are
preserved.  Press ESC to return to BASIC.

  CLI commands (after EXT2):
  DIR [d:] [path] [name] [/W] [/H] [/T] [/S]  list directory
  COPY src [/H] [dest]                         copy files
  DEL filespec [/H]                            delete files
  REN filespec [/H] name                       rename files
  FORMAT [d:] [volname] [/1] [/H] [/8]         format a disk
  CD [d:] [path]               change/display current directory
  MD [d:] path                 create subdirectory
  RD [d:] path [/H]            remove empty subdirectory
  MOVE filespec [/H] [path]    move files
  RNDIR filespec [/H] name     rename subdirectory
  TYPE filespec [/H]           display file contents on screen
  DATE [date]                  display/set system date
  TIME [time]                  display/set system time
  VOL [d:] [label]             display/set volume label
  VAR n [value]                display/set system variable
  CLS                          clear screen
  HELP                         list all CLI commands
  DOS                          switch to VT-DOS cartridge
",
                    );

                    ui.heading("TVC BASIC Reference");
                    ui.separator();
                    ui.label(
                        "LET [var = expr]            — Assign value (LET is optional)
PRINT [expr]                 — Output to screen
INPUT [prompt;] var          — Read from keyboard
READ var [,var...]           — Read from DATA
DATA val [,val...]           — Store constants for READ
RESTORE [line]               — Reset DATA pointer
GOTO line                    — Jump to line
GOSUB line                   — Call subroutine
RETURN                       — Return from subroutine
FOR var = start TO end [STEP s] ... NEXT var — Loop
IF cond THEN line|stmt       — Conditional
ON expr GOTO/GOSUB line,...  — Computed jump
DIM var(d1[,d2])             — Dimension array
REM text                     — Comment
STOP                         — Stop execution
END                          — End program
RUN [\"name\"] [\"dev\"]        — Run program (load from disk if name given)
LOAD \"name\" [\"dev\"]           — Load program from tape/disk
SAVE \"name\" [\"dev\"]           — Save program to tape/disk
VERIFY \"name\" [\"dev\"]         — Verify program on tape/disk
OPEN \"name\" [FOR OUTPUT]       — Open data file for reading/writing
CLOSE [#n]                     — Close data file(s)
POKE addr, val               — Write memory byte
OUT port, val                — Write I/O port
PEEK(addr)                   — Read memory byte
INP(port)                    — Read I/O port
CALL addr                    — Call machine code
USR(addr)                    — Call machine code, return value
WAIT port, mask [,inv]       — Wait for I/O condition
SOUND freq, dur              — Sound on PSG chip
PLAY note$                   — Play note string
CSIZE n                      — Character size (1-8)
COLOR fg, bg                 — Set color attributes
SET INK n                    — Set foreground palette
SET PAPER n                  — Set background palette
SET BORDER n                 — Set border palette
SET MODE n                   — Set graphics write mode (0-3)
SET STYLE n                  — Set PLOT line style (0-3)
PLOT x, y                    — Plot point in graphics mode
DRAW x, y                    — Draw line from last point
CIRCLE x, y, r               — Draw circle
FILL x, y                    — Flood fill from point
TAB(n)                       — Tab to column in PRINT
AT x, y                      — Position cursor in PRINT
CHR$(n)                      — Character from code
STR$(n)                      — String from number
VAL(s)                       — Number from string
LEN(s)                       — String length
ASC(s)                       — ASCII code of first char
LEFT$(s, n) / RIGHT$(s, n) / MID$(s, p, n) — Substring
INKEY$                       — Read key without waiting
HEX$(n)                      — Convert to hex string
BIN$(n)                      — Convert to binary string
FRE                          — Free memory bytes
VERNUM                       — BASIC version number
RND [n]                      — Random number
INT(x)                       — Floor
SGN(x)                       — Sign (-1, 0, 1)
ABS(x)                       — Absolute value
SQR(x)                       — Square root
EXP(x) / LOG(x)              — Exponential / natural log
SIN(x) / COS(x) / TAN(x) / ATN(x) — Trigonometry
PI                           — π (3.141592654)
",
                    );
                });
            });
        self.show_help = open;
    }

    fn draw_status_bar(&mut self, ctx: &egui::Context) {
        egui::TopBottomPanel::bottom("status_bar")
            .resizable(false)
            .exact_height(24.0)
            .show(ctx, |ui| {
                ui.horizontal_centered(|ui| {
                    if ui.small_button("Reset").clicked() {
                        self.emu.reset();
                        self.emu_frame_accumulator = 0.0;
                        self.save_app_state();
                    }
                    ui.separator();
                    let tape_active = self.emu.tvc().is_some_and(|tvc| tvc.bus.tape_play_active());
                    draw_tape_led(ui, tape_active, self.emu.get_current_tape_level());
                    ui.label(
                        if let Some(percent) = self
                            .emu
                            .tvc()
                            .and_then(|tvc| tvc.bus.tape_progress_percent())
                        {
                            format!("Tape active ({percent}%)")
                        } else {
                            "Tape idle".to_string()
                        },
                    );
                    ui.separator();
                    ui.label(format!(
                        "Tape: {}",
                        self.emu.loaded_tape.as_deref().unwrap_or("(none)")
                    ));
                    ui.separator();
                    let disk_label = match (
                        self.emu.loaded_disk[0].as_deref(),
                        self.emu.loaded_disk[1].as_deref(),
                    ) {
                        (None, None) => "Disk: (none)".to_string(),
                        (Some(a), None) => format!("A: {a}"),
                        (None, Some(b)) => format!("B: {b}"),
                        (Some(a), Some(b)) => format!("A: {a}  B: {b}"),
                    };
                    ui.label(disk_label);
                    ui.separator();
                    ui.label(if self.emu.running {
                        "Running"
                    } else {
                        "Paused"
                    });
                    ui.separator();
                    ui.label(format!("FPS: {}", self.fps));
                    ui.separator();
                    let machine_label = if self.emu.system() == System::Tvc {
                        self.emu.machine_type.label()
                    } else {
                        self.emu.system_label().to_string()
                    };
                    ui.label(format!(
                        "Machine: {}",
                        if self.emu.roms_loaded {
                            machine_label
                        } else {
                            format!("{machine_label} (ROMs missing)")
                        }
                    ));
                    if let Some(status) = &self.audio_status {
                        ui.separator();
                        ui.label(status);
                    }
                    if let Some(status) = &self.file_status {
                        ui.separator();
                        ui.label(status);
                    }
                });
            });
    }

    fn current_app_state(&self) -> AppState {
        AppState {
            machine_type: Some(self.emu.machine_type),
            vid_model: Some(self.emu.vid_model()),
            fast_boot: self.emu.fast_boot(),
            tape_file_name: self.emu.loaded_tape_file_name.clone(),
            tape_loaded: self.emu.loaded_tape_file_name.is_some(),
            disk_file_name: self.emu.loaded_disk_file_name[0].clone(),
            disk_loaded: self.emu.loaded_disk_file_name[0].is_some(),
            recent_tapes: self.emu.recent_tapes.clone(),
            recent_disks: self.emu.recent_disks.clone(),
        }
    }

    fn save_app_state(&mut self) {
        let state = self.current_app_state();
        if let Err(err) = self.app_state_file.save(&state) {
            self.file_status = Some(format!("Config save failed: {err}"));
        }
    }

    fn save_workspace(&mut self) {
        if let Err(err) = self.workspace.save(&self.app_state_file.path) {
            self.file_status = Some(format!("Workspace save failed: {err}"));
        }
    }

    fn release_machine_keys(&mut self) {
        self.pressed_keys.clear();
        self.emu.focus_change(false);
        self.prev_shift = false;
        self.prev_ctrl = false;
        self.prev_alt = false;
    }

    fn release_screen_capture(&mut self) {
        self.screen_captured = false;
        self.release_machine_keys();
    }

    fn draw_workspace(&mut self, ctx: &egui::Context) {
        if self.workspace.is_developer() {
            let was_captured = self.screen_captured;
            let workspace = &mut self.workspace;
            let screen_texture = self.screen_texture.as_ref();
            let emu = &mut self.emu;
            let debugger_ui = &mut self.debugger_ui;
            let screen_captured = &mut self.screen_captured;
            egui::CentralPanel::default().show(ctx, |ui| {
                workspace.show(ui, screen_texture, emu, debugger_ui, screen_captured);
            });
            if was_captured && !self.screen_captured {
                self.release_machine_keys();
            }
            if self.debugger_ui.take_history_restored() {
                self.release_machine_keys();
                self.emu_frame_accumulator = 0.0;
            }
            if self.debugger_ui.take_save_history_snapshot_requested() {
                self.save_snapshot_dialog();
            }
            if ctx.input(|input| input.pointer.any_released()) {
                self.workspace.mark_layout_changed();
                self.save_workspace();
            }
        } else {
            self.debugger_ui.update_tracing(&mut self.emu, false);
            egui::CentralPanel::default().show(ctx, |ui| {
                let _ = workspace::draw_screen(ui, self.screen_texture.as_ref(), None);
            });
        }
    }

    #[cfg(target_arch = "wasm32")]
    fn persist_wasm_recent(
        &self,
        kind: &'static str,
        recent: crate::emu::WasmRecentFile,
        ctx: egui::Context,
    ) {
        let tx = self.file_tx.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let bytes = js_sys::Uint8Array::new_with_length(recent.bytes.len() as u32);
            bytes.copy_from(&recent.bytes);
            let result = wasm_bindgen_futures::JsFuture::from(web_store_recent_media(
                kind,
                &recent.name,
                &bytes,
            ))
            .await;
            let error = result.err().map(js_value_string);
            let _ = tx.send(PendingFile::StorageResult { error });
            ctx.request_repaint();
        });
    }

    #[cfg(target_arch = "wasm32")]
    fn clear_wasm_recents(&self, kind: &'static str, ctx: egui::Context) {
        let tx = self.file_tx.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let result = wasm_bindgen_futures::JsFuture::from(web_clear_recent_media(kind)).await;
            let event = match result {
                Ok(_) => PendingFile::RecentCleared {
                    kind: kind.to_string(),
                },
                Err(err) => PendingFile::StorageResult {
                    error: Some(js_value_string(err)),
                },
            };
            let _ = tx.send(event);
            ctx.request_repaint();
        });
    }

    #[cfg(target_arch = "wasm32")]
    fn handle_wasm_keyboard_events(&mut self) {
        for event in web_take_keyboard_events().iter() {
            let event_type = js_sys::Reflect::get(&event, &wasm_bindgen::JsValue::from_str("type"))
                .ok()
                .and_then(|value| value.as_string())
                .unwrap_or_default();
            match event_type.as_str() {
                "down" => {
                    let code = wasm_event_code(&event);
                    if code == 27 && self.game_library.open {
                        self.game_library.open = false;
                        continue;
                    }
                    if code == 27 && self.workspace.is_developer() && self.screen_captured {
                        self.release_screen_capture();
                        continue;
                    }
                    if !self.workspace.accepts_machine_input(self.screen_captured) {
                        continue;
                    }
                    let first_press = code == 0 || self.pressed_keys.insert(code);
                    if code != 0 && first_press {
                        self.emu.key_down(code);
                    }
                    if first_press {
                        for ch in wasm_event_text(&event).chars() {
                            self.emu.key_press(ch);
                        }
                    }
                }
                "up" => {
                    let code = wasm_event_code(&event);
                    if code != 0 && self.pressed_keys.remove(&code) {
                        self.emu.key_up(code);
                    }
                }
                "text" => {
                    if self.workspace.accepts_machine_input(self.screen_captured) {
                        for ch in wasm_event_text(&event).chars() {
                            self.emu.key_press(ch);
                        }
                    }
                }
                "blur" => {
                    self.release_screen_capture();
                }
                _ => {}
            }
        }
    }
}

#[cfg(target_arch = "wasm32")]
fn wasm_event_code(event: &wasm_bindgen::JsValue) -> u32 {
    js_sys::Reflect::get(event, &wasm_bindgen::JsValue::from_str("code"))
        .ok()
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0) as u32
}

#[cfg(target_arch = "wasm32")]
fn wasm_event_text(event: &wasm_bindgen::JsValue) -> String {
    js_sys::Reflect::get(event, &wasm_bindgen::JsValue::from_str("text"))
        .ok()
        .and_then(|value| value.as_string())
        .unwrap_or_default()
}

#[cfg(target_arch = "wasm32")]
fn js_value_string(value: wasm_bindgen::JsValue) -> String {
    value
        .as_string()
        .unwrap_or_else(|| "browser operation failed".to_string())
}

#[cfg(target_arch = "wasm32")]
fn js_error_string(value: wasm_bindgen::JsValue) -> String {
    js_sys::Reflect::get(&value, &wasm_bindgen::JsValue::from_str("message"))
        .ok()
        .and_then(|message| message.as_string())
        .or_else(|| value.as_string())
        .unwrap_or_else(|| "browser fetch failed".to_string())
}

fn game_asset_url(base: &str, name: &str) -> String {
    let mut encoded = String::with_capacity(name.len());
    for byte in name.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(byte as char);
        } else {
            use std::fmt::Write;
            let _ = write!(encoded, "%{byte:02X}");
        }
    }
    format!("{base}{encoded}")
}

fn dedupe_recent_paths(paths: &[String]) -> Vec<String> {
    let mut names = HashSet::new();
    paths
        .iter()
        .filter(|path| {
            let name = std::path::Path::new(path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(path)
                .to_lowercase();
            names.insert(name)
        })
        .cloned()
        .take(5)
        .collect()
}

#[cfg(not(target_arch = "wasm32"))]
fn native_game_media_path(app_state_file: &AppStateFile, game: &GameEntry) -> std::path::PathBuf {
    let kind = if game.file_to_run.to_ascii_lowercase().ends_with(".cas") {
        "tapes"
    } else {
        "disks"
    };
    let archive_name = std::path::Path::new(&game.filename)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("game");
    let media_name = std::path::Path::new(&game.file_to_run)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("media");
    app_state_file
        .media_cache_dir()
        .join(kind)
        .join(safe_path_component(archive_name))
        .join(safe_path_component(media_name))
}

#[cfg(not(target_arch = "wasm32"))]
fn safe_path_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.') {
                ch
            } else {
                '_'
            }
        })
        .collect();
    if sanitized.is_empty() {
        "media".to_string()
    } else {
        sanitized
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn native_fetch_text(url: &str) -> Result<String, String> {
    let mut response = ureq::get(url).call().map_err(|err| err.to_string())?;
    response
        .body_mut()
        .read_to_string()
        .map_err(|err| err.to_string())
}

#[cfg(not(target_arch = "wasm32"))]
fn native_fetch_bytes(url: &str) -> Result<Vec<u8>, String> {
    let mut response = ureq::get(url).call().map_err(|err| err.to_string())?;
    response
        .body_mut()
        .read_to_vec()
        .map_err(|err| err.to_string())
}

fn decode_game_image(bytes: &[u8]) -> Result<ColorImage, String> {
    let image = image::load_from_memory(bytes)
        .map_err(|err| err.to_string())?
        .to_rgba8();
    let size = [image.width() as usize, image.height() as usize];
    Ok(ColorImage::from_rgba_unmultiplied(size, image.as_raw()))
}

fn framebuffer_image(framebuffer: &[u32], size: [usize; 2]) -> ColorImage {
    assert_eq!(framebuffer.len(), size[0] * size[1]);

    #[cfg(target_endian = "little")]
    {
        // The emulator framebuffer stores premultiplied RGBA bytes in little-endian u32 pixels.
        debug_assert_eq!(std::mem::size_of::<u32>(), std::mem::size_of::<Color32>());
        let mut pixels = Vec::with_capacity(framebuffer.len());
        unsafe {
            std::ptr::copy_nonoverlapping(
                framebuffer.as_ptr().cast::<Color32>(),
                pixels.as_mut_ptr(),
                framebuffer.len(),
            );
            pixels.set_len(framebuffer.len());
        };
        ColorImage { size, pixels }
    }

    #[cfg(not(target_endian = "little"))]
    {
        let mut bytes = Vec::with_capacity(std::mem::size_of_val(framebuffer));
        for &rgba in framebuffer {
            bytes.extend_from_slice(&rgba.to_le_bytes());
        }
        ColorImage::from_rgba_premultiplied(size, &bytes)
    }
}

fn game_image_names(game: &GameEntry) -> Vec<String> {
    if game.screenshot.is_empty() {
        return Vec::new();
    }
    let path = std::path::Path::new(&game.screenshot);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(&game.screenshot);
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("gif");
    let mut names = vec![game.screenshot.clone()];
    if !stem
        .rsplit_once('_')
        .map(|(_, suffix)| suffix.chars().all(|ch| ch.is_ascii_digit()))
        .unwrap_or(false)
    {
        names.extend((1..=5).map(|index| format!("{stem}_{index}.{extension}")));
    }
    names
}

fn draw_game_tile(
    ui: &mut egui::Ui,
    game: &GameEntry,
    texture: Option<&TextureHandle>,
    selected: bool,
    width: f32,
) -> egui::Response {
    let image_size = egui::vec2(width, width * 0.75);
    ui.allocate_ui_with_layout(
        egui::vec2(width, image_size.y + 38.0),
        egui::Layout::top_down(egui::Align::Center),
        |ui| {
            let response = ui
                .push_id("image", |ui| {
                    if let Some(texture) = texture {
                        let image = egui::Image::new(texture)
                            .fit_to_exact_size(image_size)
                            .maintain_aspect_ratio(true);
                        ui.add(
                            egui::ImageButton::new(image)
                                .selected(selected)
                                .frame(selected),
                        )
                    } else {
                        ui.add_sized(image_size, egui::Button::new("Loading...").frame(false))
                    }
                })
                .inner;
            ui.add_space(2.0);
            ui.push_id("label", |ui| {
                ui.add_sized(
                    [width, 32.0],
                    egui::Label::new(egui::RichText::new(&game.name).small())
                        .wrap()
                        .halign(egui::Align::Center)
                        .sense(egui::Sense::click()),
                )
            })
            .inner
            .union(response)
        },
    )
    .inner
}

fn draw_detail_image(ui: &mut egui::Ui, texture: &TextureHandle) {
    let source = texture.size_vec2();
    let scale = (ui.available_width() / source.x).min(1.0);
    ui.image((texture.id(), source * scale));
}

fn metadata_label(ui: &mut egui::Ui, label: &str, value: &str) {
    if value.is_empty() {
        return;
    }
    ui.horizontal_wrapped(|ui| {
        ui.strong(format!("{label}:"));
        ui.label(value);
    });
}

#[cfg(test)]
#[path = "ui_tests.rs"]
mod tests;

fn draw_tape_led(ui: &mut egui::Ui, active: bool, level: f32) {
    let (rect, _) = ui.allocate_exact_size(egui::vec2(12.0, 12.0), egui::Sense::hover());
    let color = if active {
        if level > 0.5 {
            egui::Color32::from_rgb(255, 218, 80)
        } else {
            egui::Color32::from_rgb(48, 180, 90)
        }
    } else {
        egui::Color32::from_rgb(55, 60, 58)
    };
    ui.painter().circle_filled(rect.center(), 4.5, color);
    ui.painter().circle_stroke(
        rect.center(),
        4.5,
        egui::Stroke::new(1.0_f32, egui::Color32::from_gray(120)),
    );
}

impl eframe::App for EmuApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let mut user_interacted = false;
        ctx.input(|i| {
            if !i.events.is_empty() {
                user_interacted = true;
            }
        });
        if user_interacted {
            if self.audio.is_none() {
                match NativeAudioSink::new(self.emu.sound_sample_rate()) {
                    Ok(sink) => {
                        self.audio = Some(sink);
                        self.audio_status = None;
                    }
                    Err(err) => {
                        self.audio_status = Some(format!("Audio unavailable: {err}"));
                    }
                }
            }
            if let Some(ref audio) = self.audio {
                let _ = audio.resume();
            }
        }

        #[cfg(all(feature = "native", not(target_arch = "wasm32")))]
        if let Some(ref dbg) = self.debugger {
            dbg.set_context(ctx.clone());
            while let Ok(msg) = dbg.cmd_rx.try_recv() {
                let response = dbg.handle_command(&mut self.emu, &msg.cmd_line);
                let _ = msg.reply_tx.send(response);
            }
            if dbg.close_requested() {
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
        }

        #[cfg(target_arch = "wasm32")]
        while let Ok(pending) = self.file_rx.try_recv() {
            match pending {
                PendingFile::Tape { name, bytes } => {
                    match self.emu.play_tape_bytes(&name, &bytes) {
                        Ok(()) => {
                            if let Some(recent) = self.emu.recent_tapes_wasm.first().cloned() {
                                self.persist_wasm_recent("tape", recent, ctx.clone());
                            }
                            self.file_status = Some(format!("Loaded tape: {name}"));
                        }
                        Err(err) => {
                            self.file_status = Some(format!("Tape load failed: {err}"));
                        }
                    }
                }
                PendingFile::Disk { drive, name, bytes } => {
                    match self.emu.insert_disk_bytes_drive(drive, &name, &bytes) {
                        Ok(()) => {
                            if let Some(recent) = self.emu.recent_disks_wasm.first().cloned() {
                                self.persist_wasm_recent("disk", recent, ctx.clone());
                            }
                            self.file_status = Some(format!("Loaded disk: {name}"));
                        }
                        Err(err) => {
                            self.file_status = Some(format!("Disk load failed: {err}"));
                        }
                    }
                }
                PendingFile::Snapshot { name, bytes } => {
                    if name.to_ascii_lowercase().ends_with(".z80") {
                        match self.emu.load_z80_bytes(&bytes) {
                            Ok(()) => {
                                self.file_status = Some(format!("Loaded Zx82 state: {name}"));
                            }
                            Err(err) => {
                                self.file_status = Some(format!("Z80 load failed: {err}"));
                            }
                        }
                        continue;
                    }
                    let mut data = bytes;
                    if crate::emu::is_zip_data(&data) {
                        match crate::emu::unzip_snapshot(&data) {
                            Ok(unzipped) => data = unzipped,
                            Err(err) => {
                                self.file_status = Some(format!("Snapshot unzip failed: {err}"));
                                continue;
                            }
                        }
                    }
                    match self.emu.load_snapshot(&data) {
                        Ok(()) => {
                            self.sync_selection_from_emu();
                            self.file_status = Some(format!("Loaded snapshot: {name}"));
                        }
                        Err(err) => {
                            self.file_status = Some(format!("Snapshot load failed: {err}"));
                        }
                    }
                }
                PendingFile::StorageResult { error } => {
                    if let Some(err) = error {
                        self.file_status = Some(format!("Browser storage failed: {err}"));
                    }
                }
                PendingFile::RecentCleared { kind } => match kind.as_str() {
                    "tape" => {
                        self.emu.recent_tapes_wasm.clear();
                        self.file_status = Some("Recent tapes cleared".to_string());
                    }
                    "disk" => {
                        self.emu.recent_disks_wasm.clear();
                        self.file_status = Some("Recent disks cleared".to_string());
                    }
                    _ => {}
                },
            }
        }

        self.handle_game_events(ctx);

        #[cfg(not(target_arch = "wasm32"))]
        if self.game_library.open
            && ctx.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        {
            self.game_library.open = false;
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.show_help
            && ctx.input_mut(|input| input.consume_key(egui::Modifiers::NONE, egui::Key::Escape))
        {
            self.show_help = false;
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.workspace.is_developer()
            && self.screen_captured
            && ctx.input(|input| input.key_pressed(egui::Key::Escape))
        {
            self.release_screen_capture();
        }

        #[cfg(target_arch = "wasm32")]
        self.handle_wasm_keyboard_events();

        #[cfg(not(target_arch = "wasm32"))]
        let has_focus = ctx.input(|i| i.focused);
        #[cfg(not(target_arch = "wasm32"))]
        if !has_focus && (self.screen_captured || !self.pressed_keys.is_empty()) {
            self.release_screen_capture();
        }

        #[cfg(not(target_arch = "wasm32"))]
        if self.workspace.accepts_machine_input(self.screen_captured) {
            ctx.input(|i| {
                let modifiers = i.modifiers;
                self.handle_modifier(modifiers.shift, modifiers.ctrl, modifiers.alt);

                for event in &i.events {
                    match event {
                        egui::Event::Key {
                            key,
                            physical_key,
                            pressed: true,
                            ..
                        } => {
                            let key = physical_key.unwrap_or(*key);
                            if let Some(code) = egui_key_to_js_code(key) {
                                if self.pressed_keys.insert(code) {
                                    self.emu.key_down(code);
                                }
                            }
                        }
                        egui::Event::Key {
                            key,
                            physical_key,
                            pressed: false,
                            ..
                        } => {
                            let key = physical_key.unwrap_or(*key);
                            if let Some(code) = egui_key_to_js_code(key) {
                                self.pressed_keys.remove(&code);
                                self.emu.key_up(code);
                            }
                        }
                        egui::Event::Text(text) => {
                            for ch in text.chars() {
                                self.emu.key_press(ch);
                            }
                        }
                        _ => {}
                    }
                }
            });
        }

        let now = Instant::now();
        let dt = now.duration_since(self.last_repaint_time).as_secs_f64();
        self.last_repaint_time = now;
        if self.emu.running {
            self.emu_frame_accumulator += dt.min(0.1);
        }

        if self.emu.running && self.emu_frame_accumulator >= TVC_FRAME_DT {
            let hit_breakpoint = self.emu.tick();
            if !hit_breakpoint && self.emu.frame_complete() {
                if let Err(error) = self.debugger_ui.capture_history_frame(&self.emu) {
                    self.file_status = Some(format!("Frame history stopped: {error}"));
                }
            }
            #[cfg(all(feature = "native", not(target_arch = "wasm32")))]
            if let Some(ref dbg) = self.debugger {
                dbg.record_frame();
            }
            if hit_breakpoint {
                self.emu.running = false;
                let pc = self.emu.z80_state().pc;
                self.debugger_ui.record_breakpoint_hit(pc, &self.emu);
                #[cfg(all(feature = "native", not(target_arch = "wasm32")))]
                if let Some(ref dbg) = self.debugger {
                    let _ = dbg
                        .event_tx
                        .send(crate::debugger::DebuggerEvent::BreakpointHit { pc });
                }
            }
            self.push_audio_samples();
            self.emu_frame_accumulator %= TVC_FRAME_DT;
            self.frame_count += 1;
        }
        self.update_screen_texture(ctx);
        #[cfg(not(target_arch = "wasm32"))]
        for error in self.emu.flush_dirty_disk_files() {
            self.file_status = Some(error);
        }

        let elapsed = self.last_frame_time.elapsed();
        if elapsed.as_secs() >= 1 {
            self.fps = self.frame_count;
            self.frame_count = 0;
            self.last_frame_time = Instant::now();
        }

        self.draw_menu_bar(ctx);
        self.draw_status_bar(ctx);
        self.draw_workspace(ctx);

        self.draw_game_library(ctx);
        self.draw_help_window(ctx);

        if self.emu.running {
            ctx.request_repaint();
        } else {
            ctx.request_repaint_after(Duration::from_millis(100));
        }
    }

    fn on_exit(&mut self, _gl: Option<&eframe::glow::Context>) {
        #[cfg(not(target_arch = "wasm32"))]
        {
            let _ = self.emu.flush_dirty_disk_files();
        }
        self.save_app_state();
        self.save_workspace();
    }
}

impl EmuApp {
    fn push_audio_samples(&mut self) {
        let samples = self.emu.take_audio_samples();
        if let Some(audio) = &mut self.audio {
            audio.push_samples(&samples);
        }
    }
}
