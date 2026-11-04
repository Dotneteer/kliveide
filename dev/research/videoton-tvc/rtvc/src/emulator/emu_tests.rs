use super::*;
use fatfs::{FileSystem, FormatVolumeOptions, FsOptions};
use std::io::{Cursor, Read};

fn formatted_disk(geometry: DiskGeometry) -> Vec<u8> {
    let mut disk = vec![0u8; geometry.bytes];
    let mut cursor = Cursor::new(&mut disk);
    let options = FormatVolumeOptions::new()
        .bytes_per_sector(512)
        .bytes_per_cluster(1024)
        .fats(2)
        .max_root_dir_entries(112)
        .total_sectors(geometry.total_sectors)
        .media(geometry.media)
        .sectors_per_track(9)
        .heads(geometry.heads);
    fatfs::format_volume(&mut cursor, options).unwrap();
    disk
}

fn root_dir_sector_with_file() -> [u8; 512] {
    let mut sector = [0u8; 512];
    sector[0..11].copy_from_slice(b"FFF     CAS");
    sector[11] = 0x20;
    sector[26..28].copy_from_slice(&2u16.to_le_bytes());
    sector[28..32].copy_from_slice(&4u32.to_le_bytes());
    sector
}

#[test]
fn zipped_snapshot_round_trips() {
    let mut emu = Emu::new(MachineType {
        is_plus: true,
        rom_version: RomVersion::V2_2,
        has_dos: true,
    });
    emu.load_roms();
    emu.tvc_mut().unwrap().z80.state.pc = 0xBEEF;
    let zipped = zip_snapshot(&emu.save_snapshot()).unwrap();
    assert!(zipped.len() < emu.save_snapshot().len());

    let raw = unzip_snapshot(&zipped).unwrap();
    let mut restored = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });
    restored.load_snapshot(&raw).unwrap();
    assert_eq!(restored.machine_type, emu.machine_type);
    assert_eq!(restored.tvc().unwrap().z80.state.pc, 0xBEEF);
}

#[test]
fn snapshot_restores_selected_program() {
    let mut emu = Emu::new(MachineType {
        is_plus: true,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });
    emu.progs = vec![
        ProgEntry {
            name: "First".to_string(),
            file_name: "first.cas".to_string(),
            is_cas: true,
            is_disk: false,
        },
        ProgEntry {
            name: "Second".to_string(),
            file_name: "second.cas".to_string(),
            is_cas: true,
            is_disk: false,
        },
    ];
    emu.selected_prog = 1;

    let snapshot = emu.save_snapshot();
    let mut restored = Emu::new(emu.machine_type);
    restored.progs = emu.progs.clone();
    restored.selected_prog = 0;
    restored.load_snapshot(&snapshot).unwrap();

    assert_eq!(restored.selected_prog, 1);
}

#[test]
fn debug_snapshot_restores_in_place_and_clears_typed_input() {
    let machine_type = MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    };
    let mut emu = Emu::new(machine_type);
    emu.tvc_mut().unwrap().bus.mmu.set_map(0x10);
    emu.set_z80_register("PC", 0x4567);
    assert_eq!(emu.write_raw_bank("u0", 0x1234, &[0xA5]), Some(1));
    let snapshot = emu.capture_debug_snapshot().unwrap();

    emu.set_z80_register("PC", 0x9999);
    assert_eq!(emu.write_raw_bank("u0", 0x1234, &[0x5A]), Some(1));
    emu.queue_typed_text("RUN\r");
    emu.running = true;

    emu.restore_debug_snapshot(&snapshot).unwrap();

    assert!(!emu.running);
    assert_eq!(emu.z80_state().pc, 0x4567);
    assert_eq!(emu.read_mapped_memory(0x1234, 1), vec![0xA5]);
    assert!(emu.typed_text.is_empty());
    assert!(emu.typed_key.is_none());
    assert!(emu.frame_complete());
}

fn any_tvc_key_pressed(emu: &mut Emu) -> bool {
    let key = &mut emu.tvc_mut().unwrap().bus.key;
    (0..11).any(|row| {
        key.select_row(row);
        key.read_row() != 0xFF
    })
}

#[test]
fn timed_key_press_releases_after_requested_frames() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });

    emu.key_press_frames(49, 2).unwrap();
    assert!(any_tvc_key_pressed(&mut emu));
    assert_eq!(emu.timed_keys.get(&49), Some(&2));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));
    assert_eq!(emu.timed_keys.get(&49), Some(&1));

    emu.tick();
    assert!(!any_tvc_key_pressed(&mut emu));
    assert!(!emu.timed_keys.contains_key(&49));
}

#[test]
fn timed_key_press_rejects_zero_duration_and_unknown_codes() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });

    assert!(emu.key_press_frames(49, 0).is_err());
    assert!(emu.key_press_frames(999, 1).is_err());
    assert!(!any_tvc_key_pressed(&mut emu));
}

#[test]
fn typed_text_presses_and_releases_each_tvc_key() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });

    emu.type_text("a\r");
    assert!(!any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(!any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(!any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(any_tvc_key_pressed(&mut emu));

    emu.tick();
    assert!(!any_tvc_key_pressed(&mut emu));
}

#[test]
fn game_archive_uses_exact_requested_media() {
    let archive = game_archive(&[
        ("OTHER.CAS", b"wrong"),
        ("folder/TARGET.CAS", b"correct"),
        ("disk.dsk", b"disk"),
    ]);

    assert_eq!(
        extract_game_archive_member("TARGET.CAS", &archive).unwrap(),
        b"correct"
    );
    assert_eq!(
        extract_game_archive_member("folder\\target.cas", &archive).unwrap(),
        b"correct"
    );
}

#[test]
fn game_archive_reports_missing_media() {
    let archive = game_archive(&[("OTHER.CAS", b"wrong")]);
    let error = extract_game_archive_member("MISSING.CAS", &archive)
        .unwrap_err()
        .to_string();
    assert!(error.contains("MISSING.CAS"));
}

#[test]
fn recent_media_replaces_same_display_name() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });
    emu.recent_tapes = vec![
        "progs/TVBALL.CAS".to_string(),
        "old-cache/TVBALL.CAS".to_string(),
    ];

    emu.add_recent_tape("rtvc-media/tapes/tvball/TVBALL.CAS".to_string());

    assert_eq!(
        emu.recent_tapes,
        vec!["rtvc-media/tapes/tvball/TVBALL.CAS".to_string()]
    );
}

#[test]
fn gamebase_cas_starts_from_clean_boot_and_queues_run() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V2_2,
        has_dos: false,
    });
    let mut cas = vec![0; 145];
    cas[0] = 0x11;

    emu.start_gamebase_media_bytes("TEST.CAS", &cas).unwrap();

    assert_eq!(
        emu.machine_type,
        MachineType {
            is_plus: true,
            rom_version: RomVersion::V1_2,
            has_dos: true,
        }
    );
    assert!(emu.running);
    assert_eq!(emu.typed_text.iter().collect::<String>(), "RUN\r");
    assert_eq!(emu.loaded_tape.as_deref(), Some("TEST.CAS (Injected)"));
}

#[test]
fn gamebase_disk_starts_from_clean_boot_and_queues_load() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V2_2,
        has_dos: false,
    });
    let disk = vec![0; 368_640];

    emu.start_gamebase_media_bytes("TEST.DSK", &disk).unwrap();

    assert!(emu.running);
    assert_eq!(emu.typed_text.iter().collect::<String>(), "LOAD \"*\"\r");
    assert_eq!(emu.loaded_disk[0].as_deref(), Some("TEST.DSK"));
}

#[test]
fn dirty_file_backed_disk_flushes_to_host_file() {
    let path = std::env::temp_dir().join(format!("rtvc-dirty-disk-{}.dsk", std::process::id()));
    std::fs::write(&path, formatted_disk(DiskGeometry::TVC_360K)).unwrap();

    let mut emu = Emu::new(MachineType {
        is_plus: true,
        rom_version: RomVersion::V1_2,
        has_dos: true,
    });
    emu.load_roms();
    emu.insert_disk_file_path_drive(0, &path).unwrap();

    let fdc = emu
        .tvc_mut()
        .unwrap()
        .bus
        .extensions
        .slot0_mut()
        .unwrap()
        .get_fdc_mut();
    fdc.write(4, 0x01);
    fdc.write(1, 0);
    fdc.write(2, 6);
    fdc.write(0, 0xA0);
    for byte in root_dir_sector_with_file() {
        fdc.write(3, byte);
    }
    assert!(emu.disk_dirty(0));

    assert!(emu.flush_dirty_disk_files().is_empty());
    assert!(!emu.disk_dirty(0));

    let bytes = std::fs::read(&path).unwrap();
    let fs = FileSystem::new(Cursor::new(bytes), FsOptions::new()).unwrap();
    let mut file = fs.root_dir().open_file("FFF.CAS").unwrap();
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).unwrap();
    assert_eq!(contents.len(), 4);

    let _ = std::fs::remove_file(path);
}

#[test]
fn basic_save_writes_file_to_new_disk() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V2_2,
        has_dos: false,
    });
    let snapshot = unzip_snapshot(GAMEBASE_BOOT_SNAPSHOT).unwrap();
    emu.load_snapshot(&snapshot).unwrap();
    emu.insert_empty_disk_drive(0, DiskGeometry::TVC_360K)
        .unwrap();
    emu.queue_typed_text("SAVE \"DW\"\r");
    emu.running = true;

    for _ in 0..1500 {
        emu.tick();
    }

    let bytes = emu.save_disk_bytes(0).unwrap();
    let fs = FileSystem::new(Cursor::new(bytes), FsOptions::new()).unwrap();
    assert!(fs.root_dir().open_file("DW.CAS").is_ok());
}

#[test]
fn new_720k_disk_uses_double_sided_geometry() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V2_2,
        has_dos: false,
    });
    let snapshot = unzip_snapshot(GAMEBASE_BOOT_SNAPSHOT).unwrap();
    emu.load_snapshot(&snapshot).unwrap();
    emu.insert_empty_disk_drive(0, DiskGeometry::TVC_720K)
        .unwrap();

    let bytes = emu.save_disk_bytes(0).unwrap();
    assert_eq!(bytes.len(), DiskGeometry::TVC_720K.bytes);
    assert_eq!(u16::from_le_bytes([bytes[19], bytes[20]]), 1440);
    assert_eq!(bytes[21], 0xf9);
    assert_eq!(u16::from_le_bytes([bytes[24], bytes[25]]), 9);
    assert_eq!(u16::from_le_bytes([bytes[26], bytes[27]]), 2);

    let fs = FileSystem::new(Cursor::new(bytes), FsOptions::new()).unwrap();
    assert!(fs.root_dir().iter().next().is_none());
}

#[test]
fn basic_save_writes_file_to_new_720k_disk() {
    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V2_2,
        has_dos: false,
    });
    let snapshot = unzip_snapshot(GAMEBASE_BOOT_SNAPSHOT).unwrap();
    emu.load_snapshot(&snapshot).unwrap();
    emu.insert_empty_disk_drive(0, DiskGeometry::TVC_720K)
        .unwrap();
    emu.queue_typed_text("SAVE \"DW\"\r");
    emu.running = true;

    for _ in 0..1500 {
        emu.tick();
    }

    let bytes = emu.save_disk_bytes(0).unwrap();
    let fs = FileSystem::new(Cursor::new(bytes), FsOptions::new()).unwrap();
    assert!(fs.root_dir().open_file("DW.CAS").is_ok());
}

fn game_archive(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let cursor = std::io::Cursor::new(Vec::new());
    let mut archive = zip::ZipWriter::new(cursor);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    for (name, bytes) in entries {
        archive.start_file(*name, options).unwrap();
        archive.write_all(bytes).unwrap();
    }
    archive.finish().unwrap().into_inner()
}

#[test]
fn load_tape_snapshot_restores_selection_and_can_play() {
    let snapshot_path = std::path::Path::new("snapshots/load_tape.rtvcsnap.zip");
    if !snapshot_path.exists() {
        return;
    }
    let snapshot_data = unzip_snapshot(&std::fs::read(snapshot_path).unwrap()).unwrap();
    if snapshot::read_file(&snapshot_data).is_err() {
        return;
    }

    let mut emu = Emu::new(MachineType {
        is_plus: true,
        rom_version: RomVersion::V1_2,
        has_dos: true,
    });
    emu.load_snapshot_file(snapshot_path).unwrap();
    assert_eq!(
        emu.progs
            .get(emu.selected_prog)
            .map(|entry| entry.file_name.as_str()),
        Some("TVBALL.CAS")
    );

    assert!(emu.tvc().unwrap().bus.tape_motor_on());
    emu.play_tape();
    assert!(emu.tvc().unwrap().bus.tape_play_active());
    let before = emu.tvc().unwrap().bus.tape_elapsed_cycles();
    emu.tvc_mut().unwrap().run_for_a_frame();
    assert!(emu.tvc().unwrap().bus.tape_elapsed_cycles() > before);
}

#[test]
fn z80_state_switches_system_and_exposes_mapped_debug_memory() {
    let mut snapshot = vec![0; 30 + 0xC000];
    snapshot[6..8].copy_from_slice(&0x1234u16.to_le_bytes());
    snapshot[30 + 0x4000] = 0xA5;

    let mut emu = Emu::new(MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    });
    emu.load_z80_bytes(&snapshot).unwrap();

    assert_eq!(emu.system(), System::Zx82);
    assert_eq!(emu.z80_state().get_reg16(11), 0x1234);
    assert_eq!(emu.read_mapped_memory(0x8000, 1), vec![0xA5]);

    emu.write_mapped_memory(0x8000, &[0x5A]);
    assert_eq!(emu.read_mapped_memory(0x8000, 1), vec![0x5A]);
}

#[test]
fn zx82_switch_and_state_load_preserve_running_state() {
    let machine_type = MachineType {
        is_plus: false,
        rom_version: RomVersion::V1_2,
        has_dos: false,
    };
    let mut snapshot = vec![0; 30 + 0xC000];
    snapshot[6..8].copy_from_slice(&0x1234u16.to_le_bytes());

    let mut running = Emu::new(machine_type);
    running.switch_to_zx82().unwrap();
    assert!(running.running);
    running.load_z80_bytes(&snapshot).unwrap();
    assert!(running.running);

    let mut paused = Emu::new(machine_type);
    paused.running = false;
    paused.switch_to_zx82().unwrap();
    assert!(!paused.running);
    paused.load_z80_bytes(&snapshot).unwrap();
    assert!(!paused.running);
}
