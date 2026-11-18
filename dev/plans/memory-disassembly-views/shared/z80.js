/*
 * Shared by the Memory and Disassembly view mockups: a Z80 / Z80N instruction decoder.
 *
 * Mockup code, written for these pages; the IDE has its own disassembler. It decodes every prefix
 * group (CB, ED, DD/FD, DD CB / FD CB), the ZX Spectrum Next's Z80N extensions when asked, and
 * reports what the views draw: the length, the T-states (taken / not taken for a conditional
 * branch) and the branch's kind, condition and target.
 *
 * Operands that are addresses come back as tokens, `\u0001<value>\u0002<kind>\u0003`, so a view
 * can print a label, a system variable or a number there: kind `code` for a jump or call target,
 * `data` for a 16-bit load or store, `nextreg` for a NextReg number. `renderZ80` replaces them.
 */
const Z80 = (() => {
  const R = ["b", "c", "d", "e", "h", "l", "(hl)", "a"];
  const RP = ["bc", "de", "hl", "sp"], RP2 = ["bc", "de", "hl", "af"];
  const CC = ["nz", "z", "nc", "c", "po", "pe", "p", "m"];
  const ALU = ["add a,", "adc a,", "sub ", "sbc a,", "and ", "xor ", "or ", "cp "];
  const ROT = ["rlc", "rrc", "rl", "rr", "sla", "sra", "sll", "srl"];
  const tok = (v, k) => `\u0001${v}\u0002${k}\u0003`;
  const n2 = (n) => "$" + n.toString(16).toUpperCase().padStart(2, "0");
  const sx = (b) => (b << 24) >> 24;
  const Z80N = {
    0x23: ["swapnib", 8], 0x24: ["mirror a", 8], 0x28: ["bsla de,b", 8], 0x29: ["bsra de,b", 8], 0x2a: ["bsrl de,b", 8],
    0x2b: ["bsrf de,b", 8], 0x2c: ["brlc de,b", 8], 0x30: ["mul d,e", 8], 0x31: ["add hl,a", 8], 0x32: ["add de,a", 8],
    0x33: ["add bc,a", 8], 0x90: ["outinb", 16], 0x93: ["pixeldn", 8], 0x94: ["pixelad", 8], 0x95: ["setae", 8],
    0xa4: ["ldix", 16], 0xa5: ["ldws", 14], 0xac: ["lddx", 16], 0xb4: ["ldirx", 21, 16], 0xb7: ["ldpirx", 21, 16], 0xbc: ["lddrx", 21, 16]
  };

  /**
   * Decodes one instruction.
   * @param rd     reads the byte at an offset from the instruction's first byte
   * @param addr   the instruction's address, for relative jumps
   * @param z80n   decode the ZX Spectrum Next's extensions
   * @returns { len, text, t: [taken, notTaken?], kind?, cond?, target?, indirect? }
   */
  function decode(rd, addr, z80n = false) {
    let i = 0;
    const b = () => rd(i++) & 0xff;
    const w = () => b() | (b() << 8);
    let op = b();
    let idx = null;
    if (op === 0xdd || op === 0xfd) {
      idx = op === 0xdd ? "ix" : "iy";
      const nx = rd(i) & 0xff;
      if (nx === 0xdd || nx === 0xfd || nx === 0xed) return { len: 1, text: "nop", t: [4], note: "a prefix with nothing to change" };
      op = b();
    }
    const out = (text, t, extra = {}) => ({ len: i, text, t: Array.isArray(t) ? t : [t], ...extra });
    const HL = idx ?? "hl";
    const plus = idx ? 4 : 0;
    // --- (hl) or (ix+d): the displacement is read when the operand is formatted, which is its place in the bytes
    const mem = () => { if (!idx) return "(hl)"; const d = sx(b()); return `(${idx}${d < 0 ? "-" : "+"}${n2(Math.abs(d))})`; };
    const reg = (r, usesMem) => (r === 6 ? mem() : idx && !usesMem && (r === 4 || r === 5) ? idx + (r === 4 ? "h" : "l") : R[r]);
    const rel = () => { const e = sx(b()); return (addr + i + e) & 0xffff; };

    if (op === 0xcb) {
      if (idx) {
        const d = sx(b()); const o = b(); const x = o >> 6, y = (o >> 3) & 7, z = o & 7;
        const m = `(${idx}${d < 0 ? "-" : "+"}${n2(Math.abs(d))})`;
        const copy = z !== 6 ? "," + R[z] : "";
        if (x === 0) return out(`${ROT[y]} ${m}${copy}`, 23);
        if (x === 1) return out(`bit ${y},${m}`, 20);
        return out(`${x === 2 ? "res" : "set"} ${y},${m}${copy}`, 23);
      }
      const o = b(); const x = o >> 6, y = (o >> 3) & 7, z = o & 7;
      const t = z === 6 ? (x === 1 ? 12 : 15) : 8;
      if (x === 0) return out(`${ROT[y]} ${R[z]}`, t);
      if (x === 1) return out(`bit ${y},${R[z]}`, t);
      return out(`${x === 2 ? "res" : "set"} ${y},${R[z]}`, t);
    }

    if (op === 0xed) {
      const o = b();
      if (z80n) {
        if (Z80N[o]) { const [m, t1, t2] = Z80N[o]; return out(m, t2 ? [t1, t2] : t1); }
        if (o === 0x27) return out(`test ${n2(b())}`, 11);
        if (o >= 0x34 && o <= 0x36) return out(`add ${["hl", "de", "bc"][o - 0x34]},${tok(w(), "imm")}`, 16);
        if (o === 0x8a) { const hi = b(), lo = b(); return out(`push ${tok((hi << 8) | lo, "imm")}`, 23); }
        if (o === 0x91) { const r = b(), v = b(); return out(`nextreg ${tok(r, "nextreg")},${n2(v)}`, 20, { nextreg: r }); }
        if (o === 0x92) { const r = b(); return out(`nextreg ${tok(r, "nextreg")},a`, 17, { nextreg: r }); }
        if (o === 0x98) return out("jp (c)", 13, { kind: "jp", indirect: "port" });
      }
      const x = o >> 6, y = (o >> 3) & 7, z = o & 7, p = y >> 1, q = y & 1;
      if (x === 1) {
        if (z === 0) return out(y === 6 ? "in (c)" : `in ${R[y]},(c)`, 12);
        if (z === 1) return out(y === 6 ? "out (c),0" : `out (c),${R[y]}`, 12);
        if (z === 2) return out(`${q ? "adc" : "sbc"} hl,${RP[p]}`, 15);
        if (z === 3) { const a = w(); return out(q ? `ld ${RP[p]},(${tok(a, "data")})` : `ld (${tok(a, "data")}),${RP[p]}`, 20); }
        if (z === 4) return out("neg", 8);
        if (z === 5) return out(y === 1 ? "reti" : "retn", 14, { kind: "ret" });
        if (z === 6) return out(`im ${["0", "0", "1", "2", "0", "0", "1", "2"][y]}`, 8);
        return out(["ld i,a", "ld r,a", "ld a,i", "ld a,r", "rrd", "rld", "nop", "nop"][y], y >= 4 && y <= 5 ? 18 : y >= 6 ? 8 : 9);
      }
      if (x === 2 && z <= 3 && y >= 4) {
        const m = [["ldi", "cpi", "ini", "outi"], ["ldd", "cpd", "ind", "outd"], ["ldir", "cpir", "inir", "otir"], ["lddr", "cpdr", "indr", "otdr"]][y - 4][z];
        return out(m, y >= 6 ? [21, 16] : 16);
      }
      return out(`.defb $ED,${n2(o)}`, 8, { invalid: true });
    }

    const x = op >> 6, y = (op >> 3) & 7, z = op & 7, p = y >> 1, q = y & 1;
    if (x === 1) {
      if (op === 0x76) return out("halt", 4);
      const usesMem = y === 6 || z === 6;
      const t = usesMem ? (idx ? 19 : 7) : idx && (y === 4 || y === 5 || z === 4 || z === 5) ? 8 : 4;
      const dst = reg(y, usesMem), src = reg(z, usesMem);
      return out(`ld ${dst},${src}`, t);
    }
    if (x === 2) return out(ALU[y] + reg(z, false), z === 6 ? (idx ? 19 : 7) : idx && (z === 4 || z === 5) ? 8 : 4);
    if (x === 0) {
      if (z === 0) {
        if (y === 0) return out("nop", 4);
        if (y === 1) return out("ex af,af'", 4);
        if (y === 2) { const t = rel(); return out(`djnz ${tok(t, "code")}`, [13, 8], { kind: "djnz", cond: "b", target: t }); }
        if (y === 3) { const t = rel(); return out(`jr ${tok(t, "code")}`, 12, { kind: "jr", target: t }); }
        const t = rel(); return out(`jr ${CC[y - 4]},${tok(t, "code")}`, [12, 7], { kind: "jr", cond: CC[y - 4], target: t });
      }
      if (z === 1) {
        if (q) return out(`add ${HL},${p === 2 ? HL : RP[p]}`, 11 + plus);
        const v = w(); return out(`ld ${p === 2 ? HL : RP[p]},${tok(v, "data")}`, 10 + plus);
      }
      if (z === 2) {
        if (p < 2) return out(q ? `ld a,(${RP[p]})` : `ld (${RP[p]}),a`, 7);
        const a = w();
        if (p === 2) return out(q ? `ld ${HL},(${tok(a, "data")})` : `ld (${tok(a, "data")}),${HL}`, 16 + plus);
        return out(q ? `ld a,(${tok(a, "data")})` : `ld (${tok(a, "data")}),a`, 13);
      }
      if (z === 3) return out(`${q ? "dec" : "inc"} ${p === 2 ? HL : RP[p]}`, 6 + plus);
      if (z === 4 || z === 5) { const m = z === 4 ? "inc" : "dec"; return out(`${m} ${reg(y, false)}`, y === 6 ? (idx ? 23 : 11) : idx && (y === 4 || y === 5) ? 8 : 4); }
      if (z === 6) { const r = reg(y, false); return out(`ld ${r},${n2(b())}`, y === 6 ? (idx ? 19 : 10) : idx && (y === 4 || y === 5) ? 11 : 7); }
      return out(["rlca", "rrca", "rla", "rra", "daa", "cpl", "scf", "ccf"][y], 4);
    }
    // --- x === 3
    if (z === 0) return out(`ret ${CC[y]}`, [11, 5], { kind: "ret", cond: CC[y] });
    if (z === 1) {
      if (!q) return out(`pop ${p === 2 ? HL : RP2[p]}`, 10 + plus);
      if (p === 0) return out("ret", 10, { kind: "ret" });
      if (p === 1) return out("exx", 4);
      if (p === 2) return out(`jp (${HL})`, 4 + plus, { kind: "jp", indirect: HL });
      return out(`ld sp,${HL}`, 6 + plus);
    }
    if (z === 2) { const t = w(); return out(`jp ${CC[y]},${tok(t, "code")}`, [10, 10], { kind: "jp", cond: CC[y], target: t }); }
    if (z === 3) {
      if (y === 0) { const t = w(); return out(`jp ${tok(t, "code")}`, 10, { kind: "jp", target: t }); }
      if (y === 2) return out(`out (${n2(b())}),a`, 11);
      if (y === 3) return out(`in a,(${n2(b())})`, 11);
      if (y === 4) return out(`ex (sp),${HL}`, 19 + plus);
      return out(["", "", "", "", "", "ex de,hl", "di", "ei"][y], 4);
    }
    if (z === 4) { const t = w(); return out(`call ${CC[y]},${tok(t, "code")}`, [17, 10], { kind: "call", cond: CC[y], target: t }); }
    if (z === 5) {
      if (!q) return out(`push ${p === 2 ? HL : RP2[p]}`, 11 + plus);
      const t = w(); return out(`call ${tok(t, "code")}`, 17, { kind: "call", target: t });
    }
    if (z === 6) return out(ALU[y] + n2(b()), 7);
    return out(`rst ${n2(y * 8)}`, 11, { kind: "rst", target: y * 8 });
  }

  /** Whether a condition holds for the flags in F (and B, for DJNZ) */
  function condMet(cond, f, bReg) {
    switch (cond) {
      case "nz": return !(f & 0x40);
      case "z": return !!(f & 0x40);
      case "nc": return !(f & 0x01);
      case "c": return !!(f & 0x01);
      case "po": return !(f & 0x04);
      case "pe": return !!(f & 0x04);
      case "p": return !(f & 0x80);
      case "m": return !!(f & 0x80);
      case "b": return ((bReg - 1) & 0xff) !== 0;
      default: return true;
    }
  }
  /** The flag and its value a condition reads, for the verdict readout: `C=1`, `Z=0`, `B=4` */
  function condWhy(cond, f, bReg) {
    const flag = { nz: ["Z", 0x40], z: ["Z", 0x40], nc: ["C", 0x01], c: ["C", 0x01], po: ["P/V", 0x04], pe: ["P/V", 0x04], p: ["S", 0x80], m: ["S", 0x80] }[cond];
    return cond === "b" ? `B=${bReg}` : `${flag[0]}=${f & flag[1] ? 1 : 0}`;
  }

  /** Replaces the address tokens: `name(value, kind)` returns the HTML for one */
  function render(text, name) {
    return text.replace(/\u0001(\d+)\u0002(\w+)\u0003/g, (_, v, k) => name(+v, k));
  }
  /** The plain text, numbers as hex: for search and copying */
  function plain(text) {
    return text.replace(/\u0001(\d+)\u0002(\w+)\u0003/g, (_, v, k) => (k === "nextreg" ? n2(+v) : "$" + (+v).toString(16).toUpperCase().padStart(4, "0")));
  }
  return { decode, condMet, condWhy, render, plain };
})();
