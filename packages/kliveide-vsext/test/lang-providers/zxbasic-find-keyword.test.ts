import "mocha";
import * as expect from "expect";
import { ZxBasicKeyword } from './../../src/lang-providers/keywords/zxbasic-keyword';


describe("ZxBasic language provider find Reserved Words", () => {

  it("ABS", () => {
    expect(ZxBasicKeyword.findKeyword("ABS").keyword).toBe("ABS");
    expect(ZxBasicKeyword.findKeyword("abs").keyword).toBe("ABS");
  });

  it("ACS", () => {
    expect(ZxBasicKeyword.findKeyword("ACS").keyword).toBe("ACS");
    expect(ZxBasicKeyword.findKeyword("acs").keyword).toBe("ACS");
  });

  it("AND", () => {
    expect(ZxBasicKeyword.findKeyword("AND").keyword).toBe("AND");
    expect(ZxBasicKeyword.findKeyword("and").keyword).toBe("AND");
  });

  it("ALIGN", () => {
    expect(ZxBasicKeyword.findKeyword("ALIGN").keyword).toBe("ALIGN");
    expect(ZxBasicKeyword.findKeyword("align").keyword).toBe("ALIGN");
  });

  it("ASM", () => {
    expect(ZxBasicKeyword.findKeyword("ASM").keyword).toBe("ASM");
    expect(ZxBasicKeyword.findKeyword("asm").keyword).toBe("ASM");
  });

  it("ASN", () => {
    expect(ZxBasicKeyword.findKeyword("ASN").keyword).toBe("ASN");
    expect(ZxBasicKeyword.findKeyword("asn").keyword).toBe("ASN");
  });

  it("AT", () => {
    expect(ZxBasicKeyword.findKeyword("AT").keyword).toBe("AT");
    expect(ZxBasicKeyword.findKeyword("at").keyword).toBe("AT");
  });

  it("ATN", () => {
    expect(ZxBasicKeyword.findKeyword("ATN").keyword).toBe("ATN");
    expect(ZxBasicKeyword.findKeyword("atn").keyword).toBe("ATN");
  });

  it("bAND", () => {
    expect(ZxBasicKeyword.findKeyword("bAND").keyword).toBe("BAND");
    expect(ZxBasicKeyword.findKeyword("band").keyword).toBe("BAND");
  });

  it("bNOT", () => {
    expect(ZxBasicKeyword.findKeyword("bNOT").keyword).toBe("BNOT");
    expect(ZxBasicKeyword.findKeyword("bnot").keyword).toBe("BNOT");
  });

  it("bOR", () => {
    expect(ZxBasicKeyword.findKeyword("bOR").keyword).toBe("BOR");
    expect(ZxBasicKeyword.findKeyword("bor").keyword).toBe("BOR");
  });

  it("bXOR", () => {
    expect(ZxBasicKeyword.findKeyword("bXOR").keyword).toBe("BXOR");
    expect(ZxBasicKeyword.findKeyword("bxor").keyword).toBe("BXOR");
  });

  it("BEEP", () => {
    expect(ZxBasicKeyword.findKeyword("BEEP").keyword).toBe("BEEP");
    expect(ZxBasicKeyword.findKeyword("beep").keyword).toBe("BEEP");
  });

  it("BOLD", () => {
    expect(ZxBasicKeyword.findKeyword("BOLD").keyword).toBe("BOLD");
    expect(ZxBasicKeyword.findKeyword("bold").keyword).toBe("BOLD");
  });

  it("BORDER", () => {
    expect(ZxBasicKeyword.findKeyword("BORDER").keyword).toBe("BORDER");
    expect(ZxBasicKeyword.findKeyword("border").keyword).toBe("BORDER");
  });

  it("BRIGHT", () => {
    expect(ZxBasicKeyword.findKeyword("BRIGHT").keyword).toBe("BRIGHT");
    expect(ZxBasicKeyword.findKeyword("bright").keyword).toBe("BRIGHT");
  });

  it("ByRef", () => {
    expect(ZxBasicKeyword.findKeyword("BYREF").keyword).toBe("BYREF");
    expect(ZxBasicKeyword.findKeyword("byref").keyword).toBe("BYREF");
  });

  it("ByVal", () => {
    expect(ZxBasicKeyword.findKeyword("BYVAL").keyword).toBe("BYVAL");
    expect(ZxBasicKeyword.findKeyword("byval").keyword).toBe("BYVAL");
  });

  it("CAST", () => {
    expect(ZxBasicKeyword.findKeyword("CAST").keyword).toBe("CAST");
    expect(ZxBasicKeyword.findKeyword("cast").keyword).toBe("CAST");
  });

  it("CHR", () => {
    expect(ZxBasicKeyword.findKeyword("CHR").keyword).toBe("CHR");
    expect(ZxBasicKeyword.findKeyword("chr").keyword).toBe("CHR");
    expect(ZxBasicKeyword.findKeyword("chr$").keyword).toBe("CHR");
  });

  it("CIRCLE", () => {
    expect(ZxBasicKeyword.findKeyword("CIRCLE").keyword).toBe("CIRCLE");
    expect(ZxBasicKeyword.findKeyword("circle").keyword).toBe("CIRCLE");
  });

  it("CLS", () => {
    expect(ZxBasicKeyword.findKeyword("CLS").keyword).toBe("CLS");
    expect(ZxBasicKeyword.findKeyword("cls").keyword).toBe("CLS");
  });

  it("CODE", () => {
    expect(ZxBasicKeyword.findKeyword("CODE").keyword).toBe("CODE");
    expect(ZxBasicKeyword.findKeyword("code").keyword).toBe("CODE");
  });

  it("CONST", () => {
    expect(ZxBasicKeyword.findKeyword("CONST").keyword).toBe("CONST");
    expect(ZxBasicKeyword.findKeyword("const").keyword).toBe("CONST");
  });

  it("CONTINUE", () => {
    expect(ZxBasicKeyword.findKeyword("CONTINUE").keyword).toBe("CONTINUE");
    expect(ZxBasicKeyword.findKeyword("continue").keyword).toBe("CONTINUE");
  });

  it("COS", () => {
    expect(ZxBasicKeyword.findKeyword("COS").keyword).toBe("COS");
    expect(ZxBasicKeyword.findKeyword("cos").keyword).toBe("COS");
  });

  it("DECLARE", () => {
    expect(ZxBasicKeyword.findKeyword("DECLARE").keyword).toBe("DECLARE");
    expect(ZxBasicKeyword.findKeyword("declare").keyword).toBe("DECLARE");
  });

  it("DIM", () => {
    expect(ZxBasicKeyword.findKeyword("DIM").keyword).toBe("DIM");
    expect(ZxBasicKeyword.findKeyword("dim").keyword).toBe("DIM");
  });

  it("DO", () => {
    expect(ZxBasicKeyword.findKeyword("DO").keyword).toBe("DO");
    expect(ZxBasicKeyword.findKeyword("do").keyword).toBe("DO");
  });

  it("DATA", () => {
    expect(ZxBasicKeyword.findKeyword("DATA").keyword).toBe("DATA");
    expect(ZxBasicKeyword.findKeyword("data").keyword).toBe("DATA");
  });

  it("DRAW", () => {
    expect(ZxBasicKeyword.findKeyword("DRAW").keyword).toBe("DRAW");
    expect(ZxBasicKeyword.findKeyword("draw").keyword).toBe("DRAW");
  });

  it("ELSE", () => {
    expect(ZxBasicKeyword.findKeyword("ELSE").keyword).toBe("ELSE");
    expect(ZxBasicKeyword.findKeyword("else").keyword).toBe("ELSE");
  });

  it("ELSEIF", () => {
    expect(ZxBasicKeyword.findKeyword("ELSEIF").keyword).toBe("ELSEIF");
    expect(ZxBasicKeyword.findKeyword("ELSE IF").keyword).toBe("ELSEIF");
    expect(ZxBasicKeyword.findKeyword("elseif").keyword).toBe("ELSEIF");
    expect(ZxBasicKeyword.findKeyword("else if").keyword).toBe("ELSEIF");
  });

  it("END", () => {
    expect(ZxBasicKeyword.findKeyword("END").keyword).toBe("END");
    expect(ZxBasicKeyword.findKeyword("end").keyword).toBe("END");
  });

  it("EXIT", () => {
    expect(ZxBasicKeyword.findKeyword("EXIT").keyword).toBe("EXIT");
    expect(ZxBasicKeyword.findKeyword("exit").keyword).toBe("EXIT");
  });

  it("EXP", () => {
    expect(ZxBasicKeyword.findKeyword("EXP").keyword).toBe("EXP");
    expect(ZxBasicKeyword.findKeyword("exp").keyword).toBe("EXP");
  });

  it("FastCall", () => {
    expect(ZxBasicKeyword.findKeyword("FASTCALL").keyword).toBe("FASTCALL");
    expect(ZxBasicKeyword.findKeyword("fastcall").keyword).toBe("FASTCALL");
  });

  it("FLASH", () => {
    expect(ZxBasicKeyword.findKeyword("FLASH").keyword).toBe("FLASH");
    expect(ZxBasicKeyword.findKeyword("flash").keyword).toBe("FLASH");
  });

  it("FOR", () => {
    expect(ZxBasicKeyword.findKeyword("FOR").keyword).toBe("FOR");
    expect(ZxBasicKeyword.findKeyword("for").keyword).toBe("FOR");
  });

  it("FUNCTION", () => {
    expect(ZxBasicKeyword.findKeyword("FUNCTION").keyword).toBe("FUNCTION");
    expect(ZxBasicKeyword.findKeyword("function").keyword).toBe("FUNCTION");
  });

  it("GOTO", () => {
    expect(ZxBasicKeyword.findKeyword("GOTO").keyword).toBe("GOTO");
    expect(ZxBasicKeyword.findKeyword("goto").keyword).toBe("GOTO");
    expect(ZxBasicKeyword.findKeyword("GO TO").keyword).toBe("GOTO");
    expect(ZxBasicKeyword.findKeyword("go to").keyword).toBe("GOTO");
  });
  it("GOSUB", () => {
    expect(ZxBasicKeyword.findKeyword("GOSUB").keyword).toBe("GOSUB");
    expect(ZxBasicKeyword.findKeyword("GO SUB").keyword).toBe("GOSUB");
    expect(ZxBasicKeyword.findKeyword("gosub").keyword).toBe("GOSUB");
    expect(ZxBasicKeyword.findKeyword("go sub").keyword).toBe("GOSUB");
  });

  it("IF", () => {
    expect(ZxBasicKeyword.findKeyword("IF").keyword).toBe("IF");
    expect(ZxBasicKeyword.findKeyword("if").keyword).toBe("IF");
  });

  it("IN", () => {
    expect(ZxBasicKeyword.findKeyword("IN").keyword).toBe("IN");
    expect(ZxBasicKeyword.findKeyword("in").keyword).toBe("IN");
  });

  it("INK", () => {
    expect(ZxBasicKeyword.findKeyword("INK").keyword).toBe("INK");
    expect(ZxBasicKeyword.findKeyword("ink").keyword).toBe("INK");
  });

  it("INKEY", () => {
    expect(ZxBasicKeyword.findKeyword("INKEY").keyword).toBe("INKEY");
    expect(ZxBasicKeyword.findKeyword("inkey").keyword).toBe("INKEY");
    expect(ZxBasicKeyword.findKeyword("inkey$").keyword).toBe("INKEY");
  });

  it("INPUT", () => {
    expect(ZxBasicKeyword.findKeyword("INPUT").keyword).toBe("INPUT");
    expect(ZxBasicKeyword.findKeyword("input").keyword).toBe("INPUT");
  });

  it("INT", () => {
    expect(ZxBasicKeyword.findKeyword("INT").keyword).toBe("INT");
    expect(ZxBasicKeyword.findKeyword("int").keyword).toBe("INT");
  });

  it("INVERSE", () => {
    expect(ZxBasicKeyword.findKeyword("INVERSE").keyword).toBe("INVERSE");
    expect(ZxBasicKeyword.findKeyword("inverse").keyword).toBe("INVERSE");
  });

  it("ITALIC", () => {
    expect(ZxBasicKeyword.findKeyword("ITALIC").keyword).toBe("ITALIC");
    expect(ZxBasicKeyword.findKeyword("italic").keyword).toBe("ITALIC");
  });

  it("LBOUND", () => {
    expect(ZxBasicKeyword.findKeyword("LBOUND").keyword).toBe("LBOUND");
    expect(ZxBasicKeyword.findKeyword("lbound").keyword).toBe("LBOUND");
  });

  it("LET", () => {
    expect(ZxBasicKeyword.findKeyword("LET").keyword).toBe("LET");
    expect(ZxBasicKeyword.findKeyword("let").keyword).toBe("LET");
  });

  it("LEN", () => {
    expect(ZxBasicKeyword.findKeyword("LEN").keyword).toBe("LEN");
    expect(ZxBasicKeyword.findKeyword("len").keyword).toBe("LEN");
  });

  it("LN", () => {
    expect(ZxBasicKeyword.findKeyword("LN").keyword).toBe("LN");
    expect(ZxBasicKeyword.findKeyword("ln").keyword).toBe("LN");
  });

  it("LOAD", () => {
    expect(ZxBasicKeyword.findKeyword("LOAD").keyword).toBe("LOAD");
    expect(ZxBasicKeyword.findKeyword("load").keyword).toBe("LOAD");
  });

  it("LOOP", () => {
    expect(ZxBasicKeyword.findKeyword("LOOP").keyword).toBe("LOOP");
    expect(ZxBasicKeyword.findKeyword("loop").keyword).toBe("LOOP");
  });

  it("NEXT", () => {
    expect(ZxBasicKeyword.findKeyword("NEXT").keyword).toBe("NEXT");
    expect(ZxBasicKeyword.findKeyword("next").keyword).toBe("NEXT");
  });

  it("NOT", () => {
    expect(ZxBasicKeyword.findKeyword("NOT").keyword).toBe("NOT");
    expect(ZxBasicKeyword.findKeyword("not").keyword).toBe("NOT");
  });

  it("OR", () => {
    expect(ZxBasicKeyword.findKeyword("OR").keyword).toBe("OR");
    expect(ZxBasicKeyword.findKeyword("or").keyword).toBe("OR");
  });

  it("OVER", () => {
    expect(ZxBasicKeyword.findKeyword("OVER").keyword).toBe("OVER");
    expect(ZxBasicKeyword.findKeyword("over").keyword).toBe("OVER");
  });

  it("OUT", () => {
    expect(ZxBasicKeyword.findKeyword("OUT").keyword).toBe("OUT");
    expect(ZxBasicKeyword.findKeyword("out").keyword).toBe("OUT");
  });

  it("PAPER", () => {
    expect(ZxBasicKeyword.findKeyword("PAPER").keyword).toBe("PAPER");
    expect(ZxBasicKeyword.findKeyword("paper").keyword).toBe("PAPER");
  });

  it("PAUSE", () => {
    expect(ZxBasicKeyword.findKeyword("PAUSE").keyword).toBe("PAUSE");
    expect(ZxBasicKeyword.findKeyword("pause").keyword).toBe("PAUSE");
  });

  it("PEEK", () => {
    expect(ZxBasicKeyword.findKeyword("PEEK").keyword).toBe("PEEK");
    expect(ZxBasicKeyword.findKeyword("peek").keyword).toBe("PEEK");
  });

  it("PI", () => {
    expect(ZxBasicKeyword.findKeyword("PI").keyword).toBe("PI");
    expect(ZxBasicKeyword.findKeyword("pi").keyword).toBe("PI");
  });

  it("PLOT", () => {
    expect(ZxBasicKeyword.findKeyword("PLOT").keyword).toBe("PLOT");
    expect(ZxBasicKeyword.findKeyword("plot").keyword).toBe("PLOT");
  });

  it("POKE", () => {
    expect(ZxBasicKeyword.findKeyword("POKE").keyword).toBe("POKE");
    expect(ZxBasicKeyword.findKeyword("poke").keyword).toBe("POKE");
  });

  it("PRINT", () => {
    expect(ZxBasicKeyword.findKeyword("PRINT").keyword).toBe("PRINT");
    expect(ZxBasicKeyword.findKeyword("print").keyword).toBe("PRINT");
  });

  it("RANDOMIZE", () => {
    expect(ZxBasicKeyword.findKeyword("RANDOMIZE").keyword).toBe("RANDOMIZE");
    expect(ZxBasicKeyword.findKeyword("randomize").keyword).toBe("RANDOMIZE");
  });

  it("READ", () => {
    expect(ZxBasicKeyword.findKeyword("READ").keyword).toBe("READ");
    expect(ZxBasicKeyword.findKeyword("read").keyword).toBe("READ");
  });

  it("REM", () => {
    expect(ZxBasicKeyword.findKeyword("REM").keyword).toBe("REM");
    expect(ZxBasicKeyword.findKeyword("rem").keyword).toBe("REM");
  });

  it("RESTORE", () => {
    expect(ZxBasicKeyword.findKeyword("RESTORE").keyword).toBe("RESTORE");
    expect(ZxBasicKeyword.findKeyword("restore").keyword).toBe("RESTORE");
  });

  it("RETURN", () => {
    expect(ZxBasicKeyword.findKeyword("RETURN").keyword).toBe("RETURN");
    expect(ZxBasicKeyword.findKeyword("return").keyword).toBe("RETURN");
  });

  it("RND", () => {
    expect(ZxBasicKeyword.findKeyword("RND").keyword).toBe("RND");
    expect(ZxBasicKeyword.findKeyword("rnd").keyword).toBe("RND");
  });

  it("SAVE", () => {
    expect(ZxBasicKeyword.findKeyword("SAVE").keyword).toBe("SAVE");
    expect(ZxBasicKeyword.findKeyword("save").keyword).toBe("SAVE");
  });

  it("SGN", () => {
    expect(ZxBasicKeyword.findKeyword("SGN").keyword).toBe("SGN");
    expect(ZxBasicKeyword.findKeyword("sgn").keyword).toBe("SGN");
  });

  it("SHL", () => {
    expect(ZxBasicKeyword.findKeyword("SHL").keyword).toBe("SHL OR &LT;&LT;");
    expect(ZxBasicKeyword.findKeyword("shl").keyword).toBe("SHL OR &LT;&LT;");
  });

  it("SHR", () => {
    expect(ZxBasicKeyword.findKeyword("SHR").keyword).toBe("SHR OR &GT;&GT;");
    expect(ZxBasicKeyword.findKeyword("shr").keyword).toBe("SHR OR &GT;&GT;");
  });

  it("SIN", () => {
    expect(ZxBasicKeyword.findKeyword("SIN").keyword).toBe("SIN");
    expect(ZxBasicKeyword.findKeyword("sin").keyword).toBe("SIN");
  });

  it("SQR", () => {
    expect(ZxBasicKeyword.findKeyword("SQR").keyword).toBe("SQR");
    expect(ZxBasicKeyword.findKeyword("sqr").keyword).toBe("SQR");
  });

  it("StdCall", () => {
    expect(ZxBasicKeyword.findKeyword("STDCALL").keyword).toBe("STDCALL");
    expect(ZxBasicKeyword.findKeyword("stdcall").keyword).toBe("STDCALL");
  });

  it("STEP", () => {
    expect(ZxBasicKeyword.findKeyword("STEP").keyword).toBe("STEP");
    expect(ZxBasicKeyword.findKeyword("step").keyword).toBe("STEP");
  });

  it("STOP", () => {
    expect(ZxBasicKeyword.findKeyword("STOP").keyword).toBe("STOP");
    expect(ZxBasicKeyword.findKeyword("stop").keyword).toBe("STOP");
  });

  it("STR", () => {
    expect(ZxBasicKeyword.findKeyword("STR").keyword).toBe("STR");
    expect(ZxBasicKeyword.findKeyword("str").keyword).toBe("STR");
    expect(ZxBasicKeyword.findKeyword("str$").keyword).toBe("STR");
  });

  it("SUB", () => {
    expect(ZxBasicKeyword.findKeyword("SUB").keyword).toBe("SUB");
    expect(ZxBasicKeyword.findKeyword("sub").keyword).toBe("SUB");
  });

  it("TAN", () => {
    expect(ZxBasicKeyword.findKeyword("TAN").keyword).toBe("TAN");
    expect(ZxBasicKeyword.findKeyword("tan").keyword).toBe("TAN");
  });

  it("THEN", () => {
    expect(ZxBasicKeyword.findKeyword("THEN").keyword).toBe("THEN");
    expect(ZxBasicKeyword.findKeyword("then").keyword).toBe("THEN");
  });

  it("TO", () => {
    expect(ZxBasicKeyword.findKeyword("TO").keyword).toBe("TO");
    expect(ZxBasicKeyword.findKeyword("to").keyword).toBe("TO");
  });

  it("UBOUND", () => {
    expect(ZxBasicKeyword.findKeyword("UBOUND").keyword).toBe("UBOUND");
    expect(ZxBasicKeyword.findKeyword("ubound").keyword).toBe("UBOUND");
  });

  it("UNTIL", () => {
    expect(ZxBasicKeyword.findKeyword("UNTIL").keyword).toBe("UNTIL");
    expect(ZxBasicKeyword.findKeyword("until").keyword).toBe("UNTIL");
  });

  it("VAL", () => {
    expect(ZxBasicKeyword.findKeyword("VAL").keyword).toBe("VAL");
    expect(ZxBasicKeyword.findKeyword("val").keyword).toBe("VAL");
  });

  it("VERIFY", () => {
    expect(ZxBasicKeyword.findKeyword("VERIFY").keyword).toBe("VERIFY");
    expect(ZxBasicKeyword.findKeyword("verify").keyword).toBe("VERIFY");
  });

  it("WEND", () => {
    expect(ZxBasicKeyword.findKeyword("WEND").keyword).toBe("WEND");
    expect(ZxBasicKeyword.findKeyword("wend").keyword).toBe("WEND");
  });

  it("WHILE", () => {
    expect(ZxBasicKeyword.findKeyword("WHILE").keyword).toBe("WHILE");
    expect(ZxBasicKeyword.findKeyword("while").keyword).toBe("WHILE");
  });

  it("XOR", () => {
    expect(ZxBasicKeyword.findKeyword("XOR").keyword).toBe("XOR");
    expect(ZxBasicKeyword.findKeyword("xor").keyword).toBe("XOR");
  });




});

describe("ZxBasic language provider find Inbuilt library Functions", () => {


  it("ASC (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("ASC").keyword).toBe("ASC (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("asc").keyword).toBe("ASC (LIBRARY FUNCTION)");
  });

  it("ATTR (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("ATTR").keyword).toBe("ATTR (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("attr").keyword).toBe("ATTR (LIBRARY FUNCTION)");
  });

  it("CSRLIN (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("CSRLIN").keyword).toBe("CSRLIN (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("csrlin").keyword).toBe("CSRLIN (LIBRARY FUNCTION)");
  });

  it("HEX (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("HEX").keyword).toBe("HEX (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("hex").keyword).toBe("HEX (LIBRARY FUNCTION)");
  });

  it("HEX16 (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("HEX16").keyword).toBe("HEX16 (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("hex16").keyword).toBe("HEX16 (LIBRARY FUNCTION)");
  });

  it("GetKey (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("GETKEY").keyword).toBe("GETKEY (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("getkey").keyword).toBe("GETKEY (LIBRARY FUNCTION)");
  });

  it("MultiKeys (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("MULTIKEYS").keyword).toBe("MULTIKEYS (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("multikeys").keyword).toBe("MULTIKEYS (LIBRARY FUNCTION)");
  });

  it("GetKeyScanCode (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("GETKEYSCANCODE").keyword).toBe("GETKEYSCANCODE (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("getkeyscancode").keyword).toBe("GETKEYSCANCODE (LIBRARY FUNCTION)");
  });

  it("LCase (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("LCASE").keyword).toBe("LCASE (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("lcase").keyword).toBe("LCASE (LIBRARY FUNCTION)");
  });

  it("UCase (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("UCase").keyword).toBe("UCASE (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("ucase").keyword).toBe("UCASE (LIBRARY FUNCTION)");
  });

  it("POINT (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("POINT").keyword).toBe("POINT (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("point").keyword).toBe("POINT (LIBRARY FUNCTION)");
  });

  it("POS (Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("POS").keyword).toBe("POS (LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("pos").keyword).toBe("POS (LIBRARY FUNCTION)");
  });

  it("print42 (Library Subroutine)", () => {
    expect(ZxBasicKeyword.findKeyword("PRINT42").keyword).toBe("PRINT42 (LIBRARY SUBROUTINE)");
    expect(ZxBasicKeyword.findKeyword("print42").keyword).toBe("PRINT42 (LIBRARY SUBROUTINE)");
  });

  it("printat42 (Library Subroutine)", () => {
    expect(ZxBasicKeyword.findKeyword("PRINTAT42").keyword).toBe("PRINTAT42 (LIBRARY SUBROUTINE)");
    expect(ZxBasicKeyword.findKeyword("printat42").keyword).toBe("PRINTAT42 (LIBRARY SUBROUTINE)");
  });

  it("print64 (Library Subroutine)", () => {
    expect(ZxBasicKeyword.findKeyword("PRINT64").keyword).toBe("PRINT64 (LIBRARY SUBROUTINE)");
    expect(ZxBasicKeyword.findKeyword("print64").keyword).toBe("PRINT64 (LIBRARY SUBROUTINE)");
  });

  it("printat64 (Library Subroutine)", () => {
    expect(ZxBasicKeyword.findKeyword("PRINTAT64").keyword).toBe("PRINTAT64 (LIBRARY SUBROUTINE)");
    expect(ZxBasicKeyword.findKeyword("printat64").keyword).toBe("PRINTAT64 (LIBRARY SUBROUTINE)");
  });

  it("SCREEN(Library Function)", () => {
    expect(ZxBasicKeyword.findKeyword("SCREEN").keyword).toBe("SCREEN(LIBRARY FUNCTION)");
    expect(ZxBasicKeyword.findKeyword("screen").keyword).toBe("SCREEN(LIBRARY FUNCTION)");
  });

});
