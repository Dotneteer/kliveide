use super::*;
use crate::cas::{TVC_CAS_HEADER_LEN, TVC_CAS_TYPE_BASIC, encode_tvc_cas};

const HWCNT_SOURCE: &str = "\
10 for i=1 to 10
20 print \"hello world\",i
30 next I
";

const HWCNT_PAYLOAD: &[u8] = &[
    0x0E, 0x0A, 0x00, 0xF2, 0x20, 0x49, 0x9A, 0x31, 0x20, 0xB4, 0x20, 0x31, 0x30, 0xFF, 0x15, 0x14,
    0x00, 0xDD, 0x20, 0x22, 0x68, 0x65, 0x6C, 0x6C, 0x6F, 0x20, 0x77, 0x6F, 0x72, 0x6C, 0x64, 0x22,
    0xA4, 0x49, 0xFF, 0x07, 0x1E, 0x00, 0xE5, 0x20, 0x49, 0xFF, 0x00,
];

#[test]
fn keyword_table_matches_basic_12_rom() {
    let rom = include_bytes!("../../roms/TVC12_D4.64K");
    let parsed = parse_rom_keywords(&rom[0x1E6D..]);
    assert_eq!(parsed.len(), KEYWORDS.len());
    for (parsed, expected) in parsed.iter().zip(KEYWORDS) {
        assert_eq!(parsed, expected);
    }
}

#[test]
fn tokenizes_saved_hello_world_program() {
    assert_eq!(tokenize_program(HWCNT_SOURCE).unwrap(), HWCNT_PAYLOAD);
}

#[test]
fn detokenizes_saved_hello_world_program() {
    assert_eq!(
        detokenize_program(HWCNT_PAYLOAD).unwrap(),
        "10 FOR I=1 TO 10\n20 PRINT \"hello world\",I\n30 NEXT I\n"
    );
}

#[test]
fn round_trips_detokenized_hello_world() {
    let listed = detokenize_program(HWCNT_PAYLOAD).unwrap();
    assert_eq!(tokenize_program(&listed).unwrap(), HWCNT_PAYLOAD);
}

#[test]
fn encodes_cas_container_like_basic_save() {
    let cas = encode_tvc_cas(HWCNT_PAYLOAD, TVC_CAS_TYPE_BASIC, 0x00, 0);
    assert_eq!(cas.len(), 187);
    assert_eq!(cas[0], 0x11);
    assert_eq!(&cas[2..6], &[0x01, 0x00, 0x3B, 0x00]);
    assert_eq!(&cas[0x80..0x85], &[0x00, 0x01, 0x2B, 0x00, 0x00]);
    assert_eq!(&cas[TVC_CAS_HEADER_LEN..], HWCNT_PAYLOAD);
}

#[test]
fn tokenizes_usr_bootstrap_line() {
    let bytes = tokenize_program("10 C=USR(6704)\n").unwrap();
    assert_eq!(
        &bytes,
        &[
            0x0F, 0x0A, 0x00, 0x43, 0x9A, b'U', b'S', b'R', 0x96, b'6', b'7', b'0', b'4', 0x95,
            0xFF, 0x00,
        ]
    );
}

#[test]
fn tokenizes_colon_separated_statements_and_rem() {
    let bytes = tokenize_program("10 PRINT A : PRINT B\n20 REM keep FOR as text\n").unwrap();
    assert_eq!(
        detokenize_program(&bytes).unwrap(),
        "10 PRINT A : PRINT B\n20 REM keep FOR as text\n"
    );
    assert!(bytes.contains(&0xFD));
    assert!(bytes.windows(4).any(|window| window == b"keep"));
}

#[test]
fn resumes_tokenization_after_data_but_not_inside_quoted_data() {
    let bytes = tokenize_program("10 DATA \"a:PRINT\",1:PRINT 2\n").unwrap();
    assert_eq!(
        &bytes[3..bytes.len() - 2],
        &[
            0xFB, b' ', b'"', b'a', b':', b'P', b'R', b'I', b'N', b'T', b'"', b',', b'1', 0xFD,
            0xDD, b' ', b'2'
        ]
    );
}

#[test]
fn exclamation_comments_preserve_literal_tail() {
    let bytes = tokenize_program("10 ! print a:FOR i=1\n").unwrap();
    assert_eq!(bytes[3], 0xFE);
    assert_eq!(&bytes[4..bytes.len() - 2], b" print a:FOR i=1");
}

fn source_with_payload_size(size: usize) -> String {
    let mut remaining = size - 1; // Final 00H program terminator.
    let mut source = String::new();
    let mut line = 1;
    while remaining > 0 {
        let bytes = remaining.min(250);
        assert!(bytes >= 5);
        source.push_str(&format!("{line} !{}\n", "x".repeat(bytes - 5)));
        remaining -= bytes;
        line += 1;
    }
    source
}

#[test]
fn empty_program_leaves_the_rom_startup_free_byte_count() {
    let empty = tokenize_program("").unwrap();
    assert_eq!(empty, [0x00]);
    assert_eq!(MAX_PROGRAM_BYTES - empty.len(), 42_255);
}

#[test]
fn accepts_exact_basic_memory_limit_including_program_terminator() {
    let source = source_with_payload_size(MAX_PROGRAM_BYTES);
    assert_eq!(tokenize_program(&source).unwrap().len(), MAX_PROGRAM_BYTES);
}

#[test]
fn rejects_one_byte_beyond_basic_memory_limit() {
    let source = source_with_payload_size(MAX_PROGRAM_BYTES + 1);
    assert!(
        tokenize_program(&source)
            .unwrap_err()
            .message
            .contains("42256-byte BASIC memory limit")
    );
}

#[test]
fn canonicalizes_alternate_relational_spellings() {
    let canonical = tokenize_program("10 IF A>=B THEN 20\n").unwrap();
    let alternate = tokenize_program("10 IF A=>B THEN 20\n").unwrap();
    assert_eq!(canonical, alternate);
    assert!(canonical[6] == 0x9E, "{canonical:02X?}");
}

#[test]
fn sorts_line_numbers_and_rejects_duplicates() {
    let bytes = tokenize_program("20 PRINT 2\n10 PRINT 1\n").unwrap();
    assert_eq!(
        detokenize_program(&bytes).unwrap(),
        "10 PRINT 1\n20 PRINT 2\n"
    );
    let error = tokenize_program("10 PRINT 1\n10 PRINT 2\n").unwrap_err();
    assert_eq!(error.to_string(), "line 2: duplicate line number 10");
}

#[test]
fn tokenizes_crtc_register_explorer_without_error() {
    let source = include_str!("../../coding/crtc-register-explorer.bas");
    let bytes = tokenize_program(source).unwrap();
    assert_eq!(*bytes.last().unwrap(), 0x00);
    let listed = detokenize_program(&bytes).unwrap();
    assert!(listed.contains("GRAPHICS"));
    assert!(listed.contains("SET PAPER"));
}

fn parse_rom_keywords(table: &[u8]) -> Vec<String> {
    let mut keywords = Vec::new();
    let mut index = 1;
    while index < table.len() {
        let start = index;
        while index < table.len() && table[index] & 0x80 == 0 {
            index += 1;
        }
        if index >= table.len() {
            break;
        }
        let last = table[index];
        index += 1;
        if last == 0xFF && start + 1 == index {
            break;
        }
        let mut bytes = table[start..index - 1].to_vec();
        bytes.push(last & 0x7F);
        keywords.push(String::from_utf8(bytes).unwrap());
    }
    keywords
}
