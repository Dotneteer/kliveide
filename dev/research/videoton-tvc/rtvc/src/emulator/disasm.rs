use crate::bus::CpuBus;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisassembledInstruction {
    pub addr: u16,
    pub len: u8,
    pub bytes: Vec<u8>,
    pub text: String,
    /// Affected flags in z80href order: S Z H P/V N C.
    pub flags: Option<&'static str>,
    pub description: Option<&'static str>,
    pub effect: Option<&'static str>,
    pub t_states: Option<&'static str>,
}

pub fn disassemble_at<M: CpuBus>(bus: &mut M, addr: u16) -> DisassembledInstruction {
    let mut reader = Reader::new(bus, addr);
    let text = disassemble(&mut reader);
    let info = instruction_info(&text);
    let t_states = t_states(&reader.bytes, &text);
    DisassembledInstruction {
        addr,
        len: reader.len() as u8,
        bytes: reader.bytes,
        text,
        flags: info.map(|info| info.flags),
        description: info.map(|info| info.description),
        effect: info.map(|info| info.effect),
        t_states,
    }
}

pub fn disassemble_block<M: CpuBus>(
    bus: &mut M,
    mut addr: u16,
    byte_len: usize,
) -> Vec<DisassembledInstruction> {
    let end = addr.wrapping_add(byte_len as u16);
    let mut out = Vec::new();
    let mut consumed = 0usize;
    while consumed < byte_len {
        let inst = disassemble_at(bus, addr);
        consumed += inst.len as usize;
        addr = addr.wrapping_add(inst.len as u16);
        out.push(inst);
        if addr == end {
            break;
        }
    }
    out
}

/// Disassemble one instruction from bytes captured at execution time.
pub fn disassemble_captured(addr: u16, bytes: &[u8]) -> DisassembledInstruction {
    let mut bus = CapturedInstructionBus { addr, bytes };
    disassemble_at(&mut bus, addr)
}

struct CapturedInstructionBus<'a> {
    addr: u16,
    bytes: &'a [u8],
}

impl CpuBus for CapturedInstructionBus<'_> {
    fn r8(&mut self, addr: u16) -> u8 {
        let offset = addr.wrapping_sub(self.addr) as usize;
        self.bytes.get(offset).copied().unwrap_or(0)
    }

    fn w8(&mut self, _addr: u16, _val: u8) {}
}

struct Reader<'a, M: CpuBus> {
    bus: &'a mut M,
    addr: u16,
    bytes: Vec<u8>,
}

impl<'a, M: CpuBus> Reader<'a, M> {
    fn new(bus: &'a mut M, addr: u16) -> Self {
        Self {
            bus,
            addr,
            bytes: Vec::with_capacity(4),
        }
    }

    fn len(&self) -> usize {
        self.bytes.len()
    }

    fn u8(&mut self) -> u8 {
        let val = self.bus.r8(self.addr.wrapping_add(self.bytes.len() as u16));
        self.bytes.push(val);
        val
    }

    fn i8(&mut self) -> i8 {
        self.u8() as i8
    }

    fn u16(&mut self) -> u16 {
        let lo = self.u8() as u16;
        let hi = self.u8() as u16;
        lo | (hi << 8)
    }
}

fn disassemble<M: CpuBus>(reader: &mut Reader<'_, M>) -> String {
    let mut op = reader.u8();
    if op == 0xCB {
        return disassemble_cb(reader.u8(), "(HL)");
    }
    if op == 0xED {
        return disassemble_ed(reader);
    }
    if op == 0xDD || op == 0xFD {
        while matches!(peek_prefix(reader), Some(0xDD | 0xFD)) {
            op = reader.u8();
        }

        let prefix = op;
        let index = if op == 0xDD { "IX" } else { "IY" };
        let next = reader.u8();
        if next == 0xCB {
            let d = reader.i8();
            return disassemble_cb_index(reader.u8(), index, d);
        }

        if let Some(text) = disassemble_indexed(reader, next, index) {
            return text;
        }

        return disassemble_base(reader, next, Some(prefix));
    }

    disassemble_base(reader, op, None)
}

fn peek_prefix<M: CpuBus>(reader: &mut Reader<'_, M>) -> Option<u8> {
    Some(
        reader
            .bus
            .r8(reader.addr.wrapping_add(reader.bytes.len() as u16)),
    )
}

fn disassemble_base<M: CpuBus>(reader: &mut Reader<'_, M>, op: u8, prefix: Option<u8>) -> String {
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let p = y >> 1;
    let q = y & 1;

    match x {
        0 => match z {
            0 => match y {
                0 => "NOP".to_string(),
                1 => "EX AF,AF'".to_string(),
                2 => rel("DJNZ", reader),
                3 => rel("JR", reader),
                4..=7 => rel(&format!("JR {}", CC[(y - 4) as usize]), reader),
                _ => unreachable!(),
            },
            1 => {
                if q == 0 {
                    format!("LD {},{}", RP[p as usize], imm16(reader))
                } else {
                    format!("ADD HL,{}", RP[p as usize])
                }
            }
            2 => match (q, p) {
                (0, 0) => "LD (BC),A".to_string(),
                (1, 0) => "LD A,(BC)".to_string(),
                (0, 1) => "LD (DE),A".to_string(),
                (1, 1) => "LD A,(DE)".to_string(),
                (0, 2) => format!("LD ({}),HL", imm16(reader)),
                (1, 2) => format!("LD HL,({})", imm16(reader)),
                (0, 3) => format!("LD ({}),A", imm16(reader)),
                (1, 3) => format!("LD A,({})", imm16(reader)),
                _ => unreachable!(),
            },
            3 => format!("{} {}", if q == 0 { "INC" } else { "DEC" }, RP[p as usize]),
            4 => format!("INC {}", R[y as usize]),
            5 => format!("DEC {}", R[y as usize]),
            6 => format!("LD {},{}", R[y as usize], imm8(reader)),
            7 => MISC[y as usize].to_string(),
            _ => unreachable!(),
        },
        1 => {
            if op == 0x76 {
                "HALT".to_string()
            } else {
                format!("LD {},{}", R[y as usize], R[z as usize])
            }
        }
        2 => format_alu(y, R[z as usize]),
        3 => match z {
            0 => format!("RET {}", CC[y as usize]),
            1 => {
                if q == 0 {
                    format!("POP {}", RP2[p as usize])
                } else {
                    match p {
                        0 => "RET".to_string(),
                        1 => "EXX".to_string(),
                        2 => "JP (HL)".to_string(),
                        3 => "LD SP,HL".to_string(),
                        _ => unreachable!(),
                    }
                }
            }
            2 => format!("JP {},{}", CC[y as usize], imm16(reader)),
            3 => match y {
                0 => format!("JP {}", imm16(reader)),
                1 => db_prefixed(prefix, op),
                2 => format!("OUT ({}),A", imm8(reader)),
                3 => format!("IN A,({})", imm8(reader)),
                4 => "EX (SP),HL".to_string(),
                5 => "EX DE,HL".to_string(),
                6 => "DI".to_string(),
                7 => "EI".to_string(),
                _ => unreachable!(),
            },
            4 => format!("CALL {},{}", CC[y as usize], imm16(reader)),
            5 => {
                if q == 0 {
                    format!("PUSH {}", RP2[p as usize])
                } else if p == 0 {
                    format!("CALL {}", imm16(reader))
                } else {
                    db_prefixed(prefix, op)
                }
            }
            6 => format_alu(y, &imm8(reader)),
            7 => format!("RST {:02X}H", y * 8),
            _ => unreachable!(),
        },
        _ => unreachable!(),
    }
}

fn disassemble_indexed<M: CpuBus>(
    reader: &mut Reader<'_, M>,
    op: u8,
    index: &'static str,
) -> Option<String> {
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let p = y >> 1;
    let q = y & 1;

    let mem = |d| indexed_addr(index, d);
    let index_r = |r| index_reg(index, r);

    match x {
        0 => match z {
            1 if p == 2 && q == 0 => Some(format!("LD {},{}", index, imm16(reader))),
            1 if q == 1 => Some(format!(
                "ADD {},{}",
                index,
                if p == 2 { index } else { RP[p as usize] }
            )),
            2 if p == 2 && q == 0 => Some(format!("LD ({}),{}", imm16(reader), index)),
            2 if p == 2 && q == 1 => Some(format!("LD {},({})", index, imm16(reader))),
            3 if p == 2 => Some(format!("{} {}", if q == 0 { "INC" } else { "DEC" }, index)),
            4 if y == 4 || y == 5 => Some(format!("INC {}", index_r(y))),
            4 if y == 6 => {
                let d = reader.i8();
                Some(format!("INC {}", mem(d)))
            }
            5 if y == 4 || y == 5 => Some(format!("DEC {}", index_r(y))),
            5 if y == 6 => {
                let d = reader.i8();
                Some(format!("DEC {}", mem(d)))
            }
            6 if y == 4 || y == 5 => Some(format!("LD {},{}", index_r(y), imm8(reader))),
            6 if y == 6 => {
                let d = reader.i8();
                Some(format!("LD {},{}", mem(d), imm8(reader)))
            }
            _ => None,
        },
        1 => {
            if y == 6 && z != 6 {
                let d = reader.i8();
                Some(format!("LD {},{}", mem(d), R[z as usize]))
            } else if z == 6 && y != 6 {
                let d = reader.i8();
                Some(format!("LD {},{}", R[y as usize], mem(d)))
            } else if y == 4 || y == 5 || z == 4 || z == 5 {
                Some(format!("LD {},{}", index_r(y), index_r(z)))
            } else {
                None
            }
        }
        2 if z == 6 => {
            let d = reader.i8();
            Some(format_alu(y, &mem(d)))
        }
        2 if z == 4 || z == 5 => Some(format_alu(y, index_r(z))),
        3 => match op {
            0xE1 => Some(format!("POP {}", index)),
            0xE3 => Some(format!("EX (SP),{}", index)),
            0xE5 => Some(format!("PUSH {}", index)),
            0xE9 => Some(format!("JP ({})", index)),
            0xF9 => Some(format!("LD SP,{}", index)),
            0x09 | 0x19 | 0x39 => Some(format!("ADD {},{}", index, RP[p as usize])),
            _ => None,
        },
        _ => None,
    }
}

fn disassemble_cb(op: u8, mem_reg: &str) -> String {
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let reg = if z == 6 { mem_reg } else { R[z as usize] };
    match x {
        0 => format!("{} {}", ROT[y as usize], reg),
        1 => format!("BIT {},{}", y, reg),
        2 => format!("RES {},{}", y, reg),
        3 => format!("SET {},{}", y, reg),
        _ => unreachable!(),
    }
}

fn disassemble_cb_index(op: u8, index: &'static str, d: i8) -> String {
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let mem = indexed_addr(index, d);
    if z == 6 {
        return match x {
            0 => format!("{} {}", ROT[y as usize], mem),
            1 => format!("BIT {},{}", y, mem),
            2 => format!("RES {},{}", y, mem),
            3 => format!("SET {},{}", y, mem),
            _ => unreachable!(),
        };
    }

    match x {
        0 => format!("{} {},{}", ROT[y as usize], mem, R[z as usize]),
        1 => format!("BIT {},{}", y, mem),
        2 => format!("RES {},{},{}", y, mem, R[z as usize]),
        3 => format!("SET {},{},{}", y, mem, R[z as usize]),
        _ => unreachable!(),
    }
}

fn disassemble_ed<M: CpuBus>(reader: &mut Reader<'_, M>) -> String {
    let op = reader.u8();
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let p = y >> 1;
    let q = y & 1;

    if x == 1 {
        return match z {
            0 => format!("IN {},(C)", R_ED_IN[y as usize]),
            1 => {
                if y == 6 {
                    "OUT (C),0".to_string()
                } else {
                    format!("OUT (C),{}", R[y as usize])
                }
            }
            2 => format!(
                "{} HL,{}",
                if q == 0 { "SBC" } else { "ADC" },
                RP[p as usize]
            ),
            3 => format!(
                "LD {},{}",
                if q == 0 {
                    format!("({})", imm16(reader))
                } else {
                    RP[p as usize].to_string()
                },
                if q == 0 {
                    RP[p as usize].to_string()
                } else {
                    format!("({})", imm16(reader))
                }
            ),
            4 => "NEG".to_string(),
            5 => {
                if y == 1 {
                    "RETI".to_string()
                } else {
                    "RETN".to_string()
                }
            }
            6 => match y {
                0 | 1 | 4 | 5 => "IM 0".to_string(),
                2 | 6 => "IM 1".to_string(),
                3 | 7 => "IM 2".to_string(),
                _ => unreachable!(),
            },
            7 => match y {
                0 => "LD I,A".to_string(),
                1 => "LD R,A".to_string(),
                2 => "LD A,I".to_string(),
                3 => "LD A,R".to_string(),
                4 => "RRD".to_string(),
                5 => "RLD".to_string(),
                _ => db2(0xED, op),
            },
            _ => unreachable!(),
        };
    }

    match op {
        0xA0 => "LDI".to_string(),
        0xA1 => "CPI".to_string(),
        0xA2 => "INI".to_string(),
        0xA3 => "OUTI".to_string(),
        0xA8 => "LDD".to_string(),
        0xA9 => "CPD".to_string(),
        0xAA => "IND".to_string(),
        0xAB => "OUTD".to_string(),
        0xB0 => "LDIR".to_string(),
        0xB1 => "CPIR".to_string(),
        0xB2 => "INIR".to_string(),
        0xB3 => "OTIR".to_string(),
        0xB8 => "LDDR".to_string(),
        0xB9 => "CPDR".to_string(),
        0xBA => "INDR".to_string(),
        0xBB => "OTDR".to_string(),
        _ => db2(0xED, op),
    }
}

fn rel<M: CpuBus>(mnemonic: &str, reader: &mut Reader<'_, M>) -> String {
    let d = reader.i8();
    let target = reader
        .addr
        .wrapping_add(reader.len() as u16)
        .wrapping_add(d as i16 as u16);
    if mnemonic.contains(' ') {
        format!("{},{}", mnemonic, hex16(target))
    } else {
        format!("{} {}", mnemonic, hex16(target))
    }
}

fn format_alu(y: u8, rhs: &str) -> String {
    match y {
        0 => format!("ADD A,{}", rhs),
        1 => format!("ADC A,{}", rhs),
        2 => format!("SUB {}", rhs),
        3 => format!("SBC A,{}", rhs),
        4 => format!("AND {}", rhs),
        5 => format!("XOR {}", rhs),
        6 => format!("OR {}", rhs),
        7 => format!("CP {}", rhs),
        _ => unreachable!(),
    }
}

fn indexed_addr(index: &str, d: i8) -> String {
    if d < 0 {
        format!("({}-{})", index, hex8(d.unsigned_abs()))
    } else {
        format!("({}+{})", index, hex8(d as u8))
    }
}

fn index_reg(index: &'static str, r: u8) -> &'static str {
    match (index, r) {
        ("IX", 4) => "IXH",
        ("IX", 5) => "IXL",
        ("IY", 4) => "IYH",
        ("IY", 5) => "IYL",
        (_, 0..=7) => R[r as usize],
        _ => unreachable!(),
    }
}

fn imm8<M: CpuBus>(reader: &mut Reader<'_, M>) -> String {
    hex8(reader.u8())
}

fn imm16<M: CpuBus>(reader: &mut Reader<'_, M>) -> String {
    hex16(reader.u16())
}

fn hex8(v: u8) -> String {
    format!("{:02X}H", v)
}

fn hex16(v: u16) -> String {
    format!("{:04X}H", v)
}

fn db_prefixed(prefix: Option<u8>, op: u8) -> String {
    match prefix {
        Some(prefix) => format!("DB {},{}", hex8(prefix), hex8(op)),
        None => format!("DB {}", hex8(op)),
    }
}

fn db2(a: u8, b: u8) -> String {
    format!("DB {},{}", hex8(a), hex8(b))
}

#[derive(Clone, Copy)]
struct InstructionInfo {
    flags: &'static str,
    description: &'static str,
    effect: &'static str,
}

fn instruction_info(text: &str) -> Option<InstructionInfo> {
    let mnemonic = text.split([' ', ',']).next().unwrap_or(text);
    let info = match mnemonic {
        "ADC" if text.starts_with("ADC HL,") => InstructionInfo {
            flags: "**?V0*",
            description: "Add with Carry",
            effect: "HL=HL+ss+CY",
        },
        "ADC" => InstructionInfo {
            flags: "***V0*",
            description: "Add with Carry",
            effect: "A=A+s+CY",
        },
        "ADD" if text.starts_with("ADD HL,") => InstructionInfo {
            flags: "--?-0*",
            description: "Add",
            effect: "HL=HL+ss",
        },
        "ADD" if text.starts_with("ADD IX,") => InstructionInfo {
            flags: "--?-0*",
            description: "Add",
            effect: "IX=IX+pp",
        },
        "ADD" if text.starts_with("ADD IY,") => InstructionInfo {
            flags: "--?-0*",
            description: "Add",
            effect: "IY=IY+rr",
        },
        "ADD" => InstructionInfo {
            flags: "***V0*",
            description: "Add",
            effect: "A=A+s",
        },
        "AND" => InstructionInfo {
            flags: "***P00",
            description: "Logical AND",
            effect: "A=A&s",
        },
        "BIT" => InstructionInfo {
            flags: "?*1?0-",
            description: "Test Bit",
            effect: "m&{2^b}",
        },
        "CALL" if text.starts_with("CALL ") && text.contains(',') => InstructionInfo {
            flags: "------",
            description: "Conditional Call",
            effect: "If cc CALL",
        },
        "CALL" => InstructionInfo {
            flags: "------",
            description: "Unconditional Call",
            effect: "-[SP]=PC,PC=nn",
        },
        "CCF" => InstructionInfo {
            flags: "--*-0*",
            description: "Complement Carry Flag",
            effect: "CY=~CY",
        },
        "CP" => InstructionInfo {
            flags: "***V1*",
            description: "Compare",
            effect: "A-s",
        },
        "CPD" => InstructionInfo {
            flags: "****1-",
            description: "Compare and Decrement",
            effect: "A-[HL],HL=HL-1,BC=BC-1",
        },
        "CPDR" => InstructionInfo {
            flags: "****1-",
            description: "Compare, Dec., Repeat",
            effect: "CPD till A=[HL]or BC=0",
        },
        "CPI" => InstructionInfo {
            flags: "****1-",
            description: "Compare and Increment",
            effect: "A-[HL],HL=HL+1,BC=BC-1",
        },
        "CPIR" => InstructionInfo {
            flags: "****1-",
            description: "Compare, Inc., Repeat",
            effect: "CPI till A=[HL]or BC=0",
        },
        "CPL" => InstructionInfo {
            flags: "--1-1-",
            description: "Complement",
            effect: "A=~A",
        },
        "DAA" => InstructionInfo {
            flags: "***P-*",
            description: "Decimal Adjust Acc.",
            effect: "A=BCD format",
        },
        "DEC" if is_word_inc_dec(text) => InstructionInfo {
            flags: "------",
            description: "Decrement",
            effect: "xx=xx-1",
        },
        "DEC" => InstructionInfo {
            flags: "***V1-",
            description: "Decrement",
            effect: "s=s-1",
        },
        "DI" => no_flags("Disable Interrupts", ""),
        "DJNZ" => no_flags("Dec., Jump Non-Zero", "B=B-1 till B=0"),
        "EI" => no_flags("Enable Interrupts", ""),
        "EX" if text.starts_with("EX AF,AF'") => no_flags("Exchange", "AF<->AF'"),
        "EX" if text.starts_with("EX DE,HL") => no_flags("Exchange", "DE<->HL"),
        "EX" => no_flags("Exchange", "[SP]<->register"),
        "EXX" => no_flags("Exchange", "qq<->qq' (except AF)"),
        "HALT" => no_flags("Halt", ""),
        "IM" => no_flags("Interrupt Mode", "(n=0,1,2)"),
        "IN" if text.starts_with("IN A,(") && !text.ends_with("(C)") => no_flags("Input", "A=[n]"),
        "IN" => InstructionInfo {
            flags: "***P0-",
            description: "Input",
            effect: "r=[C]",
        },
        "INC" if is_word_inc_dec(text) => InstructionInfo {
            flags: "------",
            description: "Increment",
            effect: "xx=xx+1",
        },
        "INC" => InstructionInfo {
            flags: "***V0-",
            description: "Increment",
            effect: "s=s+1",
        },
        "IND" => InstructionInfo {
            flags: "?*??1-",
            description: "Input and Decrement",
            effect: "[HL]=[C],HL=HL-1,B=B-1",
        },
        "INDR" => InstructionInfo {
            flags: "?1??1-",
            description: "Input, Dec., Repeat",
            effect: "IND till B=0",
        },
        "INI" => InstructionInfo {
            flags: "?*??1-",
            description: "Input and Increment",
            effect: "[HL]=[C],HL=HL+1,B=B-1",
        },
        "INIR" => InstructionInfo {
            flags: "?1??1-",
            description: "Input, Inc., Repeat",
            effect: "INI till B=0",
        },
        "JP" if text.starts_with("JP (") => no_flags("Unconditional Jump", "PC=[register]"),
        "JP" if text.starts_with("JP ") && text.contains(',') => {
            no_flags("Conditional Jump", "If cc JP")
        }
        "JP" => no_flags("Unconditional Jump", "PC=nn"),
        "JR" if text.starts_with("JR ") && text.contains(',') => {
            no_flags("Conditional Jump", "If cc JR")
        }
        "JR" => no_flags("Unconditional Jump", "PC=PC+e"),
        "LD" if text == "LD A,I" || text == "LD A,R" => InstructionInfo {
            flags: "**0*0-",
            description: "Load",
            effect: "A=i",
        },
        "LDD" => InstructionInfo {
            flags: "--0*0-",
            description: "Load and Decrement",
            effect: "[DE]=[HL],HL=HL-1,BC=BC-1",
        },
        "LDDR" => InstructionInfo {
            flags: "--000-",
            description: "Load, Dec., Repeat",
            effect: "LDD till BC=0",
        },
        "LDI" => InstructionInfo {
            flags: "--0*0-",
            description: "Load and Increment",
            effect: "[DE]=[HL],HL=HL+1,BC=BC-1",
        },
        "LDIR" => InstructionInfo {
            flags: "--000-",
            description: "Load, Inc., Repeat",
            effect: "LDI till BC=0",
        },
        "LD" => no_flags("Load", "dst=src"),
        "NEG" => InstructionInfo {
            flags: "***V1*",
            description: "Negate",
            effect: "A=-A",
        },
        "NOP" => no_flags("No Operation", ""),
        "OR" => InstructionInfo {
            flags: "***P00",
            description: "Logical inclusive OR",
            effect: "A=Avs",
        },
        "OTDR" => InstructionInfo {
            flags: "?1??1-",
            description: "Output, Dec., Repeat",
            effect: "OUTD till B=0",
        },
        "OTIR" => InstructionInfo {
            flags: "?1??1-",
            description: "Output, Inc., Repeat",
            effect: "OUTI till B=0",
        },
        "OUT" => no_flags("Output", "[port]=r"),
        "OUTD" => InstructionInfo {
            flags: "?*??1-",
            description: "Output and Decrement",
            effect: "[C]=[HL],HL=HL-1,B=B-1",
        },
        "OUTI" => InstructionInfo {
            flags: "?*??1-",
            description: "Output and Increment",
            effect: "[C]=[HL],HL=HL+1,B=B-1",
        },
        "POP" => no_flags("Pop", "register=[SP]+"),
        "PUSH" => no_flags("Push", "-[SP]=register"),
        "RES" => no_flags("Reset bit", "m=m&{~2^b}"),
        "RET" if text.starts_with("RET ") => no_flags("Conditional Return", "If cc RET"),
        "RET" => no_flags("Return", "PC=[SP]+"),
        "RETI" => no_flags("Return from Interrupt", "PC=[SP]+"),
        "RETN" => no_flags("Return from NMI", "PC=[SP]+"),
        "RL" => InstructionInfo {
            flags: "**0P0*",
            description: "Rotate Left",
            effect: "m={CY,m}<-",
        },
        "RLA" => InstructionInfo {
            flags: "--0-0*",
            description: "Rotate Left Acc.",
            effect: "A={CY,A}<-",
        },
        "RLC" => InstructionInfo {
            flags: "**0P0*",
            description: "Rotate Left Circular",
            effect: "m=m<-",
        },
        "RLCA" => InstructionInfo {
            flags: "--0-0*",
            description: "Rotate Left Circular",
            effect: "A=A<-",
        },
        "RLD" => InstructionInfo {
            flags: "**0P0-",
            description: "Rotate Left 4 bits",
            effect: "{A,[HL]}={A,[HL]}<-",
        },
        "RR" => InstructionInfo {
            flags: "**0P0*",
            description: "Rotate Right",
            effect: "m=->{CY,m}",
        },
        "RRA" => InstructionInfo {
            flags: "--0-0*",
            description: "Rotate Right Acc.",
            effect: "A=->{CY,A}",
        },
        "RRC" => InstructionInfo {
            flags: "**0P0*",
            description: "Rotate Right Circular",
            effect: "m=->m",
        },
        "RRCA" => InstructionInfo {
            flags: "--0-0*",
            description: "Rotate Right Circular",
            effect: "A=->A",
        },
        "RRD" => InstructionInfo {
            flags: "**0P0-",
            description: "Rotate Right 4 bits",
            effect: "{A,[HL]}=->{A,[HL]}",
        },
        "RST" => no_flags("Restart", "(p=0H,8H,10H,...,38H)"),
        "SBC" if text.starts_with("SBC HL,") => InstructionInfo {
            flags: "**?V1*",
            description: "Subtract with Carry",
            effect: "HL=HL-ss-CY",
        },
        "SBC" => InstructionInfo {
            flags: "***V1*",
            description: "Subtract with Carry",
            effect: "A=A-s-CY",
        },
        "SCF" => InstructionInfo {
            flags: "--0-01",
            description: "Set Carry Flag",
            effect: "CY=1",
        },
        "SET" => no_flags("Set bit", "m=mv{2^b}"),
        "SLA" | "SLL" => InstructionInfo {
            flags: "**0P0*",
            description: "Shift Left Arithmetic",
            effect: "m=m*2",
        },
        "SRA" => InstructionInfo {
            flags: "**0P0*",
            description: "Shift Right Arith.",
            effect: "m=m/2",
        },
        "SRL" => InstructionInfo {
            flags: "**0P0*",
            description: "Shift Right Logical",
            effect: "m=->{0,m,CY}",
        },
        "SUB" => InstructionInfo {
            flags: "***V1*",
            description: "Subtract",
            effect: "A=A-s",
        },
        "XOR" => InstructionInfo {
            flags: "***P00",
            description: "Logical Exclusive OR",
            effect: "A=Axs",
        },
        _ => return None,
    };
    Some(info)
}

fn no_flags(description: &'static str, effect: &'static str) -> InstructionInfo {
    InstructionInfo {
        flags: "------",
        description,
        effect,
    }
}

fn is_word_inc_dec(text: &str) -> bool {
    let Some(operand) = text.split_once(' ').map(|(_, operand)| operand) else {
        return false;
    };
    matches!(operand, "BC" | "DE" | "HL" | "SP" | "IX" | "IY")
}

fn t_states(bytes: &[u8], text: &str) -> Option<&'static str> {
    let (extra_prefixes, effective) = effective_bytes(bytes);
    if extra_prefixes != 0 {
        return None;
    }
    match effective {
        [0xCB, op, ..] => Some(t_states_cb(*op, false)),
        [0xED, op, ..] => t_states_ed(*op),
        [0xDD | 0xFD, 0xCB, _, op, ..] => Some(t_states_cb(*op, true)),
        [0xDD | 0xFD, op, ..] => t_states_indexed(*op, text),
        [op, ..] => Some(t_states_base(*op)),
        _ => None,
    }
}

fn effective_bytes(bytes: &[u8]) -> (usize, &[u8]) {
    let mut pos = 0usize;
    while pos + 1 < bytes.len()
        && matches!(bytes[pos], 0xDD | 0xFD)
        && matches!(bytes[pos + 1], 0xDD | 0xFD)
    {
        pos += 1;
    }
    (pos, &bytes[pos..])
}

fn t_states_base(op: u8) -> &'static str {
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let p = y >> 1;
    let q = y & 1;

    match x {
        0 => match z {
            0 => match y {
                2 => "13/8",
                3 => "12",
                4..=7 => "12/7",
                _ => "4",
            },
            1 => {
                if q == 0 {
                    "10"
                } else {
                    "11"
                }
            }
            2 => match (q, p) {
                (0, 0 | 1) | (1, 0 | 1) => "7",
                (0, 2) | (1, 2) => "16",
                (0, 3) | (1, 3) => "13",
                _ => unreachable!(),
            },
            3 => "6",
            4 | 5 => {
                if y == 6 {
                    "11"
                } else {
                    "4"
                }
            }
            6 => {
                if y == 6 {
                    "10"
                } else {
                    "7"
                }
            }
            7 => "4",
            _ => unreachable!(),
        },
        1 => {
            if op == 0x76 || y != 6 && z != 6 {
                "4"
            } else {
                "7"
            }
        }
        2 => {
            if z == 6 {
                "7"
            } else {
                "4"
            }
        }
        3 => match z {
            0 => "11/5",
            1 => {
                if q == 0 {
                    "10"
                } else {
                    match p {
                        0 => "10",
                        1 | 2 => "4",
                        3 => "6",
                        _ => unreachable!(),
                    }
                }
            }
            2 => "10",
            3 => match y {
                0 => "10",
                2 | 3 => "11",
                4 => "19",
                5 | 6 | 7 => "4",
                _ => "4",
            },
            4 => "17/10",
            5 => {
                if q == 0 {
                    "11"
                } else {
                    "17"
                }
            }
            6 => "7",
            7 => "11",
            _ => unreachable!(),
        },
        _ => unreachable!(),
    }
}

fn t_states_cb(op: u8, indexed: bool) -> &'static str {
    let x = op >> 6;
    let z = op & 7;
    if indexed {
        if x == 1 { "20" } else { "23" }
    } else if z == 6 {
        if x == 1 { "12" } else { "15" }
    } else {
        "8"
    }
}

fn t_states_ed(op: u8) -> Option<&'static str> {
    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    if x == 1 {
        return match z {
            0 | 1 => Some("12"),
            2 => Some("15"),
            3 => Some("20"),
            4 | 6 => Some("8"),
            5 => Some("14"),
            7 => match y {
                0..=3 => Some("9"),
                4 | 5 => Some("18"),
                _ => None,
            },
            _ => None,
        };
    }
    match op {
        0xA0..=0xA3 | 0xA8..=0xAB => Some("16"),
        0xB0..=0xB3 | 0xB8..=0xBB => Some("21/16"),
        _ => None,
    }
}

fn t_states_indexed(op: u8, text: &str) -> Option<&'static str> {
    if text.starts_with("DB ") {
        return None;
    }

    let x = op >> 6;
    let y = (op >> 3) & 7;
    let z = op & 7;
    let p = y >> 1;
    let q = y & 1;

    match x {
        0 => match z {
            1 if p == 2 && q == 0 => Some("14"),
            1 if p == 2 && q == 1 => Some("15"),
            2 if p == 2 => Some("20"),
            3 if p == 2 => Some("10"),
            4 | 5 if y == 4 || y == 5 => Some("8"),
            4 | 5 if y == 6 => Some("23"),
            6 if y == 4 || y == 5 => Some("11"),
            6 if y == 6 => Some("19"),
            _ => prefixed_base_t_states(op),
        },
        1 => {
            if y == 6 || z == 6 {
                Some("19")
            } else if y == 4 || y == 5 || z == 4 || z == 5 {
                Some("8")
            } else {
                prefixed_base_t_states(op)
            }
        }
        2 => {
            if z == 6 {
                Some("19")
            } else if z == 4 || z == 5 {
                Some("8")
            } else {
                prefixed_base_t_states(op)
            }
        }
        3 => match op {
            0x09 | 0x19 | 0x29 | 0x39 => Some("15"),
            0xE1 => Some("14"),
            0xE3 => Some("23"),
            0xE5 => Some("15"),
            0xE9 => Some("8"),
            0xF9 => Some("10"),
            _ => prefixed_base_t_states(op),
        },
        _ => None,
    }
}

fn prefixed_base_t_states(op: u8) -> Option<&'static str> {
    match t_states_base(op) {
        "4" => Some("8"),
        "6" => Some("10"),
        "7" => Some("11"),
        "10" => Some("14"),
        "11" => Some("15"),
        "12" => Some("16"),
        "13" => Some("17"),
        "16" => Some("20"),
        "17" => Some("21"),
        "19" => Some("23"),
        "11/5" => Some("15/9"),
        "12/7" => Some("16/11"),
        "13/8" => Some("17/12"),
        "17/10" => Some("21/14"),
        _ => None,
    }
}

const R: [&str; 8] = ["B", "C", "D", "E", "H", "L", "(HL)", "A"];
const R_ED_IN: [&str; 8] = ["B", "C", "D", "E", "H", "L", "F", "A"];
const RP: [&str; 4] = ["BC", "DE", "HL", "SP"];
const RP2: [&str; 4] = ["BC", "DE", "HL", "AF"];
const CC: [&str; 8] = ["NZ", "Z", "NC", "C", "PO", "PE", "P", "M"];
const ROT: [&str; 8] = ["RLC", "RRC", "RL", "RR", "SLA", "SRA", "SLL", "SRL"];
const MISC: [&str; 8] = ["RLCA", "RRCA", "RLA", "RRA", "DAA", "CPL", "SCF", "CCF"];

#[cfg(test)]
#[path = "disasm_tests.rs"]
mod tests;
