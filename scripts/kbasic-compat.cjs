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

/** The source of a program printing `items`, one a row from row 0. */
function buildProgram(items) {
  const lines = ["' Klive BASIC compatibility suite (scripts/kbasic-compat.cjs)"];
  for (const item of items) lines.push(...item.decl);
  items.forEach((item, row) => lines.push(`PRINT AT ${row}, 0; ${item.expr}`));
  return lines.join("\n") + "\n";
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
  const { compileWithZxbc, failureKind } = require("./kbasic-oracle.cjs");
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
        fs.writeFileSync(`${base}.bas`, buildProgram(items));
        const r = compileWithZxbc(zxbc, work, base, ["--org", String(ORG)]);
        if (!r.error) return entry.programs.push({ bin: `${base}.bin`, org: ORG, ids: items.map((i) => i.id) });
        if (items.length === 1) return (entry.rejected[items[0].id] = failureKind(r.error));
        const half = Math.ceil(items.length / 2);
        compile(items.slice(0, half));
        compile(items.slice(half));
      };
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

module.exports = { buildProgram, chunk, generate, ROWS };
