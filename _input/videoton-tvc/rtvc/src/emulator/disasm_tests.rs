use super::*;
use crate::bus::FakeBus;

fn disasm(bytes: &[u8], addr: u16) -> DisassembledInstruction {
    let mut bus = FakeBus::new();
    for (i, byte) in bytes.iter().enumerate() {
        bus.mem[addr.wrapping_add(i as u16) as usize] = *byte;
    }
    disassemble_at(&mut bus, addr)
}

#[test]
fn decodes_base_immediates_and_relative_targets() {
    assert_eq!(disasm(&[0x01, 0x34, 0x12], 0x1000).text, "LD BC,1234H");
    assert_eq!(disasm(&[0x20, 0xFE], 0x1000).text, "JR NZ,1000H");
    assert_eq!(disasm(&[0xC3, 0x78, 0x56], 0x1000).text, "JP 5678H");
}

#[test]
fn decodes_compact_bitfield_groups() {
    assert_eq!(disasm(&[0x7E], 0).text, "LD A,(HL)");
    assert_eq!(disasm(&[0xAE], 0).text, "XOR (HL)");
    assert_eq!(disasm(&[0xCB, 0x7C], 0).text, "BIT 7,H");
    assert_eq!(disasm(&[0xCB, 0xC6], 0).text, "SET 0,(HL)");
}

#[test]
fn decodes_ed_special_cases() {
    assert_eq!(disasm(&[0xED, 0x4B, 0x00, 0x40], 0).text, "LD BC,(4000H)");
    assert_eq!(disasm(&[0xED, 0xB0], 0).text, "LDIR");
    assert_eq!(disasm(&[0xED, 0x67], 0).text, "RRD");
    assert_eq!(disasm(&[0xED, 0x56], 0).text, "IM 1");
    assert_eq!(disasm(&[0xED, 0x5E], 0).text, "IM 2");
    assert_eq!(disasm(&[0xED, 0x78], 0).flags, Some("***P0-"));
}

#[test]
fn decodes_indexed_forms() {
    let ix = disasm(&[0xDD, 0x36, 0xFE, 0x99], 0x2000);
    assert_eq!(ix.text, "LD (IX-02H),99H");
    assert_eq!(ix.len, 4);

    let iy = disasm(&[0xFD, 0x8E, 0x05], 0x2000);
    assert_eq!(iy.text, "ADC A,(IY+05H)");
    assert_eq!(iy.len, 3);

    assert_eq!(disasm(&[0xDD, 0x26, 0x12], 0).text, "LD IXH,12H");
    assert_eq!(disasm(&[0xFD, 0x65], 0).text, "LD IYH,IYL");
    assert_eq!(disasm(&[0xDD, 0x94], 0).text, "SUB IXH");
    assert_eq!(disasm(&[0xDD, 0x09], 0).text, "ADD IX,BC");
    assert_eq!(disasm(&[0xFD, 0x39], 0).text, "ADD IY,SP");
}

#[test]
fn decodes_indexed_cb_byte_order() {
    let inst = disasm(&[0xDD, 0xCB, 0x80, 0x46], 0x2000);
    assert_eq!(inst.text, "BIT 0,(IX-80H)");
    assert_eq!(inst.bytes, vec![0xDD, 0xCB, 0x80, 0x46]);
}

#[test]
fn prefixed_fallback_consumes_base_operands_after_opcode() {
    let inst = disasm(&[0xDD, 0x01, 0x34, 0x12], 0x2000);
    assert_eq!(inst.text, "LD BC,1234H");
    assert_eq!(inst.len, 4);
}

#[test]
fn includes_flags_description_effect_and_t_states() {
    let jr = disasm(&[0x20, 0xFE], 0x1000);
    assert_eq!(jr.text, "JR NZ,1000H");
    assert_eq!(jr.flags, Some("------"));
    assert_eq!(jr.description, Some("Conditional Jump"));
    assert_eq!(jr.effect, Some("If cc JR"));
    assert_eq!(jr.t_states, Some("12/7"));

    let xor = disasm(&[0xAE], 0);
    assert_eq!(xor.flags, Some("***P00"));
    assert_eq!(xor.description, Some("Logical Exclusive OR"));
    assert_eq!(xor.effect, Some("A=Axs"));
    assert_eq!(xor.t_states, Some("7"));

    let indexed = disasm(&[0xFD, 0x8E, 0x05], 0x2000);
    assert_eq!(indexed.flags, Some("***V0*"));
    assert_eq!(indexed.description, Some("Add with Carry"));
    assert_eq!(indexed.effect, Some("A=A+s+CY"));
    assert_eq!(indexed.t_states, Some("19"));

    let ldir = disasm(&[0xED, 0xB0], 0);
    assert_eq!(ldir.flags, Some("--000-"));
    assert_eq!(ldir.description, Some("Load, Inc., Repeat"));
    assert_eq!(ldir.effect, Some("LDI till BC=0"));
    assert_eq!(ldir.t_states, Some("21/16"));
}
