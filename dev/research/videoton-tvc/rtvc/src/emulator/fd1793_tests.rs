use super::*;
use fatfs::{FileSystem, FormatVolumeOptions, FsOptions};
use std::io::{Cursor, Read};

fn formatted_disk() -> Vec<u8> {
    let mut disk = vec![0u8; 368_640];
    let mut cursor = Cursor::new(&mut disk);
    let options = FormatVolumeOptions::new()
        .bytes_per_sector(512)
        .bytes_per_cluster(1024)
        .fats(2)
        .max_root_dir_entries(112)
        .total_sectors(720)
        .media(0xf8)
        .sectors_per_track(9)
        .heads(1);
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
fn write_sector_updates_saved_disk_bytes() {
    let disk = formatted_disk();
    let mut fdc = FD1793::new();
    fdc.load_dsk(0, "test.dsk", &disk);

    fdc.write(4, 0x01);
    fdc.write(1, 0);
    fdc.write(2, 6);
    fdc.write(0, 0xA0);
    for byte in root_dir_sector_with_file() {
        fdc.write(3, byte);
    }

    let saved = fdc.disk_bytes(0).unwrap().to_vec();
    let fs = FileSystem::new(Cursor::new(saved), FsOptions::new()).unwrap();
    let mut file = fs.root_dir().open_file("FFF.CAS").unwrap();
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).unwrap();
    assert_eq!(contents.len(), 4);
}

#[test]
fn write_sector_status_poll_does_not_repeat_previous_byte() {
    let disk = formatted_disk();
    let mut fdc = FD1793::new();
    fdc.load_dsk(0, "test.dsk", &disk);

    fdc.write(4, 0x01);
    fdc.write(1, 0);
    fdc.write(2, 6);
    fdc.write(0, 0xA0);
    let _ = fdc.read(4);
    for byte in root_dir_sector_with_file() {
        fdc.write(3, byte);
        let _ = fdc.read(4);
    }

    let saved = fdc.disk_bytes(0).unwrap().to_vec();
    let fs = FileSystem::new(Cursor::new(saved), FsOptions::new()).unwrap();
    let mut file = fs.root_dir().open_file("FFF.CAS").unwrap();
    let mut contents = Vec::new();
    file.read_to_end(&mut contents).unwrap();
    assert_eq!(contents.len(), 4);
}

#[test]
fn write_sector_rejects_invalid_side_without_dirtying_disk() {
    let disk = formatted_disk();
    let mut fdc = FD1793::new();
    fdc.load_dsk(0, "test.dsk", &disk);

    fdc.write(4, 0x81);
    fdc.write(1, 0);
    fdc.write(2, 6);
    fdc.write(0, 0xA0);

    let status = fdc.read(0);
    assert_eq!(status & ST_RECNF, ST_RECNF);
    assert_eq!(status & ST_BUSY, 0);
    assert!(!fdc.disk_dirty(0));
    assert_eq!(fdc.disk_bytes(0).unwrap(), disk.as_slice());
}

#[test]
fn write_sector_status_and_data_reads_do_not_clear_write_drq() {
    let disk = formatted_disk();
    let mut fdc = FD1793::new();
    fdc.load_dsk(0, "test.dsk", &disk);

    fdc.write(4, 0x01);
    fdc.write(1, 0);
    fdc.write(2, 6);
    fdc.write(0, 0xA0);

    assert_eq!(fdc.read(0) & ST_DRQ, ST_DRQ);
    assert_eq!(fdc.read(4) & PRT_DRQ, PRT_DRQ);
    let _ = fdc.read(3);
    assert_eq!(fdc.read(4) & PRT_DRQ, PRT_DRQ);

    for byte in root_dir_sector_with_file() {
        fdc.write(3, byte);
    }

    let saved = fdc.disk_bytes(0).unwrap().to_vec();
    let fs = FileSystem::new(Cursor::new(saved), FsOptions::new()).unwrap();
    assert!(fs.root_dir().open_file("FFF.CAS").is_ok());
}

#[test]
fn write_sector_latches_drive_at_command_start() {
    let disk_a = formatted_disk();
    let disk_b = formatted_disk();
    let mut fdc = FD1793::new();
    fdc.load_dsk(0, "a.dsk", &disk_a);
    fdc.load_dsk(1, "b.dsk", &disk_b);

    fdc.write(4, 0x01);
    fdc.write(1, 0);
    fdc.write(2, 6);
    fdc.write(0, 0xA0);
    fdc.write(4, 0x02);
    for byte in root_dir_sector_with_file() {
        fdc.write(3, byte);
    }

    let saved_a = fdc.disk_bytes(0).unwrap().to_vec();
    let fs_a = FileSystem::new(Cursor::new(saved_a), FsOptions::new()).unwrap();
    assert!(fs_a.root_dir().open_file("FFF.CAS").is_ok());
    assert_eq!(fdc.disk_bytes(1).unwrap(), disk_b.as_slice());
    assert!(fdc.disk_dirty(0));
    assert!(!fdc.disk_dirty(1));
}
