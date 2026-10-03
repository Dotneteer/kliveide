use super::{FPS_WINDOW, FrameStats, FrameStatsSnapshot, handle_command, start_debugger_server};
use crate::emu::{Emu, MachineType, RomVersion};
use std::net::TcpListener;
use std::time::{Duration, Instant};

#[test]
fn tcp_debugger_reports_an_occupied_port_before_starting() {
    let occupied = TcpListener::bind(("127.0.0.1", 0)).unwrap();
    let port = occupied.local_addr().unwrap().port();

    let err = start_debugger_server(port).err().unwrap();

    assert_eq!(err.kind(), std::io::ErrorKind::AddrInUse);
}

#[test]
fn frame_stats_report_average_over_five_second_window() {
    let start = Instant::now();
    let mut stats = FrameStats::new_at(start);
    for frame in 1..=250 {
        stats.record_at(start + Duration::from_millis(frame * 20));
    }

    let snapshot = stats.snapshot_at(start + FPS_WINDOW);

    assert_eq!(snapshot.frames, 250);
    assert_eq!(snapshot.window_seconds, 5.0);
    assert!((snapshot.average_fps - 50.0).abs() < f64::EPSILON);
}

#[test]
fn frame_stats_drop_frames_outside_the_window() {
    let start = Instant::now();
    let mut stats = FrameStats::new_at(start);
    stats.record_at(start + Duration::from_secs(1));
    stats.record_at(start + Duration::from_secs(6));

    let snapshot = stats.snapshot_at(start + Duration::from_secs(7));

    assert_eq!(snapshot.frames, 1);
    assert!((snapshot.average_fps - 0.2).abs() < f64::EPSILON);
}

#[test]
fn tcp_debugger_reads_and_writes_active_zx82_memory() {
    let mut snapshot = vec![0; 30 + 0xC000];
    snapshot[6..8].copy_from_slice(&0x4000u16.to_le_bytes());
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });
    emu.load_z80_bytes(&snapshot).unwrap();

    let response = handle_command(
        &mut emu,
        r#"{"cmd":"write_memory","addr":32768,"data":[62,42]}"#,
        FrameStatsSnapshot::default(),
    );
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&response).unwrap()["status"],
        "ok"
    );

    let response = handle_command(
        &mut emu,
        r#"{"cmd":"read_memory","addr":32768,"len":2}"#,
        FrameStatsSnapshot::default(),
    );
    let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();
    assert_eq!(response["data"], serde_json::json!([62, 42]));

    let response = handle_command(
        &mut emu,
        r#"{"cmd":"disassemble","addr":32768,"len":2}"#,
        FrameStatsSnapshot::default(),
    );
    let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();
    assert_eq!(response["instructions"][0]["text"], "LD A,2AH");
}

#[test]
fn tcp_debugger_schedules_frame_timed_key_press() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });

    let response = handle_command(
        &mut emu,
        r#"{"cmd":"key_press","key":49,"duration":3}"#,
        FrameStatsSnapshot::default(),
    );
    let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();

    assert_eq!(response["status"], "ok");
    assert_eq!(response["key"], 49);
    assert_eq!(response["duration"], 3);
}

#[test]
fn tcp_debugger_queues_typed_text_for_frame_paced_input() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });

    let response = handle_command(
        &mut emu,
        r#"{"cmd":"key","action":"press","char":"\r"}"#,
        FrameStatsSnapshot::default(),
    );
    let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();

    assert_eq!(response["status"], "ok");

    let key = &mut emu.tvc_mut().unwrap().bus.key;
    key.select_row(5);
    assert_ne!(key.read_row() & 0x10, 0);

    emu.tick();
    let key = &mut emu.tvc_mut().unwrap().bus.key;
    key.select_row(5);
    assert_eq!(key.read_row() & 0x10, 0);

    emu.tick();
    let key = &mut emu.tvc_mut().unwrap().bus.key;
    key.select_row(5);
    assert_eq!(key.read_row() & 0x10, 0);

    emu.tick();
    let key = &mut emu.tvc_mut().unwrap().bus.key;
    key.select_row(5);
    assert_eq!(key.read_row() & 0x10, 0);

    emu.tick();
    let key = &mut emu.tvc_mut().unwrap().bus.key;
    key.select_row(5);
    assert_ne!(key.read_row() & 0x10, 0);
}

#[test]
fn tcp_debugger_controls_and_lists_instruction_trace() {
    let mut snapshot = vec![0; 30 + 0xC000];
    snapshot[6..8].copy_from_slice(&0x4000u16.to_le_bytes());
    snapshot[30..33].copy_from_slice(&[0x32, 0x00, 0x80]);
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });
    emu.load_z80_bytes(&snapshot).unwrap();
    emu.set_z80_register("A", 0x2A);

    let response = handle_command(
        &mut emu,
        r#"{"cmd":"instruction_trace_start","capacity":1000}"#,
        FrameStatsSnapshot::default(),
    );
    let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();
    assert_eq!(response["recording"], true);

    handle_command(
        &mut emu,
        r#"{"cmd":"step","count":1}"#,
        FrameStatsSnapshot::default(),
    );
    let response = handle_command(
        &mut emu,
        r#"{"cmd":"instruction_trace_list","limit":1}"#,
        FrameStatsSnapshot::default(),
    );
    let response = serde_json::from_str::<serde_json::Value>(&response).unwrap();
    assert_eq!(response["entries"][0]["pc"], 0x4000);
    assert_eq!(response["entries"][0]["instruction"], "LD (8000H),A");
    assert_eq!(response["entries"][0]["memory_writes"][0]["addr"], 0x8000);
    assert_eq!(response["entries"][0]["memory_writes"][0]["value"], 0x2A);
}
