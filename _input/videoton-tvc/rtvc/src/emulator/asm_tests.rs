use super::*;
use crate::bus::FakeBus;
use crate::disasm::disassemble_at;

fn round_trip(source: &str, pc: u16, expected_bytes: &[u8], expected_text: &str) {
    let bytes = assemble_line(source, pc).unwrap();
    assert_eq!(bytes, expected_bytes);

    let mut bus = FakeBus::new();
    for (offset, byte) in bytes.iter().enumerate() {
        bus.mem[pc.wrapping_add(offset as u16) as usize] = *byte;
    }
    assert_eq!(disassemble_at(&mut bus, pc).text, expected_text);
}

#[test]
fn assembles_base_and_immediate_instructions() {
    round_trip("nop", 0, &[0x00], "NOP");
    round_trip("LD BC,1234H", 0, &[0x01, 0x34, 0x12], "LD BC,1234H");
    round_trip("ld a, 42", 0, &[0x3E, 42], "LD A,2AH");
    round_trip("XOR (HL)", 0, &[0xAE], "XOR (HL)");
    round_trip("CALL NZ,$4567", 0, &[0xC4, 0x67, 0x45], "CALL NZ,4567H");
}

#[test]
fn assembles_relative_targets_using_the_current_address() {
    round_trip("JR NZ,1000H", 0x1000, &[0x20, 0xFE], "JR NZ,1000H");
    round_trip("DJNZ 0x1081", 0x1000, &[0x10, 0x7F], "DJNZ 1081H");
    assert!(assemble_line("JR 1100H", 0x1000).is_err());
}

#[test]
fn assembles_indexed_and_bit_instructions() {
    round_trip(
        "LD (IX-2),99H",
        0x2000,
        &[0xDD, 0x36, 0xFE, 0x99],
        "LD (IX-02H),99H",
    );
    round_trip(
        "ADC A,(IY+5)",
        0x2000,
        &[0xFD, 0x8E, 0x05],
        "ADC A,(IY+05H)",
    );
    round_trip(
        "BIT 0,(IX-128)",
        0x2000,
        &[0xDD, 0xCB, 0x80, 0x46],
        "BIT 0,(IX-80H)",
    );
}

#[test]
fn assembles_ed_and_data_directives() {
    round_trip(
        "LD BC,(4000H)",
        0,
        &[0xED, 0x4B, 0x00, 0x40],
        "LD BC,(4000H)",
    );
    round_trip("IM 2", 0, &[0xED, 0x5E], "IM 2");
    round_trip("IN A,(C)", 0, &[0xED, 0x78], "IN A,(C)");
    round_trip("OUT (C),A", 0, &[0xED, 0x79], "OUT (C),A");
    round_trip("EX AF,AF'", 0, &[0x08], "EX AF,AF'");
    round_trip("LDIR", 0, &[0xED, 0xB0], "LDIR");
    assert_eq!(
        assemble_line("DB 12H, 34, 0x56 ; bytes", 0).unwrap(),
        [0x12, 34, 0x56]
    );
    assert_eq!(
        assemble_program("DB 'A,B;C' ; string", 0).unwrap().bytes,
        [b'A', b',', b'B', b';', b'C']
    );
}

#[test]
fn reports_bad_input() {
    assert_eq!(
        assemble_line("JR PE,1000H", 0).unwrap_err().to_string(),
        "JR condition must be NZ, Z, NC, or C, got 'PE'"
    );
    assert!(assemble_line("LD A,300", 0).is_err());
    assert!(assemble_line("WAT A,B", 0).is_err());
}

#[test]
fn assembles_program_with_labels_and_expressions() {
    let program = assemble_program(
        r#"
                ORG 8000H
start:          LD HL,message
                LD B,message_end-message
loop:           DJNZ loop
                JP start
message:        DB "OK", 0
message_end:
            "#,
        0,
    )
    .unwrap();

    assert_eq!(program.origin, 0x8000);
    assert_eq!(program.next_addr, 0x800D);
    assert_eq!(program.symbols["START"], 0x8000);
    assert_eq!(program.symbols["LOOP"], 0x8005);
    assert_eq!(program.symbols["MESSAGE"], 0x800A);
    assert_eq!(program.symbols["MESSAGE_END"], 0x800D);
    assert_eq!(
        program.bytes,
        vec![
            0x21, 0x0A, 0x80, // LD HL,message
            0x06, 0x03, // LD B,message_end-message
            0x10, 0xFE, // DJNZ loop
            0xC3, 0x00, 0x80, // JP start
            b'O', b'K', 0,
        ]
    );
    assert_eq!(program.segments.len(), 1);
    assert_eq!(program.segments[0].addr, 0x8000);
}

#[test]
fn assembles_program_directives_and_segments() {
    let program = assemble_program(
        r#"
base EQU 4000H
            ORG base
first:      DB 1, 2
            DW first, $+2
            DS 3, 0FFH
            ORG base+10H
second:     NOP
            "#,
        0x2000,
    )
    .unwrap();

    assert_eq!(program.origin, 0x4000);
    assert_eq!(program.symbols["BASE"], 0x4000);
    assert_eq!(program.symbols["FIRST"], 0x4000);
    assert_eq!(program.symbols["SECOND"], 0x4010);
    assert_eq!(
        program.bytes,
        vec![1, 2, 0x00, 0x40, 0x04, 0x40, 0xFF, 0xFF, 0xFF, 0x00]
    );
    assert_eq!(program.segments.len(), 2);
    assert_eq!(program.segments[0].addr, 0x4000);
    assert_eq!(
        program.segments[0].bytes,
        vec![1, 2, 0x00, 0x40, 0x04, 0x40, 0xFF, 0xFF, 0xFF]
    );
    assert_eq!(program.segments[1].addr, 0x4010);
    assert_eq!(program.segments[1].bytes, vec![0x00]);
}

#[test]
fn org_declares_persistent_named_address_mappings() {
    let program = assemble_program(
        r#"
            ORG C000H, SYS0, 0000H, SYS1, 4000H
start:      JP MAIN@SYS0
main:       NOP
            ORG C100H
table:      DW TABLE@SYS0, TABLE@SYS1, MAIN
            ORG D000H, SYS2, 8000H
other:      JP TABLE@SYS0
        "#,
        0,
    )
    .unwrap();

    assert_eq!(program.symbols["START"], 0xC000);
    assert_eq!(program.symbols["MAIN"], 0xC003);
    assert_eq!(program.symbols["TABLE"], 0xC100);
    assert_eq!(program.symbols["OTHER"], 0xD000);
    assert_eq!(
        program.bytes,
        vec![
            0xC3, 0x03, 0x00, // JP MAIN@SYS0
            0x00, // MAIN: NOP
            0x00, 0x01, // TABLE@SYS0
            0x00, 0x41, // TABLE@SYS1
            0x03, 0xC0, // MAIN
            0xC3, 0x00, 0x01, // JP TABLE@SYS0
        ]
    );
    assert_eq!(
        program.mappings,
        vec![
            AsmMapping {
                name: "SYS0".to_string(),
                source_base: 0xC000,
                mapped_base: 0x0000,
            },
            AsmMapping {
                name: "SYS1".to_string(),
                source_base: 0xC000,
                mapped_base: 0x4000,
            },
            AsmMapping {
                name: "SYS2".to_string(),
                source_base: 0xD000,
                mapped_base: 0x8000,
            },
        ]
    );
}

#[test]
fn rejects_incomplete_org_mapping() {
    let error = assemble_program("ORG 8000H, SYS0\n", 0).unwrap_err();
    assert_eq!(
        error.to_string(),
        "line 1: ORG mappings require a name and mapped address pair"
    );
}

#[test]
fn mapping_expressions_work_in_equ_and_data_directives() {
    let program = assemble_program(
        "ORG C000H, SYS0, 0000H\nMAIN: NOP\nMAPPED EQU MAIN@SYS0\nDB MAIN@SYS0, MAPPED\nDW MAIN@SYS0+1\nDS MAIN@SYS0+1, MAIN@SYS0+7\n",
        0,
    )
    .unwrap();

    assert_eq!(program.symbols["MAPPED"], 0);
    assert_eq!(program.bytes, vec![0x00, 0x00, 0x00, 0x01, 0x00, 0x07]);
}

#[test]
fn rejects_unknown_and_duplicate_mappings() {
    let error =
        assemble_program("ORG 8000H, SYS0, 0000H\nJP START@MISSING\nSTART: NOP\n", 0).unwrap_err();
    assert_eq!(error.to_string(), "line 2: unknown mapping 'MISSING'");

    let error =
        assemble_program("ORG 8000H, SYS0, 0000H\nORG 9000H, sys0, 4000H\n", 0).unwrap_err();
    assert_eq!(error.to_string(), "line 2: duplicate mapping 'SYS0'");
}

#[test]
fn rejects_the_old_map_directive() {
    let error = assemble_program("MAP SYS,0000H,C000H\n", 0).unwrap_err();
    assert_eq!(
        error.to_string(),
        "line 1: MAP is no longer supported; declare mappings on ORG"
    );
}

#[test]
fn assembles_basic_start_program() {
    let program = assemble_program(
        r#"
            BASIC_START
entry:      LD A,02H
            OUT (00H),A
            JP BASIC_START
            "#,
        0,
    )
    .unwrap();

    assert_eq!(program.origin, 0x19EF);
    assert_eq!(program.symbols["BASIC_START"], 0x1A30);
    assert_eq!(program.symbols["ENTRY"], 0x1A30);
    assert_eq!(program.segments.len(), 1);
    assert_eq!(program.segments[0].addr, 0x19EF);
    assert_eq!(
        program.segments[0].bytes[0..16],
        [
            0x0F, 0x0A, 0x00, 0x43, 0x9A, b'U', b'S', b'R', 0x96, b'6', b'7', b'0', b'4', 0x95,
            0xFF, 0x00,
        ]
    );
    assert_eq!(
        &program.segments[0].bytes[0x41..],
        &[0x3E, 0x02, 0xD3, 0x00, 0xC3, 0x30, 0x1A]
    );
    assert_eq!(program.next_addr, 0x1A37);
}

#[test]
fn assembles_program_compatibility_edges() {
    let program = assemble_program(
        r#"
                OUT (C),0
                DB "A\"B"
            "#,
        0x9000,
    )
    .unwrap();

    assert_eq!(program.bytes, vec![0xED, 0x71, b'A', b'"', b'B']);
}

#[test]
fn reports_program_errors_with_line_numbers() {
    let err = assemble_program(
        r#"
                JR missing
            "#,
        0x1000,
    )
    .unwrap_err();
    assert_eq!(err.to_string(), "line 2: unknown symbol 'MISSING'");

    let err = assemble_program("again: NOP\nagain: RET", 0).unwrap_err();
    assert_eq!(err.to_string(), "line 2: duplicate label 'AGAIN'");
}
