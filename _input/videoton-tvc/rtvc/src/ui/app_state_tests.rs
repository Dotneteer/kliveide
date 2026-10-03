use super::*;

#[test]
fn parses_minimal_app_state() {
    let state = parse_state(
        r#"
machine_type = "64k-plus-2.2-vtdos"
video_model = "fast-frame"
fast_boot = true

[tape]
selected = "TVBALL.CAS"
loaded = true
recent = ["TVBALL.CAS", "TVBALL2.CAS"]

[disk]
selected = "VT-DOS \"Games\".dsk"
loaded = false
recent = ["Games.dsk"]
"#,
    );

    assert_eq!(
        state.machine_type,
        Some(MachineType {
            is_plus: true,
            rom_version: RomVersion::V2_2,
            has_dos: true,
        })
    );
    assert_eq!(state.vid_model, Some(VidModel::FastFrame));
    assert!(state.fast_boot);
    assert_eq!(state.tape_file_name.as_deref(), Some("TVBALL.CAS"));
    assert!(state.tape_loaded);
    assert_eq!(
        state.recent_tapes,
        vec!["TVBALL.CAS".to_string(), "TVBALL2.CAS".to_string()]
    );
    assert_eq!(
        state.disk_file_name.as_deref(),
        Some("VT-DOS \"Games\".dsk")
    );
    assert!(!state.disk_loaded);
    assert_eq!(state.recent_disks, vec!["Games.dsk".to_string()]);
}
