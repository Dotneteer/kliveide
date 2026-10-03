use std::{collections::BTreeMap, fmt};

const TVC_BASIC_LOAD_ADDR: u16 = 0x19EF;
const TVC_BASIC_USR_ENTRY: u16 = 0x1A30;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AsmError {
    message: String,
}

impl AsmError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

impl fmt::Display for AsmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for AsmError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssembledProgram {
    pub origin: u16,
    pub bytes: Vec<u8>,
    pub segments: Vec<AssembledSegment>,
    pub symbols: BTreeMap<String, u16>,
    pub mappings: Vec<AsmMapping>,
    pub lines: Vec<AssembledLine>,
    pub next_addr: u16,
}

/// A named address transformation captured at an `ORG` declaration.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AsmMapping {
    pub name: String,
    pub source_base: u16,
    pub mapped_base: u16,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssembledSegment {
    pub addr: u16,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AssembledLine {
    pub line: usize,
    pub addr: u16,
    pub len: usize,
    pub source: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedLine {
    line_no: usize,
    source: String,
    labels: Vec<String>,
    statement: Statement,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Statement {
    Empty,
    Org {
        address: String,
        mappings: Vec<(String, String)>,
    },
    BasicStart,
    Equ {
        label: String,
        expr: String,
    },
    Bytes(Vec<ByteValue>),
    Words(Vec<String>),
    Space {
        count: String,
        fill: Option<String>,
    },
    Instruction(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ByteValue {
    Expr(String),
    String(Vec<u8>),
}

/// Assemble one Z80 instruction at `pc`.
///
/// The program counter is needed for the relative displacement used by JR and
/// DJNZ. Labels, expressions, macros, and multi-line source are intentionally
/// outside this small assembler's scope.
pub fn assemble_line(source: &str, pc: u16) -> Result<Vec<u8>, AsmError> {
    let source = source.split(';').next().unwrap_or("").trim();
    if source.is_empty() {
        return Err(AsmError::new("empty assembly line"));
    }

    let split = source.find(char::is_whitespace).unwrap_or(source.len());
    let mnemonic = source[..split].to_ascii_uppercase();
    let operands = split_operands(source[split..].trim())?;
    let ops: Vec<String> = operands.iter().map(|op| normalize(op)).collect();
    let op: Vec<&str> = ops.iter().map(String::as_str).collect();

    let bytes = match mnemonic.as_str() {
        "DB" | "DEFB" => assemble_db(&op)?,
        "LD" => assemble_ld(&op)?,
        "INC" => assemble_inc_dec(&op, false)?,
        "DEC" => assemble_inc_dec(&op, true)?,
        "ADD" => assemble_add(&op)?,
        "ADC" => assemble_adc_sbc(&op, false)?,
        "SBC" => assemble_adc_sbc(&op, true)?,
        "SUB" => assemble_alu(&op, 2)?,
        "AND" => assemble_alu(&op, 4)?,
        "XOR" => assemble_alu(&op, 5)?,
        "OR" => assemble_alu(&op, 6)?,
        "CP" => assemble_alu(&op, 7)?,
        "JP" => assemble_jp(&op)?,
        "JR" => assemble_jr(&op, pc)?,
        "DJNZ" => {
            expect_count(&op, 1)?;
            vec![0x10, relative(op[0], pc)?]
        }
        "CALL" => assemble_call(&op)?,
        "RET" => assemble_ret(&op)?,
        "RST" => assemble_rst(&op)?,
        "PUSH" => assemble_push_pop(&op, true)?,
        "POP" => assemble_push_pop(&op, false)?,
        "EX" => assemble_ex(&op)?,
        "IN" => assemble_in(&op)?,
        "OUT" => assemble_out(&op)?,
        "IM" => assemble_im(&op)?,
        "BIT" => assemble_bit(&op, 1)?,
        "RES" => assemble_bit(&op, 2)?,
        "SET" => assemble_bit(&op, 3)?,
        "RLC" => assemble_rotate(&op, 0)?,
        "RRC" => assemble_rotate(&op, 1)?,
        "RL" => assemble_rotate(&op, 2)?,
        "RR" => assemble_rotate(&op, 3)?,
        "SLA" => assemble_rotate(&op, 4)?,
        "SRA" => assemble_rotate(&op, 5)?,
        "SLL" => assemble_rotate(&op, 6)?,
        "SRL" => assemble_rotate(&op, 7)?,
        _ => assemble_fixed(&mnemonic, &op)?,
    };

    Ok(bytes)
}

/// Assemble a small Z80 source block at `origin`.
///
/// This two-pass layer is intended for debugger helper code and porting shims,
/// not as a full macro assembler. It supports labels, `ORG` with named address
/// mappings, `EQU`, `DB`/`DEFB`, `DW`/`DEFW`, `DS`/`DEFS`, simple `+`/`-`
/// expressions, and `$` as the current address. Instruction encoding is
/// delegated to [`assemble_line`].
pub fn assemble_program(source: &str, origin: u16) -> Result<AssembledProgram, AsmError> {
    let parsed: Vec<_> = source
        .lines()
        .enumerate()
        .map(|(index, line)| parse_program_line(index + 1, line))
        .collect::<Result<_, _>>()?;

    let mut symbols = BTreeMap::new();
    let mut mappings = Vec::new();
    let mut mappings_by_name = BTreeMap::new();
    let mut pc = origin;

    for line in &parsed {
        if !matches!(line.statement, Statement::Equ { .. }) {
            for label in &line.labels {
                insert_symbol(&mut symbols, label, pc, line.line_no)?;
            }
        }

        match &line.statement {
            Statement::Empty => {}
            Statement::Org {
                address,
                mappings: declarations,
            } => {
                pc = eval_word(address, pc, &symbols, &mappings_by_name, false, 0)
                    .map_err(|err| line_error(line.line_no, err))?;
                for (name, mapped_address) in declarations {
                    if mappings_by_name.contains_key(name) {
                        return Err(line_error(
                            line.line_no,
                            AsmError::new(format!("duplicate mapping '{name}'")),
                        ));
                    }
                    let mapped_base =
                        eval_word(mapped_address, pc, &symbols, &mappings_by_name, false, 0)
                            .map_err(|err| line_error(line.line_no, err))?;
                    let mapping = AsmMapping {
                        name: name.clone(),
                        source_base: pc,
                        mapped_base,
                    };
                    mappings_by_name.insert(name.clone(), mapping.clone());
                    mappings.push(mapping);
                }
            }
            Statement::BasicStart => {
                insert_symbol(
                    &mut symbols,
                    "BASIC_START",
                    TVC_BASIC_USR_ENTRY,
                    line.line_no,
                )?;
                pc = TVC_BASIC_USR_ENTRY;
            }
            Statement::Equ { label, expr } => {
                let value = eval_word(expr, pc, &symbols, &mappings_by_name, false, 0)
                    .map_err(|err| line_error(line.line_no, err))?;
                insert_symbol(&mut symbols, label, value, line.line_no)?;
            }
            Statement::Bytes(values) => {
                pc = pc.wrapping_add(byte_values_len(values)? as u16);
            }
            Statement::Words(values) => {
                pc = pc.wrapping_add(values.len().wrapping_mul(2) as u16);
            }
            Statement::Space { count, .. } => {
                let count = eval_nonnegative(count, pc, &symbols, &mappings_by_name, false, 0)
                    .map_err(|err| line_error(line.line_no, err))?;
                pc = pc.wrapping_add(count as u16);
            }
            Statement::Instruction(statement) => {
                let rendered = render_instruction(statement, pc, &symbols, &mappings_by_name, true)
                    .map_err(|err| line_error(line.line_no, err))?;
                let bytes =
                    assemble_line(&rendered, pc).map_err(|err| line_error(line.line_no, err))?;
                pc = pc.wrapping_add(bytes.len() as u16);
            }
        }
    }

    let mut bytes = Vec::new();
    let mut segments = Vec::new();
    let mut lines = Vec::new();
    pc = origin;

    for line in &parsed {
        let addr = pc;
        let emitted = match &line.statement {
            Statement::Empty => Vec::new(),
            Statement::Org { address, .. } => {
                pc = eval_word(address, pc, &symbols, &mappings_by_name, false, 0)
                    .map_err(|err| line_error(line.line_no, err))?;
                Vec::new()
            }
            Statement::BasicStart => {
                pc = TVC_BASIC_LOAD_ADDR;
                tvc_basic_start_bytes()
            }
            Statement::Equ { .. } => Vec::new(),
            Statement::Bytes(values) => emit_byte_values(values, pc, &symbols, &mappings_by_name)
                .map_err(|err| line_error(line.line_no, err))?,
            Statement::Words(values) => {
                let mut out = Vec::with_capacity(values.len() * 2);
                for value in values {
                    let value = eval_word(value, pc, &symbols, &mappings_by_name, false, 0)
                        .map_err(|err| line_error(line.line_no, err))?;
                    push_word(&mut out, value);
                }
                out
            }
            Statement::Space { count, fill } => {
                let count = eval_nonnegative(count, pc, &symbols, &mappings_by_name, false, 0)
                    .map_err(|err| line_error(line.line_no, err))?;
                let fill = match fill {
                    Some(fill) => eval_byte(fill, pc, &symbols, &mappings_by_name, false, 0)
                        .map_err(|err| line_error(line.line_no, err))?,
                    None => 0,
                };
                vec![fill; count]
            }
            Statement::Instruction(statement) => {
                let rendered =
                    render_instruction(statement, pc, &symbols, &mappings_by_name, false)
                        .map_err(|err| line_error(line.line_no, err))?;
                assemble_line(&rendered, pc).map_err(|err| line_error(line.line_no, err))?
            }
        };

        if !emitted.is_empty() {
            emit_segment(&mut segments, pc, &emitted);
            bytes.extend_from_slice(&emitted);
            let line_addr = if matches!(line.statement, Statement::BasicStart) {
                TVC_BASIC_LOAD_ADDR
            } else {
                addr
            };
            lines.push(AssembledLine {
                line: line.line_no,
                addr: line_addr,
                len: emitted.len(),
                source: line.source.clone(),
            });
            pc = pc.wrapping_add(emitted.len() as u16);
        }
    }

    Ok(AssembledProgram {
        origin: segments
            .first()
            .map(|segment| segment.addr)
            .unwrap_or(origin),
        bytes,
        segments,
        symbols,
        mappings,
        lines,
        next_addr: pc,
    })
}

fn parse_program_line(line_no: usize, source: &str) -> Result<ParsedLine, AsmError> {
    let clean = strip_comment(source)?;
    let mut rest = clean.trim();
    let mut labels = Vec::new();

    while let Some((label, after)) = take_colon_label(rest)? {
        labels.push(label);
        rest = after.trim_start();
    }

    let statement = parse_statement(rest, &labels).map_err(|err| line_error(line_no, err))?;
    Ok(ParsedLine {
        line_no,
        source: source.to_string(),
        labels,
        statement,
    })
}

fn parse_statement(source: &str, labels: &[String]) -> Result<Statement, AsmError> {
    if source.is_empty() {
        return Ok(Statement::Empty);
    }

    let (mnemonic, rest) = split_statement_head(source);
    let mnemonic_upper = mnemonic.to_ascii_uppercase();
    if mnemonic_upper == "EQU" {
        if labels.len() != 1 {
            return Err(AsmError::new("EQU requires exactly one label"));
        }
        if rest.trim().is_empty() {
            return Err(AsmError::new("EQU requires an expression"));
        }
        return Ok(Statement::Equ {
            label: labels[0].clone(),
            expr: rest.trim().to_string(),
        });
    }

    if labels.is_empty()
        && let Some((next, after_next)) = split_optional_head(rest)
        && next.eq_ignore_ascii_case("EQU")
    {
        validate_label(mnemonic)?;
        if after_next.trim().is_empty() {
            return Err(AsmError::new("EQU requires an expression"));
        }
        return Ok(Statement::Equ {
            label: mnemonic.to_ascii_uppercase(),
            expr: after_next.trim().to_string(),
        });
    }

    match mnemonic_upper.as_str() {
        "ORG" => {
            if rest.trim().is_empty() {
                return Err(AsmError::new("ORG requires an address"));
            }
            parse_org(rest)
        }
        "MAP" => Err(AsmError::new(
            "MAP is no longer supported; declare mappings on ORG",
        )),
        "BASIC_START" => {
            if !rest.trim().is_empty() {
                return Err(AsmError::new("BASIC_START takes no operands"));
            }
            Ok(Statement::BasicStart)
        }
        "DB" | "DEFB" => Ok(Statement::Bytes(parse_byte_values(rest)?)),
        "DW" | "DEFW" => Ok(Statement::Words(split_operands(rest)?)),
        "DS" | "DEFS" => {
            let operands = split_operands(rest)?;
            match operands.as_slice() {
                [count] => Ok(Statement::Space {
                    count: count.clone(),
                    fill: None,
                }),
                [count, fill] => Ok(Statement::Space {
                    count: count.clone(),
                    fill: Some(fill.clone()),
                }),
                _ => Err(AsmError::new("DS requires count and optional fill byte")),
            }
        }
        _ => Ok(Statement::Instruction(source.to_string())),
    }
}

fn parse_org(source: &str) -> Result<Statement, AsmError> {
    let operands = split_operands(source)?;
    if operands.is_empty() {
        return Err(AsmError::new("ORG requires an address"));
    }
    let mapping_operands = &operands[1..];
    if mapping_operands.len() % 2 != 0 {
        return Err(AsmError::new(
            "ORG mappings require a name and mapped address pair",
        ));
    }
    let mappings = mapping_operands
        .chunks_exact(2)
        .map(|pair| {
            validate_label(&pair[0])?;
            Ok((pair[0].to_ascii_uppercase(), pair[1].clone()))
        })
        .collect::<Result<Vec<_>, AsmError>>()?;
    Ok(Statement::Org {
        address: operands[0].clone(),
        mappings,
    })
}

fn tvc_basic_start_bytes() -> Vec<u8> {
    let mut out = Vec::new();
    out.extend_from_slice(&[
        0x0F, 0x0A, 0x00, 0x43, 0x9A, b'U', b'S', b'R', 0x96, b'6', b'7', b'0', b'4', 0x95, 0xFF,
        0x00,
    ]);
    out.resize((TVC_BASIC_USR_ENTRY - TVC_BASIC_LOAD_ADDR) as usize, 0x00);
    out
}

fn strip_comment(source: &str) -> Result<String, AsmError> {
    let mut quote = None;
    let mut escape = false;
    let mut out = String::new();
    for (index, ch) in source.char_indices() {
        if escape {
            out.push(ch);
            escape = false;
            continue;
        }
        if quote.is_some() && ch == '\\' {
            out.push(ch);
            escape = true;
            continue;
        }
        if let Some(quote_ch) = quote {
            out.push(ch);
            if ch == quote_ch {
                quote = None;
            }
            continue;
        }
        match ch {
            ';' => break,
            '"' => {
                quote = Some(ch);
                out.push(ch);
            }
            '\'' if single_quote_starts_operand(&out) => {
                quote = Some(ch);
                out.push(ch);
            }
            '\'' if single_quote_starts_statement_string(&out, source, index) => {
                quote = Some(ch);
                out.push(ch);
            }
            _ => out.push(ch),
        }
    }
    if quote.is_some() {
        return Err(AsmError::new("unterminated string literal"));
    }
    Ok(out)
}

fn single_quote_starts_operand(prefix: &str) -> bool {
    prefix
        .chars()
        .rev()
        .find(|ch| !ch.is_whitespace())
        .is_none_or(|ch| ch == ',')
}

fn single_quote_starts_statement_string(prefix: &str, source: &str, index: usize) -> bool {
    prefix.chars().last().is_some_and(|ch| ch.is_whitespace()) && source[index + 1..].contains('\'')
}

fn take_colon_label(source: &str) -> Result<Option<(String, &str)>, AsmError> {
    let Some(colon) = source.find(':') else {
        return Ok(None);
    };
    let before = source[..colon].trim();
    if before.is_empty() || before.contains(char::is_whitespace) {
        return Ok(None);
    }
    validate_label(before)?;
    Ok(Some((before.to_ascii_uppercase(), &source[colon + 1..])))
}

fn validate_label(label: &str) -> Result<(), AsmError> {
    let mut chars = label.chars();
    let Some(first) = chars.next() else {
        return Err(AsmError::new("empty label"));
    };
    if !(first.is_ascii_alphabetic() || first == '_' || first == '.') {
        return Err(AsmError::new(format!("invalid label '{}'", label)));
    }
    if chars.any(|ch| !(ch.is_ascii_alphanumeric() || ch == '_' || ch == '.')) {
        return Err(AsmError::new(format!("invalid label '{}'", label)));
    }
    Ok(())
}

fn split_statement_head(source: &str) -> (&str, &str) {
    let split = source.find(char::is_whitespace).unwrap_or(source.len());
    (&source[..split], source[split..].trim_start())
}

fn split_optional_head(source: &str) -> Option<(&str, &str)> {
    if source.trim().is_empty() {
        return None;
    }
    Some(split_statement_head(source.trim_start()))
}

fn parse_byte_values(source: &str) -> Result<Vec<ByteValue>, AsmError> {
    let operands = split_operands(source)?;
    if operands.is_empty() {
        return Err(AsmError::new("DB requires at least one byte"));
    }
    operands
        .into_iter()
        .map(|operand| {
            if is_quoted(&operand) {
                parse_string_literal(&operand).map(ByteValue::String)
            } else {
                Ok(ByteValue::Expr(operand))
            }
        })
        .collect()
}

fn is_quoted(value: &str) -> bool {
    value.len() >= 2
        && ((value.starts_with('"') && value.ends_with('"'))
            || (value.starts_with('\'') && value.ends_with('\'')))
}

fn parse_string_literal(value: &str) -> Result<Vec<u8>, AsmError> {
    let inner = &value[1..value.len() - 1];
    let mut out = Vec::new();
    let mut chars = inner.chars();
    while let Some(ch) = chars.next() {
        let ch = if ch == '\\' {
            match chars.next() {
                Some('0') => '\0',
                Some('n') => '\n',
                Some('r') => '\r',
                Some('t') => '\t',
                Some('\\') => '\\',
                Some('"') => '"',
                Some('\'') => '\'',
                Some(other) => {
                    return Err(AsmError::new(format!("unsupported escape '\\{}'", other)));
                }
                None => return Err(AsmError::new("unterminated escape sequence")),
            }
        } else {
            ch
        };
        if !ch.is_ascii() {
            return Err(AsmError::new("DB string literals must be ASCII"));
        }
        out.push(ch as u8);
    }
    Ok(out)
}

fn byte_values_len(values: &[ByteValue]) -> Result<usize, AsmError> {
    values.iter().try_fold(0usize, |len, value| match value {
        ByteValue::Expr(_) => Ok(len + 1),
        ByteValue::String(bytes) => len
            .checked_add(bytes.len())
            .ok_or_else(|| AsmError::new("DB data is too long")),
    })
}

fn emit_byte_values(
    values: &[ByteValue],
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
) -> Result<Vec<u8>, AsmError> {
    let mut out = Vec::new();
    for value in values {
        match value {
            ByteValue::Expr(expr) => out.push(eval_byte(expr, pc, symbols, mappings, false, 0)?),
            ByteValue::String(bytes) => out.extend_from_slice(bytes),
        }
    }
    Ok(out)
}

fn render_instruction(
    source: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
) -> Result<String, AsmError> {
    let (mnemonic, rest) = split_statement_head(source);
    let operands = split_operands(rest)?;
    if operands.is_empty() {
        return Ok(mnemonic.to_string());
    }

    let mnemonic_upper = mnemonic.to_ascii_uppercase();
    let unknown_value = if mnemonic_upper == "JR" || mnemonic_upper == "DJNZ" {
        pc.wrapping_add(2)
    } else {
        0
    };

    let rendered: Vec<_> = operands
        .iter()
        .map(|operand| {
            render_operand(
                operand,
                pc,
                symbols,
                mappings,
                allow_undefined,
                unknown_value,
            )
        })
        .collect::<Result<_, _>>()?;
    Ok(format!("{} {}", mnemonic, rendered.join(",")))
}

fn render_operand(
    operand: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<String, AsmError> {
    let operand = normalize(operand);
    if is_fixed_operand(&operand) {
        return Ok(operand);
    }

    if operand.starts_with('(') && operand.ends_with(')') {
        let inner = &operand[1..operand.len() - 1];
        if let Some(rendered) =
            render_indexed_operand(inner, pc, symbols, mappings, allow_undefined)?
        {
            return Ok(format!("({rendered})"));
        }
        if is_fixed_operand(inner) {
            return Ok(operand);
        }
        let value = eval_word(inner, pc, symbols, mappings, allow_undefined, unknown_value)?;
        return Ok(format!("({:04X}H)", value));
    }

    let value = eval_expr(
        &operand,
        pc,
        symbols,
        mappings,
        allow_undefined,
        unknown_value,
    )?;
    if value < 0 {
        Ok(value.to_string())
    } else {
        Ok(format!("{:X}H", value))
    }
}

fn is_fixed_operand(operand: &str) -> bool {
    matches!(
        operand,
        "A" | "B"
            | "C"
            | "D"
            | "E"
            | "H"
            | "L"
            | "F"
            | "I"
            | "R"
            | "AF"
            | "AF'"
            | "BC"
            | "DE"
            | "HL"
            | "SP"
            | "IX"
            | "IY"
            | "NZ"
            | "Z"
            | "NC"
            | "PO"
            | "PE"
            | "P"
            | "M"
            | "0"
            | "(HL)"
            | "(BC)"
            | "(DE)"
            | "(SP)"
            | "(C)"
            | "(IX)"
            | "(IY)"
    )
}

fn render_indexed_operand(
    inner: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
) -> Result<Option<String>, AsmError> {
    let (index, rest) = if let Some(rest) = inner.strip_prefix("IX") {
        ("IX", rest)
    } else if let Some(rest) = inner.strip_prefix("IY") {
        ("IY", rest)
    } else {
        return Ok(None);
    };

    if rest.is_empty() {
        return Ok(Some(index.to_string()));
    }
    let value = eval_expr(rest, pc, symbols, mappings, allow_undefined, 0)?;
    i8::try_from(value).map_err(|_| {
        AsmError::new(format!(
            "index displacement '{}' is outside -128..127",
            rest
        ))
    })?;
    if value < 0 {
        Ok(Some(format!("{index}{value}")))
    } else {
        Ok(Some(format!("{index}+{value}")))
    }
}

fn emit_segment(segments: &mut Vec<AssembledSegment>, addr: u16, bytes: &[u8]) {
    if let Some(last) = segments.last_mut() {
        if last.addr.wrapping_add(last.bytes.len() as u16) == addr {
            last.bytes.extend_from_slice(bytes);
            return;
        }
    }
    segments.push(AssembledSegment {
        addr,
        bytes: bytes.to_vec(),
    });
}

fn insert_symbol(
    symbols: &mut BTreeMap<String, u16>,
    label: &str,
    value: u16,
    line_no: usize,
) -> Result<(), AsmError> {
    if symbols.insert(label.to_string(), value).is_some() {
        return Err(AsmError::new(format!(
            "line {}: duplicate label '{}'",
            line_no, label
        )));
    }
    Ok(())
}

fn line_error(line_no: usize, err: AsmError) -> AsmError {
    AsmError::new(format!("line {}: {}", line_no, err))
}

fn split_operands(source: &str) -> Result<Vec<String>, AsmError> {
    if source.is_empty() {
        return Ok(Vec::new());
    }

    let mut depth = 0u8;
    let mut quote = None;
    let mut escape = false;
    let mut start = 0usize;
    let mut operands = Vec::new();
    for (index, ch) in source.char_indices() {
        if escape {
            escape = false;
            continue;
        }
        if quote.is_some() && ch == '\\' {
            escape = true;
            continue;
        }
        if let Some(quote_ch) = quote {
            if ch == quote_ch {
                quote = None;
            }
            continue;
        }
        match ch {
            '"' => quote = Some(ch),
            '\'' if source[start..index].trim().is_empty() => quote = Some(ch),
            '(' => depth = depth.saturating_add(1),
            ')' => {
                if depth == 0 {
                    return Err(AsmError::new("unmatched ')'"));
                }
                depth -= 1;
            }
            ',' if depth == 0 => {
                let operand = source[start..index].trim();
                if operand.is_empty() {
                    return Err(AsmError::new("missing operand"));
                }
                operands.push(operand.to_string());
                start = index + 1;
            }
            _ => {}
        }
    }
    if depth != 0 {
        return Err(AsmError::new("unmatched '('"));
    }
    if quote.is_some() {
        return Err(AsmError::new("unterminated string literal"));
    }

    let operand = source[start..].trim();
    if operand.is_empty() {
        return Err(AsmError::new("missing operand"));
    }
    operands.push(operand.to_string());
    Ok(operands)
}

fn normalize(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .flat_map(char::to_uppercase)
        .collect()
}

fn assemble_db(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    if op.is_empty() {
        return Err(AsmError::new("DB requires at least one byte"));
    }
    op.iter().map(|value| byte(value)).collect()
}

fn assemble_ld(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    let dst = op[0];
    let src = op[1];

    if let (Some(d), Some(s)) = (reg8(dst), reg8(src)) {
        if d == 6 && s == 6 {
            return Err(AsmError::new("LD (HL),(HL) is not an instruction"));
        }
        return Ok(vec![0x40 | (d << 3) | s]);
    }
    match (dst, src) {
        ("(BC)", "A") => return Ok(vec![0x02]),
        ("A", "(BC)") => return Ok(vec![0x0A]),
        ("(DE)", "A") => return Ok(vec![0x12]),
        ("A", "(DE)") => return Ok(vec![0x1A]),
        ("SP", "HL") => return Ok(vec![0xF9]),
        ("I", "A") => return Ok(vec![0xED, 0x47]),
        ("R", "A") => return Ok(vec![0xED, 0x4F]),
        ("A", "I") => return Ok(vec![0xED, 0x57]),
        ("A", "R") => return Ok(vec![0xED, 0x5F]),
        ("SP", "IX") => return Ok(vec![0xDD, 0xF9]),
        ("SP", "IY") => return Ok(vec![0xFD, 0xF9]),
        _ => {}
    }

    if let Some(addr) = indirect_word(dst) {
        if src == "A" {
            let mut out = vec![0x32];
            push_word(&mut out, addr);
            return Ok(out);
        }
        if src == "HL" {
            let mut out = vec![0x22];
            push_word(&mut out, addr);
            return Ok(out);
        }
        if let Some(prefix) = index_prefix(src) {
            let mut out = vec![prefix, 0x22];
            push_word(&mut out, addr);
            return Ok(out);
        }
        if let Some(p) = reg16(src) {
            let mut out = vec![0xED, 0x43 | (p << 4)];
            push_word(&mut out, addr);
            return Ok(out);
        }
    }

    if let Some(addr) = indirect_word(src) {
        if dst == "A" {
            let mut out = vec![0x3A];
            push_word(&mut out, addr);
            return Ok(out);
        }
        if dst == "HL" {
            let mut out = vec![0x2A];
            push_word(&mut out, addr);
            return Ok(out);
        }
        if let Some(prefix) = index_prefix(dst) {
            let mut out = vec![prefix, 0x2A];
            push_word(&mut out, addr);
            return Ok(out);
        }
        if let Some(p) = reg16(dst) {
            let mut out = vec![0xED, 0x4B | (p << 4)];
            push_word(&mut out, addr);
            return Ok(out);
        }
    }

    if let Some((prefix, d)) = indexed(dst)? {
        if let Some(s) = reg8(src) {
            return Ok(vec![prefix, 0x70 | s, d as u8]);
        }
        return Ok(vec![prefix, 0x36, d as u8, byte(src)?]);
    }
    if let Some((prefix, d)) = indexed(src)? {
        if let Some(r) = reg8(dst) {
            return Ok(vec![prefix, 0x46 | (r << 3), d as u8]);
        }
    }

    if let Some(d) = reg8(dst) {
        return Ok(vec![0x06 | (d << 3), byte(src)?]);
    }
    if let Some(p) = reg16(dst) {
        let mut out = vec![0x01 | (p << 4)];
        push_word(&mut out, word(src)?);
        return Ok(out);
    }
    if let Some(prefix) = index_prefix(dst) {
        let mut out = vec![prefix, 0x21];
        push_word(&mut out, word(src)?);
        return Ok(out);
    }

    Err(form_error("LD", op))
}

fn assemble_inc_dec(op: &[&str], decrement: bool) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 1)?;
    let base = if decrement { 0x05 } else { 0x04 };
    if let Some(r) = reg8(op[0]) {
        return Ok(vec![base | (r << 3)]);
    }
    if let Some(p) = reg16(op[0]) {
        return Ok(vec![(if decrement { 0x0B } else { 0x03 }) | (p << 4)]);
    }
    if let Some(prefix) = index_prefix(op[0]) {
        return Ok(vec![prefix, if decrement { 0x2B } else { 0x23 }]);
    }
    if let Some((prefix, d)) = indexed(op[0])? {
        return Ok(vec![prefix, base | (6 << 3), d as u8]);
    }
    Err(form_error(if decrement { "DEC" } else { "INC" }, op))
}

fn assemble_add(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    if op[0] == "HL" {
        if let Some(p) = reg16(op[1]) {
            return Ok(vec![0x09 | (p << 4)]);
        }
    }
    if let Some(prefix) = index_prefix(op[0]) {
        let p = match op[1] {
            "BC" => 0,
            "DE" => 1,
            value if value == op[0] => 2,
            "SP" => 3,
            _ => return Err(form_error("ADD", op)),
        };
        return Ok(vec![prefix, 0x09 | (p << 4)]);
    }
    if op[0] == "A" {
        return assemble_alu(&op[1..], 0);
    }
    Err(form_error("ADD", op))
}

fn assemble_adc_sbc(op: &[&str], subtract: bool) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    if op[0] == "HL" {
        if let Some(p) = reg16(op[1]) {
            let base = if subtract { 0x42 } else { 0x4A };
            return Ok(vec![0xED, base | (p << 4)]);
        }
    }
    if op[0] == "A" {
        return assemble_alu(&op[1..], if subtract { 3 } else { 1 });
    }
    Err(form_error(if subtract { "SBC" } else { "ADC" }, op))
}

fn assemble_alu(op: &[&str], operation: u8) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 1)?;
    if let Some(r) = reg8(op[0]) {
        return Ok(vec![0x80 | (operation << 3) | r]);
    }
    if let Some((prefix, d)) = indexed(op[0])? {
        return Ok(vec![prefix, 0x80 | (operation << 3) | 6, d as u8]);
    }
    Ok(vec![0xC6 | (operation << 3), byte(op[0])?])
}

fn assemble_jp(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    match op {
        ["(HL)"] => Ok(vec![0xE9]),
        ["(IX)"] => Ok(vec![0xDD, 0xE9]),
        ["(IY)"] => Ok(vec![0xFD, 0xE9]),
        [target] => {
            let mut out = vec![0xC3];
            push_word(&mut out, word(target)?);
            Ok(out)
        }
        [condition, target] => {
            let cc = condition_code(condition)
                .ok_or_else(|| AsmError::new(format!("invalid JP condition '{}'", condition)))?;
            let mut out = vec![0xC2 | (cc << 3)];
            push_word(&mut out, word(target)?);
            Ok(out)
        }
        _ => Err(form_error("JP", op)),
    }
}

fn assemble_jr(op: &[&str], pc: u16) -> Result<Vec<u8>, AsmError> {
    match op {
        [target] => Ok(vec![0x18, relative(target, pc)?]),
        [condition, target] => {
            let cc = match *condition {
                "NZ" => 0,
                "Z" => 1,
                "NC" => 2,
                "C" => 3,
                _ => {
                    return Err(AsmError::new(format!(
                        "JR condition must be NZ, Z, NC, or C, got '{}'",
                        condition
                    )));
                }
            };
            Ok(vec![0x20 | (cc << 3), relative(target, pc)?])
        }
        _ => Err(form_error("JR", op)),
    }
}

fn assemble_call(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    let (opcode, target) = match op {
        [target] => (0xCD, *target),
        [condition, target] => {
            let cc = condition_code(condition)
                .ok_or_else(|| AsmError::new(format!("invalid CALL condition '{}'", condition)))?;
            (0xC4 | (cc << 3), *target)
        }
        _ => return Err(form_error("CALL", op)),
    };
    let mut out = vec![opcode];
    push_word(&mut out, word(target)?);
    Ok(out)
}

fn assemble_ret(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    match op {
        [] => Ok(vec![0xC9]),
        [condition] => {
            let cc = condition_code(condition)
                .ok_or_else(|| AsmError::new(format!("invalid RET condition '{}'", condition)))?;
            Ok(vec![0xC0 | (cc << 3)])
        }
        _ => Err(form_error("RET", op)),
    }
}

fn assemble_rst(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 1)?;
    let address = number(op[0])?;
    if !(0..=0x38).contains(&address) || address % 8 != 0 {
        return Err(AsmError::new("RST address must be 00H, 08H, ..., or 38H"));
    }
    Ok(vec![0xC7 | address as u8])
}

fn assemble_push_pop(op: &[&str], push: bool) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 1)?;
    if let Some(prefix) = index_prefix(op[0]) {
        return Ok(vec![prefix, if push { 0xE5 } else { 0xE1 }]);
    }
    let p = reg16_stack(op[0]).ok_or_else(|| {
        AsmError::new(format!(
            "{} requires BC, DE, HL, AF, IX, or IY",
            if push { "PUSH" } else { "POP" }
        ))
    })?;
    Ok(vec![(if push { 0xC5 } else { 0xC1 }) | (p << 4)])
}

fn assemble_ex(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    match (op[0], op[1]) {
        ("AF", "AF'") => Ok(vec![0x08]),
        ("DE", "HL") => Ok(vec![0xEB]),
        ("(SP)", "HL") => Ok(vec![0xE3]),
        ("(SP)", "IX") => Ok(vec![0xDD, 0xE3]),
        ("(SP)", "IY") => Ok(vec![0xFD, 0xE3]),
        _ => Err(form_error("EX", op)),
    }
}

fn assemble_in(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    if op[0] == "A" {
        if let Some(port) = parenthesized_byte(op[1]) {
            if let Ok(port) = port {
                return Ok(vec![0xDB, port]);
            }
        }
    }
    if op[1] == "(C)" {
        let r = match op[0] {
            "F" => 6,
            value => reg8(value)
                .filter(|r| *r != 6)
                .ok_or_else(|| AsmError::new(format!("invalid IN register '{}'", value)))?,
        };
        return Ok(vec![0xED, 0x40 | (r << 3)]);
    }
    Err(form_error("IN", op))
}

fn assemble_out(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    if op[1] == "A" {
        if let Some(port) = parenthesized_byte(op[0]) {
            if let Ok(port) = port {
                return Ok(vec![0xD3, port]);
            }
        }
    }
    if op[0] == "(C)" {
        if op[1] == "0" {
            return Ok(vec![0xED, 0x71]);
        }
        let r = reg8(op[1])
            .filter(|r| *r != 6)
            .ok_or_else(|| AsmError::new(format!("invalid OUT register '{}'", op[1])))?;
        return Ok(vec![0xED, 0x41 | (r << 3)]);
    }
    Err(form_error("OUT", op))
}

fn assemble_im(op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 1)?;
    let opcode = match number(op[0])? {
        0 => 0x46,
        1 => 0x56,
        2 => 0x5E,
        _ => return Err(AsmError::new("IM mode must be 0, 1, or 2")),
    };
    Ok(vec![0xED, opcode])
}

fn assemble_bit(op: &[&str], group: u8) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 2)?;
    let bit = number(op[0])?;
    if !(0..=7).contains(&bit) {
        return Err(AsmError::new("bit number must be between 0 and 7"));
    }
    let operation = (group << 6) | ((bit as u8) << 3);
    if let Some(r) = reg8(op[1]) {
        return Ok(vec![0xCB, operation | r]);
    }
    if let Some((prefix, d)) = indexed(op[1])? {
        return Ok(vec![prefix, 0xCB, d as u8, operation | 6]);
    }
    Err(form_error(
        match group {
            1 => "BIT",
            2 => "RES",
            _ => "SET",
        },
        op,
    ))
}

fn assemble_rotate(op: &[&str], operation: u8) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 1)?;
    if let Some(r) = reg8(op[0]) {
        return Ok(vec![0xCB, (operation << 3) | r]);
    }
    if let Some((prefix, d)) = indexed(op[0])? {
        return Ok(vec![prefix, 0xCB, d as u8, (operation << 3) | 6]);
    }
    Err(AsmError::new(format!(
        "invalid rotate/shift operand '{}'",
        op[0]
    )))
}

fn assemble_fixed(mnemonic: &str, op: &[&str]) -> Result<Vec<u8>, AsmError> {
    expect_count(op, 0)?;
    let bytes: &[u8] = match mnemonic {
        "NOP" => &[0x00],
        "EXX" => &[0xD9],
        "HALT" => &[0x76],
        "RLCA" => &[0x07],
        "RRCA" => &[0x0F],
        "RLA" => &[0x17],
        "RRA" => &[0x1F],
        "DAA" => &[0x27],
        "CPL" => &[0x2F],
        "SCF" => &[0x37],
        "CCF" => &[0x3F],
        "DI" => &[0xF3],
        "EI" => &[0xFB],
        "NEG" => &[0xED, 0x44],
        "RETN" => &[0xED, 0x45],
        "RETI" => &[0xED, 0x4D],
        "RRD" => &[0xED, 0x67],
        "RLD" => &[0xED, 0x6F],
        "LDI" => &[0xED, 0xA0],
        "CPI" => &[0xED, 0xA1],
        "INI" => &[0xED, 0xA2],
        "OUTI" => &[0xED, 0xA3],
        "LDD" => &[0xED, 0xA8],
        "CPD" => &[0xED, 0xA9],
        "IND" => &[0xED, 0xAA],
        "OUTD" => &[0xED, 0xAB],
        "LDIR" => &[0xED, 0xB0],
        "CPIR" => &[0xED, 0xB1],
        "INIR" => &[0xED, 0xB2],
        "OTIR" => &[0xED, 0xB3],
        "LDDR" => &[0xED, 0xB8],
        "CPDR" => &[0xED, 0xB9],
        "INDR" => &[0xED, 0xBA],
        "OTDR" => &[0xED, 0xBB],
        _ => return Err(AsmError::new(format!("unknown mnemonic '{}'", mnemonic))),
    };
    Ok(bytes.to_vec())
}

fn reg8(value: &str) -> Option<u8> {
    match value {
        "B" => Some(0),
        "C" => Some(1),
        "D" => Some(2),
        "E" => Some(3),
        "H" => Some(4),
        "L" => Some(5),
        "(HL)" => Some(6),
        "A" => Some(7),
        _ => None,
    }
}

fn reg16(value: &str) -> Option<u8> {
    match value {
        "BC" => Some(0),
        "DE" => Some(1),
        "HL" => Some(2),
        "SP" => Some(3),
        _ => None,
    }
}

fn reg16_stack(value: &str) -> Option<u8> {
    match value {
        "BC" => Some(0),
        "DE" => Some(1),
        "HL" => Some(2),
        "AF" => Some(3),
        _ => None,
    }
}

fn condition_code(value: &str) -> Option<u8> {
    match value {
        "NZ" => Some(0),
        "Z" => Some(1),
        "NC" => Some(2),
        "C" => Some(3),
        "PO" => Some(4),
        "PE" => Some(5),
        "P" => Some(6),
        "M" => Some(7),
        _ => None,
    }
}

fn index_prefix(value: &str) -> Option<u8> {
    match value {
        "IX" => Some(0xDD),
        "IY" => Some(0xFD),
        _ => None,
    }
}

fn indexed(value: &str) -> Result<Option<(u8, i8)>, AsmError> {
    if !value.starts_with('(') || !value.ends_with(')') {
        return Ok(None);
    }
    let inner = &value[1..value.len() - 1];
    let (prefix, rest) = if let Some(rest) = inner.strip_prefix("IX") {
        (0xDD, rest)
    } else if let Some(rest) = inner.strip_prefix("IY") {
        (0xFD, rest)
    } else {
        return Ok(None);
    };

    let displacement = if rest.is_empty() {
        0
    } else {
        let value = number(rest)?;
        i8::try_from(value).map_err(|_| {
            AsmError::new(format!(
                "index displacement '{}' is outside -128..127",
                rest
            ))
        })?
    };
    Ok(Some((prefix, displacement)))
}

fn indirect_word(value: &str) -> Option<u16> {
    if !value.starts_with('(') || !value.ends_with(')') {
        return None;
    }
    word(&value[1..value.len() - 1]).ok()
}

fn parenthesized_byte(value: &str) -> Option<Result<u8, AsmError>> {
    if !value.starts_with('(') || !value.ends_with(')') {
        return None;
    }
    Some(byte(&value[1..value.len() - 1]))
}

fn number(value: &str) -> Result<i32, AsmError> {
    let value = value.replace('_', "");
    let (sign, unsigned) = if let Some(rest) = value.strip_prefix('-') {
        (-1, rest)
    } else if let Some(rest) = value.strip_prefix('+') {
        (1, rest)
    } else {
        (1, value.as_str())
    };
    if unsigned.is_empty() {
        return Err(AsmError::new(format!("invalid number '{}'", value)));
    }

    let (digits, radix) = if let Some(rest) = unsigned.strip_prefix("0X") {
        (rest, 16)
    } else if let Some(rest) = unsigned.strip_prefix('$') {
        (rest, 16)
    } else if let Some(rest) = unsigned.strip_suffix('H') {
        (rest, 16)
    } else if let Some(rest) = unsigned.strip_prefix("0B") {
        (rest, 2)
    } else if let Some(rest) = unsigned.strip_suffix('B') {
        (rest, 2)
    } else {
        (unsigned, 10)
    };

    i32::from_str_radix(digits, radix)
        .map(|number| sign * number)
        .map_err(|_| AsmError::new(format!("invalid number '{}'", value)))
}

fn eval_byte(
    value: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<u8, AsmError> {
    let value_number = eval_expr(value, pc, symbols, mappings, allow_undefined, unknown_value)?;
    u8::try_from(value_number)
        .map_err(|_| AsmError::new(format!("byte '{}' is outside 0..255", value)))
}

fn eval_word(
    value: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<u16, AsmError> {
    let value_number = eval_expr(value, pc, symbols, mappings, allow_undefined, unknown_value)?;
    u16::try_from(value_number)
        .map_err(|_| AsmError::new(format!("word '{}' is outside 0..65535", value)))
}

fn eval_nonnegative(
    value: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<usize, AsmError> {
    let value_number = eval_expr(value, pc, symbols, mappings, allow_undefined, unknown_value)?;
    usize::try_from(value_number)
        .map_err(|_| AsmError::new(format!("count '{}' must be non-negative", value)))
}

fn eval_expr(
    value: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<i32, AsmError> {
    let value = normalize(value);
    if value.is_empty() {
        return Err(AsmError::new("empty expression"));
    }

    let bytes = value.as_bytes();
    let mut index = 0usize;
    let mut total = 0i32;
    let mut expect_term = true;
    let mut sign = 1i32;

    while index < bytes.len() {
        match bytes[index] as char {
            '+' if expect_term => {
                sign = 1;
                index += 1;
            }
            '-' if expect_term => {
                sign = -1;
                index += 1;
            }
            '+' | '-' => {
                sign = if bytes[index] as char == '-' { -1 } else { 1 };
                expect_term = true;
                index += 1;
            }
            _ => {
                let start = index;
                while index < bytes.len() {
                    let ch = bytes[index] as char;
                    if ch == '+' || ch == '-' {
                        break;
                    }
                    index += 1;
                }
                let term = &value[start..index];
                if term.is_empty() {
                    return Err(AsmError::new(format!("invalid expression '{}'", value)));
                }
                total +=
                    sign * eval_term(term, pc, symbols, mappings, allow_undefined, unknown_value)?;
                expect_term = false;
                sign = 1;
            }
        }
    }

    if expect_term {
        return Err(AsmError::new(format!("invalid expression '{}'", value)));
    }
    Ok(total)
}

fn eval_term(
    term: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    mappings: &BTreeMap<String, AsmMapping>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<i32, AsmError> {
    if let Some((source_term, mapping_name)) = term.split_once('@') {
        if source_term.is_empty() || mapping_name.is_empty() || mapping_name.contains('@') {
            return Err(AsmError::new(format!(
                "invalid mapped expression '{}'",
                term
            )));
        }
        let Some(mapping) = mappings.get(mapping_name) else {
            if allow_undefined {
                return Ok(unknown_value as i32);
            }
            return Err(AsmError::new(format!("unknown mapping '{}'", mapping_name)));
        };
        let source_value = if allow_undefined
            && is_label_like(source_term)
            && !symbols.contains_key(source_term)
            && number(source_term).is_err()
        {
            return Ok(unknown_value as i32);
        } else {
            eval_plain_term(source_term, pc, symbols, allow_undefined, unknown_value)?
        };
        return Ok(source_value - mapping.source_base as i32 + mapping.mapped_base as i32);
    }

    eval_plain_term(term, pc, symbols, allow_undefined, unknown_value)
}

fn eval_plain_term(
    term: &str,
    pc: u16,
    symbols: &BTreeMap<String, u16>,
    allow_undefined: bool,
    unknown_value: u16,
) -> Result<i32, AsmError> {
    if term == "$" {
        return Ok(pc as i32);
    }
    if let Ok(value) = number(term) {
        return Ok(value);
    }
    if let Some(value) = symbols.get(term) {
        return Ok(*value as i32);
    }
    if allow_undefined && is_label_like(term) {
        return Ok(unknown_value as i32);
    }
    Err(AsmError::new(format!("unknown symbol '{}'", term)))
}

fn is_label_like(value: &str) -> bool {
    let mut chars = value.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    (first.is_ascii_alphabetic() || first == '_' || first == '.')
        && chars.all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '.')
}

fn byte(value: &str) -> Result<u8, AsmError> {
    let value_number = number(value)?;
    u8::try_from(value_number)
        .map_err(|_| AsmError::new(format!("byte '{}' is outside 0..255", value)))
}

fn word(value: &str) -> Result<u16, AsmError> {
    let value_number = number(value)?;
    u16::try_from(value_number)
        .map_err(|_| AsmError::new(format!("word '{}' is outside 0..65535", value)))
}

fn relative(target: &str, pc: u16) -> Result<u8, AsmError> {
    let target = word(target)?;
    let next = pc.wrapping_add(2);
    let displacement = target.wrapping_sub(next) as i16;
    if !(-128..=127).contains(&displacement) {
        return Err(AsmError::new(format!(
            "relative target {:04X}H is out of range from {:04X}H",
            target, pc
        )));
    }
    Ok(displacement as i8 as u8)
}

fn push_word(out: &mut Vec<u8>, value: u16) {
    out.push(value as u8);
    out.push((value >> 8) as u8);
}

fn expect_count(op: &[&str], count: usize) -> Result<(), AsmError> {
    if op.len() == count {
        Ok(())
    } else {
        Err(AsmError::new(format!(
            "expected {} operand{}, got {}",
            count,
            if count == 1 { "" } else { "s" },
            op.len()
        )))
    }
}

fn form_error(mnemonic: &str, op: &[&str]) -> AsmError {
    let suffix = if op.is_empty() {
        String::new()
    } else {
        format!(" {}", op.join(","))
    };
    AsmError::new(format!("unsupported instruction '{}{}'", mnemonic, suffix))
}

#[cfg(test)]
#[path = "asm_tests.rs"]
mod tests;
