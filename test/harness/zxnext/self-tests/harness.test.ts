import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { loadCase, type LoadedCase } from "../cases/case";
import { approveCase } from "../cases/golden";
import { runCase, type CaseResult } from "../cases/run-case";
import { next8ToHex, parseColor, rgb333ToHex } from "../core/colors";

/** The visual cases (test/visual/<suite>/<case>/). */
const VISUAL_CASES = resolve(__dirname, "../../../visual");

/*
 * Mutation tests for the harness itself: each oracle is shown to *fail* on a planted defect, so a
 * green visual run means something. T00 is the subject; captures are cut to a few frames to keep
 * the runs short.
 */

const T00_DIR = resolve(VISUAL_CASES, "copper/T00-static-ula");
const outRoot = () => mkdtempSync(join(tmpdir(), "klive-visual-"));

function t00(mutate?: (c: LoadedCase) => void): LoadedCase {
  const c = loadCase(T00_DIR);
  c.spec.capture = [20, 30];
  c.golden = undefined;
  mutate?.(c);
  return c;
}

const check = (r: CaseResult, oracle: string, name?: string) =>
  r.checks.filter((c) => c.oracle === oracle && (!name || c.name === name));

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
  it("T00 passes every oracle", async () => {
    const r = await runCase(t00(), { outRoot: outRoot() });
    expect(r.checks.filter((c) => c.status !== "pass")).toEqual([]);
    expect(r.status).toBe("pass");
    expect(existsSync(join(r.outDir, "wasm/frame-00020.png"))).toBe(true);
    expect(readFileSync(join(r.outDir, "review.md"), "utf8")).toContain("Describe first");
  });

  it("probes: a wrong expected colour fails the named probe", async () => {
    const r = await runCase(
      t00((c) => ((c.spec.probes![2] as { bands: Array<{ rgb: string }> }).bands[1].rgb = "ula:5")),
      { outRoot: outRoot() }
    );
    const [probe] = check(r, "probes", "side borders");
    expect(probe.status).toBe("fail");
    expect(probe.detail).toMatch(/expected #00B6B6.*first \(96,48\) is #B6B600/);
    expect(r.status).toBe("fail");
  });

  it("probes: one poked pixel is found", async () => {
    const r = await runCase(t00(), {
      outRoot: outRoot(),
      tamper: (_f, frame) => {
        const i = (100 * frame.width + 300) * 4;
        frame.rgba[i] = 0; frame.rgba[i + 1] = 0; frame.rgba[i + 2] = 0;
      }
    });
    expect(check(r, "probes", "only two colours")[0].status).toBe("fail");
    expect(r.status).toBe("fail");
  });

  it("identical: a frame that changes over time fails the static-screen check", async () => {
    const r = await runCase(t00(), {
      outRoot: outRoot(),
      tamper: (f, frame) => { if (f === 30) frame.rgba[0] ^= 0xff; }
    });
    expect(check(r, "identical")[0]).toMatchObject({ status: "fail" });
  });

  it("known failures: XFAIL does not fail the run, XPASS does", async () => {
    const xfail = await runCase(
      t00((c) => {
        (c.spec.probes![0] as { rgb: string }).rgb = "ula:1";
        c.spec.knownFailures = [{ oracle: "probes", name: "top border", reason: "planted" }];
      }),
      { outRoot: outRoot() }
    );
    expect(check(xfail, "probes", "top border")[0].status).toBe("xfail");
    expect(xfail.status).toBe("pass");

    const xpass = await runCase(
      t00((c) => (c.spec.knownFailures = [{ oracle: "probes", name: "top border", reason: "stale" }])),
      { outRoot: outRoot() }
    );
    expect(check(xpass, "probes", "top border")[0].status).toBe("xpass");
    expect(xpass.status).toBe("fail");
  });

  it("ready: a program that never signals ready fails", async () => {
    const r = await runCase(
      t00((c) => {
        c.programPath = resolve(__dirname, "fixtures/no-ready.asm");
        c.spec.probes = [];
        c.spec.expectIdenticalFrames = false;
      }),
      { outRoot: outRoot() }
    );
    expect(check(r, "ready")[0]).toMatchObject({ status: "fail" });
    expect(check(r, "ready")[0].detail).toContain("never wrote $A5");
  });

  it("golden: a changed hash fails; approval needs a pass verdict and no known failure", async () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-visual-case-"));
    cpSync(T00_DIR, dir, { recursive: true });
    rmSync(join(dir, "golden.json"), { force: true }); // start unapproved
    const load = () => {
      const c = loadCase(dir);
      c.spec.capture = [20];
      return c;
    };
    const runRoot = outRoot();
    const first = await runCase(load(), { outRoot: runRoot });
    expect(first.golden.state).toBe("none");

    expect(approveCase(load(), runRoot)).toMatchObject({ ok: false, message: expect.stringContaining("no verdict.json") });
    const verdict = (v: string) =>
      writeFileSync(join(first.outDir, "verdict.json"), JSON.stringify({ verdict: v, reviewer: "test", observations: [], discrepancies: [], reviewedImages: [], reviewedAt: "" }));
    verdict("fail");
    expect(approveCase(load(), runRoot).ok).toBe(false);
    verdict("pass");
    expect(approveCase(load(), runRoot)).toMatchObject({ ok: true });

    const golden = JSON.parse(readFileSync(join(dir, "golden.json"), "utf8"));
    expect(Object.keys(golden).sort()).toEqual(["wasm"]);

    const same = await runCase(load(), { outRoot: outRoot() });
    expect(same.golden.state).toBe("match");
    const changed = await runCase(load(), {
      outRoot: outRoot(),
      tamper: (_f, frame) => { frame.rgba[4] ^= 1; }
    });
    expect(changed.golden.state).toBe("changed");
    expect(changed.status).toBe("fail");
  });

  it("golden: a run with a known failure is not approved, even with a pass verdict", async () => {
    const dir = mkdtempSync(join(tmpdir(), "klive-visual-case-"));
    cpSync(T00_DIR, dir, { recursive: true });
    rmSync(join(dir, "golden.json"), { force: true });
    const load = () => {
      const c = loadCase(dir);
      c.spec.capture = [20];
      (c.spec.probes![0] as { rgb: string }).rgb = "ula:1";
      c.spec.knownFailures = [{ oracle: "probes", name: "top border", reason: "planted" }];
      return c;
    };
    const runRoot = outRoot();
    const r = await runCase(load(), { outRoot: runRoot });
    expect(check(r, "probes", "top border")[0].status).toBe("xfail");
    writeFileSync(join(r.outDir, "verdict.json"), JSON.stringify({ verdict: "pass", reviewer: "test", observations: [], discrepancies: [], reviewedImages: [], reviewedAt: "" }));
    expect(approveCase(load(), runRoot)).toMatchObject({ ok: false, message: expect.stringContaining("known failure") });
    expect(existsSync(join(dir, "golden.json"))).toBe(false);
  });
});

describe("visual harness - browser tier canvas oracle", () => {
  it("passes a scaled copy of the frame and fails a different picture", async () => {
    const { compareCanvas } = await import("../cases/browser-tier");
    const sharp = (await import("sharp")).default;
    const r = await runCase(t00((c) => (c.spec.capture = [20])), { outRoot: outRoot() });
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

describe("WASM raster and active-video-line readback (regression)", () => {
  /*
   * The WASM core used to draw each frame once from end-of-frame state, so copper effects were
   * invisible in the production core. C02 (eight palette bands) and C09 (per-line scroll) must show.
   */
  // --- D02 also syncs once per frame on NextReg $1F, which the WASM core used to read as 0.
  // --- C03 checks WAIT's horizontal position: the copper beam is hc_ula (paper x = 8H), 4 ticks per HC.
  // --- C04: palette writes to entry 16 must recolour the border, mid-frame.
  // --- P01/P02: the WASM layer mixer ($15 orders, Layer 2 priority, blend modes, tilemap merge, stencil).
  // --- L01: Layer 2 is transparent where its palette-mapped RGB equals $14; $4B does not apply.
  // --- D04: a $22/$23 line interrupt raises INT at hc_ula 255 of line L-1 while the ULA interrupt is off.
  // --- C11: $68 bit 7 makes the whole ULA layer transparent per pixel, and clearing it restores the ULA.
  for (const id of ["C02-palette-bands", "C03-wait-hpos-staircase", "C04-border-palette", "C07-line-offset", "C09-scroll-per-line", "C10-transparency-per-line", "C11-ula-disable-per-line", "D02-colour-cycle", "D04-line-interrupt", "L01-layer2-transparency", "P01-layer-priorities", "P02-tilemap-merge"]) {
    it(`${id}: WASM passes every probe`, async () => {
      const c = loadCase(resolve(VISUAL_CASES, "copper", id));
      // --- After the case's ready deadline: a slow setup (L01 fills Layer 2) is not on screen before it.
      c.spec.capture = [Math.max(20, (c.spec.readyBy ?? 10) + 10)];
      c.golden = undefined;
      const r = await runCase(c, { outRoot: outRoot() });
      expect(r.checks.filter((x) => x.status === "fail" || x.status === "xpass")).toEqual([]);
    });
  }
});
