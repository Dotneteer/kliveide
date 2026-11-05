use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

const RAM_START: u16 = 0x4000;
const RAM_END: u32 = 0x10000;
const BYTES_PER_ROW: usize = 16;

const FORMAT_VERSION: &str = "rtvc-zx-tap-v1";

struct TapBlock {
    flag: u8,
    data: Vec<u8>,
    checksum: u8,
    checksum_ok: bool,
    tap_len: u16,
}

#[derive(Clone)]
struct Header {
    block_index: usize,
    type_name: String,
    type_id: u8,
    name: String,
    length: u16,
    param1: u16,
    param2: u16,
    checksum_ok: bool,
}

struct SegmentEntry {
    name: String,
    addr: u16,
    len: u16,
    bytes: Vec<u8>,
    source_block: usize,
    header_name: String,
}

struct DataBlockEntry {
    name: String,
    type_name: String,
    source_block: usize,
    header_name: String,
    len: u16,
    line: Option<u16>,
    variables_offset: Option<u16>,
    basic_lines: Vec<String>,
    bytes: Vec<u8>,
    param1: Option<u16>,
    param2: Option<u16>,
}

struct RawBlockEntry {
    block_index: usize,
    flag: u8,
    payload_len: usize,
    tap_len: u16,
    checksum: u8,
    checksum_ok: bool,
    role: String,
    bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Options {
    input: Input,
    output: Option<PathBuf>,
    no_source_path: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Input {
    Stdin,
    Path(PathBuf),
}

fn main() {
    if let Err(err) = run() {
        eprintln!("rtvc-tap2toml: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let args = env::args().collect::<Vec<_>>();
    let program = args.first().map(String::as_str).unwrap_or("rtvc-tap2toml");
    if args[1..]
        .iter()
        .any(|arg| arg.as_str() == "-h" || arg.as_str() == "--help")
    {
        println!("{}", usage(program));
        return Ok(());
    }
    let options = parse_args(program, &args[1..])?;
    let (source_name, data) = read_input(&options.input)?;
    let document = load_tap(&data, &source_name, !options.no_source_path)?;
    let output = render_toml(&document);
    write_output(options.output.as_deref(), output.as_bytes())
}

fn parse_args(program: &str, args: &[String]) -> Result<Options, String> {
    let mut input = None;
    let mut output = None;
    let mut no_source_path = false;
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
            value if value.starts_with("--output=") => {
                output = Some(PathBuf::from(&value["--output=".len()..]));
            }
            "--compact" => {
                // accepted for compatibility; output is always human-readable
            }
            "--no-source-path" => {
                no_source_path = true;
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
        no_source_path,
    })
}

fn usage(program: &str) -> String {
    format!(
        "usage: {program} [--no-source-path] [--compact] [-o <output>] <input.tap>\n\
         use '-' as input to read tap from stdin; omit -o to write TOML to stdout"
    )
}

fn read_input(input: &Input) -> Result<(String, Vec<u8>), String> {
    match input {
        Input::Stdin => {
            let mut data = Vec::new();
            io::stdin()
                .read_to_end(&mut data)
                .map_err(|err| format!("failed to read stdin: {err}"))?;
            Ok(("-".to_string(), data))
        }
        Input::Path(path) => {
            let data = fs::read(path)
                .map_err(|err| format!("failed to read {}: {err}", path.display()))?;
            Ok((path.display().to_string(), data))
        }
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

fn read_word_le(data: &[u8], offset: usize) -> u16 {
    u16::from_le_bytes([data[offset], data[offset + 1]])
}

fn read_word_be(data: &[u8], offset: usize) -> u16 {
    u16::from_be_bytes([data[offset], data[offset + 1]])
}

fn parse_tap(data: &[u8]) -> Result<Vec<TapBlock>, String> {
    let mut blocks = Vec::new();
    let mut offset = 0;
    while offset < data.len() {
        if offset + 2 > data.len() {
            return Err("truncated TAP block length".to_string());
        }
        let length = read_word_le(data, offset) as usize;
        offset += 2;
        if length == 0 {
            return Err("TAP block length must not be zero".to_string());
        }
        let end = offset + length;
        if end > data.len() {
            return Err("truncated TAP block payload".to_string());
        }
        let payload = &data[offset..end];
        offset = end;

        let checksum = payload.iter().fold(0u8, |a, b| a ^ b);
        let flag = payload[0];
        let stored_checksum = payload[payload.len() - 1];
        let block_data = if payload.len() > 2 {
            payload[1..payload.len() - 1].to_vec()
        } else {
            Vec::new()
        };

        blocks.push(TapBlock {
            flag,
            data: block_data,
            checksum: stored_checksum,
            checksum_ok: checksum == 0,
            tap_len: length as u16,
        });
    }
    Ok(blocks)
}

fn spectrum_name(raw_name: &[u8]) -> String {
    String::from_utf8_lossy(raw_name)
        .to_string()
        .chars()
        .filter(|&c| c != '\0')
        .collect::<String>()
        .trim_end()
        .to_string()
}

fn header_from_block(block: &TapBlock, block_index: usize) -> Option<Header> {
    if block.flag != 0x00 || block.data.len() != 17 {
        return None;
    }
    let block_type = block.data[0];
    let type_name = match block_type {
        0 => "program".to_string(),
        1 => "number_array".to_string(),
        2 => "character_array".to_string(),
        3 => "code".to_string(),
        _ => format!("unknown_{}", block_type),
    };
    Some(Header {
        block_index,
        type_name,
        type_id: block_type,
        name: spectrum_name(&block.data[1..11]),
        length: read_word_le(&block.data, 11),
        param1: read_word_le(&block.data, 13),
        param2: read_word_le(&block.data, 15),
        checksum_ok: block.checksum_ok,
    })
}

fn basic_usr_numbers(program: &[u8]) -> Vec<(u16, u16)> {
    let mut results = Vec::new();
    let mut offset = 0;
    while offset + 4 <= program.len() {
        let line_no = read_word_be(program, offset);
        let line_len = read_word_le(program, offset + 2) as usize;
        offset += 4;
        let line_end = offset + line_len;
        if line_end > program.len() {
            break;
        }
        let line = &program[offset..line_end];
        offset = line_end;

        for (i, &byte) in line.iter().enumerate() {
            if byte != 0xC0 {
                continue;
            }
            if let Some(addr) = number_after_usr(line, i + 1) {
                results.push((line_no, addr));
            }
        }
    }
    results
}

fn decode_basic_program(program: &[u8]) -> Vec<String> {
    let mut lines = Vec::new();
    let mut offset = 0;
    while offset + 4 <= program.len() {
        let line_no = read_word_be(program, offset);
        let line_len = read_word_le(program, offset + 2) as usize;
        offset += 4;
        let line_end = offset + line_len;
        if line_end > program.len() {
            break;
        }
        let line = &program[offset..line_end];
        offset = line_end;
        let decoded = decode_basic_line(line);
        let text = format!("{} {}", line_no, decoded).trim().to_string();
        lines.push(text);
    }
    lines
}

fn decode_basic_line(line: &[u8]) -> String {
    let mut out = String::new();
    let mut index = 0;
    let mut in_string = false;
    while index < line.len() {
        let byte = line[index];
        if byte == 0x0D {
            break;
        }
        if byte == 0x0E {
            index += 6;
            continue;
        }
        if byte == b'"' {
            out.push('"');
            in_string = !in_string;
        } else if !in_string && byte >= 0xA5 {
            let token = SPECTRUM_TOKENS
                .iter()
                .find(|(k, _)| *k == byte)
                .map(|(_, v)| v);
            if let Some(token) = token {
                if needs_space_before_token(&out, token) {
                    out.push(' ');
                }
                out.push_str(token);
                if token.ends_with(|c: char| c.is_alphanumeric()) || token.ends_with('$') {
                    out.push(' ');
                }
            } else {
                out.push_str(&format!("{{0x{:02X}}}", byte));
            }
        } else if (0x20..=0x7E).contains(&byte) {
            out.push(byte as char);
        } else {
            out.push_str(&format!("{{0x{:02X}}}", byte));
        }
        index += 1;
    }
    let text = out.trim().to_string();
    let text = text
        .replace(" :", ":")
        .replace(" ;", ";")
        .replace(" ,", ",")
        .replace(" )", ")");
    text.replace("( ", "(")
}

fn needs_space_before_token(previous: &str, token: &str) -> bool {
    if let Some(ch) = previous.chars().last() {
        !ch.is_whitespace()
            && !":;,(".contains(ch)
            && token.starts_with(|c: char| c.is_alphanumeric())
    } else {
        false
    }
}

fn number_after_usr(line: &[u8], start: usize) -> Option<u16> {
    let mut digits = Vec::new();
    let mut index = start;
    while index < line.len() {
        let byte = line[index];
        if byte == 0x0E {
            index += 6;
            continue;
        }
        if (0x30..=0x39).contains(&byte) {
            digits.push(byte);
        } else if !digits.is_empty() {
            break;
        } else if byte != 0x20 && byte != b'(' {
            break;
        }
        index += 1;
    }
    if digits.is_empty() {
        return None;
    }
    let s = String::from_utf8(digits).ok()?;
    let value: u16 = s.parse().ok()?;
    Some(value)
}

struct TapDocument {
    source: Option<String>,
    block_count: usize,
    tap_order: Vec<TapOrderEntry>,
    headers: Vec<Header>,
    segments: Vec<SegmentEntry>,
    data_blocks: Vec<DataBlockEntry>,
    raw_blocks: Vec<RawBlockEntry>,
    entry: Option<u16>,
    entry_candidates: Vec<EntryCandidate>,
    warnings: Vec<String>,
    tap_sha256: String,
}

struct TapOrderEntry {
    block_index: usize,
    section: String,
    kind: String,
    name: String,
    header_name: String,
    type_name: String,
    addr: Option<u16>,
    len: Option<u16>,
    role: String,
    flag: Option<u8>,
    payload_len: Option<usize>,
}

struct EntryCandidate {
    line: u16,
    addr: u16,
}

fn load_tap(data: &[u8], source_name: &str, include_source: bool) -> Result<TapDocument, String> {
    let sha256_hex = hex_sha256(data);
    let blocks = parse_tap(data)?;
    let mut headers = Vec::new();
    let mut segments = Vec::new();
    let mut data_blocks = Vec::new();
    let mut raw_blocks = Vec::new();
    let mut warnings = Vec::new();
    let mut pending_header: Option<Header> = None;
    let mut entry_candidates = Vec::new();

    for (index, block) in blocks.iter().enumerate() {
        if let Some(header) = header_from_block(block, index) {
            pending_header = Some(header.clone());
            headers.push(header);
            continue;
        }

        if block.flag != 0xFF {
            raw_blocks.push(RawBlockEntry {
                block_index: index,
                flag: block.flag,
                payload_len: block.data.len(),
                tap_len: block.tap_len,
                checksum: block.checksum,
                checksum_ok: block.checksum_ok,
                role: "multiload_or_custom_data".to_string(),
                bytes: block.data.clone(),
            });
            warnings.push(format!(
                "block {} has non-standard data flag 0x{:02X}; preserved in raw_blocks",
                index, block.flag
            ));
            pending_header = None;
            continue;
        }

        let payload = &block.data;
        let Some(ref header) = pending_header else {
            raw_blocks.push(RawBlockEntry {
                block_index: index,
                flag: block.flag,
                payload_len: payload.len(),
                tap_len: block.tap_len,
                checksum: block.checksum,
                checksum_ok: block.checksum_ok,
                role: "headerless_data".to_string(),
                bytes: payload.clone(),
            });
            warnings.push(format!(
                "block {} is a data block without a preceding header; preserved in raw_blocks",
                index
            ));
            continue;
        };

        let declared_len = header.length as usize;
        if payload.len() != declared_len {
            warnings.push(format!(
                "block {} data length {} does not match header length {}",
                index,
                payload.len(),
                declared_len
            ));
        }

        if header.type_name == "code" {
            let addr = header.param1;
            let end = addr as u32 + payload.len() as u32;
            if addr < RAM_START || end > RAM_END {
                warnings.push(format!(
                    "CODE block {} at 0x{:04X} length {} is not wholly in 48K RAM",
                    index,
                    addr,
                    payload.len()
                ));
            }
            let start_clip = (addr as u32).max(RAM_START as u32);
            let end_clip = end.min(RAM_END);
            if start_clip < end_clip {
                let data_start = (start_clip - addr as u32) as usize;
                let data_end = (end_clip - addr as u32) as usize;
                if data_start < payload.len() && data_end <= payload.len() {
                    let chunk = payload[data_start..data_end].to_vec();
                    segments.push(SegmentEntry {
                        name: format!(
                            "tap_code_{}_{}",
                            segments.len(),
                            if header.name.is_empty() {
                                "unnamed"
                            } else {
                                &header.name
                            }
                        ),
                        addr: start_clip as u16,
                        len: chunk.len() as u16,
                        bytes: chunk,
                        source_block: index,
                        header_name: header.name.clone(),
                    });
                }
            }
        } else if header.type_name == "program" {
            let usr_numbers = basic_usr_numbers(payload);
            entry_candidates.extend(usr_numbers);
            data_blocks.push(DataBlockEntry {
                name: format!(
                    "tap_program_{}_{}",
                    data_blocks.len(),
                    if header.name.is_empty() {
                        "unnamed"
                    } else {
                        &header.name
                    }
                ),
                type_name: header.type_name.clone(),
                source_block: index,
                header_name: header.name.clone(),
                len: payload.len() as u16,
                line: Some(header.param1),
                variables_offset: Some(header.param2),
                basic_lines: decode_basic_program(payload),
                bytes: payload.to_vec(),
                param1: None,
                param2: None,
            });
        } else {
            data_blocks.push(DataBlockEntry {
                name: format!(
                    "tap_{}_{}_{}",
                    header.type_name,
                    data_blocks.len(),
                    if header.name.is_empty() {
                        "unnamed"
                    } else {
                        &header.name
                    }
                ),
                type_name: header.type_name.clone(),
                source_block: index,
                header_name: header.name.clone(),
                len: payload.len() as u16,
                line: None,
                variables_offset: None,
                basic_lines: Vec::new(),
                bytes: payload.to_vec(),
                param1: Some(header.param1),
                param2: Some(header.param2),
            });
        }

        pending_header = None;
    }

    let entry = entry_candidates.last().map(|&(_, addr)| addr);
    let tap_order = build_tap_order(&headers, &segments, &data_blocks, &raw_blocks);

    Ok(TapDocument {
        source: if include_source && source_name != "-" {
            Some(
                Path::new(source_name)
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| source_name.to_string()),
            )
        } else {
            None
        },
        block_count: blocks.len(),
        tap_order,
        headers,
        segments,
        data_blocks,
        raw_blocks,
        entry,
        entry_candidates: entry_candidates
            .into_iter()
            .map(|(line, addr)| EntryCandidate { line, addr })
            .collect(),
        warnings,
        tap_sha256: sha256_hex,
    })
}

fn build_tap_order(
    headers: &[Header],
    segments: &[SegmentEntry],
    data_blocks: &[DataBlockEntry],
    raw_blocks: &[RawBlockEntry],
) -> Vec<TapOrderEntry> {
    let mut order = Vec::new();

    for header in headers {
        order.push(TapOrderEntry {
            block_index: header.block_index,
            section: "headers".to_string(),
            kind: "header".to_string(),
            name: header.name.clone(),
            header_name: String::new(),
            type_name: header.type_name.clone(),
            addr: None,
            len: None,
            role: String::new(),
            flag: None,
            payload_len: None,
        });
    }

    for block in data_blocks {
        order.push(TapOrderEntry {
            block_index: block.source_block,
            section: "data_blocks".to_string(),
            kind: block.type_name.clone(),
            name: block.name.clone(),
            header_name: block.header_name.clone(),
            type_name: String::new(),
            addr: None,
            len: None,
            role: String::new(),
            flag: None,
            payload_len: None,
        });
    }

    for segment in segments {
        order.push(TapOrderEntry {
            block_index: segment.source_block,
            section: "segments".to_string(),
            kind: "code".to_string(),
            name: segment.name.clone(),
            header_name: segment.header_name.clone(),
            type_name: String::new(),
            addr: Some(segment.addr),
            len: Some(segment.len),
            role: String::new(),
            flag: None,
            payload_len: None,
        });
    }

    for block in raw_blocks {
        order.push(TapOrderEntry {
            block_index: block.block_index,
            section: "raw_blocks".to_string(),
            kind: "raw".to_string(),
            name: String::new(),
            header_name: String::new(),
            type_name: String::new(),
            addr: None,
            len: None,
            role: block.role.clone(),
            flag: Some(block.flag),
            payload_len: Some(block.payload_len),
        });
    }

    order.sort_by_key(|entry| entry.block_index);
    order
}

fn hex_sha256(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    let result = hasher.finalize();
    format!("{:x}", result)
}

// ---- TOML output ----

fn render_toml(doc: &TapDocument) -> String {
    let mut out = Vec::new();

    append_scalar(&mut out, "format", FormatValue::Str(FORMAT_VERSION));
    append_scalar(&mut out, "machine", FormatValue::Str("zx-spectrum-48k"));
    if let Some(ref source) = doc.source {
        append_scalar(&mut out, "source", FormatValue::Str(source));
    }
    append_scalar(
        &mut out,
        "block_count",
        FormatValue::HexUsize(doc.block_count),
    );
    if let Some(entry) = doc.entry {
        append_scalar(&mut out, "entry", FormatValue::from_int(entry));
    }
    append_scalar(&mut out, "tap_sha256", FormatValue::Str(&doc.tap_sha256));

    // tvc_bridge
    out.push(String::new());
    out.push("[tvc_bridge]".to_string());
    append_scalar(&mut out, "main_map_port_02", FormatValue::Hex8(0xB4));
    append_scalar(&mut out, "video_page_port_0c", FormatValue::Hex8(0x00));
    append_scalar(&mut out, "video_mode_port_06", FormatValue::Hex8(0x00));

    for mapping in &[
        (0x4000, 0x7FFF, "vid0"),
        (0x8000, 0xBFFF, "u2"),
        (0xC000, 0xFFFF, "u3"),
    ] {
        out.push(String::new());
        out.push("[[tvc_bridge.segment_mapping]]".to_string());
        append_scalar(&mut out, "addr_start", FormatValue::Hex16(mapping.0));
        append_scalar(&mut out, "addr_end", FormatValue::Hex16(mapping.1));
        append_scalar(&mut out, "suggested_tvc_bank", FormatValue::Str(mapping.2));
    }

    // tap_order
    for entry in &doc.tap_order {
        out.push(String::new());
        out.push("[[tap_order]]".to_string());
        append_scalar(
            &mut out,
            "block_index",
            FormatValue::HexUsize(entry.block_index),
        );
        append_scalar(&mut out, "section", FormatValue::Str(&entry.section));
        append_scalar(&mut out, "kind", FormatValue::Str(&entry.kind));

        if !entry.name.is_empty() {
            append_scalar(&mut out, "name", FormatValue::Str(&entry.name));
        }
        if entry.kind == "header" {
            append_scalar(&mut out, "type", FormatValue::Str(&entry.type_name));
        }
        if !entry.header_name.is_empty() {
            append_scalar(
                &mut out,
                "header_name",
                FormatValue::Str(&entry.header_name),
            );
        }
        if let Some(addr) = entry.addr {
            append_scalar(&mut out, "addr", FormatValue::from_int(addr));
        }
        if let Some(len) = entry.len {
            append_scalar(&mut out, "len", FormatValue::from_int(len));
        }
        if !entry.role.is_empty() {
            append_scalar(&mut out, "role", FormatValue::Str(&entry.role));
        }
        if let Some(flag) = entry.flag {
            append_scalar(&mut out, "flag", FormatValue::Hex8(flag));
        }
        if let Some(plen) = entry.payload_len {
            append_scalar(&mut out, "payload_len", FormatValue::from_int(plen as u16));
        }
    }

    // headers
    for h in &doc.headers {
        out.push(String::new());
        out.push("[[headers]]".to_string());
        append_scalar(&mut out, "type", FormatValue::Str(&h.type_name));
        append_scalar(&mut out, "type_id", FormatValue::Hex8(h.type_id));
        append_scalar(&mut out, "name", FormatValue::Str(&h.name));
        append_scalar(&mut out, "length", FormatValue::from_int(h.length));
        append_scalar(&mut out, "param1", FormatValue::from_int(h.param1));
        append_scalar(&mut out, "param2", FormatValue::from_int(h.param2));
        append_scalar(&mut out, "checksum_ok", FormatValue::Bool(h.checksum_ok));
        append_scalar(
            &mut out,
            "block_index",
            FormatValue::HexUsize(h.block_index),
        );
    }

    // entry_candidates
    for ec in &doc.entry_candidates {
        out.push(String::new());
        out.push("[[entry_candidates]]".to_string());
        append_scalar(&mut out, "line", FormatValue::from_int(ec.line));
        append_scalar(&mut out, "addr", FormatValue::from_int(ec.addr));
    }

    // warnings
    out.push(String::new());
    {
        let items: Vec<String> = doc
            .warnings
            .iter()
            .map(|w| format!("\"{}\"", escape_toml_string(w)))
            .collect();
        out.push(format!("warnings = [{}]", items.join(", ")));
    }

    // segments
    for seg in &doc.segments {
        out.push(String::new());
        out.push("[[segments]]".to_string());
        append_scalar(&mut out, "name", FormatValue::Str(&seg.name));
        append_scalar(&mut out, "addr", FormatValue::from_int(seg.addr));
        append_scalar(&mut out, "len", FormatValue::from_int(seg.len));
        append_scalar(
            &mut out,
            "source_block",
            FormatValue::HexUsize(seg.source_block),
        );
        append_scalar(&mut out, "header_name", FormatValue::Str(&seg.header_name));
        append_bytes(&mut out, "bytes", &seg.bytes);
    }

    // data_blocks
    for db in &doc.data_blocks {
        out.push(String::new());
        out.push("[[data_blocks]]".to_string());
        append_scalar(&mut out, "name", FormatValue::Str(&db.name));
        append_scalar(&mut out, "type", FormatValue::Str(&db.type_name));
        append_scalar(
            &mut out,
            "source_block",
            FormatValue::HexUsize(db.source_block),
        );
        append_scalar(&mut out, "header_name", FormatValue::Str(&db.header_name));
        append_scalar(&mut out, "len", FormatValue::from_int(db.len));
        if let Some(line) = db.line {
            append_scalar(&mut out, "line", FormatValue::from_int(line));
        }
        if let Some(vo) = db.variables_offset {
            append_scalar(&mut out, "variables_offset", FormatValue::from_int(vo));
        }
        if !db.basic_lines.is_empty() {
            let items: Vec<String> = db
                .basic_lines
                .iter()
                .map(|bl| format!("\"{}\"", bl.replace('\\', "\\\\").replace('"', "\\\"")))
                .collect();
            out.push(format!("basic_lines = [{}]", items.join(", ")));
        }
        if let Some(p1) = db.param1 {
            append_scalar(&mut out, "param1", FormatValue::from_int(p1));
        }
        if let Some(p2) = db.param2 {
            append_scalar(&mut out, "param2", FormatValue::from_int(p2));
        }
        append_bytes(&mut out, "bytes", &db.bytes);
    }

    // raw_blocks
    for rb in &doc.raw_blocks {
        out.push(String::new());
        out.push("[[raw_blocks]]".to_string());
        append_scalar(
            &mut out,
            "block_index",
            FormatValue::HexUsize(rb.block_index),
        );
        append_scalar(&mut out, "flag", FormatValue::Hex8(rb.flag));
        append_scalar(
            &mut out,
            "payload_len",
            FormatValue::from_int(rb.payload_len as u16),
        );
        append_scalar(&mut out, "tap_len", FormatValue::from_int(rb.tap_len));
        append_scalar(&mut out, "checksum", FormatValue::Hex8(rb.checksum));
        append_scalar(&mut out, "checksum_ok", FormatValue::Bool(rb.checksum_ok));
        append_scalar(&mut out, "role", FormatValue::Str(&rb.role));
        append_bytes(&mut out, "bytes", &rb.bytes);
    }

    out.join("\n") + "\n"
}

enum FormatValue<'a> {
    Str(&'a str),
    Hex8(u8),
    Hex16(u16),
    HexUsize(usize),
    Bool(bool),
}

impl<'a> FormatValue<'a> {
    fn from_int(value: u16) -> Self {
        if value <= 0xFF {
            FormatValue::Hex8(value as u8)
        } else {
            FormatValue::Hex16(value)
        }
    }
}

fn append_scalar(out: &mut Vec<String>, key: &str, value: FormatValue) {
    let rendered = match value {
        FormatValue::Str(s) => format!(
            "{} = \"{}\"",
            key,
            s.replace('\\', "\\\\").replace('"', "\\\"")
        ),
        FormatValue::Hex8(v) => format!("{} = 0x{:02X}", key, v),
        FormatValue::Hex16(v) => format!("{} = 0x{:04X}", key, v),
        FormatValue::HexUsize(v) => {
            let width = if v <= 0xFF { 2 } else { 4 };
            format!("{} = 0x{:0width$X}", key, v, width = width)
        }
        FormatValue::Bool(v) => {
            format!("{} = {}", key, if v { "true" } else { "false" })
        }
    };
    out.push(rendered);
}

fn escape_toml_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
}

fn append_bytes(out: &mut Vec<String>, key: &str, values: &[u8]) {
    out.push(format!("{key} = ["));
    for chunk in values.chunks(BYTES_PER_ROW) {
        let hex_part: Vec<String> = chunk.iter().map(|b| format!("0x{b:02X}")).collect();
        let body = hex_part.join(", ");
        let body = if chunk.is_empty() { body } else { body + "," };
        let ascii: String = chunk
            .iter()
            .map(|b| {
                if (0x20..=0x7E).contains(b) {
                    *b as char
                } else {
                    '.'
                }
            })
            .collect();
        out.push(format!("  {body:<95} # |{ascii}|"));
    }
    out.push("]".to_string());
}

const SPECTRUM_TOKENS: &[(u8, &str)] = &[
    (0xA5, "RND"),
    (0xA6, "INKEY$"),
    (0xA7, "PI"),
    (0xA8, "FN"),
    (0xA9, "POINT"),
    (0xAA, "SCREEN$"),
    (0xAB, "ATTR"),
    (0xAC, "AT"),
    (0xAD, "TAB"),
    (0xAE, "VAL$"),
    (0xAF, "CODE"),
    (0xB0, "VAL"),
    (0xB1, "LEN"),
    (0xB2, "SIN"),
    (0xB3, "COS"),
    (0xB4, "TAN"),
    (0xB5, "ASN"),
    (0xB6, "ACS"),
    (0xB7, "ATN"),
    (0xB8, "LN"),
    (0xB9, "EXP"),
    (0xBA, "INT"),
    (0xBB, "SQR"),
    (0xBC, "SGN"),
    (0xBD, "ABS"),
    (0xBE, "PEEK"),
    (0xBF, "IN"),
    (0xC0, "USR"),
    (0xC1, "STR$"),
    (0xC2, "CHR$"),
    (0xC3, "NOT"),
    (0xC4, "BIN"),
    (0xC5, "OR"),
    (0xC6, "AND"),
    (0xC7, "<="),
    (0xC8, ">="),
    (0xC9, "<>"),
    (0xCA, "LINE"),
    (0xCB, "THEN"),
    (0xCC, "TO"),
    (0xCD, "STEP"),
    (0xCE, "DEF FN"),
    (0xCF, "CAT"),
    (0xD0, "FORMAT"),
    (0xD1, "MOVE"),
    (0xD2, "ERASE"),
    (0xD3, "OPEN #"),
    (0xD4, "CLOSE #"),
    (0xD5, "MERGE"),
    (0xD6, "VERIFY"),
    (0xD7, "BEEP"),
    (0xD8, "CIRCLE"),
    (0xD9, "INK"),
    (0xDA, "PAPER"),
    (0xDB, "FLASH"),
    (0xDC, "BRIGHT"),
    (0xDD, "INVERSE"),
    (0xDE, "OVER"),
    (0xDF, "OUT"),
    (0xE0, "LPRINT"),
    (0xE1, "LLIST"),
    (0xE2, "STOP"),
    (0xE3, "READ"),
    (0xE4, "DATA"),
    (0xE5, "RESTORE"),
    (0xE6, "NEW"),
    (0xE7, "BORDER"),
    (0xE8, "CONTINUE"),
    (0xE9, "DIM"),
    (0xEA, "REM"),
    (0xEB, "FOR"),
    (0xEC, "GO TO"),
    (0xED, "GO SUB"),
    (0xEE, "INPUT"),
    (0xEF, "LOAD"),
    (0xF0, "LIST"),
    (0xF1, "LET"),
    (0xF2, "PAUSE"),
    (0xF3, "NEXT"),
    (0xF4, "POKE"),
    (0xF5, "PRINT"),
    (0xF6, "PLOT"),
    (0xF7, "RUN"),
    (0xF8, "SAVE"),
    (0xF9, "RANDOMIZE"),
    (0xFA, "IF"),
    (0xFB, "CLS"),
    (0xFC, "DRAW"),
    (0xFD, "CLEAR"),
    (0xFE, "RETURN"),
    (0xFF, "COPY"),
];
