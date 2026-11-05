use super::*;

#[test]
fn workspace_round_trips() {
    let mut workspace = Workspace::developer_default();
    workspace.open_tab(WorkspaceTab::IoLog);
    let text = workspace.to_json().unwrap();
    let restored = Workspace::from_json(&text).unwrap();

    assert!(!text.contains("\"x\": null"));
    assert_eq!(restored.mode(), WorkspaceMode::Developer);
    assert!(restored.has_tab(WorkspaceTab::Screen));
    assert!(restored.has_tab(WorkspaceTab::IoLog));
}

#[test]
fn rejects_unknown_workspace_version() {
    let workspace = Workspace::developer_default();
    let text = workspace
        .to_json()
        .unwrap()
        .replace("\"version\": 1", "\"version\": 99");

    assert!(Workspace::from_json(&text).is_err());
}

#[test]
fn invalid_workspace_falls_back_to_default_developer_layout() {
    let workspace = Workspace::from_persisted_text("{not json".to_string());

    assert_eq!(workspace.mode(), WorkspaceMode::Developer);
    assert!(workspace.has_tab(WorkspaceTab::Screen));
    assert!(workspace.has_tab(WorkspaceTab::IoLog));
}

#[test]
fn missing_screen_is_restored() {
    let mut workspace = Workspace::developer_default();
    let location = workspace
        .dock_state
        .find_tab(&WorkspaceTab::Screen)
        .unwrap();
    workspace.dock_state.remove_tab(location);
    let text = workspace.to_json().unwrap();
    let restored = Workspace::from_json(&text).unwrap();

    assert!(restored.has_tab(WorkspaceTab::Screen));
}

#[test]
fn closed_log_can_be_reopened() {
    let mut workspace = Workspace::developer_default();
    workspace.close_tab(WorkspaceTab::IoLog);
    assert!(!workspace.has_tab(WorkspaceTab::IoLog));

    workspace.open_tab(WorkspaceTab::IoLog);

    assert!(workspace.has_tab(WorkspaceTab::IoLog));
}

#[test]
fn debugger_layout_contains_all_phase_two_panes() {
    let mut workspace = Workspace::developer_default();
    workspace.debugger_layout();

    for tab in [
        WorkspaceTab::Screen,
        WorkspaceTab::IoLog,
        WorkspaceTab::Cpu,
        WorkspaceTab::Disassembly,
        WorkspaceTab::Memory,
        WorkspaceTab::Breakpoints,
        WorkspaceTab::RomSymbols,
        WorkspaceTab::Events,
        WorkspaceTab::FrameHistory,
        WorkspaceTab::InstructionTrace,
    ] {
        assert!(workspace.has_tab(tab));
    }
    let restored = Workspace::from_json(&workspace.to_json().unwrap()).unwrap();
    assert!(restored.has_tab(WorkspaceTab::Disassembly));
    assert!(restored.has_tab(WorkspaceTab::Events));
}

#[test]
fn machine_input_requires_capture_only_in_developer_mode() {
    let simple = Workspace::simple_default();
    let developer = Workspace::developer_default();

    assert!(simple.accepts_machine_input(false));
    assert!(!developer.accepts_machine_input(false));
    assert!(developer.accepts_machine_input(true));
}

#[cfg(not(target_arch = "wasm32"))]
#[test]
fn native_workspace_survives_restart() {
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let directory =
        std::env::temp_dir().join(format!("rtvc-workspace-{}-{unique}", std::process::id()));
    std::fs::create_dir_all(&directory).unwrap();
    let config_path = directory.join("rtvc.toml");

    let mut workspace = Workspace::developer_default();
    workspace.close_tab(WorkspaceTab::IoLog);
    workspace.save(&config_path).unwrap();

    let restored = Workspace::load(&config_path);
    assert_eq!(restored.mode(), WorkspaceMode::Developer);
    assert!(restored.has_tab(WorkspaceTab::Screen));
    assert!(!restored.has_tab(WorkspaceTab::IoLog));

    std::fs::remove_file(workspace_path(&config_path)).unwrap();
    std::fs::remove_dir(directory).unwrap();
}
