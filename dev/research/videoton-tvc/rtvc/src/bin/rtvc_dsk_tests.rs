use super::*;
use std::io::Cursor;

fn tvc_boot_sector() -> [u8; BOOT_SECTOR_LEN] {
    let mut boot = [0u8; BOOT_SECTOR_LEN];
    boot[0..3].copy_from_slice(&[0xEB, 0xFE, 0x90]);
    boot[3..11].copy_from_slice(b"DiskMgr1");
    boot[11..13].copy_from_slice(&512u16.to_le_bytes());
    boot[13] = 2;
    boot[14..16].copy_from_slice(&1u16.to_le_bytes());
    boot[16] = 2;
    boot[17..19].copy_from_slice(&112u16.to_le_bytes());
    boot[19..21].copy_from_slice(&720u16.to_le_bytes());
    boot[21] = 0xF8;
    boot[22..24].copy_from_slice(&2u16.to_le_bytes());
    boot[24..26].copy_from_slice(&9u16.to_le_bytes());
    boot[26..28].copy_from_slice(&1u16.to_le_bytes());
    boot[32..36].copy_from_slice(&[0x53, 0x58, 0xC0, 0x32]);
    boot
}

#[test]
fn recognizes_tvc_boot_sector_without_pc_signature() {
    assert!(should_synthesize_boot_signature(&tvc_boot_sector()));
}

#[test]
fn presents_legacy_tvc_boot_sector_as_fat_compatible() {
    let mut disk = TvcDiskImage::new(Cursor::new(tvc_boot_sector())).unwrap();
    let mut boot = [0u8; BOOT_SECTOR_LEN];
    disk.read_exact(&mut boot).unwrap();

    assert_eq!(&boot[32..36], &[0, 0, 0, 0]);
    assert_eq!(&boot[510..512], &[0x55, 0xAA]);
}

#[test]
fn get_default_output_path_uses_disk_file_name() {
    assert_eq!(
        default_host_path_for_get("/DIR/HELLO.TXT"),
        Some(PathBuf::from("HELLO.TXT"))
    );
    assert_eq!(default_host_path_for_get("/"), None);
}
