import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import type { ViteDevServer } from "../server/vite-types";

import { frameHash, type Frame } from "../core/capture";
import type { LoadedCase } from "./case";
import { diffPng } from "../core/images";
import { diffFrames } from "./probes";
import { writeReviewPrompt } from "./review";
import { compareGolden, evaluateFrames, framesOf, judge, renderHeadlessFrame, type CaseResult, type CheckResult } from "./run-case";
import { startVisualServer, type VisualServer } from "../server/http";

/*
 * Tier 2: the browser. The visual test server plays the main process (assembler, SD card, files);
 * the installed Chrome, driven by Playwright, runs the test page with the production WASM core. The
 * page boots NextZXOS from a clone of ~/Klive/ks2.cim, types `.nexload` exactly as `nex-run` does
 * (in frames, not milliseconds), and hands back the frames counted from the program's ready marker.
 *
 * The frames then go through the same oracles as Tier 1 (`evaluateFrames`) under the core name
 * `wasm` - the page runs the WASM core, so WASM known failures apply - plus two of its own:
 * `headless` (static screens: equal to the Tier 1 WASM frame, i.e. the direct loader hides nothing)
 * and `canvas` (what the page painted matches the pixel buffer).
 */

export type BrowserTier = {
  runCase(loaded: LoadedCase, outRoot: string, options: { long?: boolean }): Promise<CaseResult>;
  close(): Promise<void>;
};

type PageState = {
  status: string;
  error?: string;
  log: string[];
  width?: number;
  height?: number;
  readyFrame?: number;
  bootFrames?: number;
  sdPath?: string;
  mainApiCalls?: Record<string, number>;
  realCardMtimeBefore?: number;
  realCardMtimeAfter?: number;
  nextRegsAtReady?: Record<string, string>;
  frameKeys: string[];
};

export async function launchBrowserTier(vite: ViteDevServer, options: { headed?: boolean; log?: (s: string) => void } = {}): Promise<BrowserTier> {
  const log = options.log ?? (() => {});
  const server: VisualServer = await startVisualServer(vite);
  const { chromium } = await import("playwright");
  // --- The installed Chrome, not a downloaded Chromium.
  const browser = await chromium.launch({ channel: "chrome", headless: !options.headed });
  log(`  server ${server.url}, Chrome ${browser.version()}`);

  return {
    async runCase(loaded, outRoot, { long }) {
      const started = Date.now();
      const { spec } = loaded;
      const outDir = join(outRoot, spec.id);
      const dir = join(outDir, "browser");
      mkdirSync(dir, { recursive: true });
      const known = spec.knownFailures ?? [];
      const checks: CheckResult[] = [];
      const images: string[] = [];
      const plan = framesOf(spec, !!long);

      const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
      const pageErrors: string[] = [];
      page.on("pageerror", (e) => pageErrors.push(e.message));
      try {
        const url = `${server.url}?case=${encodeURIComponent(spec.id)}&mode=nexload&frames=${[...plan.all].sort((a, b) => a - b).join(",")}`;
        await page.goto(url);
        await page.waitForFunction(() => ["done", "error"].includes((window as never as { __visual?: { status: string } }).__visual?.status ?? ""), null, {
          timeout: 600_000,
          polling: 500
        });
        const st = await page.evaluate(() => {
          const v = (window as never as { __visual: PageState & { frames: Record<string, string> } }).__visual;
          const { frames, ...rest } = v;
          return { ...rest, frameKeys: Object.keys(frames) };
        });
        writeFileSync(join(dir, "page-log.txt"), st.log.join("\n") + "\n");
        if (st.status === "error") throw new Error(`page error: ${st.error}`);

        // --- Safety: the developer's card image must be untouched.
        if (st.realCardMtimeBefore !== st.realCardMtimeAfter) {
          throw new Error("~/Klive/ks2.cim changed during the run - the SD session isolation is broken.");
        }

        const frames = new Map<number, Frame>();
        for (const key of st.frameKeys) {
          const b64 = await page.evaluate((k) => (window as never as { __visual: { frames: Record<string, string> } }).__visual.frames[k], key);
          frames.set(Number(key), { width: st.width!, height: st.height!, rgba: new Uint8Array(Buffer.from(b64, "base64")) });
        }

        checks.push(
          judge(known, "ready", "wasm", undefined, st.readyFrame !== undefined,
            `real .nexload of ${st.sdPath}: typed after ${st.bootFrames} frames, ready at frame ${st.readyFrame}`)
        );

        const evaluated = await evaluateFrames(spec, "wasm", frames, plan.png, outDir, "browser");
        checks.push(...evaluated.checks);
        images.push(...evaluated.images);

        if (spec.expectIdenticalFrames && frames.has(plan.png[0])) {
          const inPage = frames.get(plan.png[0])!;
          const headless = await renderHeadlessFrame(loaded, "wasm", plan.png[0]);
          const d = diffFrames(headless, inPage);
          if (d.differing) {
            const p = join(dir, "diff-headless-browser.png");
            writeFileSync(p, await diffPng(headless, inPage));
            images.push(p);
          }
          checks.push(
            judge(known, "headless", "wasm", undefined, d.differing === 0,
              d.differing === 0
                ? `equals the Tier 1 WASM frame (${frameHash(inPage)}): the direct loader hides nothing here`
                : `${d.differing} px differ from Tier 1 WASM in x${d.box?.x.join("-")} y${d.box?.y.join("-")}, first (${d.first?.x},${d.first?.y}) headless ${d.first?.a} browser ${d.first?.b}; NextRegs at ready ${JSON.stringify(st.nextRegsAtReady)}`)
          );

          // --- The page paints the last captured frame; for a static screen that is this one.
          const canvasPng = await page.locator("#screen").screenshot();
          const canvasPath = join(dir, "canvas.png");
          writeFileSync(canvasPath, canvasPng);
          images.push(canvasPath);
          const cmp = await compareCanvas(canvasPng, inPage);
          checks.push(judge(known, "canvas", "wasm", undefined, cmp.pass, cmp.detail));
        }
        if (pageErrors.length) checks.push(judge(known, "ready", "wasm", "page errors", false, pageErrors.slice(0, 3).join(" | ")));

        const hashes = { browser: evaluated.hashes };
        const golden = compareGolden(loaded, ["browser"], hashes);
        const failed = checks.some((c) => c.status === "fail" || c.status === "xpass") || golden.state === "changed";
        const result: CaseResult = {
          id: spec.id,
          title: `${spec.title} (browser tier: real .nexload, WASM core in Chrome)`,
          status: failed ? "fail" : "pass",
          checks,
          golden,
          hashes: hashes as never,
          outDir: dir,
          images,
          directLoadDifferences: [
            `none - loaded by NextZXOS .nexload from the SD card (${st.sdPath}); NextRegs at ready: ${JSON.stringify(st.nextRegsAtReady)}`
          ],
          elapsedMs: Date.now() - started
        };
        writeFileSync(join(dir, "result.json"), JSON.stringify({ ...result, page: { ...st, log: undefined } }, null, 1));
        writeReviewPrompt(loaded, result);
        return result;
      } finally {
        await page.close();
      }
    },
    async close() {
      await browser.close();
      await server.close();
    }
  };
}

/**
 * The painted canvas against the pixel buffer.
 *
 * The screenshot is the buffer scaled by CSS and the display's DPR (720x288 shows as 720x576 CSS
 * pixels, and a fractional DPR adds a row), so it is resized back to the buffer's size and compared
 * pixel by pixel within 16 per channel. Pixels on a colour edge of the buffer (a neighbour differs)
 * are not counted: resampling may move an edge by one pixel, which says nothing about the painting.
 * Passes when fewer than 0.5% of the non-edge pixels differ.
 */
export async function compareCanvas(canvasPng: Buffer, frame: Frame): Promise<{ pass: boolean; detail: string }> {
  const { width: W, height: H } = frame;
  const a = await sharp(canvasPng).removeAlpha().resize(W, H, { fit: "fill", kernel: "nearest" }).raw().toBuffer();
  const px = (x: number, y: number) => (y * W + x) * 4;
  const same = (i: number, j: number) =>
    frame.rgba[i] === frame.rgba[j] && frame.rgba[i + 1] === frame.rgba[j + 1] && frame.rgba[i + 2] === frame.rgba[j + 2];
  let compared = 0;
  let differing = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = px(x, y);
      if (!same(i, px(x - 1, y)) || !same(i, px(x + 1, y)) || !same(i, px(x, y - 1)) || !same(i, px(x, y + 1))) continue;
      compared++;
      const j = (y * W + x) * 3;
      if (Math.abs(a[j] - frame.rgba[i]) > 16 || Math.abs(a[j + 1] - frame.rgba[i + 1]) > 16 || Math.abs(a[j + 2] - frame.rgba[i + 2]) > 16) {
        differing++;
      }
    }
  }
  const ratio = compared ? differing / compared : 1;
  const meta = await sharp(canvasPng).metadata();
  return {
    pass: ratio < 0.005,
    detail: `canvas ${meta.width}x${meta.height} resized to ${W}x${H}: ${differing} of ${compared} non-edge pixels differ (${(ratio * 100).toFixed(2)}%)`
  };
}
