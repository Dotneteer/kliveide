use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

use rtvc_core::basic::tokenize_program;
use rtvc_core::cas::{TVC_CAS_TYPE_BASIC, encode_tvc_cas};

#[derive(Debug, Clone, PartialEq, Eq)]
struct Options {
    input: Input,
    output: Option<PathBuf>,
    format: OutputFormat,
    autostart: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Input {
    Stdin,
    Path(PathBuf),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OutputFormat {
    Cas,
    Bin,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("rtvc-basic: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    let program = args.first().map(String::as_str).unwrap_or("rtvc-basic");
    if args[1..]
        .iter()
        .any(|arg| arg.as_str() == "-h" || arg.as_str() == "--help")
    {
        println!("{}", usage(program));
        return Ok(());
    }
    let options = parse_args(program, &args[1..])?;
    let source = read_source(&options.input)?;
    let payload = tokenize_program(&source).map_err(|err| err.to_string())?;
    let output = match options.format {
        OutputFormat::Bin => payload,
        OutputFormat::Cas => encode_tvc_cas(
            &payload,
            TVC_CAS_TYPE_BASIC,
            if options.autostart { 0xFF } else { 0x00 },
            0,
        ),
    };
    write_output(options.output.as_deref(), &output)
}

fn parse_args(program: &str, args: &[String]) -> Result<Options, String> {
    let mut input = None;
    let mut output = None;
    let mut format = OutputFormat::Cas;
    let mut autostart = false;
    let mut index = 0;

    while index < args.len() {
        match args[index].as_str() {
            "-o" | "--output" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "--output requires a path".to_string())?;
                output = Some(PathBuf::from(value));
            }
            "--format" => {
                index += 1;
                let value = args
                    .get(index)
                    .ok_or_else(|| "--format requires cas or bin".to_string())?;
                format = parse_format(value)?;
            }
            "--auto" => autostart = true,
            value if value.starts_with("--format=") => {
                format = parse_format(&value["--format=".len()..])?;
            }
            value if value.starts_with("--output=") => {
                output = Some(PathBuf::from(&value["--output=".len()..]));
            }
            value if value.starts_with('-') && value != "-" => {
                return Err(format!("unknown option '{value}'\n\n{}", usage(program)));
            }
            value => {
                if input.is_some() {
                    return Err(format!(
                        "unexpected argument '{value}'\n\n{}",
                        usage(program)
                    ));
                }
                input = Some(if value == "-" {
                    Input::Stdin
                } else {
                    Input::Path(PathBuf::from(value))
                });
            }
        }
        index += 1;
    }

    Ok(Options {
        input: input.ok_or_else(|| usage(program))?,
        output,
        format,
        autostart,
    })
}

fn usage(program: &str) -> String {
    format!(
        "usage: {program} [--format cas|bin] [--auto] [-o <output>] <input.bas>\n\
         use '-' as input to read source from stdin; omit -o to write output to stdout"
    )
}

fn read_source(input: &Input) -> Result<String, String> {
    match input {
        Input::Stdin => {
            let mut source = String::new();
            io::stdin()
                .read_to_string(&mut source)
                .map_err(|err| format!("failed to read stdin: {err}"))?;
            Ok(source)
        }
        Input::Path(path) => fs::read_to_string(path)
            .map_err(|err| format!("failed to read {}: {err}", path.display())),
    }
}

fn write_output(path: Option<&Path>, value: &[u8]) -> Result<(), String> {
    match path {
        Some(path) => {
            let mut file = fs::File::create(path)
                .map_err(|err| format!("failed to create {}: {err}", path.display()))?;
            file.write_all(value)
                .map_err(|err| format!("failed to write {}: {err}", path.display()))
        }
        None => {
            let stdout = io::stdout();
            let mut stdout = stdout.lock();
            stdout
                .write_all(value)
                .map_err(|err| format!("failed to write stdout: {err}"))
        }
    }
}

fn parse_format(value: &str) -> Result<OutputFormat, String> {
    match value.to_ascii_lowercase().as_str() {
        "cas" => Ok(OutputFormat::Cas),
        "bin" => Ok(OutputFormat::Bin),
        _ => Err(format!(
            "invalid output format '{value}' (expected cas or bin)"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_cli_options() {
        let args = vec![
            "--format".to_string(),
            "bin".to_string(),
            "--auto".to_string(),
            "-o".to_string(),
            "out.cas".to_string(),
            "hello.bas".to_string(),
        ];
        let options = parse_args("rtvc-basic", &args).unwrap();
        assert_eq!(options.format, OutputFormat::Bin);
        assert!(options.autostart);
        assert_eq!(options.output, Some(PathBuf::from("out.cas")));
        assert_eq!(options.input, Input::Path(PathBuf::from("hello.bas")));
    }

    #[test]
    fn encodes_cas_like_basic_save() {
        let payload = tokenize_program("10 PRINT 1\n").unwrap();
        let cas = encode_tvc_cas(&payload, TVC_CAS_TYPE_BASIC, 0x00, 0);
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
}
