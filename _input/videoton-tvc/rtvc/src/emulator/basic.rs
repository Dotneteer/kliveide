use std::fmt;

const TOKEN_BASE: u8 = 0xFE;
const TOKEN_DATA: u8 = 0xFB;
const TOKEN_REM: u8 = 0xFC;
const LINE_NUMBER_MAX: u16 = 9999;
const MAX_ENCODED_LINE: usize = 255;
// BASIC 1.2's FC8EH memory check requires TOP + 0100H <= IY.
// On an unreserved 64K machine, TEXT is 19EFH and IY starts at HIMEM=BFFFH.
// TOP follows the program's 00H terminator; variables need additional space.
const MAX_PROGRAM_BYTES: usize = 0xBFFF - 0x19EF - 0x0100;

/// Keywords from BASIC 1.2 `BASIC_KEYWORD_TABLE` at SYS `DE6DH`, ordered by
/// descending token value. Index 0 is token `FEH`. Unused ROM slots are stored
/// as `"!"`.
const KEYWORDS: &[&str] = &[
    "!",
    ":",
    "REM",
    "DATA",
    "CLOSE",
    "CLS",
    "CONTINUE",
    "DEF",
    "DELETE",
    "DIM",
    "ELSE",
    "END",
    "FOR",
    "GET",
    "GOSUB",
    "GOTO",
    "GRAPHICS",
    "IF",
    "INPUT",
    "LET",
    "LIST",
    "LLIST",
    "LOAD",
    "LOMEM",
    "NEW",
    "NEXT",
    "OK",
    "ON",
    "OPEN",
    "OUTPUT",
    "OUT",
    "PLOT",
    "POKE",
    "PRINT",
    "RANDOMIZE",
    "READ",
    "RESTORE",
    "RETURN",
    "RUN",
    "SAVE",
    "SET",
    "SOUND",
    "STOP",
    "TRACE",
    "VERIFY",
    "EXT",
    "LPRINT",
    "!",
    "!",
    "!",
    "!",
    "!",
    "!",
    "AND",
    "CHARACTER",
    "DELAY",
    "DURATION",
    "INKEY$",
    "INK",
    "MODE",
    "NOT",
    "OFF",
    "ORD",
    "OR",
    "PAINT",
    "PALETTE",
    "PAPER",
    "PITCH",
    "PROMPT",
    "RATE",
    "STEP",
    "STYLE",
    "TAB",
    "THEN",
    "TO",
    "VOLUME",
    "XOR",
    "ATN",
    "AT",
    "USING",
    "BORDER",
    "!",
    "!",
    "!",
    "!",
    "!",
    "*",
    "#",
    "=>",
    "><",
    ",",
    "=<",
    "-",
    "/",
    ";",
    "^",
    ">=",
    "<>",
    ">",
    "<=",
    "=",
    "<",
    "+",
    "&",
    "(",
    ")",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BasicError {
    pub line: Option<usize>,
    pub message: String,
}

impl BasicError {
    fn new(line: Option<usize>, message: impl Into<String>) -> Self {
        Self {
            line,
            message: message.into(),
        }
    }
}

impl fmt::Display for BasicError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.line {
            Some(line) => write!(f, "line {line}: {}", self.message),
            None => f.write_str(&self.message),
        }
    }
}

impl std::error::Error for BasicError {}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CopyMode {
    Normal,
    String,
    Data { quoted: bool },
    Literal,
}

struct SourceLine {
    source_line: usize,
    number: u16,
    body: String,
}

/// Tokenize TVC BASIC source into the in-memory / CAS payload format used at
/// `19EFH`: length-prefixed lines ending with `FFH`, then a `00H` terminator.
pub fn tokenize_program(source: &str) -> Result<Vec<u8>, BasicError> {
    let mut lines = parse_source(source)?;
    lines.sort_by_key(|line| line.number);
    for pair in lines.windows(2) {
        if pair[0].number == pair[1].number {
            return Err(BasicError::new(
                Some(pair[1].source_line),
                format!("duplicate line number {}", pair[1].number),
            ));
        }
    }

    let mut out = Vec::new();
    for line in &lines {
        let body = tokenize_body(&line.body)
            .map_err(|message| BasicError::new(Some(line.source_line), message))?;
        let total = 3 + body.len();
        if total > MAX_ENCODED_LINE {
            return Err(BasicError::new(
                Some(line.source_line),
                format!("encoded line exceeds {MAX_ENCODED_LINE} bytes"),
            ));
        }
        out.push(total as u8);
        out.extend_from_slice(&line.number.to_le_bytes());
        out.extend_from_slice(&body);
        if out.len() >= MAX_PROGRAM_BYTES {
            return Err(BasicError::new(
                Some(line.source_line),
                format!(
                    "program exceeds the {MAX_PROGRAM_BYTES}-byte BASIC memory limit (64K TVC; runtime variables need additional space)"
                ),
            ));
        }
    }
    out.push(0x00);
    Ok(out)
}

/// Reconstruct numbered BASIC source from a tokenized program payload.
pub fn detokenize_program(bytes: &[u8]) -> Result<String, BasicError> {
    let mut out = String::new();
    let mut offset = 0;
    while offset < bytes.len() {
        let len = bytes[offset] as usize;
        if len == 0 {
            break;
        }
        if len < 4 || offset + len > bytes.len() {
            return Err(BasicError::new(None, "truncated BASIC line"));
        }
        if bytes[offset + len - 1] != 0xFF {
            return Err(BasicError::new(
                None,
                "BASIC line is missing FFH terminator",
            ));
        }
        let number = u16::from_le_bytes([bytes[offset + 1], bytes[offset + 2]]);
        let body = detokenize_body(&bytes[offset + 3..offset + len - 1])?;
        if !out.is_empty() {
            out.push('\n');
        }
        if body.is_empty() {
            out.push_str(&number.to_string());
        } else {
            out.push_str(&format!("{number} {body}"));
        }
        offset += len;
    }
    if offset >= bytes.len() || bytes[offset] != 0x00 {
        return Err(BasicError::new(
            None,
            "BASIC program is missing 00H terminator",
        ));
    }
    if !out.is_empty() {
        out.push('\n');
    }
    Ok(out)
}

pub fn keyword_for_token(token: u8) -> Option<&'static str> {
    let index = TOKEN_BASE.checked_sub(token)? as usize;
    KEYWORDS.get(index).copied()
}

fn parse_source(source: &str) -> Result<Vec<SourceLine>, BasicError> {
    let mut lines = Vec::new();
    for (index, raw) in source.lines().enumerate() {
        let source_line = index + 1;
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            continue;
        }
        let (number, rest) = parse_line_number(trimmed)
            .map_err(|message| BasicError::new(Some(source_line), message))?;
        lines.push(SourceLine {
            source_line,
            number,
            body: rest.trim_start().to_string(),
        });
    }
    Ok(lines)
}

fn parse_line_number(line: &str) -> Result<(u16, &str), String> {
    let bytes = line.as_bytes();
    if !bytes.first().is_some_and(u8::is_ascii_digit) {
        return Err("expected a line number".to_string());
    }
    let mut value = 0u32;
    let mut index = 0;
    while index < bytes.len() && bytes[index].is_ascii_digit() {
        value = value * 10 + u32::from(bytes[index] - b'0');
        if value > u32::from(LINE_NUMBER_MAX) {
            return Err(format!("line number must be 1-{LINE_NUMBER_MAX}"));
        }
        index += 1;
    }
    if value == 0 {
        return Err(format!("line number must be 1-{LINE_NUMBER_MAX}"));
    }
    Ok((value as u16, &line[index..]))
}

fn tokenize_body(body: &str) -> Result<Vec<u8>, String> {
    if !body.is_ascii() {
        return Err("non-ASCII characters are not supported".to_string());
    }
    let src = body.as_bytes();
    let mut out = Vec::new();
    let mut index = 0;
    let mut copy = CopyMode::Normal;
    while index < src.len() {
        match copy {
            CopyMode::Normal => {
                if src[index] == b'"' {
                    out.push(b'"');
                    index += 1;
                    copy = CopyMode::String;
                    continue;
                }
                if let Some((token, len)) = match_keyword(&src[index..]) {
                    let stored = canonical_token(token);
                    out.push(stored);
                    index += len;
                    if token == TOKEN_REM || token == TOKEN_BASE {
                        copy = CopyMode::Literal;
                    } else if token == TOKEN_DATA {
                        copy = CopyMode::Data { quoted: false };
                    }
                    continue;
                }
                let mut ch = src[index];
                if ch.is_ascii_lowercase() {
                    ch = ch.to_ascii_uppercase();
                }
                out.push(ch);
                index += 1;
            }
            CopyMode::String => {
                out.push(src[index]);
                if src[index] == b'"' {
                    copy = CopyMode::Normal;
                }
                index += 1;
            }
            CopyMode::Data { quoted } => {
                let ch = src[index];
                if ch == b':' && !quoted {
                    out.push(0xFD);
                    copy = CopyMode::Normal;
                } else {
                    out.push(ch);
                    if ch == b'"' {
                        copy = CopyMode::Data { quoted: !quoted };
                    }
                }
                index += 1;
            }
            CopyMode::Literal => {
                out.push(src[index]);
                index += 1;
            }
        }
    }
    out.push(0xFF);
    Ok(out)
}

fn match_keyword(input: &[u8]) -> Option<(u8, usize)> {
    KEYWORDS.iter().enumerate().find_map(|(index, keyword)| {
        let needle = keyword.as_bytes();
        if input.len() >= needle.len() && input[..needle.len()].eq_ignore_ascii_case(needle) {
            Some((TOKEN_BASE - index as u8, needle.len()))
        } else {
            None
        }
    })
}

fn canonical_token(token: u8) -> u8 {
    match token {
        0xA6 | 0xA5 | 0xA3 => token - 8,
        _ => token,
    }
}

fn detokenize_body(bytes: &[u8]) -> Result<String, BasicError> {
    let mut out = String::new();
    for &byte in bytes {
        if let Some(keyword) = keyword_for_token(byte) {
            out.push_str(keyword);
        } else if (0x20..=0x7E).contains(&byte) {
            out.push(byte as char);
        } else {
            return Err(BasicError::new(
                None,
                format!("unsupported BASIC byte {byte:02X}H"),
            ));
        }
    }
    Ok(out)
}

#[cfg(test)]
#[path = "basic_tests.rs"]
mod tests;
