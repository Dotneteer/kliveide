use super::{FastBootRom, RomBank, TvcMmu};
use crate::bus::FakeBus;
use crate::z80::Z80;

const CLEAR_FAST: [u8; 12] = [
    0xAF, 0x77, 0x54, 0x5D, 0x13, 0x01, 0xFF, 0x3F, 0xED, 0xB0, 0xEB, 0xC9,
];

#[test]
fn fast_boot_patches_and_restores_known_roms() {
    let mut mmu = TvcMmu::new(false);

    let rom_1_2 = include_bytes!("../../roms/TVC12_D4.64K");
    let original_entry_1_2 = &rom_1_2[0x0338..0x0348];
    let original_clear_1_2 = &rom_1_2[0x0348..0x0354];
    assert_eq!(&rom_1_2[0x1A19..0x1A1B], &[0x11, 0x15]);
    mmu.set_fast_boot(true);
    mmu.add_rom("TVC12_D4.64K", rom_1_2);
    assert_eq!(
        mmu.read_raw_bank("sys", 0x0338, 11).unwrap(),
        original_entry_1_2[..11]
    );
    assert_eq!(mmu.read_raw_bank("sys", 0x0343, 1).unwrap(), [0xC9]);
    assert_eq!(mmu.read_raw_bank("sys", 0x0348, 12).unwrap(), CLEAR_FAST);
    assert_eq!(mmu.read_raw_bank("sys", 0x1A19, 2).unwrap(), [0x18, 0x5C]);
    mmu.set_fast_boot(false);
    assert_eq!(
        mmu.read_raw_bank("sys", 0x0338, 16).unwrap(),
        original_entry_1_2
    );
    assert_eq!(
        mmu.read_raw_bank("sys", 0x0348, 12).unwrap(),
        original_clear_1_2
    );
    assert_eq!(mmu.read_raw_bank("sys", 0x1A19, 2).unwrap(), [0x11, 0x15]);

    let rom_2_2 = include_bytes!("../../roms/TVC22_D6.64K");
    let original_entry_2_2 = &rom_2_2[0x034D..0x0357];
    let original_clear_2_2 = &rom_2_2[0x0357..0x0363];
    assert_eq!(&rom_2_2[0x0F21..0x0F23], &[0x20, 0x73]);
    mmu.set_fast_boot(true);
    mmu.add_rom("TVC22_D6.64K", rom_2_2);
    assert_eq!(
        mmu.read_raw_bank("sys", 0x034D, 5).unwrap(),
        original_entry_2_2[..5]
    );
    assert_eq!(mmu.read_raw_bank("sys", 0x0352, 1).unwrap(), [0xC9]);
    assert_eq!(mmu.read_raw_bank("sys", 0x0357, 12).unwrap(), CLEAR_FAST);
    assert_eq!(mmu.read_raw_bank("sys", 0x0F21, 2).unwrap(), [0x18, 0x73]);
    mmu.set_fast_boot(false);
    assert_eq!(
        mmu.read_raw_bank("sys", 0x034D, 10).unwrap(),
        original_entry_2_2
    );
    assert_eq!(
        mmu.read_raw_bank("sys", 0x0357, 12).unwrap(),
        original_clear_2_2
    );
    assert_eq!(mmu.read_raw_bank("sys", 0x0F21, 2).unwrap(), [0x20, 0x73]);
}

#[test]
fn fast_boot_does_not_patch_unexpected_bytes() {
    let rom = [0u8; 0x2000];
    let mut mmu = TvcMmu::new(false);
    mmu.set_fast_boot(true);

    mmu.add_rom("TVC12_D4.64K", &rom);
    assert_eq!(mmu.read_raw_bank("sys", 0x0343, 1).unwrap(), [0x00]);
    assert_eq!(mmu.read_raw_bank("sys", 0x0348, 12).unwrap(), [0x00; 12]);
    assert_eq!(mmu.read_raw_bank("sys", 0x1A19, 2).unwrap(), [0x00, 0x00]);

    mmu.add_rom("TVC22_D6.64K", &rom);
    assert_eq!(mmu.read_raw_bank("sys", 0x0352, 1).unwrap(), [0x00]);
    assert_eq!(mmu.read_raw_bank("sys", 0x0357, 12).unwrap(), [0x00; 12]);
    assert_eq!(mmu.read_raw_bank("sys", 0x0F21, 2).unwrap(), [0x00, 0x00]);
}

#[test]
fn mapped_rom_offset_identifies_bytes_across_paging_views() {
    let mut mmu = TvcMmu::new(false);
    // Reset mapping: page 0 shows SYS, page 3 shows CART.
    mmu.set_map(0x00);
    assert_eq!(mmu.mapped_rom_offset(0x0229), Some((RomBank::Sys, 0x0229)));
    assert_eq!(mmu.mapped_rom_offset(0xC229), None);
    // SYS in pages 0 and 3: one physical byte, two CPU addresses.
    mmu.set_map(0x40);
    assert_eq!(mmu.mapped_rom_offset(0x0229), Some((RomBank::Sys, 0x0229)));
    assert_eq!(mmu.mapped_rom_offset(0xC229), Some((RomBank::Sys, 0x0229)));
    // Normal mapping: page 0 shows U0 RAM, page 3 shows SYS.
    mmu.set_map(0x50);
    assert_eq!(mmu.mapped_rom_offset(0x0229), None);
    assert_eq!(mmu.mapped_rom_offset(0xC229), Some((RomBank::Sys, 0x0229)));
}

#[test]
fn map_labels_describe_standard_and_plus_video_banks() {
    let mut standard = TvcMmu::new(false);
    standard.set_map(0x90);
    assert_eq!(standard.map_labels(), ["U0", "U1", "V", "U3"]);

    let mut plus = TvcMmu::new(true);
    plus.set_vid_map(0x08);
    plus.set_map(0x90);
    assert_eq!(plus.map_labels(), ["U0", "U1", "V2", "U3"]);
}

#[test]
fn fast_ram_test_preserves_both_entry_point_stack_contracts() {
    run_fast_ram_test(FastBootRom::V1_2, 0xC338);
    run_fast_ram_test(FastBootRom::V1_2, 0xC33E);
    run_fast_ram_test(FastBootRom::V2_2, 0xC347);
    run_fast_ram_test(FastBootRom::V2_2, 0xC34D);
}

fn run_fast_ram_test(rom: FastBootRom, entry: u16) {
    let rom_bytes: &[u8] = match rom {
        FastBootRom::V1_2 => include_bytes!("../../roms/TVC12_D4.64K"),
        FastBootRom::V2_2 => include_bytes!("../../roms/TVC22_D6.64K"),
    };
    let mut mmu = TvcMmu::new(false);
    mmu.set_fast_boot(true);
    mmu.add_rom(
        match rom {
            FastBootRom::V1_2 => "TVC12_D4.64K",
            FastBootRom::V2_2 => "TVC22_D6.64K",
        },
        rom_bytes,
    );
    let sys = mmu.read_raw_bank("sys", 0, 0x2000).unwrap();

    let mut bus = FakeBus::new();
    bus.mem[..sys.len()].copy_from_slice(&sys);
    bus.mem[0xC000..0xC000 + sys.len()].copy_from_slice(&sys);
    bus.mem[0x4000..0x8000].fill(0xA5);
    bus.mem[0x9000] = 0x34;
    bus.mem[0x9001] = 0x12;

    let mut z80 = Z80::new();
    z80.state.set_reg16(3, 0x4000);
    z80.state.set_reg16(10, 0x9000);
    z80.state.set_reg16(11, entry);

    for _ in 0..0x5000 {
        z80.step(&mut bus, 0);
        if z80.state.get_reg16(11) == 0x1234 {
            break;
        }
    }

    assert_eq!(z80.state.get_reg16(11), 0x1234);
    assert_eq!(z80.state.get_reg16(3), 0x8000);
    assert_eq!(z80.state.get_reg16(2), 0x4000);
    assert_eq!(z80.state.get_reg16(10), 0x9002);
    assert_ne!(z80.state.get_reg16(0) as u8 & 0x40, 0);
    assert!(bus.mem[0x4000..0x8000].iter().all(|byte| *byte == 0));
}
