import "mocha";
import * as expect from "expect";

import { InputStream } from "../../src/parser/input-stream";
import { TokenStream, TokenType } from "../../src/parser/token-stream";

describe("Parser - token: operator-like", () => {
  it("get: register A", () => {
    testToken("a", TokenType.A);
    testToken("A", TokenType.A);
  });

  it("get: register B", () => {
    testToken("b", TokenType.B);
    testToken("B", TokenType.B);
  });

  it("get: register C", () => {
    testToken("c", TokenType.C);
    testToken("C", TokenType.C);
  });

  it("get: register D", () => {
    testToken("d", TokenType.D);
    testToken("D", TokenType.D);
  });

  it("get: register E", () => {
    testToken("e", TokenType.E);
    testToken("E", TokenType.E);
  });

  it("get: register H", () => {
    testToken("h", TokenType.H);
    testToken("H", TokenType.H);
  });

  it("get: register L", () => {
    testToken("l", TokenType.L);
    testToken("L", TokenType.L);
  });

  it("get: register I", () => {
    testToken("i", TokenType.I);
    testToken("I", TokenType.I);
  });

  it("get: register R", () => {
    testToken("r", TokenType.R);
    testToken("R", TokenType.R);
  });

  it("get: register XL", () => {
    testToken("xl", TokenType.XL);
    testToken("XL", TokenType.XL);
    testToken("ixl", TokenType.XL);
    testToken("IXL", TokenType.XL);
    testToken("IXl", TokenType.XL);
  });

  it("get: register YL", () => {
    testToken("yl", TokenType.YL);
    testToken("YL", TokenType.YL);
    testToken("iyl", TokenType.YL);
    testToken("IYL", TokenType.YL);
    testToken("IYl", TokenType.YL);
  });

  it("get: register BC", () => {
    testToken("bc", TokenType.BC);
    testToken("BC", TokenType.BC);
  });

  it("get: register DE", () => {
    testToken("de", TokenType.DE);
    testToken("DE", TokenType.DE);
  });

  it("get: register HL", () => {
    testToken("hl", TokenType.HL);
    testToken("HL", TokenType.HL);
  });

  it("get: register SP", () => {
    testToken("sp", TokenType.SP);
    testToken("SP", TokenType.SP);
  });

  it("get: register IX", () => {
    testToken("ix", TokenType.IX);
    testToken("IX", TokenType.IX);
  });

  it("get: register IY", () => {
    testToken("iy", TokenType.IY);
    testToken("IY", TokenType.IY);
  });

  it("get: register AF", () => {
    testToken("af", TokenType.AF);
    testToken("AF", TokenType.AF);
  });

  it("get: register AF'", () => {
    testToken("af'", TokenType.AF_);
    testToken("AF'", TokenType.AF_);
  });

  it("get: token Z", () => {
    testToken("z", TokenType.Z);
    testToken("Z", TokenType.Z);
  });

  it("get: token NZ", () => {
    testToken("nz", TokenType.NZ);
    testToken("NZ", TokenType.NZ);
  });

  it("get: token NC", () => {
    testToken("nc", TokenType.NC);
    testToken("NC", TokenType.NC);
  });

  it("get: token PE", () => {
    testToken("pe", TokenType.PE);
    testToken("PE", TokenType.PE);
  });

  it("get: token PO", () => {
    testToken("po", TokenType.PO);
    testToken("PO", TokenType.PO);
  });

  it("get: token P", () => {
    testToken("p", TokenType.P);
    testToken("P", TokenType.P);
  });

  it("get: token M", () => {
    testToken("m", TokenType.M);
    testToken("M", TokenType.M);
  });

  it("get: nop instruction", () => {
    testToken("nop", TokenType.Nop);
    testToken("NOP", TokenType.Nop);
  });

  it("get: rlca instruction", () => {
    testToken("rlca", TokenType.Rlca);
    testToken("RLCA", TokenType.Rlca);
  });

  it("get: rrca instruction", () => {
    testToken("rrca", TokenType.Rrca);
    testToken("RRCA", TokenType.Rrca);
  });

  it("get: rla instruction", () => {
    testToken("rla", TokenType.Rla);
    testToken("RLA", TokenType.Rla);
  });

  it("get: rra instruction", () => {
    testToken("rra", TokenType.Rra);
    testToken("RRA", TokenType.Rra);
  });

  it("get: cpl instruction", () => {
    testToken("cpl", TokenType.Cpl);
    testToken("CPL", TokenType.Cpl);
  });

  it("get: scf instruction", () => {
    testToken("scf", TokenType.Scf);
    testToken("SCF", TokenType.Scf);
  });

  it("get: halt instruction", () => {
    testToken("halt", TokenType.Halt);
    testToken("HALT", TokenType.Halt);
  });

  it("get: ret instruction", () => {
    testToken("ret", TokenType.Ret);
    testToken("RET", TokenType.Ret);
  });

  it("get: exx instruction", () => {
    testToken("exx", TokenType.Exx);
    testToken("EXX", TokenType.Exx);
  });

  it("get: di instruction", () => {
    testToken("di", TokenType.Di);
    testToken("DI", TokenType.Di);
  });

  it("get: ei instruction", () => {
    testToken("ei", TokenType.Ei);
    testToken("EI", TokenType.Ei);
  });

  it("get: neg instruction", () => {
    testToken("neg", TokenType.Neg);
    testToken("NEG", TokenType.Neg);
  });

  it("get: retn instruction", () => {
    testToken("retn", TokenType.Retn);
    testToken("RETN", TokenType.Retn);
  });

  it("get: reti instruction", () => {
    testToken("reti", TokenType.Reti);
    testToken("RETI", TokenType.Reti);
  });

  it("get: rld instruction", () => {
    testToken("rld", TokenType.Rld);
    testToken("RLD", TokenType.Rld);
  });

  it("get: rrd instruction", () => {
    testToken("rrd", TokenType.Rrd);
    testToken("RRD", TokenType.Rrd);
  });

  it("get: ldi instruction", () => {
    testToken("ldi", TokenType.Ldi);
    testToken("LDI", TokenType.Ldi);
  });

  it("get: cpi instruction", () => {
    testToken("cpi", TokenType.Cpi);
    testToken("CPI", TokenType.Cpi);
  });

  it("get: ini instruction", () => {
    testToken("ini", TokenType.Ini);
    testToken("INI", TokenType.Ini);
  });

  it("get: outi instruction", () => {
    testToken("outi", TokenType.Outi);
    testToken("OUTI", TokenType.Outi);
  });

  it("get: ldd instruction", () => {
    testToken("ldd", TokenType.Ldd);
    testToken("LDD", TokenType.Ldd);
  });

  it("get: cpd instruction", () => {
    testToken("cpd", TokenType.Cpd);
    testToken("CPD", TokenType.Cpd);
  });

  it("get: ind instruction", () => {
    testToken("ind", TokenType.Ind);
    testToken("IND", TokenType.Ind);
  });

  it("get: outd instruction", () => {
    testToken("outd", TokenType.Outd);
    testToken("OUTD", TokenType.Outd);
  });

  it("get: ldir instruction", () => {
    testToken("ldir", TokenType.Ldir);
    testToken("LDIR", TokenType.Ldir);
  });

  it("get: cpir instruction", () => {
    testToken("cpir", TokenType.Cpir);
    testToken("CPIR", TokenType.Cpir);
  });

  it("get: inir instruction", () => {
    testToken("inir", TokenType.Inir);
    testToken("INIR", TokenType.Inir);
  });

  it("get: otir instruction", () => {
    testToken("otir", TokenType.Otir);
    testToken("OTIR", TokenType.Otir);
  });

  it("get: lddr instruction", () => {
    testToken("lddr", TokenType.Lddr);
    testToken("LDDR", TokenType.Lddr);
  });

  it("get: cpdr instruction", () => {
    testToken("cpdr", TokenType.Cpdr);
    testToken("CPDR", TokenType.Cpdr);
  });

  it("get: indr instruction", () => {
    testToken("indr", TokenType.Indr);
    testToken("INDR", TokenType.Indr);
  });

  it("get: otdr instruction", () => {
    testToken("otdr", TokenType.Otdr);
    testToken("OTDR", TokenType.Otdr);
  });

  it("get: ld instruction", () => {
    testToken("ld", TokenType.Ld);
    testToken("LD", TokenType.Ld);
  });

  it("get: inc instruction", () => {
    testToken("inc", TokenType.Inc);
    testToken("INC", TokenType.Inc);
  });

  it("get: dec instruction", () => {
    testToken("dec", TokenType.Dec);
    testToken("DEC", TokenType.Dec);
  });

  it("get: ex instruction", () => {
    testToken("ex", TokenType.Ex);
    testToken("EX", TokenType.Ex);
  });

  it("get: add instruction", () => {
    testToken("add", TokenType.Add);
    testToken("ADD", TokenType.Add);
  });

  it("get: adc instruction", () => {
    testToken("adc", TokenType.Adc);
    testToken("ADC", TokenType.Adc);
  });

  it("get: sub instruction", () => {
    testToken("sub", TokenType.Sub);
    testToken("SUB", TokenType.Sub);
  });

  it("get: sbc instruction", () => {
    testToken("sbc", TokenType.Sbc);
    testToken("SBC", TokenType.Sbc);
  });

  it("get: and instruction", () => {
    testToken("and", TokenType.And);
    testToken("AND", TokenType.And);
  });

  it("get: xor instruction", () => {
    testToken("xor", TokenType.Xor);
    testToken("XOR", TokenType.Xor);
  });

  it("get: or instruction", () => {
    testToken("or", TokenType.Or);
    testToken("OR", TokenType.Or);
  });

  it("get: cp instruction", () => {
    testToken("cp", TokenType.Cp);
    testToken("CP", TokenType.Cp);
  });

  it("get: djnz instruction", () => {
    testToken("djnz", TokenType.Djnz);
    testToken("DJNZ", TokenType.Djnz);
  });

  it("get: jr instruction", () => {
    testToken("jr", TokenType.Jr);
    testToken("JR", TokenType.Jr);
  });

  it("get: jp instruction", () => {
    testToken("jp", TokenType.Jp);
    testToken("JP", TokenType.Jp);
  });

  it("get: call instruction", () => {
    testToken("call", TokenType.Call);
    testToken("CALL", TokenType.Call);
  });

  it("get: rst instruction", () => {
    testToken("rst", TokenType.Rst);
    testToken("RST", TokenType.Rst);
  });

  it("get: push instruction", () => {
    testToken("push", TokenType.Push);
    testToken("PUSH", TokenType.Push);
  });

  it("get: pop instruction", () => {
    testToken("pop", TokenType.Pop);
    testToken("pop", TokenType.Pop);
  });

  it("get: in instruction", () => {
    testToken("in", TokenType.In);
    testToken("in", TokenType.In);
  });

  it("get: out instruction", () => {
    testToken("out", TokenType.Out);
    testToken("OUT", TokenType.Out);
  });

  it("get: im instruction", () => {
    testToken("im", TokenType.Im);
    testToken("im", TokenType.Im);
  });

  it("get: rlc instruction", () => {
    testToken("rlc", TokenType.Rlc);
    testToken("RLC", TokenType.Rlc);
  });

  it("get: rrc instruction", () => {
    testToken("rrc", TokenType.Rrc);
    testToken("RRC", TokenType.Rrc);
  });

  it("get: rl instruction", () => {
    testToken("rl", TokenType.Rl);
    testToken("RL", TokenType.Rl);
  });

  it("get: rr instruction", () => {
    testToken("rr", TokenType.Rr);
    testToken("RR", TokenType.Rr);
  });

  it("get: sla instruction", () => {
    testToken("sla", TokenType.Sla);
    testToken("SLA", TokenType.Sla);
  });

  it("get: sra instruction", () => {
    testToken("sra", TokenType.Sra);
    testToken("SRA", TokenType.Sra);
  });

  it("get: sll instruction", () => {
    testToken("sll", TokenType.Sll);
    testToken("SLL", TokenType.Sll);
  });

  it("get: srl instruction", () => {
    testToken("srl", TokenType.Srl);
    testToken("SRL", TokenType.Srl);
  });

  it("get: bit instruction", () => {
    testToken("bit", TokenType.Bit);
    testToken("BIT", TokenType.Bit);
  });

  it("get: set instruction", () => {
    testToken("set", TokenType.Set);
    testToken("SET", TokenType.Set);
  });

  it("get: res instruction", () => {
    testToken("res", TokenType.Res);
    testToken("RES", TokenType.Res);
  });

  it("get: swapnib instruction", () => {
    testToken("swapnib", TokenType.Swapnib);
    testToken("SWAPNIB", TokenType.Swapnib);
  });

  it("get: mirror instruction", () => {
    testToken("mirror", TokenType.Mirror);
    testToken("MIRROR", TokenType.Mirror);
  });

  it("get: test instruction", () => {
    testToken("test", TokenType.Test);
    testToken("TEST", TokenType.Test);
  });

  it("get: bsla instruction", () => {
    testToken("bsla", TokenType.Bsla);
    testToken("BSLA", TokenType.Bsla);
  });

  it("get: bsra instruction", () => {
    testToken("bsra", TokenType.Bsra);
    testToken("BSRA", TokenType.Bsra);
  });

  it("get: bsrl instruction", () => {
    testToken("bsrl", TokenType.Bsrl);
    testToken("BSRL", TokenType.Bsrl);
  });

  it("get: bsrf instruction", () => {
    testToken("bsrf", TokenType.Bsrf);
    testToken("BSRF", TokenType.Bsrf);
  });

  it("get: brlc instruction", () => {
    testToken("brlc", TokenType.Brlc);
    testToken("BRLC", TokenType.Brlc);
  });

  it("get: mul instruction", () => {
    testToken("mul", TokenType.Mul);
    testToken("MUL", TokenType.Mul);
  });

  it("get: outinb instruction", () => {
    testToken("outinb", TokenType.OutInB);
    testToken("OUTINB", TokenType.OutInB);
  });

  it("get: nextreg instruction", () => {
    testToken("nextreg", TokenType.NextReg);
    testToken("nextreg", TokenType.NextReg);
  });

  it("get: pixeldn instruction", () => {
    testToken("pixeldn", TokenType.PixelDn);
    testToken("PIXELDN", TokenType.PixelDn);
  });

  it("get: pixelad instruction", () => {
    testToken("pixelad", TokenType.PixelAd);
    testToken("PIXELAD", TokenType.PixelAd);
  });

  it("get: setae instruction", () => {
    testToken("setae", TokenType.SetAE);
    testToken("SETAE", TokenType.SetAE);
  });

  it("get: ldix instruction", () => {
    testToken("ldix", TokenType.Ldix);
    testToken("LDIX", TokenType.Ldix);
  });

  it("get: ldws instruction", () => {
    testToken("ldws", TokenType.Ldws);
    testToken("LDWS", TokenType.Ldws);
  });

  it("get: lddx instruction", () => {
    testToken("lddx", TokenType.Lddx);
    testToken("LDDX", TokenType.Lddx);
  });

  it("get: ldirx instruction", () => {
    testToken("ldirx", TokenType.Ldirx);
    testToken("LDIRX", TokenType.Ldirx);
  });

  it("get: ldpirx instruction", () => {
    testToken("ldpirx", TokenType.Ldpirx);
    testToken("LDPIRX", TokenType.Ldpirx);
  });

  it("get: lddrx instruction", () => {
    testToken("lddrx", TokenType.Lddrx);
    testToken("LDDRX", TokenType.Lddrx);
  });

  it("get: org pragma", () => {
    testToken(".org", TokenType.Org);
    testToken(".ORG", TokenType.Org);
    testToken("org", TokenType.Org);
    testToken("ORG", TokenType.Org);
  });

  it("get: xorg pragma", () => {
    testToken(".xorg", TokenType.Xorg);
    testToken(".XORG", TokenType.Xorg);
    testToken("xorg", TokenType.Xorg);
    testToken("XORG", TokenType.Xorg);
  });

  it("get: ent pragma", () => {
    testToken(".ent", TokenType.Ent);
    testToken(".ENT", TokenType.Ent);
    testToken("ent", TokenType.Ent);
    testToken("ENT", TokenType.Ent);
  });

  it("get: xent pragma", () => {
    testToken(".xent", TokenType.Xent);
    testToken(".XENT", TokenType.Xent);
    testToken("xent", TokenType.Xent);
    testToken("XENT", TokenType.Xent);
  });

  it("get: equ pragma", () => {
    testToken(".equ", TokenType.Equ);
    testToken(".EQU", TokenType.Equ);
    testToken("equ", TokenType.Equ);
    testToken("EQU", TokenType.Equ);
  });

  it("get: var pragma", () => {
    testToken(".var", TokenType.Var);
    testToken(".VAR", TokenType.Var);
    testToken("var", TokenType.Var);
    testToken("VAR", TokenType.Var);
    testToken(":=", TokenType.Var);
  });

  it("get: disp pragma", () => {
    testToken(".disp", TokenType.Disp);
    testToken(".DISP", TokenType.Disp);
    testToken("disp", TokenType.Disp);
    testToken("DISP", TokenType.Disp);
  });

  it("get: defb pragma", () => {
    testToken(".defb", TokenType.Defb);
    testToken(".DEFB", TokenType.Defb);
    testToken("defb", TokenType.Defb);
    testToken("DB", TokenType.Defb);
    testToken(".db", TokenType.Defb);
    testToken(".DB", TokenType.Defb);
    testToken("db", TokenType.Defb);
    testToken("DB", TokenType.Defb);
  });

  it("get: defw pragma", () => {
    testToken(".defw", TokenType.Defw);
    testToken(".DEFW", TokenType.Defw);
    testToken("defw", TokenType.Defw);
    testToken("DEFW", TokenType.Defw);
    testToken(".dw", TokenType.Defw);
    testToken(".DW", TokenType.Defw);
    testToken("dw", TokenType.Defw);
    testToken("DW", TokenType.Defw);
  });

  it("get: defm pragma", () => {
    testToken(".defm", TokenType.Defm);
    testToken(".DEFM", TokenType.Defm);
    testToken("defm", TokenType.Defm);
    testToken("DEFM", TokenType.Defm);
    testToken(".dm", TokenType.Defm);
    testToken(".DM", TokenType.Defm);
    testToken("dm", TokenType.Defm);
    testToken("DM", TokenType.Defm);
  });

  it("get: defn pragma", () => {
    testToken(".defn", TokenType.Defn);
    testToken(".DEFN", TokenType.Defn);
    testToken("defn", TokenType.Defn);
    testToken("DEFN", TokenType.Defn);
    testToken(".dn", TokenType.Defn);
    testToken(".DN", TokenType.Defn);
    testToken("dn", TokenType.Defn);
    testToken("DN", TokenType.Defn);
  });

  it("get: defh pragma", () => {
    testToken(".defh", TokenType.Defh);
    testToken(".DEFH", TokenType.Defh);
    testToken("defh", TokenType.Defh);
    testToken("DEFH", TokenType.Defh);
    testToken(".dh", TokenType.Defh);
    testToken(".DH", TokenType.Defh);
    testToken("dh", TokenType.Defh);
    testToken("DH", TokenType.Defh);
  });

  it("get: defgx pragma", () => {
    testToken(".defgx", TokenType.Defgx);
    testToken(".DEFGX", TokenType.Defgx);
    testToken("defgx", TokenType.Defgx);
    testToken("DEFGX", TokenType.Defgx);
    testToken(".dgx", TokenType.Defgx);
    testToken(".DGX", TokenType.Defgx);
    testToken("dgx", TokenType.Defgx);
    testToken("DGX", TokenType.Defgx);
  });

  it("get: defg pragma", () => {
    testToken(".defg", TokenType.Defg);
    testToken(".DEFG", TokenType.Defg);
    testToken("defg", TokenType.Defg);
    testToken("DEFG", TokenType.Defg);
    testToken(".dg", TokenType.Defg);
    testToken(".DG", TokenType.Defg);
    testToken("dg", TokenType.Defg);
    testToken("DG", TokenType.Defg);
  });

  it("get: defc pragma", () => {
    testToken(".defc", TokenType.Defc);
    testToken(".DEFC", TokenType.Defc);
    testToken("defc", TokenType.Defc);
    testToken("DEFC", TokenType.Defc);
    testToken(".dc", TokenType.Defc);
    testToken(".DC", TokenType.Defc);
    testToken("dc", TokenType.Defc);
    testToken("DC", TokenType.Defc);
  });

  it("get: skip pragma", () => {
    testToken(".skip", TokenType.Skip);
    testToken(".SKIP", TokenType.Skip);
    testToken("skip", TokenType.Skip);
    testToken("SKIP", TokenType.Skip);
  });

  it("get: extern pragma", () => {
    testToken(".extern", TokenType.Extern);
    testToken(".EXTERN", TokenType.Extern);
    testToken("extern", TokenType.Extern);
    testToken("EXTERN", TokenType.Extern);
  });

  it("get: defs pragma", () => {
    testToken(".defs", TokenType.Defs);
    testToken(".DEFS", TokenType.Defs);
    testToken("defs", TokenType.Defs);
    testToken("DEFS", TokenType.Defs);
    testToken(".ds", TokenType.Defs);
    testToken(".DS", TokenType.Defs);
    testToken("ds", TokenType.Defs);
    testToken("DS", TokenType.Defs);
  });

  it("get: fillb pragma", () => {
    testToken(".fillb", TokenType.Fillb);
    testToken(".FILLB", TokenType.Fillb);
    testToken("fillb", TokenType.Fillb);
    testToken("FILLB", TokenType.Fillb);
  });

  it("get: fillw pragma", () => {
    testToken(".fillw", TokenType.Fillw);
    testToken(".FILLW", TokenType.Fillw);
    testToken("fillw", TokenType.Fillw);
    testToken("FILLW", TokenType.Fillw);
  });

  it("get: model pragma", () => {
    testToken(".model", TokenType.Model);
    testToken(".MODEL", TokenType.Model);
    testToken("model", TokenType.Model);
    testToken("MODEL", TokenType.Model);
  });

  it("get: align pragma", () => {
    testToken(".align", TokenType.Align);
    testToken(".ALIGN", TokenType.Align);
    testToken("align", TokenType.Align);
    testToken("ALIGN", TokenType.Align);
  });

  it("get: trace pragma", () => {
    testToken(".trace", TokenType.Trace);
    testToken(".TRACE", TokenType.Trace);
    testToken("trace", TokenType.Trace);
    testToken("TRACE", TokenType.Trace);
  });

  it("get: tracehex pragma", () => {
    testToken(".tracehex", TokenType.TraceHex);
    testToken(".TRACEHEX", TokenType.TraceHex);
    testToken("tracehex", TokenType.TraceHex);
    testToken("TRACEHEX", TokenType.TraceHex);
  });

  it("get: rndseed pragma", () => {
    testToken(".rndseed", TokenType.RndSeed);
    testToken(".RNDSEED", TokenType.RndSeed);
    testToken("rndseed", TokenType.RndSeed);
    testToken("RNDSEED", TokenType.RndSeed);
  });

  it("get: error pragma", () => {
    testToken(".error", TokenType.Error);
    testToken(".ERROR", TokenType.Error);
    testToken("error", TokenType.Error);
    testToken("ERROR", TokenType.Error);
  });

  it("get: includebin pragma", () => {
    testToken(".includebin", TokenType.IncludeBin);
    testToken(".INCLUDEBIN", TokenType.IncludeBin);
    testToken(".include_bin", TokenType.IncludeBin);
    testToken(".INCLUDE_BIN", TokenType.IncludeBin);
    testToken("includebin", TokenType.IncludeBin);
    testToken("INCLUDEBIN", TokenType.IncludeBin);
    testToken("include_bin", TokenType.IncludeBin);
    testToken("INCLUDE_BIN", TokenType.IncludeBin);
  });

  it("get: comparebin pragma", () => {
    testToken(".comparebin", TokenType.CompareBin);
    testToken(".COMPAREBIN", TokenType.CompareBin);
    testToken("comparebin", TokenType.CompareBin);
    testToken("COMPAREBIN", TokenType.CompareBin);
  });

  it("get: macro statement", () => {
    testToken(".macro", TokenType.Macro);
    testToken(".MACRO", TokenType.Macro);
    testToken("macro", TokenType.Macro);
    testToken("MACRO", TokenType.Macro);
  });

  it("get: end macro statement", () => {
    testToken(".endm", TokenType.Endm);
    testToken(".ENDM", TokenType.Endm);
    testToken("endm", TokenType.Endm);
    testToken("ENDM", TokenType.Endm);
    testToken("mend", TokenType.Endm);
    testToken("MEND", TokenType.Endm);
    testToken("mend", TokenType.Endm);
    testToken("MEND", TokenType.Endm);
  });

  it("get: proc statement", () => {
    testToken(".proc", TokenType.Proc);
    testToken(".PROC", TokenType.Proc);
    testToken("proc", TokenType.Proc);
    testToken("PROC", TokenType.Proc);
  });

  it("get: end proc statement", () => {
    testToken(".endp", TokenType.Endp);
    testToken(".ENDP", TokenType.Endp);
    testToken("endp", TokenType.Endp);
    testToken("ENDP", TokenType.Endp);
    testToken(".pend", TokenType.Endp);
    testToken(".PEND", TokenType.Endp);
    testToken("pend", TokenType.Endp);
    testToken("PEND", TokenType.Endp);
  });

  it("get: loop statement", () => {
    testToken(".loop", TokenType.Loop);
    testToken(".LOOP", TokenType.Loop);
    testToken("loop", TokenType.Loop);
    testToken("LOOP", TokenType.Loop);
  });

  it("get: end loop statement", () => {
    testToken(".endl", TokenType.Endl);
    testToken(".ENDL", TokenType.Endl);
    testToken("endl", TokenType.Endl);
    testToken("ENDL", TokenType.Endl);
    testToken(".lend", TokenType.Endl);
    testToken(".LEND", TokenType.Endl);
    testToken("lend", TokenType.Endl);
    testToken("LEND", TokenType.Endl);
  });

  it("get: repeat statement", () => {
    testToken(".repeat", TokenType.Repeat);
    testToken(".REPEAT", TokenType.Repeat);
    testToken("repeat", TokenType.Repeat);
    testToken("REPEAT", TokenType.Repeat);
  });

  it("get: until statement", () => {
    testToken(".until", TokenType.Until);
    testToken(".UNTIL", TokenType.Until);
    testToken("until", TokenType.Until);
    testToken("UNTIL", TokenType.Until);
  });

  it("get: while statement", () => {
    testToken(".while", TokenType.While);
    testToken(".WHILE", TokenType.While);
    testToken("while", TokenType.While);
    testToken("WHILE", TokenType.While);
  });

  it("get: end while statement", () => {
    testToken(".endw", TokenType.Endw);
    testToken(".ENDW", TokenType.Endw);
    testToken("endw", TokenType.Endw);
    testToken("ENDW", TokenType.Endw);
    testToken(".wend", TokenType.Endw);
    testToken(".WEND", TokenType.Endw);
    testToken("wend", TokenType.Endw);
    testToken("WEND", TokenType.Endw);
  });

  it("get: if statement", () => {
    testToken(".if", TokenType.If);
    testToken(".IF", TokenType.If);
    testToken("if", TokenType.If);
    testToken("IF", TokenType.If);
  });

  it("get: if used statement", () => {
    testToken(".ifused", TokenType.IfUsed);
    testToken(".IFUSED", TokenType.IfUsed);
    testToken("ifused", TokenType.IfUsed);
    testToken("IFUSED", TokenType.IfUsed);
  });

  it("get: if not used statement", () => {
    testToken(".ifnused", TokenType.IfNUsed);
    testToken(".IFNUSED", TokenType.IfNUsed);
    testToken("ifnused", TokenType.IfNUsed);
    testToken("IFNUSED", TokenType.IfNUsed);
  });

  it("get: else if statement", () => {
    testToken(".elif", TokenType.Elif);
    testToken(".ELIF", TokenType.Elif);
    testToken("elif", TokenType.Elif);
    testToken("ELIF", TokenType.Elif);
  });

  it("get: else statement", () => {
    testToken(".else", TokenType.Else);
    testToken(".ELSE", TokenType.Else);
    testToken("else", TokenType.Else);
    testToken("ELSE", TokenType.Else);
  });

  it("get: endif statement", () => {
    testToken(".endif", TokenType.Endif);
    testToken(".ENDIF", TokenType.Endif);
    testToken("endif", TokenType.Endif);
    testToken("ENDIF", TokenType.Endif);
  });

  it("get: for statement", () => {
    testToken(".for", TokenType.For);
    testToken(".FOR", TokenType.For);
    testToken("for", TokenType.For);
    testToken("FOR", TokenType.For);
  });

  it("get: to statement", () => {
    testToken(".to", TokenType.To);
    testToken(".TO", TokenType.To);
    testToken("to", TokenType.To);
    testToken("TO", TokenType.To);
  });

  it("get: step statement", () => {
    testToken(".step", TokenType.Step);
    testToken(".STEP", TokenType.Step);
    testToken("step", TokenType.Step);
    testToken("STEP", TokenType.Step);
  });

  it("get: next statement", () => {
    testToken(".next", TokenType.Next);
    testToken(".NEXT", TokenType.Next);
    testToken("next", TokenType.Next);
    testToken("NEXT", TokenType.Next);
  });

  it("get: break statement", () => {
    testToken(".break", TokenType.Break);
    testToken(".BREAK", TokenType.Break);
    testToken("break", TokenType.Break);
    testToken("BREAK", TokenType.Break);
  });

  it("get: continue statement", () => {
    testToken(".continue", TokenType.Continue);
    testToken(".CONTINUE", TokenType.Continue);
    testToken("continue", TokenType.Continue);
    testToken("CONTINUE", TokenType.Continue);
  });

  it("get: module statement", () => {
    testToken(".module", TokenType.Module);
    testToken(".MODULE", TokenType.Module);
    testToken("module", TokenType.Module);
    testToken("MODULE", TokenType.Module);
    testToken(".scope", TokenType.Module);
    testToken(".SCOPE", TokenType.Module);
    testToken("scope", TokenType.Module);
    testToken("SCOPE", TokenType.Module);
  });

  it("get: end module statement", () => {
    testToken(".endmodule", TokenType.EndModule);
    testToken(".ENDMODULE", TokenType.EndModule);
    testToken("endmodule", TokenType.EndModule);
    testToken("ENDMODULE", TokenType.EndModule);
    testToken(".endscope", TokenType.EndModule);
    testToken(".ENDSCOPE", TokenType.EndModule);
    testToken("endscope", TokenType.EndModule);
    testToken("ENDSCOPE", TokenType.EndModule);
    testToken(".moduleend", TokenType.EndModule);
    testToken(".MODULEEND", TokenType.EndModule);
    testToken("moduleend", TokenType.EndModule);
    testToken("MODULEEND", TokenType.EndModule);
    testToken(".scopeend", TokenType.EndModule);
    testToken(".SCOPEEND", TokenType.EndModule);
    testToken("scopeend", TokenType.EndModule);
    testToken("SCOPEEND", TokenType.EndModule);
  });

  it("get: struct statement", () => {
    testToken(".struct", TokenType.Struct);
    testToken(".STRUCT", TokenType.Struct);
    testToken("struct", TokenType.Struct);
    testToken("STRUCT", TokenType.Struct);
  });

  it("get: end struct statement", () => {
    testToken(".ends", TokenType.Ends);
    testToken(".ENDS", TokenType.Ends);
    testToken("ends", TokenType.Ends);
    testToken("ENDS", TokenType.Ends);
  });

  it("get: textof function", () => {
    testToken("textof", TokenType.TextOf);
    testToken("TEXTOF", TokenType.TextOf);
  });

  it("get: ltextof function", () => {
    testToken("ltextof", TokenType.LTextOf);
    testToken("LTEXTOF", TokenType.LTextOf);
  });

  it("get: hreg function", () => {
    testToken("hreg", TokenType.HReg);
    testToken("HREG", TokenType.HReg);
  });

  it("get: lreg function", () => {
    testToken("lreg", TokenType.LReg);
    testToken("LREG", TokenType.LReg);
  });

  it("get: def function", () => {
    testToken("def", TokenType.Def);
    testToken("DEF", TokenType.Def);
  });

  it("get: isreg8 function", () => {
    testToken("isreg8", TokenType.IsReg8);
    testToken("ISREG8", TokenType.IsReg8);
  });

  it("get: isreg8Std function", () => {
    testToken("isreg8std", TokenType.IsReg8Std);
    testToken("ISREG8STD", TokenType.IsReg8Std);
  });

  it("get: isreg8spec function", () => {
    testToken("isreg8spec", TokenType.IsReg8Spec);
    testToken("ISREG8SPEC", TokenType.IsReg8Spec);
  });

  it("get: isreg8idx function", () => {
    testToken("isreg8idx", TokenType.IsReg8Idx);
    testToken("ISREG8IDX", TokenType.IsReg8Idx);
  });

  it("get: isreg16 function", () => {
    testToken("isreg16", TokenType.IsReg16);
    testToken("ISREG16", TokenType.IsReg16);
  });

  it("get: isreg16std function", () => {
    testToken("isreg16std", TokenType.IsReg16Std);
    testToken("ISREG16STD", TokenType.IsReg16Std);
  });

  it("get: isreg16idx function", () => {
    testToken("isreg16idx", TokenType.IsReg16Idx);
    testToken("ISREG16IDX", TokenType.IsReg16Idx);
  });

  it("get: isregindirect function", () => {
    testToken("isregindirect", TokenType.IsRegIndirect);
    testToken("ISREGINDIRECT", TokenType.IsRegIndirect);
  });

  it("get: iscport function", () => {
    testToken("iscport", TokenType.IsCPort);
    testToken("ISCPORT", TokenType.IsCPort);
  });

  it("get: isindexedaddr function", () => {
    testToken("isindexedaddr", TokenType.IsIndexedAddr);
    testToken("ISINDEXEDADDR", TokenType.IsIndexedAddr);
  });

  it("get: iscondition function", () => {
    testToken("iscondition", TokenType.IsCondition);
    testToken("ISCONDITION", TokenType.IsCondition);
  });

  it("get: isexpr function", () => {
    testToken("isexpr", TokenType.IsExpr);
    testToken("ISEXPR", TokenType.IsExpr);
  });

  it("get: true literal", () => {
    testToken(".true", TokenType.True);
    testToken(".TRUE", TokenType.True);
    testToken("true", TokenType.True);
    testToken("TRUE", TokenType.True);
  });

  it("get: false literal", () => {
    testToken(".false", TokenType.False);
    testToken(".FALSE", TokenType.False);
    testToken("false", TokenType.False);
    testToken("FALSE", TokenType.False);
  });

  it("get: cnt variable", () => {
    testToken(".cnt", TokenType.CurCnt);
    testToken(".CNT", TokenType.CurCnt);
  });


  it("get: identifier", () => {
    testToken("_", TokenType.Identifier);
    testToken("@", TokenType.Identifier);
    testToken("`", TokenType.Identifier);
    testToken("apple", TokenType.Identifier);
    testToken("apple_", TokenType.Identifier);
    testToken("apple@", TokenType.Identifier);
    testToken("apple!", TokenType.Identifier);
    testToken("apple?", TokenType.Identifier);
    testToken("apple#", TokenType.Identifier);
    testToken("apple112", TokenType.Identifier);
    testToken("apple'", TokenType.Unknown);
  });
});

function testToken(tokenStr: string, type: TokenType): void {
  // --- Test for the single token
  let ts = new TokenStream(new InputStream(tokenStr));
  let token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(tokenStr);
  expect(token.location.startPos).toBe(0);
  expect(token.location.endPos).toBe(tokenStr.length);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(0);
  expect(token.location.endColumn).toBe(tokenStr.length);

  // --- Test for token with subsequent token
  ts = new TokenStream(new InputStream(tokenStr + "/"));
  token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(tokenStr);
  expect(token.location.startPos).toBe(0);
  expect(token.location.endPos).toBe(tokenStr.length);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(0);
  expect(token.location.endColumn).toBe(tokenStr.length);

  // --- Test for token with leading whitespace
  ts = new TokenStream(new InputStream("  " + tokenStr));
  token = ts.get();
  expect(token.type).toBe(type);
  expect(token.text).toBe(tokenStr);
  expect(token.location.startPos).toBe(2);
  expect(token.location.endPos).toBe(tokenStr.length + 2);
  expect(token.location.line).toBe(1);
  expect(token.location.startColumn).toBe(2);
  expect(token.location.endColumn).toBe(tokenStr.length + 2);
}
