use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use rtvc_core::asm::assemble_program;
use rtvc_core::basic::tokenize_program;
use rtvc_core::cas::{TVC_CAS_TYPE_BASIC, encode_tvc_cas};

const TVC_BASIC_LOAD_ADDR: u16 = 0x19EF;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SourceKind {
    Asm,
    Bas,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("rtvc-tocas: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    let program = args.first().map(String::as_str).unwrap_or("rtvc-tocas");
    if args[1..]
        .iter()
        .any(|arg| arg.as_str() == "-h" || arg.as_str() == "--help")
    {
        println!("{}", usage(program));
        return Ok(());
    }
    let inputs = parse_args(program, &args[1..])?;
    for input in inputs {
        match source_kind(&input) {
            Some(kind) => {
                let output = convert_file(&input, kind)?;
                println!("{} -> {}", input.display(), output.display());
            }
            None => println!("skip {} (unrecognised extension)", input.display()),
        }
    }
    Ok(())
}

fn parse_args(program: &str, args: &[String]) -> Result<Vec<PathBuf>, String> {
    let mut inputs = Vec::new();
    for arg in args {
        if arg.starts_with('-') {
            return Err(format!("unknown option '{arg}'\n\n{}", usage(program)));
        }
        inputs.push(PathBuf::from(arg));
    }
    if inputs.is_empty() {
        return Err(usage(program));
    }
    Ok(inputs)
}

fn usage(program: &str) -> String {
    format!(
        "usage: {program} <file.(bas|asm)> [file.(bas|asm)...]\n\
         compile .bas with rtvc-basic and assemble .asm with rtvc-asm --format cas;\n\
         write each output beside the source, replacing the extension with .cas;\n\
         skip files with any other extension"
    )
}

fn convert_file(input: &Path, kind: SourceKind) -> Result<PathBuf, String> {
    let output = cas_output_path(input);
    let source = fs::read_to_string(input)
        .map_err(|err| format!("failed to read {}: {err}", input.display()))?;
    let bytes = convert_source(kind, &source)?;
    fs::write(&output, bytes)
        .map_err(|err| format!("failed to write {}: {err}", output.display()))?;
    Ok(output)
}

fn source_kind(path: &Path) -> Option<SourceKind> {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("asm") => Some(SourceKind::Asm),
        Some("bas") => Some(SourceKind::Bas),
        _ => None,
    }
}

fn cas_output_path(input: &Path) -> PathBuf {
    input.with_extension("cas")
}

fn convert_source(kind: SourceKind, source: &str) -> Result<Vec<u8>, String> {
    match kind {
        SourceKind::Asm => convert_asm(source),
        SourceKind::Bas => convert_bas(source),
    }
}

fn convert_asm(source: &str) -> Result<Vec<u8>, String> {
    let assembled = assemble_program(source, 0).map_err(|err| err.to_string())?;
    if assembled.segments.len() != 1 {
        return Err(
            "asm CAS output requires exactly one contiguous BASIC_START segment".to_string(),
        );
    }
    let segment = &assembled.segments[0];
    if segment.addr != TVC_BASIC_LOAD_ADDR {
        return Err(format!(
            "asm CAS output requires a BASIC_START segment at {TVC_BASIC_LOAD_ADDR:04X}H, got {:04X}H",
            segment.addr
        ));
    }
    Ok(encode_tvc_cas(
        &segment.bytes,
        TVC_CAS_TYPE_BASIC,
        0xFF,
        TVC_BASIC_LOAD_ADDR,
    ))
}

fn convert_bas(source: &str) -> Result<Vec<u8>, String> {
    let payload = tokenize_program(source).map_err(|err| err.to_string())?;
    Ok(encode_tvc_cas(&payload, TVC_CAS_TYPE_BASIC, 0x00, 0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_multiple_inputs() {
        let args = vec![
            "hello.bas".to_string(),
            "demo.asm".to_string(),
            "other.BAS".to_string(),
        ];
        let inputs = parse_args("rtvc-tocas", &args).unwrap();
        assert_eq!(
            inputs,
            vec![
                PathBuf::from("hello.bas"),
                PathBuf::from("demo.asm"),
                PathBuf::from("other.BAS"),
            ]
        );
    }

    #[test]
    fn rejects_unknown_options() {
        let error = parse_args("rtvc-tocas", &["-o".to_string(), "a.bas".to_string()]).unwrap_err();
        assert!(error.contains("unknown option '-o'"));
    }

    #[test]
    fn classifies_extensions_case_insensitively() {
        assert_eq!(
            source_kind(Path::new("coding/demo.asm")),
            Some(SourceKind::Asm)
        );
        assert_eq!(
            source_kind(Path::new("coding/demo.BAS")),
            Some(SourceKind::Bas)
        );
        assert_eq!(source_kind(Path::new("coding/demo.toml")), None);
        assert_eq!(source_kind(Path::new("coding/README")), None);
    }

    #[test]
    fn writes_cas_beside_the_source() {
        assert_eq!(
            cas_output_path(Path::new("coding/demo.bas")),
            PathBuf::from("coding/demo.cas")
        );
        assert_eq!(
            cas_output_path(Path::new("/tmp/helper.ASM")),
            PathBuf::from("/tmp/helper.cas")
        );
    }

    #[test]
    fn converts_basic_like_rtvc_basic() {
        let cas = convert_source(SourceKind::Bas, "10 PRINT 1\n").unwrap();
        let payload = tokenize_program("10 PRINT 1\n").unwrap();
        assert_eq!(cas[0], 0x11);
        assert_eq!(cas[0x80], 0x00);
        assert_eq!(cas[0x81], 0x01);
        assert_eq!(
            u16::from_le_bytes([cas[0x82], cas[0x83]]) as usize,
            payload.len()
        );
        assert_eq!(cas[0x84], 0x00);
        assert_eq!(&cas[0x90..], payload.as_slice());
    }

    #[test]
    fn converts_asm_like_rtvc_asm_format_cas() {
        let assembled = assemble_program("BASIC_START\nRET\n", 0).unwrap();
        let cas = convert_source(SourceKind::Asm, "BASIC_START\nRET\n").unwrap();
        assert_eq!(cas[0], 0x11);
        assert_eq!(&cas[0x80..0x85], &[0x00, 0x01, 0x42, 0x00, 0xFF]);
        assert_eq!(&cas[0x87..0x89], &[0xEF, 0x19]);
        assert_eq!(&cas[0x90..0xA0], &assembled.segments[0].bytes[..16]);
        assert_eq!(cas[0x90 + 0x41], 0xC9);
    }

    #[test]
    fn rejects_asm_without_basic_start() {
        let error = convert_source(SourceKind::Asm, "ORG 8000H\nRET\n").unwrap_err();
        assert!(error.contains("BASIC_START"));
    }
}
