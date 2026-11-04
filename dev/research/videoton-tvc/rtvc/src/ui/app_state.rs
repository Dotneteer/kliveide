#[cfg(not(target_arch = "wasm32"))]
use std::io::Write;
use std::path::PathBuf;

use crate::emu::{MachineType, RomVersion};
use crate::vid::VidModel;

#[cfg(not(target_arch = "wasm32"))]
const CONFIG_FILE_NAME: &str = "rtvc.toml";

#[derive(Default)]
pub struct AppState {
    pub machine_type: Option<MachineType>,
    pub vid_model: Option<VidModel>,
    pub fast_boot: bool,
    pub tape_file_name: Option<String>,
    pub tape_loaded: bool,
    pub disk_file_name: Option<String>,
    pub disk_loaded: bool,
    pub recent_tapes: Vec<String>,
    pub recent_disks: Vec<String>,
}

pub struct AppStateFile {
    pub path: PathBuf,
    pub state: AppState,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Section {
    Root,
    Tape,
    Disk,
}

#[cfg(not(target_arch = "wasm32"))]
impl AppStateFile {
    pub fn load() -> Self {
        let cwd_path = PathBuf::from(CONFIG_FILE_NAME);
        if cwd_path.exists() {
            return Self {
                state: read_state_file(&cwd_path),
                path: cwd_path,
            };
        }

        if let Some(exe_path) = executable_config_path().filter(|path| path.exists()) {
            return Self {
                state: read_state_file(&exe_path),
                path: exe_path,
            };
        }

        Self {
            path: cwd_path,
            state: AppState::default(),
        }
    }

    pub fn save(&mut self, state: &AppState) -> std::io::Result<()> {
        match write_state_file(&self.path, state) {
            Ok(()) => Ok(()),
            Err(first_err) => {
                if self.path == PathBuf::from(CONFIG_FILE_NAME) {
                    if let Some(exe_path) = executable_config_path() {
                        if write_state_file(&exe_path, state).is_ok() {
                            self.path = exe_path;
                            return Ok(());
                        }
                    }
                }
                Err(first_err)
            }
        }
    }

    pub fn media_cache_dir(&self) -> PathBuf {
        self.path
            .parent()
            .unwrap_or_else(|| std::path::Path::new("."))
            .join("rtvc-media")
    }
}

#[cfg(target_arch = "wasm32")]
impl AppStateFile {
    pub fn load() -> Self {
        let state = if let Some(window) = web_sys::window() {
            if let Ok(Some(local_storage)) = window.local_storage() {
                local_storage
                    .get_item("rtvc_config")
                    .ok()
                    .flatten()
                    .map(|s| parse_state(&s))
                    .unwrap_or_default()
            } else {
                AppState::default()
            }
        } else {
            AppState::default()
        };
        Self {
            path: PathBuf::new(),
            state,
        }
    }

    pub fn save(&mut self, state: &AppState) -> std::io::Result<()> {
        let mut text = String::new();
        text.push_str(&format!(
            "machine_type = \"{}\"\n",
            machine_type_id(state.machine_type)
        ));
        text.push_str(&format!(
            "video_model = \"{}\"\n",
            vid_model_id(state.vid_model)
        ));
        text.push_str(&format!("fast_boot = {}\n\n", state.fast_boot));
        text.push_str("[tape]\n");
        if let Some(file_name) = &state.tape_file_name {
            text.push_str(&format!("selected = \"{}\"\n", escape_string(file_name)));
        }
        text.push_str(&format!("loaded = {}\n", state.tape_loaded));
        if !state.recent_tapes.is_empty() {
            text.push_str("recent = [");
            for (i, val) in state.recent_tapes.iter().enumerate() {
                if i > 0 {
                    text.push_str(", ");
                }
                text.push_str(&format!("\"{}\"", escape_string(val)));
            }
            text.push_str("]\n");
        }
        text.push_str("\n[disk]\n");
        if let Some(file_name) = &state.disk_file_name {
            text.push_str(&format!("selected = \"{}\"\n", escape_string(file_name)));
        }
        text.push_str(&format!("loaded = {}\n", state.disk_loaded));
        if !state.recent_disks.is_empty() {
            text.push_str("recent = [");
            for (i, val) in state.recent_disks.iter().enumerate() {
                if i > 0 {
                    text.push_str(", ");
                }
                text.push_str(&format!("\"{}\"", escape_string(val)));
            }
            text.push_str("]\n");
        }

        if let Some(window) = web_sys::window() {
            if let Ok(Some(local_storage)) = window.local_storage() {
                local_storage
                    .set_item("rtvc_config", &text)
                    .map_err(|err| std::io::Error::other(js_value_string(err)))?;
            }
        }
        Ok(())
    }
}

#[cfg(target_arch = "wasm32")]
fn js_value_string(value: wasm_bindgen::JsValue) -> String {
    value
        .as_string()
        .unwrap_or_else(|| "browser configuration storage failed".to_string())
}

#[cfg(not(target_arch = "wasm32"))]
fn executable_config_path() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(|parent| parent.join(CONFIG_FILE_NAME)))
}

#[cfg(not(target_arch = "wasm32"))]
fn read_state_file(path: &std::path::Path) -> AppState {
    let Ok(text) = std::fs::read_to_string(path) else {
        return AppState::default();
    };
    parse_state(&text)
}

#[cfg(not(target_arch = "wasm32"))]
fn write_state_file(path: &std::path::Path, state: &AppState) -> std::io::Result<()> {
    let mut file = std::fs::File::create(path)?;
    writeln!(
        file,
        "machine_type = \"{}\"",
        machine_type_id(state.machine_type)
    )?;
    writeln!(file, "video_model = \"{}\"", vid_model_id(state.vid_model))?;
    writeln!(file, "fast_boot = {}", state.fast_boot)?;
    writeln!(file)?;
    writeln!(file, "[tape]")?;
    if let Some(file_name) = &state.tape_file_name {
        writeln!(file, "selected = \"{}\"", escape_string(file_name))?;
    }
    writeln!(file, "loaded = {}", state.tape_loaded)?;
    if !state.recent_tapes.is_empty() {
        write!(file, "recent = [")?;
        for (i, val) in state.recent_tapes.iter().enumerate() {
            if i > 0 {
                write!(file, ", ")?;
            }
            write!(file, "\"{}\"", escape_string(val))?;
        }
        writeln!(file, "]")?;
    }
    writeln!(file)?;
    writeln!(file, "[disk]")?;
    if let Some(file_name) = &state.disk_file_name {
        writeln!(file, "selected = \"{}\"", escape_string(file_name))?;
    }
    writeln!(file, "loaded = {}", state.disk_loaded)?;
    if !state.recent_disks.is_empty() {
        write!(file, "recent = [")?;
        for (i, val) in state.recent_disks.iter().enumerate() {
            if i > 0 {
                write!(file, ", ")?;
            }
            write!(file, "\"{}\"", escape_string(val))?;
        }
        writeln!(file, "]")?;
    }
    Ok(())
}

fn parse_state(text: &str) -> AppState {
    let mut state = AppState::default();
    let mut section = Section::Root;

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some(name) = line
            .strip_prefix('[')
            .and_then(|line| line.strip_suffix(']'))
        {
            section = match name.trim() {
                "tape" => Section::Tape,
                "disk" => Section::Disk,
                _ => Section::Root,
            };
            continue;
        }

        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim();
        let value = value.trim();

        match section {
            Section::Root => match key {
                "machine_type" => {
                    if let Some(value) =
                        parse_string(value).and_then(|id| machine_type_from_id(&id))
                    {
                        state.machine_type = Some(value);
                    }
                }
                "video_model" => {
                    if let Some(value) = parse_string(value).and_then(|id| vid_model_from_id(&id)) {
                        state.vid_model = Some(value);
                    }
                }
                "fast_boot" => {
                    state.fast_boot = parse_bool(value).unwrap_or(state.fast_boot);
                }
                _ => {}
            },
            Section::Tape => match key {
                "selected" => state.tape_file_name = parse_string(value),
                "loaded" => state.tape_loaded = parse_bool(value).unwrap_or(state.tape_loaded),
                "recent" => state.recent_tapes = parse_array_string(value),
                _ => {}
            },
            Section::Disk => match key {
                "selected" => state.disk_file_name = parse_string(value),
                "loaded" => state.disk_loaded = parse_bool(value).unwrap_or(state.disk_loaded),
                "recent" => state.recent_disks = parse_array_string(value),
                _ => {}
            },
        }
    }

    state
}

fn parse_string(value: &str) -> Option<String> {
    let mut chars = value.strip_prefix('"')?.strip_suffix('"')?.chars();
    let mut out = String::new();
    while let Some(ch) = chars.next() {
        if ch == '\\' {
            match chars.next()? {
                '\\' => out.push('\\'),
                '"' => out.push('"'),
                other => {
                    out.push('\\');
                    out.push(other);
                }
            }
        } else {
            out.push(ch);
        }
    }
    Some(out)
}

fn parse_bool(value: &str) -> Option<bool> {
    match value {
        "true" => Some(true),
        "false" => Some(false),
        _ => None,
    }
}

fn escape_string(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn machine_type_id(machine_type: Option<MachineType>) -> &'static str {
    match machine_type.unwrap_or(MachineType {
        is_plus: true,
        rom_version: RomVersion::V1_2,
        has_dos: true,
    }) {
        MachineType {
            is_plus: true,
            rom_version: RomVersion::V1_2,
            has_dos: true,
        } => "64k-plus-1.2-vtdos",
        MachineType {
            is_plus: true,
            rom_version: RomVersion::V2_2,
            has_dos: true,
        } => "64k-plus-2.2-vtdos",
        MachineType {
            is_plus: false,
            rom_version: RomVersion::V1_2,
            has_dos: false,
        } => "64k-1.2",
        MachineType {
            is_plus: true,
            rom_version: RomVersion::V1_2,
            has_dos: false,
        } => "64k-plus-1.2",
        MachineType {
            is_plus: true,
            rom_version: RomVersion::V2_2,
            has_dos: false,
        } => "64k-plus-2.2",
        _ => "64k-plus-1.2-vtdos",
    }
}

fn machine_type_from_id(id: &str) -> Option<MachineType> {
    MachineType::all_types()
        .into_iter()
        .find(|machine_type| machine_type_id(Some(*machine_type)) == id)
}

fn vid_model_id(vid_model: Option<VidModel>) -> &'static str {
    match vid_model.unwrap_or(VidModel::Interleaved) {
        VidModel::FastFrame => "fast-frame",
        VidModel::Interleaved => "interleaved",
    }
}

fn vid_model_from_id(id: &str) -> Option<VidModel> {
    match id {
        "fast-frame" | "simple" => Some(VidModel::FastFrame),
        "interleaved" | "realistic" => Some(VidModel::Interleaved),
        _ => None,
    }
}

fn parse_array_string(value: &str) -> Vec<String> {
    let mut out = Vec::new();
    let trimmed_val = value.trim();
    let Some(content) = trimmed_val
        .strip_prefix('[')
        .and_then(|v| v.strip_suffix(']'))
    else {
        return out;
    };
    for part in content.split(',') {
        let trimmed_part = part.trim();
        if trimmed_part.is_empty() {
            continue;
        }
        if let Some(s) = parse_string(trimmed_part) {
            out.push(s);
        }
    }
    out
}

#[cfg(test)]
#[path = "app_state_tests.rs"]
mod tests;
