#[cfg(feature = "wasm-full")]
use wasm_bindgen::JsCast;
use wasm_bindgen::prelude::*;

use crate::tvc::Tvc;
use crate::vid::VidModel;

pub const SCREEN_WIDTH: usize = 608;
pub const SCREEN_HEIGHT: usize = 288;

#[wasm_bindgen]
pub struct WasmTvc {
    tvc: Tvc,
}

#[wasm_bindgen]
impl WasmTvc {
    #[wasm_bindgen(constructor)]
    pub fn new(is_plus: bool) -> Self {
        WasmTvc {
            tvc: Tvc::new_with_vid_model(is_plus, default_web_vid_model()),
        }
    }

    pub fn reset(&mut self) {
        self.tvc.reset();
    }

    #[wasm_bindgen(js_name = saveSnapshot)]
    pub fn save_snapshot(&self) -> Vec<u8> {
        self.tvc.save_snapshot()
    }

    #[wasm_bindgen(js_name = loadSnapshot)]
    pub fn load_snapshot(&mut self, data: &[u8]) -> Result<(), JsValue> {
        if let Some((is_plus, rom_version, has_dos)) = snapshot_machine_type(data)? {
            let fast_boot = self.tvc.fast_boot();
            self.tvc = Tvc::new_with_vid_model(is_plus, self.tvc.vid_model());
            load_builtin_roms(&mut self.tvc, rom_version, has_dos);
            self.tvc.set_fast_boot(fast_boot);
        }
        self.tvc
            .load_snapshot(data)
            .map_err(|err| JsValue::from_str(&err.to_string()))
    }

    #[wasm_bindgen(js_name = setVidModel)]
    pub fn set_vid_model(&mut self, model: &str) -> Result<(), JsValue> {
        let vid_model = match model {
            "fast-frame" | "simple" => VidModel::FastFrame,
            "interleaved" | "realistic" => VidModel::Interleaved,
            _ => {
                return Err(JsValue::from_str("expected `fast-frame` or `interleaved`"));
            }
        };
        self.tvc.set_vid_model(vid_model);
        Ok(())
    }

    #[wasm_bindgen(js_name = vidModel)]
    pub fn vid_model(&self) -> String {
        match self.tvc.vid_model() {
            VidModel::FastFrame => "fast-frame",
            VidModel::Interleaved => "interleaved",
        }
        .to_string()
    }

    #[wasm_bindgen(js_name = runFrame)]
    pub fn run_frame(&mut self) -> bool {
        self.tvc.run_for_a_frame()
    }

    #[wasm_bindgen(js_name = audioSampleRate)]
    pub fn audio_sample_rate(&self) -> u32 {
        self.tvc.sound_sample_rate()
    }

    #[wasm_bindgen(js_name = takeAudioSamples)]
    pub fn take_audio_samples(&mut self) -> Vec<f32> {
        self.tvc.take_audio_samples()
    }

    #[wasm_bindgen(js_name = addRom)]
    pub fn add_rom(&mut self, name: &str, data: &[u8]) {
        self.tvc.add_rom(name, data);
    }

    #[wasm_bindgen(js_name = loadCartRom)]
    pub fn load_cart_rom(&mut self, data: &[u8]) {
        self.tvc.load_cart_rom(data);
    }

    #[wasm_bindgen(js_name = loadDisk)]
    pub fn load_disk(&mut self, drive: usize, name: &str, data: &[u8]) {
        self.tvc.load_disk(drive, name, data);
    }

    #[wasm_bindgen(js_name = keyDown)]
    pub fn key_down(&mut self, code: u32) -> bool {
        self.tvc.key_down(code)
    }

    #[wasm_bindgen(js_name = keyUp)]
    pub fn key_up(&mut self, code: u32) {
        self.tvc.key_up(code);
    }

    #[wasm_bindgen(js_name = keyPressText)]
    pub fn key_press_text(&mut self, text: &str) {
        for ch in text.chars() {
            self.tvc.key_press(ch);
        }
    }

    #[wasm_bindgen(js_name = focusChange)]
    pub fn focus_change(&mut self, has_focus: bool) {
        self.tvc.focus_change(has_focus);
    }

    #[wasm_bindgen(js_name = framebufferPtr)]
    pub fn framebuffer_ptr(&self) -> *const u32 {
        self.tvc.framebuffer.as_ptr()
    }

    #[wasm_bindgen(js_name = framebufferLen)]
    pub fn framebuffer_len(&self) -> usize {
        self.tvc.framebuffer.len() * std::mem::size_of::<u32>()
    }

    #[wasm_bindgen(js_name = screenWidth)]
    pub fn screen_width(&self) -> usize {
        SCREEN_WIDTH
    }

    #[wasm_bindgen(js_name = screenHeight)]
    pub fn screen_height(&self) -> usize {
        SCREEN_HEIGHT
    }

    #[wasm_bindgen(js_name = takeFrameComplete)]
    pub fn take_frame_complete(&mut self) -> bool {
        let complete = self.tvc.frame_complete;
        self.tvc.frame_complete = false;
        complete
    }
}

fn default_web_vid_model() -> VidModel {
    VidModel::FastFrame
}

fn snapshot_machine_type(data: &[u8]) -> Result<Option<(bool, u8, bool)>, JsValue> {
    let chunks =
        crate::snapshot::read_file(data).map_err(|err| JsValue::from_str(&err.to_string()))?;
    let Some(chunk) = chunks.iter().find(|chunk| chunk.id == *b"EMUT") else {
        return Ok(None);
    };
    let mut reader = crate::snapshot::Reader::new(chunk.data);
    let is_plus = reader
        .u8()
        .map_err(|err| JsValue::from_str(&err.to_string()))?
        != 0;
    let rom_version = reader
        .u8()
        .map_err(|err| JsValue::from_str(&err.to_string()))?;
    if rom_version > 1 {
        return Err(JsValue::from_str("unknown snapshot ROM version"));
    }
    let has_dos = reader
        .u8()
        .map_err(|err| JsValue::from_str(&err.to_string()))?
        != 0;
    Ok(Some((is_plus, rom_version, has_dos)))
}

fn load_builtin_roms(tvc: &mut Tvc, rom_version: u8, has_dos: bool) {
    let roms: &[(&str, &[u8])] = match rom_version {
        1 => &[
            ("TVC22_D4.64K", include_bytes!("../../roms/TVC22_D4.64K")),
            ("TVC22_D6.64K", include_bytes!("../../roms/TVC22_D6.64K")),
            ("TVC22_D7.64K", include_bytes!("../../roms/TVC22_D7.64K")),
        ],
        _ => &[
            ("TVC12_D3.64K", include_bytes!("../../roms/TVC12_D3.64K")),
            ("TVC12_D4.64K", include_bytes!("../../roms/TVC12_D4.64K")),
            ("TVC12_D7.64K", include_bytes!("../../roms/TVC12_D7.64K")),
        ],
    };
    for (name, bytes) in roms {
        tvc.add_rom(name, bytes);
    }
    if has_dos {
        tvc.add_rom(
            "VT-DOS12-DISK.ROM",
            include_bytes!("../../roms/VT-DOS12-DISK.ROM"),
        );
    }
}

#[cfg(feature = "wasm-full")]
#[wasm_bindgen]
pub struct WebHandle {
    runner: eframe::WebRunner,
}

#[cfg(feature = "wasm-full")]
#[wasm_bindgen]
impl WebHandle {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            runner: eframe::WebRunner::new(),
        }
    }

    #[wasm_bindgen(js_name = start)]
    pub fn start(&self, canvas_id: &str) -> Result<(), JsValue> {
        use crate::emu::Emu;

        let document = web_sys::window()
            .ok_or_else(|| JsValue::from_str("no window"))?
            .document()
            .ok_or_else(|| JsValue::from_str("no document"))?;
        let canvas = document
            .get_element_by_id(canvas_id)
            .ok_or_else(|| JsValue::from_str("canvas not found"))?
            .dyn_into::<web_sys::HtmlCanvasElement>()
            .map_err(|_| JsValue::from_str("element is not a canvas"))?;

        let app_state_file = crate::app_state::AppStateFile::load();
        let machine_type = app_state_file
            .state
            .machine_type
            .unwrap_or_else(|| crate::emu::MachineType::all_types()[0]);
        let mut emu = Emu::new(machine_type);
        if let Some(vid_model) = app_state_file.state.vid_model {
            emu.set_vid_model(vid_model);
        }
        emu.set_fast_boot(app_state_file.state.fast_boot);
        emu.load_roms();
        let audio_error = startup_audio_error();
        let storage_error = startup_storage_error();
        let (recent_tapes, recent_disks) = load_recent_media()?;
        emu.recent_tapes_wasm = recent_tapes;
        emu.recent_disks_wasm = recent_disks;

        let mut app = crate::ui::EmuApp::new(emu, app_state_file, None);
        if let Some(error) = audio_error {
            app.set_audio_status(format!("Audio unavailable: {error}"));
        }
        if let Some(error) = storage_error {
            app.set_file_status(format!("Browser storage unavailable: {error}"));
        }

        let runner = self.runner.clone();
        wasm_bindgen_futures::spawn_local(async move {
            if let Err(err) = runner
                .start(
                    canvas,
                    eframe::WebOptions::default(),
                    Box::new(|_cc| Ok(Box::new(app))),
                )
                .await
            {
                web_sys::console::error_1(&err);
            }
        });
        Ok(())
    }
}

#[cfg(feature = "wasm-full")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = globalThis, js_name = rtvcGetStartupAudioError)]
    fn web_startup_audio_error() -> JsValue;

    #[wasm_bindgen(js_namespace = globalThis, js_name = rtvcGetStartupStorageError)]
    fn web_startup_storage_error() -> JsValue;

    #[wasm_bindgen(js_namespace = globalThis, js_name = rtvcGetStartupRecentMedia)]
    fn web_startup_recent_media() -> JsValue;
}

#[cfg(feature = "wasm-full")]
fn startup_audio_error() -> Option<String> {
    web_startup_audio_error().as_string()
}

#[cfg(feature = "wasm-full")]
fn startup_storage_error() -> Option<String> {
    web_startup_storage_error().as_string()
}

#[cfg(feature = "wasm-full")]
fn load_recent_media() -> Result<
    (
        Vec<crate::emu::WasmRecentFile>,
        Vec<crate::emu::WasmRecentFile>,
    ),
    JsValue,
> {
    let records = web_startup_recent_media()
        .dyn_into::<js_sys::Array>()
        .map_err(|_| JsValue::from_str("recent media result is not an array"))?;
    let mut tapes = Vec::new();
    let mut disks = Vec::new();

    for record in records.iter() {
        let kind = js_sys::Reflect::get(&record, &JsValue::from_str("kind"))?
            .as_string()
            .unwrap_or_default();
        let name = js_sys::Reflect::get(&record, &JsValue::from_str("name"))?
            .as_string()
            .unwrap_or_default();
        let bytes =
            js_sys::Uint8Array::new(&js_sys::Reflect::get(&record, &JsValue::from_str("bytes"))?)
                .to_vec();
        let recent = crate::emu::WasmRecentFile { name, bytes };
        match kind.as_str() {
            "tape" => tapes.push(recent),
            "disk" => disks.push(recent),
            _ => {}
        }
    }
    tapes.truncate(5);
    disks.truncate(5);
    Ok((tapes, disks))
}
