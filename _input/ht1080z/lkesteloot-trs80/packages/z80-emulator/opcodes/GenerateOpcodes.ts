// This program generates the Decode.ts source file for decoding
// and executing Z80 instructions. It takes as input the template
// (Decode.templates.ts) and the data files in the "opcodes" directory.

import * as fs from "fs";
import {toHex, isWordReg, isByteReg, toHexByte} from "z80-base";
import { OpcodeMap, opcodeMap, OpcodeVariant, opcodeVariantToOpcodeString, opcodeVariantToString } from "z80-inst";

/**
 * Params that qualify as "byte-sized".
 */
const BYTE_PARAMS = new Set(["a", "b", "c", "d", "e", "h", "l", "nn", "ixh", "ixl", "iyh", "iyl"]);

/**
 * Params that qualify as "word-sized".
 */
const WORD_PARAMS = new Set(["af", "bc", "de", "hl", "nnnn", "ix", "iy", "sp"]);

/**
 * Indentation for generate blocks.
 */
const INDENT = "    ";

/**
 * The two possible param sizes.
 */
enum DataWidth {
    BYTE, WORD
}

/**
 * Aliases point to a variant, but we must record the variant by identity until we know how to
 * retrieve its function from a map.
 */
type ResolvedAlias = {
    setter: string,
    canonicalVariant: OpcodeVariant,
};

/**
 * Track the indentation level of code currently being generated.
 */
let gIndent = "";
function enter(): void {
    gIndent += INDENT;
}
function exit(): void {
    gIndent = gIndent.substring(0, gIndent.length - INDENT.length);
}

/**
 * Add indented line to the output.
 */
function addLine(output: string[], line: string): void {
    if (line.length === 0) {
        output.push("");
    } else {
        output.push(gIndent + line);
    }
}

/**
 * Some operations have conditions (e.g., "Z" to mean "if the value is zero").
 * Generate the TypeScript "if" statement for it, or none if there's no condition.
 */
function addCondIf(output: string[], cond: string | undefined): void {
    if (cond !== undefined) {
        let not = cond.startsWith("n");
        let flag = (not ? cond.substring(1) : cond).toUpperCase();
        if (cond === "po") {
            not = true;
            flag = "P";
        } else if (cond === "pe") {
            not = false;
            flag = "P";
        } else if (cond === "p") {
            not = true;
            flag = "S";
        } else if (cond === "m") {
            not = false;
            flag = "S";
        }
        addLine(output, "if ((z80.regs.f & Flag." + flag + ") " + (not ? "===" : "!==") + " 0) {");
        enter();
    }
}

/**
 * Generate else statement for condition code. Returns whether there's a condition code.
 */
function addCondElse(output: string[], cond: string | undefined): boolean {
    if (cond !== undefined) {
        exit();
        addLine(output, "} else {");
        enter();
        return true;
    }

    return false;
}

/**
 * Finish the "if" block for a condition code.
 */
function addCondEndIf(output: string[], cond: string | undefined): void {
    if (cond !== undefined) {
        exit();
        addLine(output, "}");
    }
}

/**
 * Given a parameter, determine its width, or undefined if it can't be determined
 * (e.g., "(nnnn)").
 */
function determineParamWidth(param: string): DataWidth | undefined {
    if (BYTE_PARAMS.has(param)) {
        return DataWidth.BYTE;
    }
    if (WORD_PARAMS.has(param)) {
        return DataWidth.WORD;
    }

    return undefined;
}

/**
 * Given two parameters, determines the data width of the pair. At least one
 * of them must indicate the width, and if both do, they must match.
 */
function determineDataWidth(param1: string, param2: string): DataWidth {
    let dataWidth1 = determineParamWidth(param1);
    let dataWidth2 = determineParamWidth(param2);

    if (dataWidth1 === undefined) {
        if (dataWidth2 === undefined) {
            throw new Error(`Can't determine data width from "${param1}" and "${param2}"`);
        }
        return dataWidth2;
    }

    if (dataWidth2 !== undefined && dataWidth1 !== dataWidth2) {
        throw new Error(`Mismatch of data width between "${param1}" and "${param2}"`);
    }

    return dataWidth1;
}

/**
 * Generate 8-bit arithmetic code for the opcode and "A". The operand
 * must already be in "value".
 */
function emitArith8(output: string[], opcode: "add" | "adc" | "sub" | "sbc"): void {
    let addition = opcode.startsWith("a");
    let op = addition ? "add" : "sub";
    let opCap = addition ? "Add" : "Sub";
    let carry = opcode.endsWith("c");

    addLine(output, "let result = " + op + "16(z80.regs.a, value);");
    if (carry) {
        addLine(output, "if ((z80.regs.f & Flag.C) !== 0) {");
        enter();
        addLine(output, "result = " + (addition ? "inc" : "dec") + "16(result);");
        exit();
        addLine(output, "}");
    }
    addLine(output, "const lookup = (((z80.regs.a & 0x88) >> 3) |");
    addLine(output, "               ((value & 0x88) >> 2) |");
    addLine(output, "               ((result & 0x88) >> 1)) & 0xFF;");
    addLine(output, "z80.regs.a = result & 0xFF;");
    addLine(output, "z80.regs.f = (((result & 0x100) !== 0) ? Flag.C : 0) " +
        (addition ? "" : "| Flag.N ") +
        "| halfCarry" + opCap + "Table[lookup & 0x07] " + "" +
        "| overflow" + opCap + "Table[lookup >> 4] " +
        "| z80.sz53Table[z80.regs.a];");
}

/**
 * Generate 16-bit arithmetic code for the opcode and "dest". The operand
 * must already be in "value".
 */
function emitArith16(output: string[], opcode: "add" | "adc" | "sbc", dest: string): void {
    let addition = opcode.startsWith("a");
    let op = addition ? "+" : "-";
    let carry = opcode.endsWith("c");
    let mask = carry ? "0x8800" : "0x0800";

    addLine(output, "let result = z80.regs." + dest + " " + op + " value;");
    if (carry) {
        addLine(output, "if ((z80.regs.f & Flag.C) !== 0) {");
        enter();
        addLine(output, "result " + op + "= 1;");
        exit();
        addLine(output, "}");
    }
    addLine(output, "const lookup = (((z80.regs." + dest + " & " + mask + ") >> 11) |");
    addLine(output, "               ((value & " + mask + ") >> 10) |");
    addLine(output, "               ((result & " + mask + ") >> 9)) & 0xFF;");
    addLine(output, "z80.regs.memptr = inc16(z80.regs." + dest + ");");
    addLine(output, "z80.regs." + dest + " = result & 0xFFFF;");

    // Flags are set differently based on operation.
    switch (opcode) {
        case "add":
            addLine(output, "z80.regs.f = (z80.regs.f & (Flag.V | Flag.Z | Flag.S)) | ((result & 0x10000) !== 0 ? Flag.C : 0) | ((result >> 8) & (Flag.X3 | Flag.X5)) | halfCarryAddTable[lookup];");
            break;

        case "adc":
            addLine(output, "z80.regs.f = ((result & 0x10000) !== 0 ? Flag.C : 0) | overflowAddTable[lookup >> 4] | ((result >> 8) & (Flag.X3 | Flag.X5 | Flag.S)) | halfCarryAddTable[lookup & 0x07] | (result !== 0 ? 0 : Flag.Z);");
            break;

        case "sbc":
            addLine(output, "z80.regs.f = ((result & 0x10000) !== 0 ? Flag.C : 0) | Flag.N | overflowSubTable[lookup >> 4] | ((result >> 8) & (Flag.X3 | Flag.X5 | Flag.S)) | halfCarrySubTable[lookup & 0x07] | (result !== 0 ? 0 : Flag.Z);");
            break;
    }
}

/**
 * Handle 8-bit and 16-bit arithmetic operations.
 */
function handleArith(output: string[], opcode: "add" | "adc" | "sub" | "sbc", dest: string, src: string): void {
    addLine(output, "let value: number;");
    if (determineDataWidth(dest, src) == DataWidth.BYTE) {
        if (src.startsWith("(") && src.endsWith(")")) {
            const addr = src.substring(1, src.length - 1);
            if (isWordReg(addr)) {
                addLine(output, "value = z80.readByte(z80.regs." + addr + ");");
            } else if (addr.endsWith("+dd")) {
                const reg = addr.substring(0, addr.length - 3);
                addLine(output, "value = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.incTStateCount(5);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "z80.regs.memptr = (z80.regs." + reg + " + signedByte(value)) & 0xFFFF;");
                addLine(output, "value = z80.readByte(z80.regs.memptr);");
            } else {
                throw new Error("Unknown src address type: " + addr);
            }
        } else if (src === "nn") {
            addLine(output, "value = z80.readByte(z80.regs.pc);");
            addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        } else {
            addLine(output, "value = z80.regs." + src + ";");
        }
        if (dest === "a") {
            emitArith8(output, opcode);
        } else {
            throw new Error("8-bit " + opcode + " must have A as destination");
        }
    } else {
        // DataWidth.WORD.
        if (opcode === "sub") {
            throw new Error("SUB is not supported with 16 bits");
        }
        addLine(output, "z80.incTStateCount(7);");
        if (isWordReg(src)) {
            addLine(output, "value = z80.regs." + src + ";");
        } else {
            throw new Error("Unknown src type: " + src);
        }
        if (isWordReg(dest)) {
            emitArith16(output, opcode, dest);
        } else {
            throw new Error("Unknown dest type: " + dest);
        }
    }
}

function handleCp(output: string[], src: string): void {
    addLine(output, "let value: number;");
    if (src.startsWith("(") && src.endsWith(")")) {
        const addr = src.substring(1, src.length - 1);
        if (isWordReg(addr)) {
            addLine(output, "value = z80.readByte(z80.regs." + addr + ");");
        } else if (addr.endsWith("+dd")) {
            const reg = addr.substring(0, addr.length - 3);
            addLine(output, "value = z80.readByte(z80.regs.pc);");
            addLine(output, "z80.incTStateCount(5);");
            addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
            addLine(output, "z80.regs.memptr = (z80.regs." + reg + " + signedByte(value)) & 0xFFFF;");
            addLine(output, "value = z80.readByte(z80.regs.memptr);");
        } else {
            throw new Error("Unknown src address type: " + addr);
        }
    } else if (src === "nn") {
        addLine(output, "value = z80.readByte(z80.regs.pc);");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
    } else if (isByteReg(src)) {
        addLine(output, "value = z80.regs." + src + ";");
    } else {
        throw new Error("Unknown src type: " + src);
    }

    addLine(output, "const diff = (z80.regs.a - value) & 0xFFFF;");
    addLine(output, "const lookup = (((z80.regs.a & 0x88) >> 3) |");
    addLine(output, "               ((value & 0x88) >> 2) |");
    addLine(output, "               ((diff & 0x88) >> 1)) & 0xFF;");
    addLine(output, "let f = Flag.N;");
    addLine(output, "if ((diff & 0x100) != 0) f |= Flag.C;");
    addLine(output, "if (diff == 0) f |= Flag.Z;");
    addLine(output, "f |= halfCarrySubTable[lookup & 0x07];");
    addLine(output, "f |= overflowSubTable[lookup >> 4];");
    addLine(output, "f |= value & (Flag.X3 | Flag.X5);");
    addLine(output, "f |= diff & Flag.S;");
    addLine(output, "z80.regs.af = word(z80.regs.a, f);")
}

function handleEx(output: string[], op1: string, op2: string): void {
    if (op2 === "af'") {
        op2 = "afPrime";
    }

    addLine(output, "const rightValue = z80.regs." + op2 + ";");
    if (op1 === "(sp)") {
        addLine(output, "const leftValueL = z80.readByte(z80.regs.sp);");
        addLine(output, "const leftValueH = z80.readByte(inc16(z80.regs.sp));");
        addLine(output, "z80.incTStateCount(1);");
        addLine(output, "z80.writeByte(inc16(z80.regs.sp), hi(rightValue));");
        addLine(output, "z80.writeByte(z80.regs.sp, lo(rightValue));");
        addLine(output, "z80.incTStateCount(2);");
        addLine(output, "z80.regs.memptr = word(leftValueH, leftValueL);");
        addLine(output, "z80.regs." + op2 + " = word(leftValueH, leftValueL);");
    } else {
        addLine(output, "z80.regs." + op2 + " = z80.regs." + op1 + ";");
        addLine(output, "z80.regs." + op1 + " = rightValue;");
    }
}

// Rotate and shift instructions, which can also be undocumented DDCB/FDCB instructions with a register.
const ROTATE_SHIFT_MNEMONICS = new Set(["rlc", "rrc", "rl", "rr", "sla", "sra", "sll", "srl"]);

function handleJpJrCall(output: string[], opcode: string, cond: string | undefined, dest: string): void {
    // The official form JP (HL) jumps to HL itself, not to the address in memory at HL.
    if (dest.startsWith("(") && dest.endsWith(")")) {
        dest = dest.substring(1, dest.length - 1);
    }
    if (dest === "nnnn") {
        addLine(output, "z80.regs.memptr = z80.readByte(z80.regs.pc);");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        addLine(output, "z80.regs.memptr = word(z80.readByte(z80.regs.pc), z80.regs.memptr);");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
    }
    addCondIf(output, cond);
    if (opcode === "jr") {
        addLine(output, "const offset = z80.readByte(z80.regs.pc);");
        addLine(output, "z80.incTStateCount(5);");
        addLine(output, "z80.regs.pc = add16(z80.regs.pc, signedByte(offset));");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        addLine(output, "z80.regs.memptr = z80.regs.pc;");
        if (addCondElse(output, cond)) {
            addLine(output, "z80.incTStateCount(3);");
            addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        }
    } else {
        if (opcode === "call") {
            addLine(output, "z80.incTStateCount(1);");
            addLine(output, "z80.pushWord(z80.regs.pc);");
        }
        if (dest === "nnnn") {
            addLine(output, "z80.regs.pc = z80.regs.memptr;");
        } else if (isWordReg(dest)) {
            addLine(output, "z80.regs.pc = z80.regs." + dest + ";");
        } else {
            throw new Error("Unknown " + opcode + " dest: " + dest);
        }
    }
    addCondEndIf(output, cond);
}

function handleLd(output: string[], dest: string, src: string): void {
    if (dest.includes("dd")) {
        // Must fetch this first, before possible "nn" in src.
        addLine(output, "const dd = z80.readByte(z80.regs.pc);");
        if (isByteReg(src)) {
            addLine(output, "z80.incTStateCount(5);");
        }
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
    }
    addLine(output, "let value: number;");
    if (determineDataWidth(dest, src) == DataWidth.BYTE) {
        if (src.startsWith("(") && src.endsWith(")")) {
            const addr = src.substring(1, src.length - 1);
            if (isWordReg(addr)) {
                if (addr === "bc" || addr === "de") {
                    addLine(output, "z80.regs.memptr = inc16(z80.regs." + addr + ");");
                }
                addLine(output, "value = z80.readByte(z80.regs." + addr + ");");
            } else if (addr === "nnnn") {
                addLine(output, "value = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "value = word(z80.readByte(z80.regs.pc), value);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "z80.regs.memptr = inc16(value);");
                addLine(output, "value = z80.readByte(value);");
            } else if (addr.endsWith("+dd")) {
                const reg = addr.substring(0, addr.length - 3);
                addLine(output, "value = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.incTStateCount(5);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "z80.regs.memptr = (z80.regs." + reg + " + signedByte(value)) & 0xFFFF;");
                addLine(output, "value = z80.readByte(z80.regs.memptr);");
            } else {
                throw new Error("Unknown src address type: " + addr);
            }
        } else {
            if (src === "nn") {
                addLine(output, "value = z80.readByte(z80.regs.pc);");
                if (dest.includes("dd")) {
                    addLine(output, "z80.incTStateCount(2);");
                }
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
            } else {
                addLine(output, "value = z80.regs." + src + ";");
            }
        }
        if (src === "r" || src === "i" || dest === "r" || dest === "i") {
            addLine(output, "z80.incTStateCount(1);");
        }
        if (dest.startsWith("(") && dest.endsWith(")")) {
            const addr = dest.substring(1, dest.length - 1);
            if (isWordReg(addr)) {
                if (addr === "bc" || addr === "de") {
                    addLine(output, "z80.regs.memptr = word(z80.regs.a, inc16(z80.regs." + addr + "));");
                }
                addLine(output, "z80.writeByte(z80.regs." + addr + ", value);");
            } else if (addr === "nnnn") {
                addLine(output, "value = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "value = word(z80.readByte(z80.regs.pc), value);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "z80.regs.memptr = word(z80.regs.a, inc16(value));");
                addLine(output, "z80.writeByte(value, z80.regs.a);");
            } else if (addr.endsWith("+dd")) {
                const reg = addr.substring(0, addr.length - 3);
                // Value of "dd" is already in "dd" variable.
                addLine(output, "z80.regs.memptr = (z80.regs." + reg + " + signedByte(dd)) & 0xFFFF;");
                addLine(output, "z80.writeByte(z80.regs.memptr, value);")
            } else {
                throw new Error("Unknown dest address type: " + addr);
            }
        } else {
            addLine(output, "z80.regs." + dest + " = value;");
            if (src === "r" || src === "i") {
                addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | z80.sz53Table[z80.regs.a] | (z80.regs.iff2 ? Flag.V : 0);");
                // TODO: Must clear the P flag on NMOS Z80s. See "iff2_read" in Fuse.
            }
        }
    } else {
        // DataWidth.WORD.
        if (src.startsWith("(") && src.endsWith(")")) {
            const addr = src.substring(1, src.length - 1);
            if (addr === "nnnn") {
                addLine(output, "let addr = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "addr = word(z80.readByte(z80.regs.pc), addr);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "value = z80.readByte(addr);");
                addLine(output, "z80.regs.memptr = inc16(addr);");
                addLine(output, "value = word(z80.readByte(z80.regs.memptr), value);");
            } else {
                throw new Error("Unknown src address type: " + addr);
            }
        } else {
            if (src === "nnnn") {
                addLine(output, "value = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "value = word(z80.readByte(z80.regs.pc), value);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
            } else if (isWordReg(src)) {
                addLine(output, "value = z80.regs." + src + ";");
                if (isWordReg(dest) && (src === "hl" || src === "ix" || src === "iy")) {
                    addLine(output, "z80.incTStateCount(2);");
                }
            } else {
                throw new Error("Unknown src type: " + src);
            }
        }
        if (dest.startsWith("(") && dest.endsWith(")")) {
            const addr = dest.substring(1, dest.length - 1);
            if (addr === "nnnn") {
                addLine(output, "let addr = z80.readByte(z80.regs.pc);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "addr = word(z80.readByte(z80.regs.pc), addr);");
                addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                addLine(output, "z80.writeByte(addr, lo(value));");
                addLine(output, "addr = inc16(addr);");
                addLine(output, "z80.regs.memptr = addr;");
                addLine(output, "z80.writeByte(addr, hi(value));");
            } else {
                throw new Error("Unknown dest address type: " + addr);
            }
        } else {
            if (isWordReg(dest)) {
                addLine(output, "z80.regs." + dest + " = value;");
            } else {
                throw new Error("Unknown dest type: " + dest);
            }
        }
    }
}

function handleLogic(output: string[], opcode: string, operand: string): void {
    addLine(output, "let value: number;");
    if (operand === "nn") {
        addLine(output, "value = z80.readByte(z80.regs.pc);");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
    } else if (operand === "(hl)") {
        addLine(output, "value = z80.readByte(z80.regs.hl);");
    } else if (operand === "(ix+dd)" || operand === "(iy+dd)") {
        const reg = operand.substring(1, 3);
        addLine(output, "value = z80.readByte(z80.regs.pc);");
        addLine(output, "z80.incTStateCount(5);");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        addLine(output, "z80.regs.memptr = (z80.regs." + reg + " + signedByte(value)) & 0xFFFF;");
        addLine(output, "value = z80.readByte(z80.regs.memptr);");
    } else if (isByteReg(operand)) {
        addLine(output, "value = z80.regs." + operand + ";");
    } else {
        throw new Error("Unknown " + opcode + " operand " + operand);
    }
    const operator = opcode === "and" ? "&" : opcode === "or" ? "|" : "^";
    addLine(output, "z80.regs.a " + operator + "= value;");
    addLine(output, "z80.regs.f = z80.sz53pTable[z80.regs.a];");
    if (opcode === "and") {
        addLine(output, "z80.regs.f |= Flag.H;");
    }
}

function handleOutiOutd(output: string[], decrement: boolean, repeat: boolean): void {
    addLine(output, "z80.incTStateCount(1);");
    addLine(output, "const value = z80.readByte(z80.regs.hl);");
    addLine(output, "z80.regs.b = dec8(z80.regs.b);");
    addLine(output, "z80.regs.memptr = " + (decrement ? "dec" : "inc") + "16(z80.regs.bc);");
    addLine(output, "z80.writePort(z80.regs.bc, value);");
    addLine(output, "z80.regs.hl = " + (decrement ? "dec" : "inc") + "16(z80.regs.hl);");
    addLine(output, "const other = add8(value, z80.regs.l);");
    addLine(output, "z80.regs.f = (value & 0x80 ? Flag.N : 0 ) | (other < value ? Flag.H | Flag.C : 0) | (z80.parityTable[(other & 0x07) ^ z80.regs.b] ? Flag.P : 0) | z80.sz53Table[z80.regs.b];");
    if (repeat) {
        addLine(output, "if (z80.regs.b > 0) {");
        enter();
        addLine(output, "z80.incTStateCount(5);");
        addLine(output, "z80.regs.pc = add16(z80.regs.pc, -2);");
        exit();
        addLine(output, "}");
    }
}

function handleIniInd(output: string[], decrement: boolean, repeat: boolean): void {
    addLine(output, "z80.incTStateCount(1);");
    addLine(output, "const value = z80.readPort(z80.regs.bc);");
    addLine(output, "z80.writeByte(z80.regs.hl, value);");
    addLine(output, "z80.regs.memptr = " + (decrement ? "dec" : "inc") + "16(z80.regs.bc);");
    addLine(output, "z80.regs.b = dec8(z80.regs.b);");
    addLine(output, "const other = " + (decrement ? "dec" : "inc") + "8(add8(value, z80.regs.c));");
    addLine(output, "z80.regs.f = (value & 0x80 ? Flag.N : 0 ) | (other < value ? Flag.H | Flag.C : 0) | (z80.parityTable[(other & 0x07) ^ z80.regs.b] ? Flag.P : 0) | z80.sz53Table[z80.regs.b];");
    if (repeat) {
        addLine(output, "if (z80.regs.b > 0) {");
        enter();
        addLine(output, "z80.incTStateCount(5);");
        addLine(output, "z80.regs.pc = add16(z80.regs.pc, -2);");
        exit();
        addLine(output, "}");
    }
    addLine(output, "z80.regs.hl = " + (decrement ? "dec" : "inc") + "16(z80.regs.hl);");
}

function handleCpiCpd(output: string[], decrement: boolean, repeat: boolean): void {
    addLine(output, "const value = z80.readByte(z80.regs.hl);");
    addLine(output, "let diff = (z80.regs.a - value) & 0xFF;");
    addLine(output, "const lookup = ((z80.regs.a & 0x08) >> 3) | ((value & 0x08) >> 2) | ((diff & 0x08) >> 1);");
    addLine(output, "z80.incTStateCount(5);");
    addLine(output, "z80.regs.bc = dec16(z80.regs.bc);");
    addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | (z80.regs.bc !== 0 ? Flag.V : 0) | Flag.N | halfCarrySubTable[lookup] | (diff !== 0 ? 0 : Flag.Z) | (diff & Flag.S);");
    addLine(output, "if ((z80.regs.f & Flag.H) !== 0) diff = dec8(diff);");
    addLine(output, "z80.regs.f |= (diff & Flag.X3) | (((diff & 0x02) !== 0) ? Flag.X5 : 0);");
    if (repeat) {
        addLine(output, "if ((z80.regs.f & (Flag.V | Flag.Z)) === Flag.V) {");
        enter();
        addLine(output, "z80.incTStateCount(5);");
        addLine(output, "z80.regs.pc = add16(z80.regs.pc, -2);");
        addLine(output, "z80.regs.memptr = add16(z80.regs.pc, 1);");
        exit();
        addLine(output, "} else {");
        enter();
        addLine(output, "z80.regs.memptr = " + (decrement ? "dec" : "inc") + "16(z80.regs.memptr);");
        exit();
        addLine(output, "}");
    } else {
        addLine(output, "z80.regs.memptr = " + (decrement ? "dec" : "inc") + "16(z80.regs.memptr);");
    }
    addLine(output, "z80.regs.hl = " + (decrement ? "dec" : "inc") + "16(z80.regs.hl);");
}

function handleLdiLdd(output: string[], decrement: boolean, repeat: boolean): void {
    addLine(output, "let value = z80.readByte(z80.regs.hl);");
    addLine(output, "z80.writeByte(z80.regs.de, value);");
    addLine(output, "z80.incTStateCount(2);");
    addLine(output, "z80.regs.bc = dec16(z80.regs.bc);");
    addLine(output, "value = add16(value, z80.regs.a);");
    addLine(output, "z80.regs.f = (z80.regs.f & (Flag.C | Flag.Z | Flag.S)) | (z80.regs.bc !== 0 ? Flag.V : 0) | (value & Flag.X3) | ((value & 0x02) !== 0 ? Flag.X5 : 0)");
    if (repeat) {
        addLine(output, "if (z80.regs.bc !== 0) {");
        enter();
        addLine(output, "z80.incTStateCount(5);");
        addLine(output, "z80.regs.pc = add16(z80.regs.pc, -2);");
        addLine(output, "z80.regs.memptr = add16(z80.regs.pc, 1);");
        exit();
        addLine(output, "}");
    }
    addLine(output, "z80.regs.hl = " + (decrement ? "dec" : "inc") + "16(z80.regs.hl);");
    addLine(output, "z80.regs.de = " + (decrement ? "dec" : "inc") + "16(z80.regs.de);");
}

function handlePop(output: string[], reg: string): void {
    addLine(output, "z80.regs." + reg + " = z80.popWord();");
}

function handlePush(output: string[], reg: string): void {
    addLine(output, "z80.incTStateCount(1);");
    addLine(output, "z80.pushWord(z80.regs." + reg + ");");
}

function handleRet(output: string[], cond: string | undefined): void {
    if (cond !== undefined) {
        addLine(output, "z80.incTStateCount(1);");
    }
    addCondIf(output, cond);
    addLine(output, "z80.regs.pc = z80.popWord();");
    addLine(output, "z80.regs.memptr = z80.regs.pc;");
    addCondEndIf(output, cond);
}

function handleRst(output: string[], rst: number): void {
    addLine(output, "z80.incTStateCount(1);");
    addLine(output, "z80.pushWord(z80.regs.pc);");
    addLine(output, "z80.regs.pc = 0x" + toHex(rst, 4)+ ";");
    addLine(output, "z80.regs.memptr = z80.regs.pc;");
}

// Value to subtract is already in "value".
function emitSub(output: string[]): void {
    addLine(output, "const diff = sub16(z80.regs.a, value);");
    addLine(output, "const lookup = (((z80.regs.a & 0x88) >> 3) |");
    addLine(output, "               ((value & 0x88) >> 2) |");
    addLine(output, "               ((diff & 0x88) >> 1)) & 0xFF;");
    addLine(output, "z80.regs.a = diff;");
    addLine(output, "let f = Flag.N;");
    addLine(output, "if ((diff & 0x100) != 0) f |= Flag.C;");
    addLine(output, "f |= halfCarrySubTable[lookup & 0x07];");
    addLine(output, "f |= overflowSubTable[lookup >> 4];");
    addLine(output, "f |= z80.sz53Table[z80.regs.a];");
    addLine(output, "z80.regs.f = f;");
}

function handleOut(output: string[], port: string, src: string): void {
    if (port === "(nn)") {
        if (src !== "a") {
            throw new Error("When OUT to (nn), source must be A");
        }
        addLine(output, "const port = z80.readByte(z80.regs.pc);");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        addLine(output, "z80.regs.memptr = word(z80.regs.a, inc8(port));");
        addLine(output, "z80.writePort(word(z80.regs.a, port), z80.regs.a);");
    } else if (port === "(c)") {
        let value: string;
        if (src === "0") {
            // TODO: apparently it's 0xFF if the Z80 is CMOS?!
            value = "0x00";
        } else if (isByteReg(src)) {
            value = "z80.regs." + src;
        } else {
            throw new Error("Unknown source for OUT: " + src);
        }
        addLine(output, "z80.writePort(z80.regs.bc, " + value + ");");
        addLine(output, "z80.regs.memptr = inc16(z80.regs.bc);");
    } else {
        throw new Error("Unknown port for OUT: " + port);
    }
}

function handleIn(output: string[], dest: string, port: string): void {
    if (port === "(nn)") {
        if (dest !== "a") {
            throw new Error("When IN from (nn), destination must be A");
        }
        addLine(output, "const port = word(z80.regs.a, z80.readByte(z80.regs.pc));");
        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
        addLine(output, "z80.regs.a = z80.readPort(port);");
        addLine(output, "z80.regs.memptr = inc16(port);");
    } else if (port === "(c)") {
        if (!isByteReg(dest)) {
            throw new Error("Unknown dest for IN: " + dest);
        }
        addLine(output, "z80.regs.memptr = inc16(z80.regs.bc);");
        addLine(output, "z80.regs." + dest + " = z80.readPort(z80.regs.bc);");
        addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | z80.sz53pTable[z80.regs." + dest + "];");
    } else {
        throw new Error("Unknown port for OUT: " + port);
    }
}

// Return a tuple of bit value, C bitwise operator, and hex string to compare to.
// E.g., "set 5" would return [0x20, "|", "0x20"].
function getSetRes(opcode: "bit" | "set" | "res", bit: string): [number, string, string] {
    let bitValue = 1 << parseInt(bit, 10);
    let operator: string;

    switch (opcode) {
        case "bit":
            operator = "&";
            break;

        case "set":
            operator = "|";
            break;

        case "res":
            operator = "&";
            bitValue ^= 0xFF;
            break;
    }
    let hexBit = "0x" + toHex(bitValue, 2);

    return [bitValue, operator, hexBit];
}

function handleSetResBit(output: string[], opcode:"bit" | "set" | "res", bit: string, operand: string): void {
    const [bitValue, operator, hexBit] = getSetRes(opcode, bit);

    if (opcode === "bit") {
        if (isByteReg(operand)) {
            addLine(output, "const value = z80.regs." + operand + ";");
            addLine(output, "const hiddenValue = value;");
        } else if (operand === "(hl)") {
            addLine(output, "const value = z80.readByte(z80.regs.hl);");
            addLine(output, "const hiddenValue = hi(z80.regs.memptr);");
            addLine(output, "z80.incTStateCount(1);");
        } else if (operand.endsWith("+dd)")) {
            addLine(output, "const value = z80.readByte(z80.regs.memptr);");
            addLine(output, "const hiddenValue = hi(z80.regs.memptr);");
            addLine(output, "z80.incTStateCount(1);");
        }
        addLine(output, "let f = (z80.regs.f & Flag.C) | Flag.H | (hiddenValue & (Flag.X3 | Flag.X5));");
        addLine(output, "if ((value & " + hexBit + ") === 0) {");
        enter();
        addLine(output, "f |= Flag.P | Flag.Z;");
        exit();
        addLine(output, "}");
        if (bitValue === 0x80) {
            addLine(output, "if ((value & " + hexBit + ") !== 0) {");
            enter();
            addLine(output, "f |= Flag.S;");
            exit();
            addLine(output, "}");
        }
        addLine(output, "z80.regs.f = f;");
    } else {
        // set or res.
        if (isByteReg(operand)) {
            addLine(output, "z80.regs." + operand + " " + operator + "= " + hexBit + ";");
        } else if (operand === "(hl)") {
            addLine(output, "const value = z80.readByte(z80.regs.hl);");
            addLine(output, "z80.incTStateCount(1);");
            addLine(output, "z80.writeByte(z80.regs.hl, value " + operator + " " + hexBit + ");");
        } else if (operand.endsWith("+dd)")) {
            addLine(output, "const value = z80.readByte(z80.regs.memptr);");
            addLine(output, "z80.incTStateCount(1);");
            addLine(output, "z80.writeByte(z80.regs.memptr, value " + operator + " " + hexBit + ");");
        }
    }
}

function handleRotateShiftIncDec(output: string[], opcode: string, operand: string):void {
    // Read operand.
    addLine(output, "let value: number;");
    if (isByteReg(operand) || isWordReg(operand)) {
        addLine(output, "value = z80.regs." + operand + ";");
    } else if (operand === "(hl)") {
        addLine(output, "value = z80.readByte(z80.regs.hl);");
        addLine(output, "z80.incTStateCount(1);");
    } else if (operand.endsWith("+dd)")) {
        if (opcode === "inc" || opcode === "dec") {
            const reg = operand.substring(1, 3);
            addLine(output, "const offset = z80.readByte(z80.regs.pc);");
            addLine(output, "z80.incTStateCount(5);");
            addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
            addLine(output, "z80.regs.memptr = add16(z80.regs." + reg + ", signedByte(offset));");
        }
        addLine(output, "value = z80.readByte(z80.regs.memptr);");
        addLine(output, "z80.incTStateCount(1);");
    } else {
        throw new Error("Unknown operand for " + opcode + ": " + operand);
    }

    // Perform operation.
    // TODO this oldValue is sometimes not used and generates a lot of warnings.
    addLine(output, "const oldValue = value;");
    switch (opcode) {
        case "rl":
            addLine(output, "value = ((value << 1) | ((z80.regs.f & Flag.C) !== 0 ? 1 : 0)) & 0xFF;");
            break;

        case "rlc":
            addLine(output, "value = ((value << 1) | (value >> 7)) & 0xFF;");
            break;

        case "rr":
            addLine(output, "value = (value >> 1) | ((z80.regs.f & Flag.C) !== 0 ? 0x80 : 0);");
            break;

        case "rrc":
            addLine(output, "value = ((value >> 1) | (value << 7)) & 0xFF;");
            break;

        case "sla":
            addLine(output, "value = (value << 1) & 0xFF;");
            break;

        case "sll":
            addLine(output, "value = ((value << 1) | 0x01) & 0xFF;");
            break;

        case "sra":
            addLine(output, "value = (value & 0x80) | (value >> 1);");
            break;

        case "srl":
            addLine(output, "value = value >> 1;");
            break;

        case "inc":
        case "dec":
            if (isWordReg(operand)) {
                addLine(output, "z80.incTStateCount(2);");
                addLine(output, "value = " + opcode + "16(value);");
            } else {
                addLine(output, "value = " + opcode + "8(value);");
                // TODO is this right that oldValue is used in dec but value is used in inc?
                if (opcode === "dec") {
                    addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | (value === 0x7F ? Flag.V : 0) | ((oldValue & 0x0F) !== 0 ? 0 : Flag.H) | Flag.N | z80.sz53Table[value];");
                } else {
                    addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | (value === 0x80 ? Flag.V : 0) | ((value & 0x0F) !== 0 ? 0 : Flag.H) | z80.sz53Table[value];");
                }
            }
            break;
    }

    if (opcode !== "inc" && opcode !== "dec") {
        // Which bit goes into the carry flag.
        const bitIntoCarry = opcode.substring(1, 2) === "l" ? "0x80" : "0x01";
        addLine(output, "z80.regs.f = ((oldValue & " + bitIntoCarry + ") !== 0 ? Flag.C : 0) | z80.sz53pTable[value];");
    }

    // Write operand.
    if (isByteReg(operand) || isWordReg(operand)) {
        addLine(output, "z80.regs." + operand + " = value;");
    } else if (operand === "(hl)") {
        addLine(output, "z80.writeByte(z80.regs.hl, value);");
    } else if (operand.endsWith("+dd)")) {
        addLine(output, "z80.writeByte(z80.regs.memptr, value);");
    }
}

function handleDaa(output: string[]): void {
    addLine(output, "let value = 0;");
    addLine(output, "let carry = z80.regs.f & Flag.C;");
    addLine(output, "if ((z80.regs.f & Flag.H) !== 0 || ((z80.regs.a & 0x0F) > 9)) {");
    enter();
    addLine(output, "value = 6; // Skip over hex digits in lower nybble.");
    exit();
    addLine(output, "}");
    addLine(output, "if (carry !== 0 || z80.regs.a > 0x99) {");
    enter();
    addLine(output, "value |= 0x60; // Skip over hex digits in upper nybble.");
    exit();
    addLine(output, "}");
    addLine(output, "if (z80.regs.a > 0x99) {");
    enter();
    addLine(output, "carry = Flag.C;");
    exit();
    addLine(output, "}");
    addLine(output, "if ((z80.regs.f & Flag.N) !== 0) {");
    enter();
    emitArith8(output, "sub");
    exit();
    addLine(output, "} else {");
    enter();
    emitArith8(output, "add");
    exit();
    addLine(output, "}");
    addLine(output, "z80.regs.f = (z80.regs.f & ~(Flag.C | Flag.P)) | carry | z80.parityTable[z80.regs.a];");
}

function handleRotateA(output: string[], opcode: string): void {
    // Can't use "rr" etc. code here, the flags are set differently.
    addLine(output, "const oldA = z80.regs.a;");

    switch (opcode) {
        case "rla":
            addLine(output, "z80.regs.a = ((z80.regs.a << 1) | ((z80.regs.f & Flag.C) !== 0 ? 0x01 : 0)) & 0xFF;");
            break;

        case "rra":
            addLine(output, "z80.regs.a = (z80.regs.a >> 1) | ((z80.regs.f & Flag.C) !== 0 ? 0x80 : 0);");
            break;

        case "rlca":
            addLine(output, "z80.regs.a = ((z80.regs.a >> 7) | (z80.regs.a << 1)) & 0xFF;");
            break;

        case "rrca":
            addLine(output, "z80.regs.a = ((z80.regs.a >> 1) | (z80.regs.a << 7)) & 0xFF;");
            break;
    }

    // Which bit goes into the carry flag.
    const bitIntoCarry = opcode.substring(1, 2) === "l" ? "0x80" : "0x01";
    addLine(output, "z80.regs.f = (z80.regs.f & (Flag.P | Flag.Z | Flag.S)) | (z80.regs.a & (Flag.X3 | Flag.X5)) | ((oldA & " + bitIntoCarry + ") !== 0 ? Flag.C : 0);");
}

/**
 * Fills in the dispatch map for this prefix and sub-prefixes.
 *
 * @param opcodeMap map from opcode to either a variant or a sub-map.
 * @param dispatchMap the map we're building: from prefix (like "base" or "ddcb") to the code that generates a map for it.
 * @param variantMap map from variant (by identity) to a snippet of code for retrieving its function.
 * @param aliases array of setters and the variants they should point to.
 * @param prefix Prefix for this opcodeMap ("base" or "ddcb").
 */
function generateDispatch(opcodeMap: OpcodeMap,
                          dispatchMap: Map<string, string>,
                          variantMap: Map<OpcodeVariant, string>,
                          aliases: ResolvedAlias[],
                          prefix: string): void {

    // Lines for the code we'll be putting in the map.
    const output: string[] = [];

    // Name of the TypeScript map to insert into.
    const mapName = "decodeMap" + prefix.toUpperCase();

    // Handle non-aliases.
    for (const [opcode, value] of opcodeMap.entries()) {
        const hexOpcode = toHex(opcode, 2);
        const setter = mapName + ".set(0x" + hexOpcode + ", ";

        if (!(value instanceof Map) && value.aliasOf !== undefined) {
            // Don't handle aliases here, they're done at the very end.
            aliases.push({
                setter: setter,
                canonicalVariant: value.aliasOf,
            });
            continue;
        }

        const comment = value instanceof Map
            ? "shift " + toHexByte(opcode).toLowerCase()
            : opcodeVariantToString(value);
        addLine(output, setter + "(z80: Z80) => { // " + comment);
        enter();

        if (value instanceof Map) {
            const newPrefix = (prefix === "base" ? "" : prefix) + toHexByte(opcode);
            const oldIndent = gIndent;
            gIndent = "";
            generateDispatch(value, dispatchMap, variantMap, aliases, newPrefix);
            gIndent = oldIndent;
            addLine(output, "decode" + newPrefix.toUpperCase() + "(z80);");
        } else {
            const variant = value;
            const mnemonic = variant.mnemonic;
            const params = variant.params;

            // How to retrieve this variant's function later if we need it.
            variantMap.set(variant, mapName + ".get(0x" + hexOpcode + ") as OpcodeFunc");

            // Special case handling for undocumented DDCB and FDCB instructions that also copy
            // the result to a register. Two basic formats:
            //     SRL (IY+dd),A
            //     RES 7,(IY+dd),A
            const isRotateShiftToReg = ROTATE_SHIFT_MNEMONICS.has(mnemonic) && params.length === 2;
            const isSetResToReg = (mnemonic === "set" || mnemonic === "res") && params.length === 3;
            if (isRotateShiftToReg || isSetResToReg) {
                const reg = params[params.length - 1];
                const newOpcode = mnemonic;

                if (newOpcode === "set" || newOpcode === "res") {
                    const bit = params[0];
                    const [_, operator, hexBit] = getSetRes(newOpcode, bit);
                    addLine(output, "z80.regs." + reg + " = z80.readByte(z80.regs.memptr) " + operator + " " + hexBit + ";");
                    addLine(output, "z80.incTStateCount(1);");
                    addLine(output, "z80.writeByte(z80.regs.memptr, z80.regs." + reg + ");");
                } else {
                    addLine(output, "z80.regs." + reg + " = z80.readByte(z80.regs.memptr);");
                    addLine(output, "z80.incTStateCount(1);");
                    addLine(output, "{");
                    enter();
                    handleRotateShiftIncDec(output, newOpcode, reg);
                    exit();
                    addLine(output, "}");
                    addLine(output, "z80.writeByte(z80.regs.memptr, z80.regs." + reg + ");");
                }
            } else {
                switch (mnemonic) {
                    case "nop": {
                        // Nothing to do.
                        break;
                    }

                    case "add":
                    case "adc":
                    case "sub":
                    case "sbc": {
                        // The official form of SUB has no destination (SUB B); the others have two (ADD A,B).
                        if (params.length !== 1 && params.length !== 2) {
                            throw new Error(mnemonic + " requires one or two params");
                        }
                        const [dest, src] = params.length === 1 ? ["a", params[0]] : params;
                        handleArith(output, mnemonic, dest, src);
                        break;
                    }

                    case "cp": {
                        // The official form is CP B, but also accept CP A,B.
                        if (params.length !== 1 && params.length !== 2) {
                            throw new Error("CP requires one or two params: " + params);
                        }
                        handleCp(output, params[params.length - 1]);
                        break;
                    }

                    case "di": {
                        addLine(output, "z80.regs.iff1 = 0;");
                        addLine(output, "z80.regs.iff2 = 0;");
                        break;
                    }

                    case "ex": {
                        if (params.length !== 2) {
                            throw new Error("EX requires two params");
                        }
                        const [op1, op2] = params;
                        handleEx(output, op1, op2);
                        break;
                    }

                    case "ei": {
                        // TODO Wait another instruction before enabling interrupts.
                        addLine(output, "z80.regs.iff1 = 1;");
                        addLine(output, "z80.regs.iff2 = 1;");
                        break;
                    }

                    case "im": {
                        addLine(output, "z80.regs.im = " + parseInt(params[0], 10) + ";");
                        break;
                    }

                    case "reti":
                    case "retn": {
                        addLine(output, "z80.regs.iff1 = z80.regs.iff2;");
                        addLine(output, "z80.regs.pc = z80.popWord();");
                        addLine(output, "z80.regs.memptr = z80.regs.pc;");
                        break;
                    }

                    case "neg": {
                        addLine(output, "const value = z80.regs.a;");
                        addLine(output, "z80.regs.a = 0;");
                        emitSub(output);
                        break;
                    }

                    case "jr":
                    case "call":
                    case "jp": {
                        let cond: string | undefined;
                        let dest: string;
                        if (params.length == 2) {
                            cond = params[0];
                            dest = params[1];
                        } else {
                            cond = undefined;
                            dest = params[0];
                        }
                        handleJpJrCall(output, mnemonic, cond, dest)
                        break;
                    }

                    case "ld": {
                        if (params.length !== 2) {
                            throw new Error("LD requires two params");
                        }
                        const [dest, src] = params;
                        handleLd(output, dest, src);
                        break;
                    }

                    case "or":
                    case "and":
                    case "xor": {
                        let operand: string;
                        if (params.length === 2) {
                            if (params[0] === "a") {
                                operand = params[1];
                            } else {
                                throw new Error("First operand of " + mnemonic + " must be A");
                            }
                        } else if (params.length === 1) {
                            operand = params[0];
                        } else {
                            throw new Error("LD requires two params");
                        }
                        handleLogic(output, mnemonic, operand);
                        break;
                    }

                    case "outi":
                    case "outd":
                    case "otir":
                    case "otdr": {
                        handleOutiOutd(output, mnemonic === "otdr" || mnemonic === "outd", mnemonic.endsWith("r"));
                        break;
                    }

                    case "ini":
                    case "ind":
                    case "inir":
                    case "indr": {
                        handleIniInd(output, mnemonic.startsWith("ind"), mnemonic.endsWith("r"));
                        break;
                    }

                    case "cpi":
                    case "cpd":
                    case "cpir":
                    case "cpdr": {
                        handleCpiCpd(output, mnemonic.startsWith("cpd"), mnemonic.endsWith("r"));
                        break;
                    }

                    case "ldi":
                    case "ldd":
                    case "ldir":
                    case "lddr": {
                        handleLdiLdd(output, mnemonic.startsWith("ldd"), mnemonic.endsWith("r"));
                        break;
                    }

                    case "pop": {
                        if (params.length !== 1) {
                            throw new Error("POP requires one param");
                        }
                        handlePop(output, params[0]);
                        break;
                    }

                    case "push": {
                        if (params.length !== 1) {
                            throw new Error("PUSH requires one param");
                        }
                        handlePush(output, params[0]);
                        break;
                    }

                    case "ret": {
                        handleRet(output, params[0]);
                        break;
                    }

                    case "rst": {
                        handleRst(output, parseInt(params[0], 16));
                        break;
                    }

                    case "out": {
                        const [port, src] = params;
                        handleOut(output, port, src);
                        break;
                    }

                    case "in": {
                        // IN (C) sets the flags and discards the value, as if it were loaded into F.
                        const [dest, port] = params.length === 1 ? ["f", params[0]] : params;
                        handleIn(output, dest, port);
                        break;
                    }

                    case "rld": {
                        addLine(output, "const tmp = z80.readByte(z80.regs.hl);");
                        addLine(output, "z80.incTStateCount(4);");
                        addLine(output, "z80.writeByte(z80.regs.hl, ((tmp << 4) | (z80.regs.a & 0x0F)) & 0xFF);");
                        addLine(output, "z80.regs.a = (z80.regs.a & 0xF0) | (tmp >> 4);");
                        addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | z80.sz53pTable[z80.regs.a];");
                        addLine(output, "z80.regs.memptr = inc16(z80.regs.hl);");
                        break;
                    }

                    case "rrd": {
                        addLine(output, "const tmp = z80.readByte(z80.regs.hl);");
                        addLine(output, "z80.incTStateCount(4);");
                        addLine(output, "z80.writeByte(z80.regs.hl, ((z80.regs.a << 4) | (tmp >> 4)) & 0xFF);");
                        addLine(output, "z80.regs.a = (z80.regs.a & 0xF0) | (tmp & 0x0F);");
                        addLine(output, "z80.regs.f = (z80.regs.f & Flag.C) | z80.sz53pTable[z80.regs.a];");
                        addLine(output, "z80.regs.memptr = inc16(z80.regs.hl);");
                        break;
                    }

                    case "exx": {
                        addLine(output, "let tmp: number;");
                        addLine(output, "tmp = z80.regs.bc; z80.regs.bc = z80.regs.bcPrime; z80.regs.bcPrime = tmp;");
                        addLine(output, "tmp = z80.regs.de; z80.regs.de = z80.regs.dePrime; z80.regs.dePrime = tmp;");
                        addLine(output, "tmp = z80.regs.hl; z80.regs.hl = z80.regs.hlPrime; z80.regs.hlPrime = tmp;");
                        break;
                    }

                    case "bit":
                    case "set":
                    case "res": {
                        const [bit, operand] = params;
                        handleSetResBit(output, mnemonic, bit, operand);
                        break;
                    }

                    case "rl":
                    case "rlc":
                    case "rr":
                    case "rrc":
                    case "sla":
                    case "sll":
                    case "sra":
                    case "srl":
                    case "inc":
                    case "dec": {
                        handleRotateShiftIncDec(output, mnemonic, params[0]);
                        break;
                    }

                    case "halt": {
                        addLine(output, "z80.regs.halted = 1;");
                        addLine(output, "z80.regs.pc = dec16(z80.regs.pc);");
                        break;
                    }

                    case "ccf": {
                        // Various docs (like "Undocumented Z80 Documented") claim that flag bits 3 and 5
                        // are taken from A, but both trs80gp and the Fuse project use the OR of A and F.
                        addLine(output, "z80.regs.f = (z80.regs.f & (Flag.P | Flag.Z | Flag.S)) | ((z80.regs.f & Flag.C) !== 0 ? Flag.H : Flag.C) | ((z80.regs.f | z80.regs.a) & (Flag.X3 | Flag.X5));");
                        break;
                    }

                    case "scf": {
                        // Various docs (like "Undocumented Z80 Documented") claim that flag bits 3 and 5
                        // are taken from A, but both trs80gp and the Fuse project use the OR of A and F.
                        addLine(output, "z80.regs.f = (z80.regs.f & (Flag.P | Flag.Z | Flag.S)) | Flag.C | ((z80.regs.f | z80.regs.a) & (Flag.X3 | Flag.X5));");
                        break;
                    }

                    case "cpl": {
                        addLine(output, "z80.regs.a ^= 0xFF;");
                        addLine(output, "z80.regs.f = (z80.regs.f & (Flag.C | Flag.P | Flag.Z | Flag.S)) | (z80.regs.a & (Flag.X3 | Flag.X5)) | Flag.N | Flag.H;");
                        break;
                    }

                    case "daa": {
                        handleDaa(output);
                        break;
                    }

                    case "rla":
                    case "rra":
                    case "rlca":
                    case "rrca": {
                        handleRotateA(output, mnemonic);
                        break;
                    }

                    case "djnz": {
                        addLine(output, "z80.incTStateCount(1);");
                        addLine(output, "z80.regs.b = dec8(z80.regs.b);");
                        addLine(output, "if (z80.regs.b !== 0) {");
                        enter();
                        handleJpJrCall(output, "jr", undefined, "nn");
                        exit();
                        addLine(output, "} else {");
                        enter();
                        addLine(output, "z80.incTStateCount(3);");
                        addLine(output, "z80.regs.pc = inc16(z80.regs.pc);");
                        exit();
                        addLine(output, "}");
                        break;
                    }

                    default:
                        console.log("Unhandled opcode in " + prefix + "");
                        break;
                }
            }
        }

        exit();
        addLine(output, "});");
    }

    if (gIndent !== "") {
        throw new Error("Unbalanced enter/exit");
    }

    const code = output.join("\n");
    dispatchMap.set(prefix, code);
}

function generateAliasCode(aliases: ResolvedAlias[], variantMap: Map<OpcodeVariant, string>): string {
    const lines: string[] = [];

    for (const {setter, canonicalVariant} of aliases) {
        const getter = variantMap.get(canonicalVariant);
        if (getter === undefined) {
            throw new Error("Can't find variant for " + opcodeVariantToString(canonicalVariant) +
                " (" + opcodeVariantToOpcodeString(canonicalVariant) + ")");
        }
        lines.push(setter + getter + ");");
    }

    return lines.join("\n");
}

/**
 * Generate the actual source file from the map.
 * @param dispatchMap map from prefix (like "base" or "ddcb") to the code that generates a map for it.
 * @param aliases code that inserts aliases into all the maps.
 */
function generateSource(dispatchMap: Map<string, string>,
                        aliases: string): void {

    let template = fs.readFileSync("src/Decode.template.ts", "utf-8");
    const preamble = "// This file was generated by GenerateOpcodes.ts. Do not modify.\n\n";
    template = preamble + template;

    for (const [prefix, dispatch] of dispatchMap.entries()) {
        const key = "// DECODE_" + prefix.toUpperCase();
        template = template.replace(key, dispatch);
    }

    template = template.replace("// ALIASES", aliases);

    fs.writeFileSync("src/Decode.ts", template);
}

/**
 * Create the "Decode.ts" file from all Z80 instructions.
 */
function generateOpcodes(): void {
    // Map from prefix (like "base" or "ddcb") to the code that generates a map for it.
    const dispatchMap = new Map<string, string>();
    // Map from variant (by identity) to a bit of code to fetch the function for it.
    const variantMap = new Map<OpcodeVariant, string>();
    // List of aliases we need to generate at the very end.
    const aliases: ResolvedAlias[] = [];

    generateDispatch(opcodeMap, dispatchMap, variantMap, aliases, "base");
    generateSource(dispatchMap, generateAliasCode(aliases, variantMap));
}

generateOpcodes();
