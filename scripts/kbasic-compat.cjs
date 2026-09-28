#!/usr/bin/env node
/**
 * Klive BASIC's generated compatibility suites (compatibility plan C2, §3.3): small items - an
 * expression printed on its own row, with the declarations it needs - over types, operators,
 * literals, CONST folding, conversions and number printing. zxbc's results are recorded once by the
 * oracle; CI runs Klive BASIC over the same items and compares them one by one
 * (`test/kbasic/compat/compat.test.ts`).
 *
 *   node scripts/kbasic-compat.cjs gen                  write test/kbasic/compat/suites/<suite>.json
 *   node scripts/kbasic-compat.cjs oracle [suite ...]   run zxbc: test/kbasic/compat/oracle/<suite>.json
 *
 * The oracle keeps the guard rails of `scripts/kbasic-oracle.cjs` (plan D12): never in CI, zxbc's
 * output only in a temporary folder, and the results hold what the programs printed, never code. A
 * program zxbc rejects is split in halves until each rejected item stands alone, so one item cannot
 * hide the others' results.
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const COMPAT = path.join(ROOT, "test/kbasic/compat");
const SUITES = path.join(COMPAT, "suites");
const RUNNER = "test/kbasic/compat/compat-oracle-run.test.ts";
const ORG = 32768;

// ------------------------------------------------------------------------------------------------
// Programs

/** The rows a program holds: one item a row, printed with AT so a long value cannot shift the rest. */
const ROWS = 20;

/**
 * The source of a program printing `items`, one a row from row 0. An item with `rows` (alone in its
 * program) prints nothing of its own: its result is the first `rows` rows its statements leave.
 */
function buildProgram(items) {
  const lines = ["' Klive BASIC compatibility suite (scripts/kbasic-compat.cjs)"];
  // --- Header options (`'@name value`, C7): only for an item alone in its program
  for (const item of items) lines.push(...(item.header ?? []));
  for (const item of items) lines.push(...item.decl);
  items.forEach((item, row) => {
    if (!item.rows) lines.push(`PRINT AT ${row}, 0; ${item.expr}`);
  });
  return lines.join("\n") + "\n";
}

/**
 * What an item's program shows for it: its row, or its first `rows` rows joined with " / "; an item
 * with `err` adds ERR_NR as the run left it (255 is OK).
 */
function itemResult(item, row, screenLine, peek) {
  const shown = !item.rows ? screenLine(row).trimEnd() : Array.from({ length: item.rows }, (_, r) => screenLine(r).trimEnd()).join(" / ");
  return item.err && peek ? `${shown} | ERR ${peek(23610)}` : shown;
}

/** Items in programs of `size` (at most ROWS), in order. */
function chunk(items, size) {
  const n = Math.max(1, Math.min(size, ROWS));
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}

// ------------------------------------------------------------------------------------------------
// The suites

const TYPES = ["UByte", "Byte", "UInteger", "Integer", "ULong", "Long", "Fixed", "Float"];
/** Operand pairs per type: ordinary values, signs, and the type's edges. */
const PAIRS = {
  UByte: [[200, 100], [7, 2], [255, 1], [3, 200]],
  Byte: [[-7, 2], [7, -2], [-128, -1], [100, 27]],
  UInteger: [[60000, 1000], [7, 2], [65535, 1], [3, 60000]],
  Integer: [[-100, 3], [100, -3], [-32768, -1], [30000, 3000]],
  ULong: [[4000000000, 7], [7, 2], [4294967295, 1], [3, 70000]],
  Long: [[-100000, 7], [100000, -7], [-2147483648, -1], [2000000000, 2000000000]],
  Fixed: [[3.5, 1.25], [-7.5, 2], [100.25, -0.5], [0.1, 3]],
  Float: [[7.5, 2.5], [-7.5, 2], [1e10, 3], [0.1, 3]]
};
const BINARY = ["+", "-", "*", "/", "MOD", "=", "<", ">", "BAND", "BOR", "BXOR"];
const LITERALS = ["0", "1", "5", "127", "128", "200", "255", "256", "1000", "32767", "32768", "40000", "65535", "65536", "100000", "-1", "-5", "-128", "-129", "-200", "-32768", "-32769", "$FF", "$100", "0.5", "2.5", "0.001", "1E10", "3.0"];
const LITERAL_FORMS = ["L", "-(L)", "BNOT L", "NOT L", "L SHL 1", "L SHL 8", "L SHR 1", "L + 1", "L - 1", "L * 2", "L / 2", "L / 8", "L MOD 3", "L + L", "L * L"];

function literal(v) {
  return String(v).replace("e+", "E");
}

function generate() {
  const suites = {};
  let n = 0;
  const name = () => `v${++n}`;

  // --- Literals and constant folding: nothing declared
  suites.literals = {
    perProgram: ROWS,
    items: [...new Set(LITERALS.flatMap((l) => LITERAL_FORMS.map((form) => form.replace(/L/g, l))))].map((expr) => ({ id: expr, decl: [], expr }))
  };

  // --- Binary operators on two variables of one type
  suites.binary = {
    perProgram: ROWS,
    items: TYPES.flatMap((t) =>
      PAIRS[t].flatMap(([x, y]) =>
        BINARY.map((op) => {
          const a = name();
          const b = name();
          return { id: `${t} ${literal(x)} ${op} ${literal(y)}`, decl: [`DIM ${a} AS ${t} = ${literal(x)}`, `DIM ${b} AS ${t} = ${literal(y)}`], expr: `${a} ${op} ${b}` };
        })
      )
    )
  };

  // --- Mixed types: which type an operation takes
  const MIXED = [["UByte", "Byte"], ["UByte", "Integer"], ["Byte", "UInteger"], ["Integer", "UInteger"], ["Integer", "Long"], ["UInteger", "Long"], ["Long", "ULong"], ["Byte", "ULong"], ["Integer", "Fixed"], ["Long", "Fixed"], ["Integer", "Float"], ["Fixed", "Float"]];
  suites.mixed = {
    perProgram: ROWS,
    items: MIXED.flatMap(([t1, t2]) =>
      [[PAIRS[t1][0][0], PAIRS[t2][0][1]], [PAIRS[t1][1][0], PAIRS[t2][2][0]]].flatMap(([x, y]) =>
        ["+", "-", "*", "/", "MOD", "<"].map((op) => {
          const a = name();
          const b = name();
          return { id: `${t1} ${literal(x)} ${op} ${t2} ${literal(y)}`, decl: [`DIM ${a} AS ${t1} = ${literal(x)}`, `DIM ${b} AS ${t2} = ${literal(y)}`], expr: `${a} ${op} ${b}` };
        })
      )
    )
  };

  // --- Shifts: a variable or a literal shifted by a literal or a UByte variable
  suites.shifts = {
    perProgram: ROWS,
    items: ["UByte", "Byte", "UInteger", "Integer", "ULong", "Long"].flatMap((t) =>
      [PAIRS[t][0][0], PAIRS[t][1][0]].flatMap((x) =>
        [1, 3, 8, 17].flatMap((count) =>
          ["SHL", "SHR"].flatMap((op) => {
            const a = name();
            const c = name();
            return [
              { id: `${t} ${literal(x)} ${op} ${count}`, decl: [`DIM ${a} AS ${t} = ${literal(x)}`], expr: `${a} ${op} ${count}` },
              { id: `${t} ${literal(x)} ${op} UByte ${count}`, decl: [`DIM ${a}s AS ${t} = ${literal(x)}`, `DIM ${c} AS UByte = ${count}`], expr: `${a}s ${op} ${c}` }
            ];
          })
        )
      )
    )
  };

  // --- CONST: typed and untyped, folded into expressions
  suites.consts = {
    perProgram: ROWS,
    items: [...TYPES.map((t) => ` AS ${t}`), ""].flatMap((as) =>
      [PAIRS[as ? as.slice(4) : "Integer"][0][0], PAIRS[as ? as.slice(4) : "Integer"][1][0]].flatMap((x) =>
        ["k", "k + k", "k * 3", "k - 300", "-k", "k / 7", "k MOD 7"].map((form) => {
          const k = name();
          return { id: `CONST${as || " (untyped)"} ${literal(x)}: ${form}`, decl: [`CONST ${k}${as} = ${literal(x)}`], expr: form.replace(/k/g, k) };
        })
      )
    )
  };

  // --- Conversions: assignment and CAST from every type to every type
  suites.convert = {
    perProgram: ROWS,
    items: TYPES.flatMap((from) =>
      [PAIRS[from][0][0], PAIRS[from][1][0]].flatMap((x) =>
        TYPES.flatMap((to) => {
          const a = name();
          const b = name();
          return [
            { id: `${from} ${literal(x)} -> ${to} (assignment)`, decl: [`DIM ${a} AS ${from} = ${literal(x)}`, `DIM ${b} AS ${to}`, `${b} = ${a}`], expr: b },
            { id: `CAST(${to}, ${from} ${literal(x)})`, decl: [`DIM ${a}c AS ${from} = ${literal(x)}`], expr: `CAST(${to}, ${a}c)` }
          ];
        })
      )
    )
  };

  // --- Unary operators and numeric functions
  suites.unary = {
    perProgram: ROWS,
    items: TYPES.flatMap((t) =>
      [PAIRS[t][0][0], PAIRS[t][1][0]].flatMap((x) =>
        ["-a", "BNOT a", "NOT a", "ABS(a)", "SGN(a)", "INT(a)"].map((form) => {
          const a = name();
          return { id: `${t} ${literal(x)}: ${form}`, decl: [`DIM ${a} AS ${t} = ${literal(x)}`], expr: form.replace(/a/g, a) };
        })
      )
    )
  };

  // --- How PRINT writes numbers held in variables
  const PRINTED = {
    Float: ["0", "1", "-1", "0.5", "0.001", "1E-5", "1.5E-5", "123456789", "1234567890", "1E10", "-1E10", "2147483648", "1E38", "1E-38", "3.14159265", "99999999", "100000000", "0.1"],
    Fixed: ["0.5", "-0.5", "32767.5", "-32768", "0.0001", "1.1", "-0.1"],
    UByte: ["0", "255"],
    Byte: ["-128", "127"],
    UInteger: ["65535"],
    Integer: ["-32768", "32767"],
    ULong: ["4294967295"],
    Long: ["-2147483648", "2147483647"]
  };
  suites.print = {
    perProgram: ROWS,
    items: Object.entries(PRINTED).flatMap(([t, values]) =>
      values.map((v) => {
        const a = name();
        return { id: `PRINT ${t} ${v}`, decl: [`DIM ${a} AS ${t} = ${v}`], expr: a };
      })
    )
  };

  // --- Division and MOD by a zero variable: one item a program, since an error may stop it
  suites.divzero = {
    perProgram: 1,
    items: TYPES.flatMap((t) =>
      [...new Set([PAIRS[t][1][0], PAIRS[t][0][0]])].flatMap((x) =>
        ["/", "MOD"].map((op) => {
          const a = name();
          const z = name();
          return { id: `${t} ${literal(x)} ${op} 0`, decl: [`DIM ${a} AS ${t} = ${literal(x)}`, `DIM ${z} AS ${t}`], expr: `${a} ${op} ${z}` };
        })
      )
    )
  };

  // --- A variable meeting a literal, on either side: which type the literal takes there
  const MEET = ["2", "-1", "256", "0.5", "0.001", "1E10", "70000"];
  suites.meet = {
    perProgram: ROWS,
    items: TYPES.flatMap((t) =>
      MEET.flatMap((l) =>
        ["a + L", "L - a", "a * L", "a / L", "L / a", "a MOD L"].map((form) => {
          const a = name();
          return { id: `${t} ${literal(PAIRS[t][1][0])}: ${form.replace(/L/g, l)}`, decl: [`DIM ${a} AS ${t} = ${literal(PAIRS[t][1][0])}`], expr: form.replace(/a/g, a).replace(/L/g, l) };
        })
      )
    )
  };

  // --- A constant expression converted to a declared type (DIM ... = constant)
  const INITIAL = ["-2.5", "2.5", "-0.1", "0.001", "1 / 3", "-1 / 3", "7 / 2", "1E10", "70000", "-1", "300", "-129", "65536", "3.99", "-3.99"];
  suites.initial = {
    perProgram: ROWS,
    items: TYPES.flatMap((t) =>
      INITIAL.map((c) => {
        const a = name();
        return { id: `DIM AS ${t} = ${c}`, decl: [`DIM ${a} AS ${t} = ${c}`], expr: a };
      })
    )
  };

  // --- Variables typed by their first assignment, and a FOR variable after the loop
  const IMPLICIT = [["1.5", "v / 7"], ["7 / 2", "v / 7"], ["0.001", "v"], ["100000", "v * 100000"], ["-1", "v"], ["2.5", "v * v * v * v"], ["1E10", "v"], ["40000", "v + v"], ["-200", "v"], ["0.5", "v * 2"]];
  suites.implicit = {
    perProgram: ROWS,
    items: [
      ...IMPLICIT.map(([value, form]) => {
        const v = name();
        return { id: `${v.replace(/\d+/, "")} = ${value}: ${form}`, decl: [`${v} = ${value}`], expr: form.replace(/v/g, v) };
      }),
      ...[["0", "1", "0.25"], ["1", "0", "-0.5"], ["0", "2.5", "1"], ["10", "1", "-3"], ["1", "300", "100"]].map(([from, to, step]) => {
        const v = name();
        return { id: `FOR v = ${from} TO ${to} STEP ${step}: v / 3 after`, decl: [`FOR ${v} = ${from} TO ${to} STEP ${step}: NEXT ${v}`], expr: `${v} / 3` };
      })
    ]
  };

  // --- Signed variables divided by literals: whole, with a zero fraction, powers of two or not
  suites.divlit = {
    perProgram: ROWS,
    items: ["Byte", "Integer", "Long"].flatMap((t) =>
      [PAIRS[t][0][0], PAIRS[t][1][0], -1].flatMap((x) =>
        ["a / 2", "a / 4", "a / 3", "a / 2.0", "a MOD 2", "a MOD 4", "a MOD 2.0", "a * 2.0", "a SHR 1"].map((form) => {
          const a = name();
          return { id: `${t} ${literal(x)}: ${form}`, decl: [`DIM ${a} AS ${t} = ${literal(x)}`], expr: form.replace(/a/g, a) };
        })
      )
    )
  };

  // --- Strings: comparison, concatenation, slices and the String functions, on variables
  const STRS = [["abc", "abd"], ["", "a"], ["ab", "abc"], ["B", "a"], ["Hello", "Hello"], ["x", ""]];
  const SLICES = ["s(1 TO 3)", "s(2)", "s(TO 2)", "s(3 TO)", "s(0)", "s(4 TO 2)", "s(1 TO 99)", "s(0 TO 0)"];
  const STRFNS = ["LEN(s)", "CODE(s)", "s + t", "t + s", "STR$(LEN(s)) + s", "CHR$(65) + s", "s = t", "s < t", "s > t", "s <> t", "s <= t", "s >= t"];
  suites.strings = {
    perProgram: ROWS,
    items: [
      ...STRS.flatMap(([x, y]) =>
        STRFNS.map((form) => {
          const a = name();
          const b = name();
          return { id: `"${x}", "${y}": ${form}`, decl: [`DIM ${a} AS String = "${x}"`, `DIM ${b} AS String = "${y}"`], expr: form.replace(/\bs\b/g, a).replace(/\bt\b/g, b) };
        })
      ),
      ...["Hello World", "Hi", ""].flatMap((x) =>
        SLICES.map((form) => {
          const a = name();
          return { id: `"${x}": ${form}`, decl: [`DIM ${a} AS String = "${x}"`], expr: form.replace(/\bs\b/g, a) };
        })
      ),
      ...["1.5", "-0.001", "1E10", "65535", "-32768", "0.1", "1 / 3", "3.0"].map((v) => ({ id: `STR$(${v})`, decl: [], expr: `STR$(${v})` })),
      ...["Float 0.1", "Float -2.5", "Fixed 0.1", "Fixed -2.5", "Long -100000", "UByte 200", "Integer -32768"].map((tv) => {
        const [t, v] = tv.split(" ");
        const a = name();
        return { id: `STR$(${t} ${v})`, decl: [`DIM ${a} AS ${t} = ${v}`], expr: `STR$(${a})` };
      })
    ]
  };

  // --- The numeric built-ins on each type, inside each function's domain
  const BUILTIN_VALUES = { UByte: [0, 200], Byte: [-100, 7], UInteger: [1, 60000], Integer: [-2, 30000], ULong: [1, 4000000000], Long: [-100000, 3], Fixed: [0.5, -2.5], Float: [0.5, -7.25] };
  const FNS = ["ABS(a)", "SGN(a)", "INT(a)", "SQR(ABS(a))", "SIN(a)", "COS(a)", "TAN(a)", "ATN(a)", "EXP(a / 100000)", "LN(ABS(a) + 1)", "a * PI", "a ^ 2"];
  suites.builtins = {
    perProgram: ROWS,
    items: [
      ...TYPES.flatMap((t) =>
        BUILTIN_VALUES[t].flatMap((x) =>
          FNS.map((form) => {
            const a = name();
            return { id: `${t} ${literal(x)}: ${form}`, decl: [`DIM ${a} AS ${t} = ${literal(x)}`], expr: form.replace(/\ba\b/g, a) };
          })
        )
      ),
      ...["0.5", "-0.5", "1", "0"].flatMap((v) => ["ASN", "ACS"].map((f) => ({ id: `${f}(${v})`, decl: [], expr: `${f}(${v})` }))),
      ...["2.5", "-2.5", "7", "0.001", "1E10", "256"].flatMap((v) => ["ABS", "SGN", "INT", "SQR"].map((f) => ({ id: `${f}(${v}) (literal)`, decl: [], expr: `${f}(${v === "-2.5" ? "ABS(-2.5)" : v})` })))
    ]
  };

  // --- Statements (C3): evaluation order around calls, named arguments, FOR. One program an item: each
  // --- has routines with side effects of its own. `@` in a line is replaced by the item's own suffix.
  const STATEMENTS = [
    // --- Evaluation order: a FUNCTION that changes g and b, then an expression reading them too
    ["order: g + f()", "g + f()"], ["order: f() + g", "f() + g"], ["order: g - f()", "g - f()"],
    ["order: g * 2 - f()", "g * 2 - f()"], ["order: (g + 0) + f()", "(g + 0) + f()"], ["order: -g + f()", "-g + f()"],
    ["order: g + f() * 1", "g + f() * 1"], ["order: t(1) + f()", "t(1) + f()"], ["order: u + f()", "u + f()"], ["order: fl + f()", "fl + f()"],
    ["order: g + f() + g", "g + f() + g"], ["order: f() + g + f()", "f() + g + f()"], ["order: g + (f() + g)", "g + (f() + g)"],
    ["order: g = f()", "g = f()"], ["order: g AND f()", "g AND f()"], ["order: s + h()", "s + h()"],
    ["order: 100 + f() + g", "100 + f() + g"], ["order: g < f()", "g < f()"], ["order: f() - f()", "f() - f()"],
    ["order: b + f()", "b + f()"], ["order: (g + b) + f()", "(g + b) + f()"], ["order: CAST(Integer, g) + f()", "CAST(Integer, g) + f()"],
    ["order: g2(g, f())", "g2(g, f())"], ["order: g2(f(), g)", "g2(f(), g)"]
  ].map(([id, expr]) => ({
    id,
    decl: [
      "DIM g@, b@ AS Integer", "DIM t@(3) AS Integer", "DIM u@ AS UByte = 5", "DIM fl@ AS Float = 5", "DIM s@ AS String = \"a\"",
      "FUNCTION f@() AS Integer: g@ = g@ + 10: b@ = b@ + 100: t@(1) = t@(1) + 1000: u@ = u@ + 10: fl@ = fl@ + 10: RETURN 1: END FUNCTION",
      "FUNCTION h@() AS String: s@ = \"b\": RETURN \"c\": END FUNCTION",
      "FUNCTION g2@(x AS Integer, y AS Integer) AS Integer: RETURN x * 100 + y: END FUNCTION",
      "g@ = 5: b@ = 3: t@(1) = 7"
    ],
    expr: expr.replace(/\bg2\(/g, "g2@(").replace(/\bg\b/g, "g@").replace(/\bb\b/g, "b@").replace(/\bu\b/g, "u@").replace(/\bfl\b/g, "fl@").replace(/\bs\b/g, "s@").replace(/\bh\(\)/g, "h@()").replace(/\bt\(/g, "t@(").replace(/\bf\(\)/g, "f@()")
  }));
  const ASSIGN = [
    ["assign: t(g) = f()", "t@(g@) = f@()", 'STR$(t@(0)) + " " + STR$(t@(1)) + " " + STR$(t@(2)) + " " + STR$(g@)'],
    ["assign: t(g + 0) = f()", "t@(g@ + 0) = f@()", 'STR$(t@(0)) + " " + STR$(t@(1)) + " " + STR$(t@(2)) + " " + STR$(g@)'],
    ["assign: t(h()) = f()", "t@(h@()) = f@()", 'STR$(t@(0)) + " " + STR$(t@(1)) + " " + STR$(t@(2)) + " " + STR$(g@)'],
    ["assign: g = g + f()", "g@ = g@ + f@()", "g@"]
  ].map(([id, stmt, expr]) => ({
    id,
    decl: [
      "DIM g@ AS UByte", "DIM t@(20) AS Integer",
      "FUNCTION f@() AS Integer: g@ = g@ + 1: RETURN 50: END FUNCTION",
      "FUNCTION h@() AS UByte: g@ = g@ + 1: RETURN g@: END FUNCTION",
      "g@ = 1", stmt
    ],
    expr
  }));
  const NAMED = [
    ["named: s(c := 7, a := 5)", "s@(c := 7, a := 5)"], ["named: s(1, c := 9)", "s@(1, c := 9)"], ["named: s(b := 4)", "s@(b := 4)"],
    ["named: s(a := 1, b := 2, c := 3)", "s@(a := 1, b := 2, c := 3)"], ["named: fn(y := 2, x := 1)", "PRINT AT 0, 0; fn@(y := 2, x := 1)"]
  ].map(([id, stmt]) => ({
    id,
    decl: [
      "SUB s@(a AS UByte = 1, b AS UByte = 2, c AS UByte = 3): PRINT AT 0, 0; a; \"-\"; b; \"-\"; c: END SUB",
      "FUNCTION fn@(x AS UByte, y AS UByte = 50) AS UInteger: RETURN x * 100 + y: END FUNCTION",
      stmt
    ],
    expr: '""; : REM'
  }));
  const FORS = [
    ["for: limit and step changed in the body", "DIM i@, l@, s@, n@ AS Integer", "l@ = 10: s@ = 2: FOR i@ = 1 TO l@ STEP s@: l@ = 0: s@ = 100: n@ = n@ + 1: NEXT i@"],
    ["for: limit raised in the body", "DIM i@, l@, n@ AS Integer", "l@ = 3: FOR i@ = 1 TO l@: IF i@ = 2 THEN l@ = 5\nn@ = n@ + 1: NEXT i@"],
    ["for: step changed in the body", "DIM i@, s@, n@ AS Integer", "s@ = 1: FOR i@ = 1 TO 10 STEP s@: s@ = 3: n@ = n@ + 1: NEXT i@"],
    ["for: limit from a FUNCTION", "DIM i@, n@, c@ AS Integer\nFUNCTION lim@() AS Integer: c@ = c@ + 1: RETURN 4: END FUNCTION", "FOR i@ = 1 TO lim@(): n@ = n@ + 1: NEXT i@\nn@ = n@ * 100 + c@"],
    ["for: step from a FUNCTION", "DIM i@, n@, c@ AS Integer\nFUNCTION st@() AS Integer: c@ = c@ + 1: RETURN 1: END FUNCTION", "FOR i@ = 1 TO 4 STEP st@(): n@ = n@ + 1: NEXT i@\nn@ = n@ * 100 + c@"],
    ["for: start from a FUNCTION", "DIM i@, n@, c@ AS Integer\nFUNCTION st@() AS Integer: c@ = c@ + 1: RETURN 1: END FUNCTION", "FOR i@ = st@() TO 4: n@ = n@ + 1: NEXT i@\nn@ = n@ * 100 + c@"],
    ["for: UInteger with a negative Integer STEP", "DIM u@ AS UInteger\nDIM s@ AS Integer = -300\nDIM n@ AS Integer", "FOR u@ = 1000 TO 150 STEP s@: n@ = n@ + 1: NEXT u@\nn@ = n@ * 10000 + u@"],
    ["for: UByte with a negative Byte STEP", "DIM u@ AS UByte\nDIM s@ AS Byte = -2\nDIM n@ AS Integer", "FOR u@ = 9 TO 2 STEP s@: n@ = n@ + 1: NEXT u@\nn@ = n@ * 1000 + u@"],
    ["for: UByte with a negative literal STEP", "DIM u@ AS UByte\nDIM n@ AS Integer", "FOR u@ = 9 TO 2 STEP -2: n@ = n@ + 1: NEXT u@\nn@ = n@ * 1000 + u@"],
    ["for: Integer with a UByte STEP variable", "DIM i@ AS Integer\nDIM s@ AS UByte = 3\nDIM n@ AS Integer", "FOR i@ = 1 TO 10 STEP s@: n@ = n@ + 1: NEXT i@\nn@ = n@ * 100 + i@"],
    ["for: no pass", "DIM i@, n@ AS Integer", "FOR i@ = 10 TO 1: n@ = n@ + 1: NEXT i@\nn@ = n@ * 100 + i@"],
    ["for: the variable changed in the body", "DIM i@, n@ AS Integer", "FOR i@ = 1 TO 10: i@ = i@ + 2: n@ = n@ + 1: NEXT i@\nn@ = n@ * 100 + i@"],
    ["for: Float variable, 0.1 steps", "DIM f@ AS Float\nDIM n@ AS Integer", "FOR f@ = 0 TO 1 STEP 0.1: n@ = n@ + 1: NEXT f@\nn@ = n@ * 100 + INT(f@ * 10)"],
    ["for: Fixed variable, 0.25 steps", "DIM f@ AS Fixed\nDIM n@ AS Integer", "FOR f@ = 0 TO 1 STEP 0.25: n@ = n@ + 1: NEXT f@\nn@ = n@ * 100 + INT(f@ * 100)"],
    ["for: UByte up to 255", "DIM u@ AS UByte\nDIM n@ AS Integer", "FOR u@ = 250 TO 255: n@ = n@ + 1: IF n@ > 20 THEN EXIT FOR\nNEXT u@\nn@ = n@ * 1000 + u@"],
    ["for: Byte down to -128", "DIM u@ AS Byte\nDIM n@ AS Integer", "FOR u@ = -125 TO -128 STEP -1: n@ = n@ + 1: IF n@ > 20 THEN EXIT FOR\nNEXT u@\nn@ = n@ * 1000 + u@"],
    ["for: an undeclared variable", "DIM n@ AS Integer", "FOR k@ = 1 TO 300 STEP 100: n@ = n@ + 1: NEXT k@\nn@ = n@ * 1000 + k@"]
  ].map(([id, decl, body]) => ({ id, decl: [...decl.split("\n"), ...body.split("\n")], expr: "n@" }));
  suites.statements = {
    perProgram: 1,
    items: [...STATEMENTS, ...ASSIGN, ...NAMED, ...FORS].map((item) => {
      const suffix = name();
      const sub = (text) => text.replace(/@/g, suffix);
      return { id: item.id, decl: item.decl.map(sub), expr: sub(item.expr) };
    })
  };

  // --- Runtime errors (C3): does the program stop, or set ERR_NR and carry on? One program each; the
  // --- row reads "after <ERR_NR>" when it carried on, and stays empty when it stopped
  const ERRORS = [
    ["PRINT AT row 30", 'PRINT AT 30, 0; "y";'], ["PRINT AT column 40", 'PRINT AT 0, 40; "y";'],
    ["INK 10", "INK 10"], ["PAPER 12", "PAPER 12"], ["PRINT INK 10", 'PRINT INK 10; "y";'], ["BORDER 9", "BORDER 9"],
    ["PLOT off the screen", "PLOT 10, 200"], ["DRAW off the screen", "PLOT 10, 10: DRAW 250, 0"], ["CIRCLE off the screen", "CIRCLE 250, 100, 20"],
    ["READ of the wrong kind", 'DIM x@ AS UByte\nREAD x@\nDATA "t"'], ["READ after RESTORE to no DATA", "DIM x@ AS UByte\nDATA 1\nRESTORE fin@\nREAD x@\nfin@:"],
    ["STOP", "STOP"], ["ERROR 3", "ERROR 3"], ["SQR(-1)", "DIM f@ AS Float = -1\nf@ = SQR(f@)"], ["Float overflow", "DIM f@ AS Float = 1E38\nf@ = f@ * f@"],
    ["LN(0)", "DIM f@ AS Float\nf@ = LN(f@)"], ["BEEP too long", "BEEP 100, 0"], ["BEEP too high", "BEEP 0.01, 100"],
    ["String heap full", 'DIM s@ AS String\nDIM i@ AS UInteger\nFOR i@ = 1 TO 300: s@ = s@ + "0123456789012345678901234567890123456789": NEXT i@'],
    ["CHR$ of 300", "DIM c@ AS UInteger = 300\nDIM s@ AS String\ns@ = CHR$(c@)"], ["USR of a String", 'DIM u@ AS UInteger\nu@ = USR "zz"'],
    ["END", "END"], ["Fixed division by zero", "DIM a@, z@ AS Fixed\na@ = 1\na@ = a@ / z@"]
  ];
  suites.errors = {
    perProgram: 1,
    items: ERRORS.map(([id, stmt]) => {
      const suffix = name();
      return { id, decl: stmt.replace(/@/g, suffix).split("\n"), expr: '"after "; PEEK 23610' };
    })
  };

  // --- The screen (C3c): colours, PRINT's layout, graphics, USR of a String, slice assignment. One
  // --- program each; `@` becomes the item's own suffix
  const ATTRS = "PEEK 22688; \" \"; PEEK 23693; \" \"; PEEK 23694; \" \"; PEEK 23697; \" \"; PEEK 23624";
  const COLOURS = [
    ...[0, 7, 8, 9, 10, 15].map((v) => `INK ${v}`), ...[0, 8, 9, 10, 12].map((v) => `PAPER ${v}`),
    ...[1, 2, 8].flatMap((v) => [`FLASH ${v}`, `BRIGHT ${v}`]), ...[1, 2].flatMap((v) => [`INVERSE ${v}`, `OVER ${v}`]),
    ...[0, 7, 8, 9, 10].map((v) => `BORDER ${v}`), "PAPER 1: INK 9", "PAPER 6: INK 9", "INK 2: PAPER 9"
  ].map((stmt) => ({ id: `colour: ${stmt}`, decl: [stmt, 'PRINT AT 5, 0; "a";'], expr: ATTRS }));
  const PRINTED_COLOURS = ["INK 9", "PAPER 9", "INK 8", "INK 10", "FLASH 8", "BRIGHT 2", "PAPER 1; INK 9", "INVERSE 1", "OVER 1"].map((attr) => ({
    id: `colour: PRINT ${attr};`,
    decl: [`PRINT AT 5, 0; ${attr}; "a";`],
    expr: ATTRS
  }));
  const LAYOUT = [
    ['PRINT "a", "b", "c"', 2], ['PRINT "abcdefghijklmnopqrst", "x"', 2], ['PRINT TAB 10; "x"; TAB 5; "y"', 2], ['PRINT TAB 40; "x"', 1],
    ['PRINT 1; 2; -3; 0.5', 1], ['PRINT "a"; 1; "b"', 1], ['PRINT AT 0, 30; "abcd"', 2], ['PRINT "0123456789012345678901234567890123456789"', 2],
    ['PRINT "a" + CHR$(8) + "b"', 1], ['PRINT "a" + CHR$(13) + "b"', 2], ['PRINT CHR$(22) + CHR$(1) + CHR$(3) + "x"', 2],
    ['PRINT CHR$(23) + CHR$(5) + CHR$(0) + "x"', 1], ['PRINT "x"; CHR$(6); "y"', 1], ['PRINT , "x"', 1], ['PRINT ; "x"', 1],
    ['PRINT: PRINT "x"', 2], ['PRINT AT 0, 0; "ab"; AT 0, 1; "c"', 1], ['PRINT 3 = 3; 3 < 2', 1], ['PRINT "abc": CLS: PRINT "x"', 1],
    ['PRINT "a";: PRINT "b"', 1], ['PRINT "a", : PRINT "b"', 1], ['PRINT AT 1, 0; "x": PRINT "y"', 3], ['PRINT "x"; TAB 3; "y"; TAB 3; "z"', 2]
  ].map(([stmt, rows]) => ({ id: `layout: ${stmt}`, decl: [stmt], expr: "", rows }));
  const CHECKSUM = "FUNCTION ck@() AS UInteger: DIM a AS UInteger: DIM s AS UInteger: FOR a = 16384 TO 22527: s = (s SHL 1) BXOR PEEK a: NEXT a: RETURN s: END FUNCTION";
  const GRAPHICS = [
    "PLOT 0, 0: PLOT 255, 191: PLOT 128, 96", "PLOT 10, 10: DRAW 100, 50: DRAW -30, 70: DRAW 0, -50", "PLOT 0, 0: DRAW 255, 175",
    "CIRCLE 128, 96, 50", "CIRCLE 10, 10, 5", "CIRCLE 128, 96, 1", "CIRCLE 128, 96, 0", "CIRCLE 200, 150, 30",
    "PLOT 50, 50: DRAW 100, 0, PI", "PLOT 50, 50: DRAW 50, 50, -PI / 2", "PLOT 100, 100: DRAW 30, 0, 1",
    "PLOT 5, 5: PLOT INVERSE 1; 5, 5: PLOT 6, 6: PLOT OVER 1; 6, 6: PLOT OVER 1; 7, 7", "PLOT 20, 20: DRAW OVER 1; 50, 0: DRAW OVER 1; -50, 0"
  ].map((stmt) => ({ id: `graphics: ${stmt}`, decl: [CHECKSUM, stmt], expr: "ck@()" }));
  const POINTS = [5, 21, 100, 175, 189].map((y) => ({ id: `graphics: PLOT 5, ${y}: POINT`, decl: ["#include <point.bas>", `PLOT 5, ${y}`], expr: `POINT(5, ${y}); POINT(5, ${y} - 16); POINT(5, ${y} + 16)` }));
  const USRS = ['"a"', '"A"', '"u"', '"v"', '"zz"', '""'].map((v) => ({ id: `USR ${v}`, decl: ["DIM u@ AS UInteger", `u@ = USR ${v}`], expr: 'u@; " "; PEEK 23610' }));
  const SLICES_ASSIGNED = ['s(0 TO 4) = "Howdy"', 's(6 TO) = "Earth"', 's(0) = "J"', 's(2 TO 3) = "XYZ"', 's(2 TO 6) = "a"', 's(9 TO 20) = "abc"', 's(20) = "z"', 's(TO 2) = "abc"', 's(5 TO 2) = "q"', 's(10 TO 10) = "!"'].map((stmt) => ({
    id: `slice: ${stmt}`,
    decl: ['DIM s@ AS String = "Hello World"', stmt.replace(/\bs\(/, "s@(")],
    expr: 's@; "|"; LEN(s@); "|"; PEEK 23610'
  }));
  suites.screen = {
    perProgram: 1,
    items: [...COLOURS, ...PRINTED_COLOURS, ...LAYOUT, ...GRAPHICS, ...POINTS, ...USRS, ...SLICES_ASSIGNED].map((item) => {
      const suffix = name();
      return { ...item, decl: item.decl.map((d) => d.replace(/@/g, suffix)), expr: item.expr.replace(/@/g, suffix) };
    })
  };

  // --- Built-in functions without parentheses (C4): how far each one's argument reaches
  const NOPAREN = ["SIN 0 + 1", "SQR 4 * 4", "SQR 4 ^ 2", "ABS -5", "ABS -5 + 1", "-ABS -3", "INT -2.5", "INT 2.5 * 2", "SGN -3 * 2", "SIN COS 0",
    'LEN "ab" + 1', 'CODE "a" + 1', 'VAL "2" * 3', 'VAL "2" + "3"', "STR$ 12 + \"x\"", 'LEN STR$ 123', "EXP 0 + 1", "LN 1 + 1", "ATN 0 + 1", "TAN 0 + 1",
    "PEEK 23610 + 1", "ABS 2 - 3", "SQR 16 / 4", "INT 7 / 2", "NOT 0 + 1", "SIN 0 = 0", "ABS -2 < 1", "LEN \"abc\" = 3", "CHR$ 65 + CHR$ 66", "ASN 1 + 0",
    "ASN(1) + 0", "INT(7) / 2", "SQR(2) + 0", "SQR 2 + 0", "SIN(1) + 0", "SIN 1 + 0", "ABS(3) / 2", "ABS 3 / 2", "LEN(\"abc\") / 2", "LEN \"abc\" / 2",
    "CODE(\"a\") / 2", "INT(2.5) / 2", "SGN(3) / 2", "PEEK(0) / 2", "PEEK 0 / 2", "VAL(\"7\") / 2", "EXP(1) + 0", "INT(7.5)", "INT 7.5"];
  suites.noparen = {
    perProgram: ROWS,
    items: NOPAREN.map((expr) => ({ id: expr, decl: [], expr }))
  };

  // --- Inline asm in zxbasm's dialect (C5): each item computes HL in an ASM block and stores it in a
  // --- BASIC variable; `@` becomes the item's own suffix
  const ASM = [
    ["number $hex", ["ld hl,$1234"]], ["number h suffix", ["ld hl,1234h"]], ["number 0x", ["ld hl,0x1234"]], ["number %bin", ["ld hl,%1010"]],
    ["number b suffix", ["ld hl,1010b"]], ["char literal", ["ld hl,'A'"]], ["expression precedence", ["ld hl,2+3*4"]], ["expression parens", ["ld hl,(2+3)*4"]],
    ["division", ["ld hl,100/7"]], ["shift", ["ld hl,1 << 4"]], ["and or", ["ld hl,($F0 & $3C) | 1"]], ["negative", ["ld hl,-5"]],
    ["DEFW and a label", ["ld hl,(data@)", "jr skip@", "data@: DEFW 1234", "skip@:"]], ["DW", ["ld hl,(data@)", "jr skip@", "data@: DW 4321", "skip@:"]],
    ["DEFB doubled quote", ["ld a,(str@+1)", "ld l,a", "ld h,0", "jr skip@", 'str@: DEFB "a""b"', "skip@:"]], ["DB string and number", ["ld a,(str@+2)", "ld l,a", "ld h,0", "jr skip@", 'str@: DB "ab",7', "skip@:"]],
    ["DEFS size", ["ld hl,end@-start@", "jr skip@", "start@: DEFS 5", "end@:", "skip@:"]], ["DS with fill", ["ld a,(start@+2)", "ld l,a", "ld h,0", "jr skip@", "start@: DS 3,9", "skip@:"]],
    ["several instructions on a line", ["ld hl,1 : inc hl : inc hl"]], ["label then instructions", ["jr go@", "go@: ld hl,5 : inc hl"]],
    ["EQU", ["val@ EQU 42", "ld hl,val@"]], ["EQU with colon", ["val@: EQU 40+3", "ld hl,val@"]], ["mixed case", ["Ld Hl,7 : INC hl"]],
    ["PROC LOCAL", ["PROC", "LOCAL lp", "ld b,3 : ld hl,0", "lp: inc hl : djnz lp", "ENDP"]],
    ["two PROCs with one LOCAL name", ["PROC", "LOCAL lp", "ld b,2 : ld hl,0", "lp: inc hl : djnz lp", "ENDP", "PROC", "LOCAL lp", "ld b,3", "lp: inc hl : djnz lp", "ENDP"]],
    ["a label in a PROC not LOCAL", ["jr in@", "PROC", "in@: ld hl,11", "ENDP"]],
    ["temporary labels", ["ld hl,0 : ld b,3", "1: inc hl", "djnz 1b", "jr 1f", "ld hl,99", "1:"]],
    ["dotted label", ["ld hl,1", "jr .sk@", "ld hl,2", ".sk@:", "inc hl"]],
    ["current address", ["ld hl,$-$"]], ["jr $+3", ["ld hl,5", "jr $+3", "inc hl", "inc hl"]],
    ["a global by _name", ["ld hl,(_g@)", "inc hl"]], ["comment after code", ["ld hl,8 ; a comment : ld hl,9"]],
    ["ALIGN", ["jr skip@", "ALIGN 4", "data@: DB 1", "skip@:", "ld hl,data@ & 3"]]
  ].map(([id, body]) => ({ id: `asm: ${id}`, decl: ["DIM r@ AS UInteger", "DIM g@ AS UInteger = 500", "ASM", ...body, "ld (_r@),hl", "END ASM"], expr: "r@" }));
  const FRAMES = [
    ["STDCALL byte and word parameters", "FUNCTION f@(a AS UByte, b AS UInteger) AS UInteger\nASM\nld l,(ix+5)\nld h,0\nld e,(ix+6)\nld d,(ix+7)\nadd hl,de\nEND ASM\nEND FUNCTION", "f@(3, 1000)"],
    ["STDCALL three parameters", "FUNCTION f@(a AS UInteger, b AS UInteger, c AS UByte) AS UInteger\nASM\nld l,(ix+4)\nld h,(ix+5)\nld e,(ix+6)\nld d,(ix+7)\nor a\nsbc hl,de\nld e,(ix+9)\nld d,0\nadd hl,de\nEND ASM\nEND FUNCTION", "f@(1000, 30, 4)"],
    ["FASTCALL byte", "FUNCTION FASTCALL f@(a AS UByte) AS UByte\nASM\nadd a,a\nEND ASM\nEND FUNCTION", "f@(21)"],
    ["FASTCALL word", "FUNCTION FASTCALL f@(a AS UInteger) AS UInteger\nASM\nadd hl,hl\nEND ASM\nEND FUNCTION", "f@(1234)"],
    ["FASTCALL Long", "FUNCTION FASTCALL f@(a AS ULong) AS ULong\nASM\ninc hl\nEND ASM\nEND FUNCTION", "f@(70000)"],
    ["a local through IX", "FUNCTION f@(a AS UByte) AS UByte\nDIM t AS UByte = 9\nASM\nld a,(ix-1)\nadd a,(ix+5)\nEND ASM\nEND FUNCTION", "f@(5)"],
    ["a byte local at IX-2", "FUNCTION f@(a AS UByte) AS UByte\nDIM t AS UByte = 9\nASM\nld a,(ix-2)\nEND ASM\nEND FUNCTION", "f@(5)"],
    ["a byte local at IX-3", "FUNCTION f@(a AS UByte) AS UByte\nDIM t AS UByte = 9\nASM\nld a,(ix-3)\nEND ASM\nEND FUNCTION", "f@(5)"],
    ["a word local at IX-2", "FUNCTION f@() AS UInteger\nDIM t AS UInteger = 1234\nASM\nld l,(ix-2)\nld h,(ix-1)\nEND ASM\nEND FUNCTION", "f@()"],
    ["a word local at IX-4", "FUNCTION f@() AS UInteger\nDIM t AS UInteger = 1234\nASM\nld l,(ix-4)\nld h,(ix-3)\nEND ASM\nEND FUNCTION", "f@()"],
    ["two byte locals", "FUNCTION f@() AS UInteger\nDIM t AS UByte = 7\nDIM u AS UByte = 3\nASM\nld l,(ix-1)\nld h,(ix-2)\nEND ASM\nEND FUNCTION", "f@()"],
    ["FUNCTION Float result", "FUNCTION f@() AS Float\nASM\nld a,$82\nld e,$20\nld d,0\nld c,0\nld b,0\nEND ASM\nEND FUNCTION", "f@()"],
    ["FASTCALL byte in A, two statements", "FUNCTION FASTCALL f@(a AS UByte) AS UByte\nASM\nld b,a\nEND ASM\nASM\nld a,b\ninc a\nEND ASM\nEND FUNCTION", "f@(8)"],
    ["FASTCALL popping a byte parameter", "FUNCTION FASTCALL f@(a AS UByte, b AS UByte) AS UByte\nASM\npop hl\nld e,a\npop af\nadd a,e\npush hl\nEND ASM\nEND FUNCTION", "f@(30, 12)"],
    ["FASTCALL popping a word parameter", "FUNCTION FASTCALL f@(a AS UInteger, b AS UInteger) AS UInteger\nASM\npop bc\npop de\nadd hl,de\npush bc\nEND ASM\nEND FUNCTION", "f@(1000, 234)"],
    ["FASTCALL ret inside the asm", "FUNCTION FASTCALL f@(a AS UByte) AS UByte\nASM\nor a\njr z,zero@\nld a,5\nret\nzero@:\nld a,7\nEND ASM\nEND FUNCTION", "f@(0) * 10 + f@(1)"],
    ["FASTCALL SUB with a parameter popped", "DIM r3@ AS UInteger\nSUB FASTCALL s@(a AS UByte, b AS UInteger)\nASM\npop hl\npop de\nld (_r3@),de\npush hl\nEND ASM\nEND SUB\nFUNCTION t@() AS UInteger\ns@(1, 4321)\nRETURN r3@\nEND FUNCTION", "t@()"],
    ["a result by RETURN after asm", "FUNCTION f@(a AS UByte) AS UByte\nASM\nld a,77\nEND ASM\nRETURN a + 1\nEND FUNCTION", "f@(4)"]
  ].map(([id, fn, call]) => ({ id: `asm frame: ${id}`, decl: fn.split("\n"), expr: call }));
  suites.asm = {
    perProgram: 1,
    items: [...ASM, ...FRAMES].map((item) => {
      const suffix = name();
      return { ...item, decl: item.decl.map((d) => d.replace(/@/g, suffix)), expr: item.expr.replace(/@/g, suffix) };
    })
  };

  // --- The standard library (C6): each documented library a program an item. `ck~` checksums
  // --- memory (24 bits), `occ~` shows which character cells of a row hold any pixel - the layout of
  // --- print42/print64 text without depending on the font.
  const LIB_CHECKSUM = [
    "FUNCTION ck~(a AS UInteger, n AS UInteger) AS ULong",
    "DIM s AS ULong = 0",
    "DIM i AS UInteger",
    "FOR i = 0 TO n - 1",
    "s = (s * 3 + PEEK(a + i)) BAND 16777215",
    "NEXT i",
    "RETURN s",
    "END FUNCTION"
  ];
  const OCCUPANCY = [
    "FUNCTION occ~(r AS UByte) AS String",
    "DIM t AS String = \"\"",
    "DIM c AS UByte",
    "DIM l AS UByte",
    "DIM nib AS UByte = 0",
    "FOR c = 0 TO 31",
    "nib = nib SHL 1",
    "FOR l = 0 TO 7",
    "IF PEEK(16384 + (r >> 3) * 2048 + (r BAND 7) * 32 + l * 256 + c) <> 0 THEN nib = nib BOR 1: l = 7",
    "NEXT l",
    "IF (c BAND 3) = 3 THEN",
    "IF nib < 10 THEN t = t + CHR(48 + nib) ELSE t = t + CHR(55 + nib)",
    "nib = 0",
    "END IF",
    "NEXT c",
    "RETURN t",
    "END FUNCTION"
  ];
  const bytes = (arr) => arr.join(",");
  const TEXT = [..."Klive BASIC packs: abcabcabcabc, the rain in Spain stays mainly in the plain; 0000000000 plain plain!"].map((c) => c.charCodeAt(0));
  const packers = require("./kbasic-packers.cjs");
  const packed = (label, data) => [`DIM ${label}(0 TO ${data.length - 1}) AS UByte => {${bytes(data)}}`];
  const out = (n) => [`DIM o~(0 TO ${n - 1}) AS UByte`];
  // --- 1500 bytes whose repeats lie 200-1100 bytes back: far offsets in both formats
  const FAR = (() => {
    let seed = 12345;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16;
    const data = Array.from({ length: 300 }, () => rnd() & 255);
    for (let k = 0; data.length < 1500; k++) {
      data.push(rnd() & 255, rnd() & 255);
      const from = data.length - Math.min(data.length, 200 + ((k * 137) % 900));
      for (let n = 0; n < 5 + ((k * 7) % 30); n++) data.push(data[from + n]);
    }
    return data;
  })();
  const TILE = Array.from({ length: 36 }, (_, i) => (i < 32 ? (i * 37 + 11) & 255 : [0x47, 0x16, 0x39, 0x0a][i - 32]));
  const CHARS = Array.from({ length: 32 }, (_, i) => (i * 29 + 5) & 255);
  const LIBRARY = [
    // --- asc.bas
    ...[0, 1, 4, 5, 9].map((n) => [`asc("Hello", ${n})`, ["#include <asc.bas>"], `asc("Hello", ${n})`]),
    // --- hex.bas
    ...["hex(0)", "hex(305419896)", "hex(4294967295)", "hex16(4660)", "hex16(65535)", "hex8(171)", "hex8(0)"].map((e) => [e, ["#include <hex.bas>"], e]),
    // --- string.bas
    ...['left("Hello", 0)', 'left("Hello", 2)', 'left("Hello", 9)', 'right("Hello", 2)', 'right("Hello", 9)', 'right("Hello", 5)', 'right("Hello", 6)', 'mid("Hello", 1, 3)', 'mid("Hello", 4, 5)', 'mid("Hello", 9, 2)', 'mid("Hello", 0, 0)', 'left("", 3)'].map((e) => [e, ["#include <string.bas>"], `"[" + ${e} + "]"`]),
    // --- csrlin.bas and pos.bas
    ...[["5, 7", '"ab"'], ["23, 30", '"xy"'], ["10, 0", '"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"'], ["3, 3", '"a";TAB 20']].map(([at, what]) => [
      `CSRLIN/POS after PRINT AT ${at}; ${what};`,
      ["#include <csrlin.bas>", "#include <pos.bas>", "DIM r~ AS UByte", "DIM c~ AS UByte", `PRINT AT ${at}; ${what};`, "r~ = CSRLIN()", "c~ = POS()"],
      'r~; " "; c~'
    ]),
    // --- attr.bas and screen.bas
    ...["ATTR(3, 4)", "ATTR(0, 0)", "ATTR(22, 0)", "ATTR(23, 31)"].map((e) => [e, ["#include <attr.bas>", 'PRINT AT 3, 4; INK 2; PAPER 5; BRIGHT 1; "X"'], e]),
    ...["SCREEN$(2, 3)", "SCREEN$(2, 4)", "SCREEN$(4, 4)", "SCREEN$(6, 6)", "SCREEN$(23, 0)"].map((e) => [e, ["#include <screen.bas>", 'PRINT AT 2, 3; "Q"; AT 4, 4; INVERSE 1; "Z"; AT 6, 6; CHR 144'], `"[" + ${e} + "]"`]),
    // --- putchars.bas
    ["putChars 2x2", ["#include <putchars.bas>", ...LIB_CHECKSUM, `DIM d~(0 TO 31) AS UByte => {${bytes(CHARS)}}`, "putChars(3, 4, 2, 2, @d~(0))"], "ck~(16384, 6144)"],
    ["paint 3x2", ["#include <putchars.bas>", ...LIB_CHECKSUM, "paint(30, 22, 3, 2, 71)"], "ck~(22528, 768)"],
    ["paintData 2x2", ["#include <putchars.bas>", ...LIB_CHECKSUM, "DIM d~(0 TO 3) AS UByte => {1, 2, 3, 4}", "paintData(0, 0, 2, 2, @d~(0))"], "ck~(22528, 768)"],
    // --- print42.bas and print64.bas: the cells they touch, and the pixels
    ...[["print42", "printat42", 41], ["print64", "printat64", 63]].flatMap(([p, at, last]) => [
      [`${p} layout`, [`#include <${p}.bas>`, ...OCCUPANCY, `${at}(2, 3)`, `${p}("Hello, World")`, `${p}(" more")`], "occ~(2)"],
      [`${p} pixels`, [`#include <${p}.bas>`, ...LIB_CHECKSUM, `${at}(0, 0)`, `${p}("AbC 09")`], "ck~(16384, 256 * 8)"],
      ...[
        ["past the last column", `${at}(9, ${last}): ${p}("ab")`, [9, 10]],
        ["a column past the end", `${at}(9, 60 + ${last - 41}): ${p}("ab")`, [9, 10]],
        ["a row past the end", `${at}(30, 0): ${p}("ab")`, [0, 23]],
        ["the last place", `${at}(23, ${last}): ${p}("ab")`, [23, 0]],
        ["CHR 13", `${at}(5, 0): ${p}("a" + CHR(13) + "b")`, [5, 6]],
        ["CHR 8", `${at}(12, 0): ${p}(CHR(8) + "b")`, [11, 12]],
        ["CHR 22", `${at}(12, 5): ${p}(CHR(22) + CHR(3) + CHR(7) + "b")`, [3, 12]],
        ["CHR 23 and colour codes", `${at}(12, 5): ${p}(CHR(23) + CHR(16) + CHR(2) + "b")`, [12, 13]],
        ["skipped codes", `${at}(12, 5): ${p}(CHR(1) + CHR(128) + CHR(170) + CHR(255) + "b")`, [12, 13]],
        ["UDGs and CHR 127", `${at}(12, 5): ${p}(CHR(144) + CHR(160) + CHR(127) + "b")`, [12, 13]],
        ["the cursor stays", `${at}(4, 4): ${p}("ab"): CLS: PRINT AT 20, 20; "";: ${p}("c")`, [4, 20]]
      ].map(([what, code, rows]) => [`${p} ${what}`, [`#include <${p}.bas>`, ...OCCUPANCY, "DIM k~ AS String", code, `k~ = ${rows.map((r) => `occ~(${r})`).join(' + " " + ')}`, "CLS"], "k~"])
    ]),
    // --- clearbox.bas
    ["clearBox", ["#include <clearbox.bas>", ...LIB_CHECKSUM, "DIM i~ AS UInteger", "FOR i~ = 16384 TO 22527: POKE i~, i~ BAND 255: NEXT i~", "clearBox(2, 3, 4, 5)"], "ck~(16384, 6912)"],
    // --- hmirror.bas
    ...[0, 1, 128, 3, 165, 240, 255].map((n) => [`hMirror(${n})`, ["#include <hmirror.bas>"], `hMirror(${n})`]),
    // --- puttile.bas
    ...[[0, 0], [10, 10], [30, 22]].map(([x, y]) => [`putTile(${x}, ${y})`, ["#include <puttile.bas>", ...LIB_CHECKSUM, `DIM d~(0 TO 35) AS UByte => {${bytes(TILE)}}`, `putTile(${x}, ${y}, @d~(0))`], "ck~(16384, 6912)"]),
    // --- fmath.bas: the Fixed results' bits
    ...[0, 1, 2, 3, 30, 45, 46, 89, 90, 91, 135, 180, 181, 270, 359, 360, 400, -30, 0.5, 44.75].flatMap((d) =>
      ["fSin", "fCos", "fTan"].filter((f) => f !== "fTan" || ![90, 270].includes(d)).map((f) => [`${f}(${d})`, ["#include <fmath.bas>", "DIM x~ AS Fixed", `x~ = ${f}(${d})`], 'x~; " "; PEEK(ULong, @x~)'])
    ),
    // --- megalz.bas and zx0.bas: decompressed with the result's checksum
    ["megaLZDepack far offsets", ["#include <megalz.bas>", ...LIB_CHECKSUM, ...packed("p~", packers.megaLzPack(FAR)), ...out(FAR.length), `megaLZDepack(@p~(0), @o~(0))`], `ck~(@o~(0), ${FAR.length})`],
    ["dzx0Standard far offsets", ["#include <zx0.bas>", ...LIB_CHECKSUM, ...packed("p~", packers.zx0Pack(FAR)), ...out(FAR.length), `dzx0Standard(@p~(0), @o~(0))`], `ck~(@o~(0), ${FAR.length})`],
    (() => {
      const data = packers.zx0Pack(FAR, { backwards: true });
      return ["dzx0StandardBack far offsets", ["#include <zx0.bas>", ...LIB_CHECKSUM, ...packed("p~", data), ...out(FAR.length), `dzx0StandardBack(@p~(${data.length - 1}), @o~(${FAR.length - 1}))`], `ck~(@o~(0), ${FAR.length})`];
    })(),
    ["megaLZDepack", ["#include <megalz.bas>", ...LIB_CHECKSUM, ...packed("p~", packers.megaLzPack(TEXT)), ...out(TEXT.length + 4), `megaLZDepack(@p~(0), @o~(0))`], `ck~(@o~(0), ${TEXT.length + 4})`],
    ...["dzx0Standard", "dzx0Turbo", "dzx0Mega"].flatMap((f) => [
      [`${f}`, ["#include <zx0.bas>", ...LIB_CHECKSUM, ...packed("p~", packers.zx0Pack(TEXT)), ...out(TEXT.length + 4), `${f}(@p~(0), @o~(0))`], `ck~(@o~(0), ${TEXT.length + 4})`],
      (() => {
        const data = packers.zx0Pack(TEXT, { backwards: true });
        return [`${f}Back`, ["#include <zx0.bas>", ...LIB_CHECKSUM, ...packed("p~", data), ...out(TEXT.length + 4), `${f}Back(@p~(${data.length - 1}), @o~(${TEXT.length + 1}))`], `ck~(@o~(0), ${TEXT.length + 4})`];
      })()
    ]),
    ...[["dzx0SmartRCS", false], ["dzx0AgileRCS", false], ["dzx0SmartRCSBack", true]].map(([f, back]) => {
      const screen = Array.from({ length: 6912 }, (_, i) => (i < 6144 ? ((i >> 5) * 7 + (i & 31) * 3) & (i % 13 ? 255 : 0) : 56 + (i % 5)));
      const data = packers.zx0Pack(packers.rcsEncode(screen), { backwards: back });
      return [f, ["#include <zx0.bas>", ...LIB_CHECKSUM, ...packed("p~", data), back ? `${f}(@p~(${data.length - 1}), 23295)` : `${f}(@p~(0), 16384)`], "ck~(16384, 6912)"];
    }),
    ["zx0 to memory with RCS", ["#include <zx0.bas>", ...LIB_CHECKSUM, ...packed("p~", packers.zx0Pack(TEXT)), ...out(TEXT.length + 4), `dzx0SmartRCS(@p~(0), @o~(0))`], `ck~(@o~(0), ${TEXT.length + 4})`],
    // --- memorybank.bas on the 48K machine: BANKM is ordinary RAM there
    ...[0, 3, 7].map((b) => [`SetBank(${b}) GetBank()`, ["#include <memorybank.bas>", "POKE 23388, 16", `SetBank(${b})`], 'GetBank(); " "; PEEK(23388)'])
  ];
  // --- A screen checksum is taken, then the screen cleared, so the result prints on a blank one
  const screenFirst = ([id, decl, expr]) =>
    /ck~\(16384/.test(expr) ? [id, [...decl, "DIM k~ AS ULong", `k~ = ${expr}`, "CLS"], "k~"] : [id, decl, expr];
  suites.library = {
    perProgram: 1,
    frames: 3000,
    items: LIBRARY.map(screenFirst).map(([id, decl, expr]) => {
      const suffix = name();
      return { id: `library: ${id}`, decl: decl.map((d) => d.replace(/~/g, suffix)), expr: expr.replace(/~/g, suffix) };
    })
  };

  // --- Options and pragmas (C7): each item alone in its program, with header options (`'@name value`,
  // --- zxbc flags through the corpus oracle's mapping) or `#pragma` lines. `err` items add ERR_NR,
  // --- `hold` items run with those keys held down.
  const opt = (id, header, decl, expr, extra = {}) => ({ id, header: header.map((h) => `'@${h}`), decl, expr, ...extra });
  const ARRAY = ["DIM a~(3) AS UByte", "a~(1) = 10: a~(3) = 30"];
  const ARRAY_EXPR = 'LBOUND(a~, 1); " "; UBOUND(a~, 1); " "; a~(1) + a~(3)';
  const STR = ['DIM s~ AS String = "Hello"'];
  const STR_EXPR = 's~(1); s~(2 TO 3); "/"; s~( TO 2); "/"; s~(4 TO); LEN(s~)';
  const OPTIONS = [
    // --- array base
    opt("array-base 1", ["array-base 1"], ARRAY, ARRAY_EXPR),
    opt("#pragma array_base = 1", [], ["#pragma array_base = 1", ...ARRAY], ARRAY_EXPR),
    opt("array-base 1, explicit bounds", ["array-base 1"], ["DIM a~(0 TO 2) AS UByte => {4, 5, 6}"], 'LBOUND(a~, 1); " "; a~(0)'),
    opt("#pragma array_base, then back", [], ["#pragma array_base = 1", "DIM a~(3) AS UByte", "#pragma array_base = 0", "DIM b~(3) AS UByte"], 'LBOUND(a~, 1); " "; LBOUND(b~, 1)'),
    // --- string base
    opt("string-base 1", ["string-base 1"], STR, STR_EXPR),
    opt("#pragma string_base = 1", [], ["#pragma string_base = 1", ...STR], STR_EXPR),
    opt("string-base 1 and string.bas", ["string-base 1"], ["#include <string.bas>", "#include <asc.bas>"], 'mid("Hello", 2, 3); "/"; left("Hello", 2); "/"; right("Hello", 2); "/"; asc("Hello", 1)'),
    // --- case
    opt("case-insensitive", ["case-insensitive"], ["DIM Foo~ AS UByte = 3", "foo~ = FOO~ + 1"], "fOO~"),
    opt("#pragma case_insensitive", [], ["#pragma case_insensitive = true", "DIM Foo~ AS UByte = 3", "foo~ = FOO~ + 1"], "fOO~"),
    opt("case-insensitive routines", ["case-insensitive"], ["FUNCTION Twice~(n AS UByte) AS UByte", "RETURN n * 2", "END FUNCTION"], "TWICE~(4)"),
    // --- Sinclair compatibility
    opt("sinclair-compatible", ["sinclair-compatible"], ["DIM a~(3) AS UByte", "a~(1) = 7", 'DIM s~ AS String = "Hi"', 'PRINT AT 5, 5; "Q"'], 'LBOUND(a~, 1); a~(1); s~(1); ATTR(5, 5); SCREEN$(5, 5); POINT(0, 0)'),
    opt("#pragma sinclair", [], ["#pragma sinclair = true", "DIM a~(3) AS UByte", "a~(1) = 7", 'DIM s~ AS String = "Hi"'], "LBOUND(a~, 1); a~(1); s~(1)"),
    opt("#pragma sinclair: the libraries", [], ["#pragma sinclair = true", 'PRINT AT 5, 5; "Q"'], "ATTR(5, 5); SCREEN$(5, 5); POINT(0, 0)"),
    opt("#pragma sinclair: case", [], ["#pragma sinclair = true", "DIM Foo~ AS UByte = 3"], "FOO~"),
    opt("check-bounds: a read out of range", ["check-bounds"], ["DIM a~(3) AS UByte", "DIM i~ AS UByte = 200", "DIM v~ AS UByte", "v~ = a~(i~)"], '"after"; v~', { err: true }),
    opt("check-bounds: a String array", ["check-bounds"], ["DIM a~(3) AS String", "DIM i~ AS UByte = 4", 'a~(i~) = "x"'], '"after"; a~(0)', { err: true }),
    // --- declarations and types (compile verdicts)
    opt("require-declarations: undeclared", ["require-declarations"], ["x~ = 5"], "x~"),
    opt("require-declarations: declared", ["require-declarations"], ["DIM x~ AS UByte = 5"], "x~"),
    opt("#pragma explicit: undeclared", [], ["#pragma explicit = true", "x~ = 5"], "x~"),
    opt("require-types: untyped DIM", ["require-types"], ["DIM y~ = 3"], "y~"),
    opt("require-types: typed", ["require-types"], ["DIM y~ AS Integer = 3"], "y~"),
    opt("#pragma strict: untyped DIM", [], ["#pragma strict = true", "DIM y~ = 3"], "y~"),
    opt("#pragma default_byref", [], ["#pragma default_byref = true", "SUB inc~(a AS UByte)", "a = a + 1", "END SUB", "DIM v~ AS UByte = 5", "inc~(v~)"], "v~"),
    // --- the heap
    opt("heap-size and check-memory: a String too long", ["heap-size 200", "check-memory"], ['DIM s~ AS String = ""', "DIM i~ AS UByte", 'FOR i~ = 1 TO 60: s~ = s~ + "abcd": NEXT i~'], "LEN(s~)", { err: true }),
    opt("#pragma heap_size and memory_check", [], ["#pragma heap_size = 200", "#pragma memory_check = true", 'DIM s~ AS String = ""', "DIM i~ AS UByte", 'FOR i~ = 1 TO 60: s~ = s~ + "abcd": NEXT i~'], "LEN(s~)", { err: true }),
    opt("heap-size fits", ["heap-size 400", "check-memory"], ['DIM s~ AS String = ""', "DIM i~ AS UByte", 'FOR i~ = 1 TO 20: s~ = s~ + "abcd": NEXT i~'], "LEN(s~)", { err: true }),
    ...[["heap-address 50000", ["heap-address 50000"], []], ["#pragma heap_address", [], ["#pragma heap_address = 50000"]]].map(([id, header, pragma]) =>
      opt(id, header, [...pragma, 'DIM s~ AS String = "HELLO"', 's~ = s~ + "WORLD"', "DIM i~ AS UInteger", "DIM at~ AS UInteger = 0", "FOR i~ = 50000 TO 55000", "IF PEEK(i~) = 87 AND PEEK(i~ + 1) = 79 AND at~ = 0 THEN at~ = i~", "NEXT i~"], "at~ > 0")
    ),
    // --- array bounds checks
    opt("check-bounds: out of range", ["check-bounds"], ["DIM a~(3) AS UByte", "DIM i~ AS UByte = 5", "a~(i~) = 1"], '"after"; a~(0)', { err: true }),
    opt("#pragma array_check", [], ["#pragma array_check = true", "DIM a~(3) AS UByte", "DIM i~ AS UByte = 5", "a~(i~) = 1"], '"after"; a~(0)', { err: true }),
    opt("check-bounds: in range", ["check-bounds"], ["DIM a~(3) AS UByte", "DIM i~ AS UByte = 3", "a~(i~) = 1"], '"after"; a~(0)', { err: true }),
    opt("check-bounds: a two-dimensional array", ["check-bounds"], ["DIM a~(3, 2) AS UByte", "DIM i~ AS UByte = 1", "DIM j~ AS UByte = 3", "a~(i~, j~) = 1"], '"after"; a~(0, 0)', { err: true }),
    // --- BREAK
    opt("break-key with BREAK held", ["break-key"], ["DIM i~ AS UInteger", "FOR i~ = 1 TO 3000: NEXT i~"], '"after"', { err: true, hold: ["CShift", "Space"] }),
    opt("#pragma enable_break with BREAK held", [], ["#pragma enable_break = true", "DIM i~ AS UInteger", "FOR i~ = 1 TO 3000: NEXT i~"], '"after"', { err: true, hold: ["CShift", "Space"] }),
    opt("no break-key with BREAK held", [], ["DIM i~ AS UInteger", "FOR i~ = 1 TO 3000: NEXT i~"], '"after"', { err: true, hold: ["CShift", "Space"] }),
    // --- defines, optimisation, origin
    opt("define", ["define LEVEL=3, FAST"], ["#ifdef FAST", 'DIM t~ AS String = "fast"', "#else", 'DIM t~ AS String = "slow"', "#endif"], 't~; LEVEL'),
    ...[0, 1, 2, 3].map((o) => opt(`optimize ${o}`, [`optimize ${o}`], ["DIM x~ AS Integer = -7", "DIM f~ AS Float = 2.5"], 'x~ * 3 MOD 5; " "; f~ * x~; " "; x~ SHR 3')),
    opt("#pragma optimization_level", [], ["#pragma optimization_level = 0", "DIM x~ AS Integer = -7"], "x~ * 3 MOD 5"),
    opt("origin 40000", ["origin 40000"], ["DIM x~ AS UByte = 9"], 'x~; " "; PEEK(40000) <> 0'),
    opt("check-bounds: through an array parameter", ["check-bounds"], ["SUB put~(a() AS UByte, i AS UByte)", "a(i) = 1", "END SUB", "DIM a~(3) AS UByte", "put~(a~, 7)"], '"after"; a~(0)', { err: true }),
    opt("check-bounds: an array parameter in range", ["check-bounds"], ["SUB put~(a() AS UByte, i AS UByte)", "a(i) = 1", "END SUB", "DIM a~(3) AS UByte", "put~(a~, 3)"], '"after"; a~(3)', { err: true }),
    opt("zxnext with nextreg", ["zxnext"], ["ASM", "nextreg $15, 1", "END ASM"], "1"),
    opt("headerless", ["headerless"], ["DIM x~ AS UByte = 9"], "x~"),
    // --- ZX Next opcodes in inline asm (compile verdicts)
    opt("nextreg in asm", [], ["ASM", "nextreg $15, 1", "END ASM"], "1"),
    opt("#pragma zxnext with nextreg", [], ["#pragma zxnext = true", "ASM", "nextreg $15, 1", "END ASM"], "1")
  ];
  suites.options = {
    perProgram: 1,
    frames: 600,
    items: OPTIONS.map((item) => {
      const suffix = name();
      return { ...item, id: `options: ${item.id}`, decl: item.decl.map((d) => d.replace(/~/g, suffix)), expr: item.expr.replace(/~/g, suffix) };
    })
  };

  // --- Acceptance (C4): whole programs that are only compiled - the spec's accepting and rejecting
  // --- cases for every EBNF form (test/kbasic/syntax/spec-cases.ts), and known edges
  const specCases = loadSpecCases();
  const EDGES = [
    "#if A = 1\nPRINT 1\n#endif", "#define A 1\n#if A == 1\nPRINT 1\n#endif", "#define A 2\n#if A == 1\nPRINT 1\n#elif A == 2\nPRINT 2\n#endif",
    "#define A 2\n#if A == 1\nPRINT 1\n#else\nPRINT 2\n#endif", "#ifdef A\nPRINT 1\n#endif",
    "DIM x AS Float = 2\nPRINT x ^ -1", "PRINT 2 ^ -1", "DIM x AS Float = 2\nPRINT x ^ (-1)", "DIM x AS Float = 2\nPRINT -x ^ 2", "PRINT 2 * -1", "PRINT 2 - -1",
    "DIM x AS UByte\nREAD x", "DIM x AS UByte\nREAD x\nDATA 1", "RESTORE", "DATA 1\nRESTORE",
    "BEEP 100, 0", "BEEP 1, 100", "BEEP -1, 0", "BEEP 10, 69", "BEEP 0, -60", "BEEP 1, -61", "DIM d AS Float = 100\nBEEP d, 0",
    "PRINT 1 / 0", "PRINT 1 MOD 0", "PRINT 1.5 / 0", 'PRINT "a" = "a"', "DIM s AS UByte = 1\nFOR i = 1 TO 5 STEP s: NEXT i",
    "FUNCTION f() AS UByte: RETURN 1: END FUNCTION\nPRINT f()", "SUB s: END SUB\ns()",
    "GOTO 10", "10 PRINT 1\n10 PRINT 2", "GOSUB 20\nEND\n20 RETURN",
    "PRINT AT 30, 0; 1", "PRINT AT 0, 40; 1", "PLOT 300, 0", "PLOT 0, 200", "INK 12", "PAPER 9", "BORDER 9", "FLASH 2", "OVER 3", "INVERSE 2",
    "PAUSE -1", "POKE 70000, 1", "PRINT CHR$(300)", "DIM a(0)", "DIM a(-1)", "DIM a(3) AS UByte\nPRINT a(5)", "DIM a(3) AS UByte\na(4) = 1",
    'x = 5: x$ = "a"', "DIM a AS UByte\nDIM a AS UByte", "DIM a AS UByte\nDIM a AS Integer",
    'PRINT CODE ""', "PRINT LEN 5", "PRINT VAL 5", 'PRINT STR$ "a"', "PRINT 1,,2", "PRINT ;;", "PRINT 1'2",
    "IF 1 THEN PRINT 1 ELSE PRINT 2", "IF 1 THEN\nEND IF", "ON 1 GOTO 10, 20\n10 PRINT\n20 PRINT", "RETURN",
    "EXIT FOR", "NEXT", "NEXT i", "CONST c = 1\nc = 2", 'DIM s AS String = 5', 'PRINT "a" + 1', 'DIM s AS String\ns = 5',
    "FUNCTION f(a)\n RETURN a\nEND FUNCTION\nPRINT f(1)", "PRINT SIN", "PRINT PEEK", "x = 1 +", "PRINT (1", "PRINT 1)",
    "DIM a AS UByte = 256", "DIM a AS Byte = 200", "DIM a AS UInteger = -1", "DIM a AS Fixed = 40000", "DIM a AS Float = 1E40",
    "PRINT 1E40", "PRINT 1E39 * 10", "DIM a(3) AS UByte => {1, 2, 3}", "DIM a(3) AS UByte => {1, 2, 3, 4, 5}",
    "SUB s(a AS UByte = 1, b AS UByte)\nEND SUB", "FUNCTION f AS UByte\nEND FUNCTION\nPRINT f", "s()", "PRINT f(1)",
    "DIM a AS UByte\na(1) = 2", "DIM a(3) AS UByte\na = 2", "LET a = 1: LET a = a + 1: PRINT a", "PRINT PI = 3",
    "PRINT RND * 10", "RANDOMIZE", "RANDOMIZE 1", "PRINT INKEY$", "PRINT USR 0", "PRINT IN 254", "OUT 254, 1",
    "DIM i AS UByte\nFOR i = 1 TO 10 STEP 0: NEXT i", "FOR i = 10 TO 1: NEXT i", "DO\nLOOP UNTIL 1: LOOP", "WHILE 1: WEND",
    "ASM\n ld a,1\nEND ASM", "ASM\n ld a,(ix+1)\n call $0d6b\nEND ASM", "PRINT @x", "DIM x AS UByte\nPRINT @x",
    "STOP 3", "END 5", "ERROR 30", "ERROR 256",
    "IF a THEN\nELSEIF b THEN PRINT 1\nELSE PRINT 2\nEND IF", "IF a THEN\nELSEIF b THEN\nPRINT 1\nELSE\nPRINT 2\nEND IF",
    "IF a THEN\nELSEIF b PRINT 1\nEND IF", "IF a THEN\nELSEIF b THEN\nPRINT 1\nEND IF", "IF a THEN\nELSE PRINT 2\nEND IF", "IF a THEN PRINT 1: ELSE PRINT 2",
    "", "REM x", "' comment", "#ifdef A\nPRINT 1\n#endif\nPRINT 2", "#define A\n#ifdef A\nPRINT 1\n#endif",
    "x = ABS -1", "x = SIN COS 0", "x = PEEK 23610 + 1", "x$ = CHR$ 65", "x = CODE a$", "x = USR 0 + 1", "x = LEN \"ab\" + 1", "x = INT (1.5) + 1"
  ];
  const acceptance = [
    ...Object.values(specCases).flatMap((c) => [...c.accept, ...c.reject]),
    ...EDGES
  ];
  suites.acceptance = {
    kind: "accept",
    perProgram: 1,
    items: [...new Set(acceptance)].map((source) => ({ id: source, decl: [], expr: "", source }))
  };

  for (const [suite, data] of Object.entries(suites)) {
    const ids = new Set();
    for (const item of data.items) {
      if (ids.has(item.id)) throw new Error(`${suite}: the id "${item.id}" repeats`);
      ids.add(item.id);
    }
  }
  return suites;
}

// ------------------------------------------------------------------------------------------------
// Commands

function fail(message) {
  console.error(`kbasic-compat: ${message}`);
  process.exit(1);
}

/** test/kbasic/syntax/spec-cases.ts's CASES, through the TypeScript compiler's transpiler. */
function loadSpecCases() {
  const ts = require("typescript");
  const source = fs.readFileSync(path.join(ROOT, "test/kbasic/syntax/spec-cases.ts"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", js)(mod, mod.exports, require);
  return mod.exports.CASES;
}

function writeSuites() {
  fs.mkdirSync(SUITES, { recursive: true });
  const suites = generate();
  for (const [suite, data] of Object.entries(suites)) {
    fs.writeFileSync(path.join(SUITES, `${suite}.json`), JSON.stringify({ suite, ...data }, null, 1) + "\n");
    console.log(`${suite}: ${data.items.length} items`);
  }
}

function readSuite(suite) {
  const file = path.join(SUITES, `${suite}.json`);
  if (!fs.existsSync(file)) fail(`no suite ${suite} (run: node scripts/kbasic-compat.cjs gen)`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runOracle(names) {
  if (process.env.CI) fail("refusing to run with CI set: the oracle never runs in CI (plan D12)");
  const { compileWithZxbc, failureKind, headerOptions, zxbcArguments } = require("./kbasic-oracle.cjs");
  const zxbc = process.env.KBASIC_ORACLE_ZXBC || path.join(os.homedir(), "zxbasic/.venv/bin/zxbc");
  if (!fs.existsSync(zxbc)) fail(`no zxbc at ${zxbc}`);
  const version = spawnSync(zxbc, ["--version"], { encoding: "utf8" });
  const zxbcVersion = (version.stdout || version.stderr).trim();
  const suites = names.length ? names : fs.readdirSync(SUITES).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "kbasic-compat-"));
  try {
    const manifest = { zxbc: zxbcVersion, suites: {} };
    let count = 0;
    for (const suite of suites) {
      const data = readSuite(suite);
      const entry = { programs: [], rejected: {} };
      // --- Compile a group; a rejected group splits in halves until the rejected items stand alone
      const compile = (items) => {
        const base = path.join(work, `${suite}-${count++}`);
        const source = buildProgram(items);
        fs.writeFileSync(`${base}.bas`, source);
        // --- The header's options as zxbc flags (the corpus oracle's mapping)
        const mapped = zxbcArguments(headerOptions(source));
        if (mapped.skip) {
          for (const i of items) entry.rejected[i.id] = `not run: ${mapped.skip}`;
          return;
        }
        const r = compileWithZxbc(zxbc, work, base, mapped.args);
        if (!r.error)
          return entry.programs.push({
            bin: `${base}.bin`,
            org: mapped.org,
            ids: items.map((i) => i.id),
            rows: items.map((i) => i.rows ?? 0),
            errs: items.map((i) => !!i.err),
            hold: items.flatMap((i) => i.hold ?? []),
            frames: data.frames ?? 300
          });
        if (items.length === 1) return (entry.rejected[items[0].id] = failureKind(r.error));
        const half = Math.ceil(items.length / 2);
        compile(items.slice(0, half));
        compile(items.slice(half));
      };
      if (data.kind === "accept") {
        // --- Only compiled: accepted, or zxbc's message
        for (const item of data.items) {
          const base = path.join(work, `${suite}-${count++}`);
          fs.writeFileSync(`${base}.bas`, item.source + "\n");
          const r = compileWithZxbc(zxbc, work, base, ["--org", String(ORG)]);
          if (r.error) entry.rejected[item.id] = failureKind(r.error);
          else (entry.accepted ??= []).push(item.id);
        }
        manifest.suites[suite] = entry;
        console.log(`${suite}: ${(entry.accepted ?? []).length} accepted, ${Object.keys(entry.rejected).length} rejected`);
        continue;
      }
      for (const group of chunk(data.items, data.perProgram)) compile(group);
      manifest.suites[suite] = entry;
      console.log(`${suite}: ${entry.programs.length} programs, ${Object.keys(entry.rejected).length} items rejected`);
    }
    const file = path.join(work, "manifest.json");
    fs.writeFileSync(file, JSON.stringify(manifest));
    const test = spawnSync("npx", ["vitest", "run", "--config", "build/vitest.config.ts", "--project", "node", RUNNER], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, KBASIC_COMPAT_MANIFEST: file },
      shell: process.platform === "win32"
    });
    if (test.status !== 0) fail("the compat oracle runner failed");
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "gen") return writeSuites();
  if (command === "oracle") return runOracle(rest);
  fail("usage: kbasic-compat.cjs gen | oracle [suite ...]");
}

if (require.main === module) main();

module.exports = { buildProgram, chunk, generate, itemResult, ROWS };
