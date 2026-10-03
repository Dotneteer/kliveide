use std::path::Path;

use crate::debug_ui::DebuggerUi;
use crate::emu::Emu;
use crate::log::LogCategory;
use eframe::egui::{self, TextureHandle};
use egui_dock::{DockArea, DockState, NodeIndex, TabViewer};
use serde::{Deserialize, Serialize};

const WORKSPACE_VERSION: u32 = 1;
#[cfg(not(target_arch = "wasm32"))]
const WORKSPACE_FILE_NAME: &str = "rtvc-workspace.json";
#[cfg(target_arch = "wasm32")]
const WORKSPACE_STORAGE_KEY: &str = "rtvc_workspace_v1";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceMode {
    #[default]
    Simple,
    Developer,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkspaceTab {
    Screen,
    IoLog,
    Cpu,
    Disassembly,
    Memory,
    Breakpoints,
    RomSymbols,
    Events,
    FrameHistory,
    InstructionTrace,
}

#[derive(Serialize, Deserialize)]
struct WorkspaceDocument {
    version: u32,
    mode: WorkspaceMode,
    dock_state: DockState<WorkspaceTab>,
    #[serde(default)]
    io_log_filters: IoLogFilters,
}

pub struct Workspace {
    mode: WorkspaceMode,
    dock_state: DockState<WorkspaceTab>,
    io_log_filters: IoLogFilters,
    dirty: bool,
    persisted_json: Option<String>,
    persisted_location: Option<String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct IoLogFilters {
    sound: bool,
    video: bool,
    tape: bool,
    disk: bool,
    other: bool,
}

impl Default for IoLogFilters {
    fn default() -> Self {
        Self {
            sound: true,
            video: true,
            tape: true,
            disk: true,
            other: true,
        }
    }
}

impl IoLogFilters {
    fn allows(self, category: LogCategory) -> bool {
        match category {
            LogCategory::Sound => self.sound,
            LogCategory::Video => self.video,
            LogCategory::Tape => self.tape,
            LogCategory::Disk => self.disk,
            LogCategory::Other => self.other,
        }
    }
}

impl Workspace {
    pub fn load(config_path: &Path) -> Self {
        match load_text(config_path) {
            Ok(Some(text)) => {
                let mut workspace = Self::from_persisted_text(text);
                workspace.persisted_location = Some(persistence_location(config_path));
                workspace
            }
            Ok(None) => Self::simple_default(),
            Err(_) => Self::simple_default(),
        }
    }

    pub fn mode(&self) -> WorkspaceMode {
        self.mode
    }

    pub fn set_mode(&mut self, mode: WorkspaceMode) {
        if self.mode != mode {
            self.mode = mode;
            self.dirty = true;
        }
    }

    pub fn is_developer(&self) -> bool {
        self.mode == WorkspaceMode::Developer
    }

    pub fn accepts_machine_input(&self, screen_captured: bool) -> bool {
        self.mode == WorkspaceMode::Simple || screen_captured
    }

    pub fn has_tab(&self, tab: WorkspaceTab) -> bool {
        self.dock_state.find_tab(&tab).is_some()
    }

    pub fn close_tab(&mut self, tab: WorkspaceTab) {
        if tab == WorkspaceTab::Screen {
            return;
        }
        if let Some(location) = self.dock_state.find_tab(&tab) {
            self.dock_state.remove_tab(location);
            self.dirty = true;
        }
    }

    pub fn open_tab(&mut self, tab: WorkspaceTab) {
        if let Some(location) = self.dock_state.find_tab(&tab) {
            self.dock_state.set_active_tab(location);
            self.dock_state
                .set_focused_node_and_surface((location.0, location.1));
        } else {
            self.dock_state.push_to_focused_leaf(tab);
            if let Some(location) = self.dock_state.find_tab(&tab) {
                self.dock_state.set_active_tab(location);
                self.dock_state
                    .set_focused_node_and_surface((location.0, location.1));
            }
        }
        self.dirty = true;
    }

    pub fn reset_layout(&mut self) {
        self.dock_state = default_dock_state();
        self.dirty = true;
    }

    pub fn debugger_layout(&mut self) {
        self.dock_state = debugger_dock_state();
        self.dirty = true;
    }

    pub fn mark_layout_changed(&mut self) {
        self.dirty = true;
    }

    pub fn show(
        &mut self,
        ui: &mut egui::Ui,
        screen_texture: Option<&TextureHandle>,
        emu: &mut Emu,
        debugger: &mut DebuggerUi,
        screen_captured: &mut bool,
    ) {
        debugger.drain_trace_events(emu);
        let mut viewer = WorkspaceViewer {
            screen_texture,
            emu,
            debugger,
            screen_captured,
            screen_visible: false,
            screen_clicked: false,
            events_visible: false,
            io_log_filters: &mut self.io_log_filters,
            io_log_filters_changed: false,
        };
        DockArea::new(&mut self.dock_state)
            .id(egui::Id::new("rtvc_developer_workspace"))
            .show_add_buttons(false)
            .show_inside(ui, &mut viewer);
        let clicked_elsewhere =
            ui.input(|input| input.pointer.primary_clicked()) && !viewer.screen_clicked;
        let screen_visible = viewer.screen_visible;
        let events_visible = viewer.events_visible;
        let io_log_filters_changed = viewer.io_log_filters_changed;
        drop(viewer);
        if io_log_filters_changed {
            self.dirty = true;
        }
        if !screen_visible || clicked_elsewhere {
            *screen_captured = false;
        }
        debugger.update_tracing(emu, events_visible);
    }

    pub fn save(&mut self, config_path: &Path) -> Result<(), String> {
        if !self.dirty {
            return Ok(());
        }
        let text = self.to_json()?;
        let location = persistence_location(config_path);
        if self.persisted_json.as_deref() != Some(text.as_str())
            || self.persisted_location.as_deref() != Some(location.as_str())
        {
            save_text(config_path, &text)?;
            self.persisted_json = Some(text);
            self.persisted_location = Some(location);
        }
        self.dirty = false;
        Ok(())
    }

    fn simple_default() -> Self {
        Self {
            mode: WorkspaceMode::Simple,
            dock_state: default_dock_state(),
            io_log_filters: IoLogFilters::default(),
            dirty: false,
            persisted_json: None,
            persisted_location: None,
        }
    }

    fn developer_default() -> Self {
        Self {
            mode: WorkspaceMode::Developer,
            dock_state: default_dock_state(),
            io_log_filters: IoLogFilters::default(),
            dirty: true,
            persisted_json: None,
            persisted_location: None,
        }
    }

    fn from_persisted_text(text: String) -> Self {
        match Self::from_json(&text) {
            Ok(mut workspace) => {
                workspace.persisted_json = Some(text);
                workspace
            }
            Err(_) => Self::developer_default(),
        }
    }

    fn from_json(text: &str) -> Result<Self, String> {
        let document: WorkspaceDocument =
            serde_json::from_str(text).map_err(|err| err.to_string())?;
        if document.version != WORKSPACE_VERSION {
            return Err(format!(
                "unsupported workspace version {}",
                document.version
            ));
        }
        let mut workspace = Self {
            mode: document.mode,
            dock_state: document.dock_state,
            io_log_filters: document.io_log_filters,
            dirty: false,
            persisted_json: None,
            persisted_location: None,
        };
        if !workspace.has_tab(WorkspaceTab::Screen) {
            workspace
                .dock_state
                .push_to_first_leaf(WorkspaceTab::Screen);
            workspace.dirty = true;
        }
        Ok(workspace)
    }

    fn to_json(&self) -> Result<String, String> {
        let mut value = serde_json::to_value(WorkspaceDocument {
            version: WORKSPACE_VERSION,
            mode: self.mode,
            dock_state: self.dock_state.clone(),
            io_log_filters: self.io_log_filters,
        })
        .map_err(|err| err.to_string())?;
        replace_non_finite_coordinates(&mut value);
        serde_json::to_string_pretty(&value).map_err(|err| err.to_string())
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn persistence_location(config_path: &Path) -> String {
    workspace_path(config_path).to_string_lossy().into_owned()
}

#[cfg(target_arch = "wasm32")]
fn persistence_location(_config_path: &Path) -> String {
    WORKSPACE_STORAGE_KEY.to_string()
}

fn replace_non_finite_coordinates(value: &mut serde_json::Value) {
    match value {
        serde_json::Value::Object(fields) => {
            for (name, value) in fields {
                if matches!(name.as_str(), "x" | "y") && value.is_null() {
                    *value = serde_json::Value::from(0.0);
                } else {
                    replace_non_finite_coordinates(value);
                }
            }
        }
        serde_json::Value::Array(values) => {
            for value in values {
                replace_non_finite_coordinates(value);
            }
        }
        _ => {}
    }
}

fn default_dock_state() -> DockState<WorkspaceTab> {
    let mut dock_state = DockState::new(vec![WorkspaceTab::Screen]);
    dock_state
        .main_surface_mut()
        .split_below(NodeIndex::root(), 0.72, vec![WorkspaceTab::IoLog]);
    dock_state
}

fn debugger_dock_state() -> DockState<WorkspaceTab> {
    let mut dock_state = DockState::new(vec![WorkspaceTab::Screen]);
    let [main, _bottom] = dock_state.main_surface_mut().split_below(
        NodeIndex::root(),
        0.75,
        vec![WorkspaceTab::IoLog, WorkspaceTab::Events],
    );
    let [_screen, right] =
        dock_state
            .main_surface_mut()
            .split_right(main, 0.68, vec![WorkspaceTab::Cpu]);
    dock_state.main_surface_mut().split_below(
        right,
        0.38,
        vec![
            WorkspaceTab::Disassembly,
            WorkspaceTab::Memory,
            WorkspaceTab::Breakpoints,
            WorkspaceTab::RomSymbols,
            WorkspaceTab::FrameHistory,
            WorkspaceTab::InstructionTrace,
        ],
    );
    dock_state
}

pub fn draw_screen(
    ui: &mut egui::Ui,
    screen_texture: Option<&TextureHandle>,
    capture: Option<&mut bool>,
) -> bool {
    let available_rect = ui.available_rect_before_wrap();
    let avail = available_rect.size();
    let display_height_per_width = 3.0 / 4.0;
    let width = avail.x.min(avail.y / display_height_per_width);
    let height = width * display_height_per_width;
    let image_size = egui::vec2(width, height);
    let rect = egui::Rect::from_center_size(available_rect.center(), image_size);
    let sense = if capture.is_some() {
        egui::Sense::click()
    } else {
        egui::Sense::hover()
    };
    let response = ui.allocate_rect(rect, sense);

    if let Some(texture) = screen_texture {
        ui.painter().image(
            texture.id(),
            rect,
            egui::Rect::from_min_max(egui::pos2(0.0, 0.0), egui::pos2(1.0, 1.0)),
            egui::Color32::WHITE,
        );
    } else {
        ui.painter().rect_filled(rect, 0.0, egui::Color32::BLACK);
    }

    if let Some(captured) = capture {
        if response.clicked() {
            *captured = true;
        }
        let stroke = if *captured {
            egui::Stroke::new(2.0_f32, egui::Color32::from_rgb(80, 170, 255))
        } else {
            egui::Stroke::new(1.0_f32, egui::Color32::from_gray(70))
        };
        ui.painter()
            .rect_stroke(rect, 0.0, stroke, egui::StrokeKind::Inside);
        if *captured {
            ui.painter().text(
                rect.left_top() + egui::vec2(8.0, 8.0),
                egui::Align2::LEFT_TOP,
                "Keyboard captured - Esc to release",
                egui::FontId::proportional(12.0),
                egui::Color32::from_rgb(180, 220, 255),
            );
        }
    }
    response.clicked()
}

fn draw_io_log(ui: &mut egui::Ui, emu: &mut Emu, filters: &mut IoLogFilters) -> bool {
    if emu.tvc().is_none() {
        ui.label("IO logging is currently available only for TVC.");
        return false;
    }
    let before = *filters;
    ui.horizontal(|ui| {
        if ui.small_button("Clear").clicked() {
            emu.clear_log();
        }
        ui.separator();
        ui.checkbox(&mut filters.sound, "Sound");
        ui.checkbox(&mut filters.video, "Video");
        ui.checkbox(&mut filters.tape, "Tape");
        ui.checkbox(&mut filters.disk, "Disk");
        ui.checkbox(&mut filters.other, "Other");
    });
    let hidden_count = emu
        .log_entries()
        .iter()
        .filter(|entry| !filters.allows(entry.category))
        .count();
    if hidden_count > 0 {
        ui.small(format!("{hidden_count} hidden"));
    }
    egui::ScrollArea::vertical()
        .auto_shrink([false; 2])
        .show(ui, |ui| {
            for entry in emu.log_entries().iter().rev() {
                if filters.allows(entry.category) {
                    ui.label(&entry.message);
                }
            }
        });
    before != *filters
}

struct WorkspaceViewer<'a> {
    screen_texture: Option<&'a TextureHandle>,
    emu: &'a mut Emu,
    debugger: &'a mut DebuggerUi,
    screen_captured: &'a mut bool,
    screen_visible: bool,
    screen_clicked: bool,
    events_visible: bool,
    io_log_filters: &'a mut IoLogFilters,
    io_log_filters_changed: bool,
}

impl TabViewer for WorkspaceViewer<'_> {
    type Tab = WorkspaceTab;

    fn title(&mut self, tab: &mut Self::Tab) -> egui::WidgetText {
        match tab {
            WorkspaceTab::Screen => "Screen".into(),
            WorkspaceTab::IoLog => "IO Log".into(),
            WorkspaceTab::Cpu => "CPU".into(),
            WorkspaceTab::Disassembly => "Disassembly".into(),
            WorkspaceTab::Memory => "Memory".into(),
            WorkspaceTab::Breakpoints => "Breakpoints".into(),
            WorkspaceTab::RomSymbols => "ROM Symbols".into(),
            WorkspaceTab::Events => "Events".into(),
            WorkspaceTab::FrameHistory => "Frame History".into(),
            WorkspaceTab::InstructionTrace => "Instruction Trace".into(),
        }
    }

    fn ui(&mut self, ui: &mut egui::Ui, tab: &mut Self::Tab) {
        match tab {
            WorkspaceTab::Screen => {
                self.screen_visible = true;
                self.screen_clicked =
                    draw_screen(ui, self.screen_texture, Some(self.screen_captured));
            }
            WorkspaceTab::IoLog => {
                self.io_log_filters_changed |= draw_io_log(ui, self.emu, self.io_log_filters);
            }
            WorkspaceTab::Cpu => self.debugger.draw_cpu(ui, self.emu),
            WorkspaceTab::Disassembly => self.debugger.draw_disassembly(ui, self.emu),
            WorkspaceTab::Memory => self.debugger.draw_memory(ui, self.emu),
            WorkspaceTab::Breakpoints => self.debugger.draw_breakpoints(ui, self.emu),
            WorkspaceTab::RomSymbols => self.debugger.draw_rom_symbols(ui, self.emu),
            WorkspaceTab::Events => {
                self.events_visible = true;
                self.debugger.draw_events(ui, self.emu);
            }
            WorkspaceTab::FrameHistory => self.debugger.draw_frame_history(ui, self.emu),
            WorkspaceTab::InstructionTrace => self.debugger.draw_instruction_trace(ui, self.emu),
        }
    }

    fn closeable(&mut self, tab: &mut Self::Tab) -> bool {
        *tab != WorkspaceTab::Screen
    }

    fn scroll_bars(&self, _tab: &Self::Tab) -> [bool; 2] {
        [false, false]
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn workspace_path(config_path: &Path) -> std::path::PathBuf {
    config_path.with_file_name(WORKSPACE_FILE_NAME)
}

#[cfg(not(target_arch = "wasm32"))]
fn load_text(config_path: &Path) -> Result<Option<String>, String> {
    let path = workspace_path(config_path);
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn save_text(config_path: &Path, text: &str) -> Result<(), String> {
    std::fs::write(workspace_path(config_path), text).map_err(|err| err.to_string())
}

#[cfg(target_arch = "wasm32")]
fn load_text(_config_path: &std::path::Path) -> Result<Option<String>, String> {
    let window = web_sys::window().ok_or_else(|| "browser window unavailable".to_string())?;
    let storage = window
        .local_storage()
        .map_err(js_value_string)?
        .ok_or_else(|| "browser local storage unavailable".to_string())?;
    storage
        .get_item(WORKSPACE_STORAGE_KEY)
        .map_err(js_value_string)
}

#[cfg(target_arch = "wasm32")]
fn save_text(_config_path: &std::path::Path, text: &str) -> Result<(), String> {
    let window = web_sys::window().ok_or_else(|| "browser window unavailable".to_string())?;
    let storage = window
        .local_storage()
        .map_err(js_value_string)?
        .ok_or_else(|| "browser local storage unavailable".to_string())?;
    storage
        .set_item(WORKSPACE_STORAGE_KEY, text)
        .map_err(js_value_string)
}

#[cfg(target_arch = "wasm32")]
fn js_value_string(value: wasm_bindgen::JsValue) -> String {
    value
        .as_string()
        .unwrap_or_else(|| "browser workspace storage failed".to_string())
}

#[cfg(test)]
#[path = "workspace_tests.rs"]
mod tests;
