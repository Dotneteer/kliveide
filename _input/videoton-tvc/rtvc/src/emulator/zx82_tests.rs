use super::*;

#[test]
fn instruction_trace_records_zx82_memory_writes() {
    let mut zx82 = Zx82::new();
    zx82.bus.ram_mut()[0..5].copy_from_slice(&[0x32, 0x00, 0x80, 0xD3, 0xFE]);
    zx82.z80.state.pc = 0x4000;
    zx82.z80.state.set_reg8(0, 0x2A);
    zx82.instruction_trace_mut()
        .start(crate::instruction_trace::MIN_TRACE_CAPACITY);

    zx82.debug_step_instruction();

    let entry = zx82.instruction_trace().entries().back().unwrap();
    assert_eq!(entry.pc(), 0x4000);
    assert_eq!(entry.registers.af >> 8, 0x2A);
    assert_eq!(entry.opcode[..3], [0x32, 0x00, 0x80]);
    assert_eq!(entry.main_map, None);
    assert_eq!(
        entry.effects.memory_writes,
        vec![crate::instruction_trace::TraceMemoryWrite {
            addr: 0x8000,
            value: 0x2A,
        }]
    );

    zx82.debug_step_instruction();
    let entry = zx82.instruction_trace().entries().back().unwrap();
    assert_eq!(entry.pc(), 0x4003);
    assert_eq!(
        entry.effects.port_writes,
        vec![crate::instruction_trace::TracePortWrite {
            port: 0x2AFE,
            value: 0x2A,
        }]
    );
}

#[test]
fn fixed_memory_map_keeps_rom_read_only() {
    let mut bus = Zx82Bus::new();
    let mut rom = [0; ROM_SIZE];
    rom[0x1234] = 0xA5;
    bus.load_rom(&rom).unwrap();

    bus.w8(0x1234, 0x5A);
    bus.w8(0x4000, 0x3C);

    assert_eq!(bus.r8(0x1234), 0xA5);
    assert_eq!(bus.r8(0x4000), 0x3C);
}

#[test]
fn ula_uses_even_ports_and_high_address_for_keyboard_rows() {
    let mut bus = Zx82Bus::new();
    bus.set_key(0, 1, true);

    assert_eq!(bus.in8(0xFE, 0xFE) & 0x1F, 0x1D);
    assert_eq!(bus.in8(0xFE, 0xFF) & 0x1F, 0x1F);
    assert_eq!(bus.in8(0xFF, 0xFE), 0xFF);

    bus.out8(0xFE, 0x15, 0);
    assert_eq!(bus.border_color(), 5);
    assert!(bus.speaker_level());
}

#[test]
fn full_frame_renderer_uses_spectrum_bitmap_layout_and_attributes() {
    let mut zx82 = Zx82::new();
    zx82.bus.ram_mut()[0] = 0x80;
    zx82.bus.ram_mut()[0x1800] = 0x02;
    zx82.draw_full_frame();

    let first_pixel = TOP_BORDER * FRAMEBUFFER_WIDTH + LEFT_BORDER;
    assert_eq!(zx82.framebuffer[first_pixel], spectrum_color(2, false));
    assert_eq!(zx82.framebuffer[first_pixel + 1], spectrum_color(0, false));
}

#[test]
fn frame_interrupt_is_offered_every_69888_t_states() {
    let mut zx82 = Zx82::new();
    zx82.bus.ram_mut()[0] = 0x76;
    zx82.z80.state.pc = 0x4000;
    zx82.z80.state.iff1 = 1;
    zx82.z80.state.iff2 = 1;

    zx82.run_for_a_frame();

    assert!(zx82.clock() >= FRAME_CLOCKS);
    assert!(zx82.last_frame_interrupt_accepted());
    assert_eq!(zx82.z80.state.pc, 0x0038);
}

#[test]
fn supplied_48k_rom_reaches_an_initialized_screen() {
    let Ok(rom) = std::fs::read("roms/48.rom") else {
        return;
    };
    let mut zx82 = Zx82::new();
    zx82.load_rom(&rom).unwrap();

    for _ in 0..100 {
        zx82.run_for_a_frame();
    }

    assert!(zx82.bus.ram()[..0x1B00].iter().any(|&byte| byte != 0));
    assert!(zx82.framebuffer.iter().any(|&pixel| pixel != 0xFF000000));
    assert!(zx82.last_frame_interrupt_accepted());
}

#[test]
fn supplied_rom_reads_keyboard_matrix_in_basic() {
    let Ok(rom) = std::fs::read("roms/48.rom") else {
        return;
    };
    let mut zx82 = Zx82::new();
    zx82.load_rom(&rom).unwrap();
    for _ in 0..100 {
        zx82.run_for_a_frame();
    }
    let before = zx82.bus.ram()[..0x1B00].to_vec();

    zx82.bus.set_key(5, 0, true);
    for _ in 0..3 {
        zx82.run_for_a_frame();
    }
    zx82.bus.set_key(5, 0, false);
    for _ in 0..3 {
        zx82.run_for_a_frame();
    }

    assert_ne!(&zx82.bus.ram()[..0x1B00], before.as_slice());
}

#[test]
fn breakpoint_stops_frame_execution_at_mapped_address() {
    let mut zx82 = Zx82::new();
    zx82.load_rom(&[0; ROM_SIZE]).unwrap();
    zx82.set_breakpoint(1);

    assert!(zx82.run_for_a_frame());
    assert_eq!(zx82.z80.state.get_reg16(11), 1);
}

#[test]
fn debug_run_to_interrupt_advances_to_the_frame_irq() {
    let mut zx82 = Zx82::new();
    zx82.load_rom(&[0; ROM_SIZE]).unwrap();
    zx82.z80.state.iff1 = 1;
    zx82.z80.state.iff2 = 1;

    let (elapsed, accepted) = zx82.debug_run_to_interrupt(FRAME_CLOCKS as u32 + 32);

    assert!(accepted);
    assert!(elapsed >= FRAME_CLOCKS as u32);
}

#[test]
fn host_key_codes_drive_the_spectrum_matrix() {
    let mut zx82 = Zx82::new();
    assert!(zx82.key_down(80));
    assert_eq!(zx82.bus.in8(0xFE, 0xDF) & 0x01, 0);

    zx82.key_up(80);
    assert_ne!(zx82.bus.in8(0xFE, 0xDF) & 0x01, 0);
}

#[test]
fn loads_uncompressed_z80_v1() {
    let mut snapshot = z80_base_header(0x4567);
    snapshot[0] = 0x12;
    snapshot[1] = 0x34;
    snapshot[2] = 0x78;
    snapshot[3] = 0x56;
    snapshot[10] = 0x9A;
    snapshot[11] = 0x2B;
    snapshot[12] = 0x0D;
    snapshot[27] = 1;
    snapshot[28] = 1;
    snapshot[29] = 2;
    let mut ram = vec![0; RAM_SIZE];
    ram[0] = 0xA5;
    ram[Z80_PAGE_SIZE] = 0xB6;
    ram[Z80_PAGE_SIZE * 2] = 0xC7;
    snapshot.extend_from_slice(&ram);

    let mut zx82 = Zx82::new();
    zx82.load_z80(&snapshot).unwrap();

    assert_eq!(zx82.z80.state.get_reg16(0), 0x1234);
    assert_eq!(zx82.z80.state.get_reg16(1), 0x5678);
    assert_eq!(zx82.z80.state.get_reg16(11), 0x4567);
    assert_eq!(zx82.z80.state.get_reg8(20), 0x9A);
    assert_eq!(zx82.z80.state.get_reg8(21), 0xAB);
    assert_eq!(zx82.z80.state.iff1, 1);
    assert_eq!(zx82.z80.state.iff2, 1);
    assert_eq!(zx82.z80.state.im, 2);
    assert_eq!(zx82.bus.border_color(), 6);
    assert_eq!(zx82.bus.ram()[0], 0xA5);
    assert_eq!(zx82.bus.ram()[Z80_PAGE_SIZE], 0xB6);
    assert_eq!(zx82.bus.ram()[Z80_PAGE_SIZE * 2], 0xC7);
}

#[test]
fn loads_compressed_z80_v1() {
    let mut snapshot = z80_base_header(0x3456);
    snapshot[12] = 0x20;
    snapshot.extend(repeated_z80_runs(RAM_SIZE, 0xED));
    snapshot.extend_from_slice(&[0x00, 0xED, 0xED, 0x00]);

    let mut zx82 = Zx82::new();
    zx82.load_z80(&snapshot).unwrap();

    assert_eq!(zx82.z80.state.get_reg16(11), 0x3456);
    assert!(zx82.bus.ram().iter().all(|&byte| byte == 0xED));
}

#[test]
fn loads_z80_v2_uncompressed_pages() {
    let mut snapshot = z80_base_header(0);
    snapshot.extend_from_slice(&23u16.to_le_bytes());
    snapshot.extend_from_slice(&0x2468u16.to_le_bytes());
    snapshot.push(0);
    snapshot.resize(32 + 23, 0);
    append_z80_page(&mut snapshot, 8, &[0x18; Z80_PAGE_SIZE], false);
    append_z80_page(&mut snapshot, 4, &[0x24; Z80_PAGE_SIZE], false);
    append_z80_page(&mut snapshot, 5, &[0x35; Z80_PAGE_SIZE], false);

    let mut zx82 = Zx82::new();
    zx82.load_z80(&snapshot).unwrap();

    assert_eq!(zx82.z80.state.get_reg16(11), 0x2468);
    assert_eq!(zx82.bus.ram()[0], 0x18);
    assert_eq!(zx82.bus.ram()[Z80_PAGE_SIZE], 0x24);
    assert_eq!(zx82.bus.ram()[Z80_PAGE_SIZE * 2], 0x35);
}

#[test]
fn loads_z80_v3_compressed_pages() {
    let mut snapshot = z80_base_header(0);
    snapshot.extend_from_slice(&54u16.to_le_bytes());
    snapshot.extend_from_slice(&0x1357u16.to_le_bytes());
    snapshot.push(0);
    snapshot.resize(32 + 54, 0);
    append_z80_page(&mut snapshot, 5, &[0x55; Z80_PAGE_SIZE], true);
    append_z80_page(&mut snapshot, 8, &[0x88; Z80_PAGE_SIZE], true);
    append_z80_page(&mut snapshot, 4, &[0x44; Z80_PAGE_SIZE], true);

    let mut zx82 = Zx82::new();
    zx82.load_z80(&snapshot).unwrap();

    assert_eq!(zx82.z80.state.get_reg16(11), 0x1357);
    assert_eq!(zx82.bus.ram()[0], 0x88);
    assert_eq!(zx82.bus.ram()[Z80_PAGE_SIZE], 0x44);
    assert_eq!(zx82.bus.ram()[Z80_PAGE_SIZE * 2], 0x55);
}

#[test]
fn rejects_non_48k_and_incomplete_z80_snapshots() {
    let mut snapshot = z80_base_header(0);
    snapshot.extend_from_slice(&23u16.to_le_bytes());
    snapshot.extend_from_slice(&0x1234u16.to_le_bytes());
    snapshot.push(3);
    snapshot.resize(32 + 23, 0);

    let mut zx82 = Zx82::new();
    assert!(zx82.load_z80(&snapshot).is_err());

    snapshot[34] = 0;
    append_z80_page(&mut snapshot, 8, &[0; Z80_PAGE_SIZE], false);
    assert!(zx82.load_z80(&snapshot).is_err());
}

fn write_word(data: &mut [u8], offset: usize, value: u16) {
    data[offset..offset + 2].copy_from_slice(&value.to_le_bytes());
}

fn z80_base_header(pc: u16) -> Vec<u8> {
    let mut header = vec![0; Z80_BASE_HEADER_SIZE];
    write_word(&mut header, 6, pc);
    header
}

fn repeated_z80_runs(length: usize, value: u8) -> Vec<u8> {
    let mut encoded = Vec::new();
    let mut remaining = length;
    while remaining > 0 {
        let count = remaining.min(256);
        encoded.extend_from_slice(&[
            0xED,
            0xED,
            if count == 256 { 0 } else { count as u8 },
            value,
        ]);
        remaining -= count;
    }
    encoded
}

fn append_z80_page(snapshot: &mut Vec<u8>, page: u8, data: &[u8], compressed: bool) {
    if compressed {
        let encoded = repeated_z80_runs(data.len(), data[0]);
        snapshot.extend_from_slice(&(encoded.len() as u16).to_le_bytes());
        snapshot.push(page);
        snapshot.extend_from_slice(&encoded);
    } else {
        snapshot.extend_from_slice(&0xFFFFu16.to_le_bytes());
        snapshot.push(page);
        snapshot.extend_from_slice(data);
    }
}
