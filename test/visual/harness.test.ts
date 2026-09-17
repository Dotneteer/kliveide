import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { loadCase, type LoadedCase } from "../../scripts/visual-tests/lib/case";
import { approveCase } from "../../scripts/visual-tests/lib/golden";
import { runCase, type CaseResult } from "../../scripts/visual-tests/lib/run-case";
import { next8ToHex, parseColor, rgb333ToHex } from "../../scripts/visual-tests/lib/colors";

/*
 * Mutation tests for the harness itself: each oracle is shown to *fail* on a planted defect, so a
 * green visual run means something. T00 is the subject; captures are cut to a few frames to keep
 * the TypeScript core fast.
 */

const T00_DIR = resolve(__dirname, "copper/T00-static-ula");
const outRoot = () => mkdtempSync(join(tmpdir(), "klive-visual-"));

function t00(mutate?: (c: LoadedCase) => void): LoadedCase {
  const c = loadCase(T00_DIR);
  c.spec.capture = [20, 30];
  c.golden = undefined;
  mutate?.(c);
  return c;
}

const check = (r: CaseResult, oracle: string, core?: string, name?: string) =>
  r.checks.filter((c) => c.oracle === oracle && (!core || c.core === core) && (!name || c.name === name));

describe("visual harness - colours", () => {
  it("expands Next colour notations", () => {
    expect(rgb333ToHex(5, 0, 0)).toBe("#B60000");
    expect(parseColor("ula:6")).toBe("#B6B600");
    expect(next8ToHex(0xe3)).toBe("#FF00FF"); // the Next's default transparency colour
    expect(next8ToHex(0x02)).toBe("#0000B6"); // BB=10 -> 9-bit blue 101 (low bit = B1|B0)
    expect(next8ToHex(0x01)).toBe("#00006D"); // BB=01 -> 011
  });
});

describe("visual harness - oracles fail on planted defects", () => {
  it("T00 passes every oracle on both cores", async () => {
    const r = await runCase(t00(), { cores: ["ts", "wasm"], outRoot: outRoot() });
    expect(r.checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(r.status).toBe("pass");
    expect(existsSync(join(r.outDir, "wasm/frame-00020.png"))).toBe(true);
    expect(readFileSync(join(r.outDir, "review.md"), "utf8")).toContain("Describe first");
  });

  it("probes: a wrong expected colour fails the named probe", async () => {
    const r = await runCase(
      t00((c) => ((c.spec.probes![2] as { bands: Array<{ rgb: string }> }).bands[1].rgb = "ula:5")),
      { cores: ["wasm"], outRoot: outRoot() }
    );
    const [probe] = check(r, "probes", "wasm", "side borders");
    expect(probe.status).toBe("fail");
    expect(probe.detail).toMatch(/expected #00B6B6.*first \(96,48\) is #B6B600/);
    expect(r.status).toBe("fail");
  });

  it("parity + probes: one poked pixel is found and drawn in the diff image", async () => {
    const r = await runCase(t00(), {
      cores: ["ts", "wasm"],
      outRoot: outRoot(),
      tamper: (core, _f, frame) => {
        if (core !== "wasm") return;
        const i = (100 * frame.width + 300) * 4;
        frame.rgba[i] = 0; frame.rgba[i + 1] = 0; frame.rgba[i + 2] = 0;
      }
    });
    const [parity] = check(r, "parity");
    expect(parity.status).toBe("fail");
    expect(parity.detail).toContain("first (300,100) ts #B6B600 wasm #000000");
    expect(existsSync(join(r.outDir, "diff-ts-wasm-00020.png"))).toBe(true);
    expect(check(r, "probes", "wasm", "only two colours")[0].status).toBe("fail");
    expect(check(r, "probes", "ts", "only two colours")[0].status).toBe("pass");
  });

  it("identical: a frame that changes over time fails the static-screen check", async () => {
    const r = await runCase(t00(), {
      cores: ["wasm"],
      outRoot: outRoot(),
      tamper: (_c, f, frame) => { if (f === 30) frame.rgba[0] ^= 0xff; }
    });
    expect(check(r, "identical", "wasm")[0]).toMatchObject({ status: "fail" });
  });

  it("known failures: XFAIL does not fail the run, XPASS does", async () => {
    const xfail = await runCase(
      t00((c) => {
        (c.spec.probes![0] as { rgb: string }).rgb = "ula:1";
        c.spec.knownFailures = [{ core: "wasm", oracle: "probes", name: "top border", reason: "planted" }];
      }),
      { cores: ["wasm"], outRoot: outRoot() }
    );
    expect(check(xfail, "probes", "wasm", "top border")[0].status).toBe("xfail");
    expect(xfail.status).toBe("pass");

    const xpass = await runCase(
      t00((c) => (c.spec.knownFailures = [{ core: "wasm", oracle: "probes", name: "top border", reason: "stale" }])),
      { cores: ["wasm"], outRoot: outRoot() }
    );
    expect(check(xpass, "probes", "wasm", "top border")[0].status).toBe("xpass");
    expect(xpass.status).toBe("fail");
  });

  it("ready: a program that never signals ready fails", async () => {
    const r = await runCase(
      t00((c) => {
        c.programPath = resolve(__dirname, "fixtures/no-ready.asm");
        c.spec.probes = [];
        c.spec.expectIdenticalFrames = false;
      }),
      { cores: ["wasm"], outRoot: outRoot() }
    );
    expect(check(r, "ready", "wasm")[0]).toMatchObject({ status: "fail" });
    expect(check(r, "ready", "wasm")[0].detail).toContain("never wrote $A5");
  });

  it("golden: a changed hash fails; approval needs a pass verdict and skips XFAIL cores", async () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-visual-case-"));
    cpSync(T00_DIR, dir, { recursive: true });
    rmSync(join(dir, "golden.json"), { force: true }); // start unapproved
    const load = () => {
      const c = loadCase(dir);
      c.spec.capture = [20];
      return c;
    };
    const runRoot = outRoot();
    const first = await runCase(load(), { cores: ["ts", "wasm"], outRoot: runRoot });
    expect(first.golden.state).toBe("none");

    expect(approveCase(load(), runRoot)).toMatchObject({ ok: false, message: expect.stringContaining("no verdict.json") });
    const verdict = (v: string) =>
      writeFileSync(join(first.outDir, "verdict.json"), JSON.stringify({ verdict: v, reviewer: "test", observations: [], discrepancies: [], reviewedImages: [], reviewedAt: "" }));
    verdict("fail");
    expect(approveCase(load(), runRoot).ok).toBe(false);
    verdict("pass");
    expect(approveCase(load(), runRoot)).toMatchObject({ ok: true });

    const golden = JSON.parse(readFileSync(join(dir, "golden.json"), "utf8"));
    expect(Object.keys(golden).sort()).toEqual(["ts", "wasm"]);

    const same = await runCase(load(), { cores: ["wasm"], outRoot: outRoot() });
    expect(same.golden.state).toBe("match");
    const changed = await runCase(load(), {
      cores: ["wasm"],
      outRoot: outRoot(),
      tamper: (_c, _f, frame) => { frame.rgba[4] ^= 1; }
    });
    expect(changed.golden.state).toBe("changed");
    expect(changed.status).toBe("fail");
  });
});

describe("visual harness - browser tier canvas oracle", () => {
  it("passes a scaled copy of the frame and fails a different picture", async () => {
    const { compareCanvas } = await import("../../scripts/visual-tests/lib/browser-tier");
    const sharp = (await import("sharp")).default;
    const r = await runCase(t00((c) => (c.spec.capture = [20])), { cores: ["wasm"], outRoot: outRoot() });
    const png = readFileSync(join(r.outDir, "wasm/frame-00020.png"));
    const raw = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const frame = { width: raw.info.width, height: raw.info.height, rgba: new Uint8Array(raw.data) };
    // --- What the page paints: 720x288 stretched to 720x576
    const canvas = await sharp(png).resize(720, 576, { fit: "fill", kernel: "nearest" }).png().toBuffer();
    expect((await compareCanvas(canvas, frame)).pass).toBe(true);
    const wrong = await sharp(canvas).negate({ alpha: false }).png().toBuffer();
    expect((await compareCanvas(wrong, frame)).pass).toBe(false);
  });
});

describe("visual harness - per-core review verdicts", () => {
  it("approves the core the reviewer passed and not the one it failed", async () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-visual-case-"));
    cpSync(T00_DIR, dir, { recursive: true });
    rmSync(join(dir, "golden.json"), { force: true }); // start unapproved
    const c = loadCase(dir);
    c.spec.capture = [20];
    const root = outRoot();
    const r = await runCase(c, { cores: ["ts", "wasm"], outRoot: root });
    writeFileSync(join(r.outDir, "verdict.json"), JSON.stringify({ verdict: "fail", cores: { ts: "pass", wasm: "fail" }, reviewer: "test", observations: [], discrepancies: [], reviewedImages: [], reviewedAt: "" }));
    expect(approveCase(loadCase(dir), root)).toMatchObject({ ok: true, message: expect.stringContaining("approved ts") });
    expect(Object.keys(JSON.parse(readFileSync(join(dir, "golden.json"), "utf8")))).toEqual(["ts"]);
  });
});

describe("WASM beam-racing raster (regression)", () => {
  /*
   * The WASM core used to draw each frame once from end-of-frame state, so copper effects were
   * invisible in the production core. C02 (eight palette bands) and C09 (per-line scroll) must show
   * in WASM exactly as in the TypeScript core.
   */
  for (const id of ["C02-palette-bands", "C07-line-offset", "C09-scroll-per-line"]) {
    it(`${id}: WASM passes every probe and matches the TypeScript core`, async () => {
      const c = loadCase(resolve(__dirname, "copper", id));
      c.spec.capture = [20];
      c.golden = undefined;
      const r = await runCase(c, { cores: ["ts", "wasm"], outRoot: outRoot() });
      expect(r.checks.filter((x) => x.status === "fail" || x.status === "xpass")).toEqual([]);
      expect(check(r, "parity")[0].status).toBe("pass");
    });
  }
});
