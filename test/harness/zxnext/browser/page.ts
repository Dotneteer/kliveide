import { FILE_PROVIDER } from "@emu/machines/machine-props";
import { ZxNextWasmV2Machine } from "@emu/machines/zxNext/ZxNextWasmV2Machine";
import { loadNexFileContents } from "@renderer/appIde/DocumentPanels/Next/nexFileLoader";
import type { IFileProvider } from "@renderer/core/IFileProvider";

import { captureFrame, runDisplayedFrame, type Frame } from "../core/frame";
import { loadNexDirect } from "../core/load-nex-direct";
import { FrameRunner } from "./frame-runner";
import { HttpMessenger } from "./http-messenger";

/*
 * The browser tier's emulator: the production WASM core, running in Chrome, frame by frame.
 *
 * URL parameters:
 *   case=<id>         run that case (otherwise: list the cases)
 *   mode=direct       load the .nex with the test-only direct loader (B1)
 *   mode=boot         cold-boot NextZXOS from a cloned SD card until the boot menu is idle (B2)
 *   mode=nexload      boot, then the app's own launch flow types `.nexload` (B3); frames are
 *                     counted from the program's ready marker ($A5 in NextReg $7F)
 *   frames=50,100     frames to capture (default: the case's capture list)
 *
 * The page publishes its progress on `window.__visual` for the Playwright driver.
 */

type VisualState = {
  status: "idle" | "running" | "done" | "error";
  error?: string;
  log: string[];
  frames: Record<string, string>; // frame number -> RGBA base64
  width?: number;
  height?: number;
  readyFrame?: number;
  bootFrames?: number;
  sdPath?: string;
  mainApiCalls?: Record<string, number>;
  realCardMtimeBefore?: number;
  realCardMtimeAfter?: number;
  /** NextReg values when the program signalled ready - the state a loader difference shows up in. */
  nextRegsAtReady?: Record<string, string>;
};

/** Registers a test program's picture depends on; logged at the ready point in every mode. */
const SNAPSHOT_REGS = [0x03, 0x05, 0x06, 0x07, 0x12, 0x14, 0x15, 0x16, 0x17, 0x1c, 0x22, 0x26, 0x27, 0x40, 0x42, 0x43, 0x4a, 0x4b, 0x60, 0x61, 0x62, 0x63, 0x64, 0x68, 0x69, 0x6b, 0x7f, 0xc0];

function snapshotNextRegs(machine: ZxNextWasmV2Machine): Record<string, string> {
  const exports = machine.wasmV2Runtime!.exports;
  return Object.fromEntries(SNAPSHOT_REGS.map((r) => ["$" + r.toString(16).padStart(2, "0").toUpperCase(), "$" + exports.zxnextGetNextRegisterDirect(r).toString(16).padStart(2, "0").toUpperCase()]));
}

const READY_REG = 0x7f;
const READY_VALUE = 0xa5;

const state: VisualState = { status: "idle", log: [], frames: {} };
(window as unknown as { __visual: VisualState }).__visual = state;

const $ = (id: string) => document.getElementById(id)!;
function log(line: string): void {
  state.log.push(line);
  $("log").textContent += line + "\n";
}

class FetchFileProvider implements IFileProvider {
  async readTextFile(path: string): Promise<string> {
    return (await this.fetch(path)).text();
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    return new Uint8Array(await (await this.fetch(path)).arrayBuffer());
  }
  writeTextFile(): Promise<void> {
    throw new Error("read-only");
  }
  writeBinaryFile(): Promise<void> {
    throw new Error("read-only");
  }
  private async fetch(path: string): Promise<Response> {
    const r = await fetch(`/public/${path.replace(/^\/+/, "")}`);
    if (!r.ok) throw new Error(`GET /public/${path}: ${r.status}`);
    return r;
  }
}

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  const body = await r.json();
  if (!r.ok) throw new Error(`${url}: ${body.error ?? r.status}`);
  return body as T;
}

export async function createMachine(messenger?: unknown): Promise<ZxNextWasmV2Machine> {
  const machine = new ZxNextWasmV2Machine(undefined, undefined, messenger as never, {
    artifactName: "visual-tests-browser.wasm",
    readArtifact: async () => new Uint8Array(await (await fetch("/wasm/zx-spectrum-next.wasm")).arrayBuffer())
  });
  machine.setMachineProperty(FILE_PROVIDER, new FetchFileProvider());
  await machine.setup();
  return machine;
}

function paint(frame: Frame): void {
  const canvas = $("screen") as HTMLCanvasElement;
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d")!;
  const rgba = new Uint8ClampedArray(frame.rgba);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 0xff;
  ctx.putImageData(new ImageData(rgba, frame.width, frame.height), 0, 0);
}

/** Lets the page repaint and the driver poll between batches of emulated frames. */
const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

async function runDirect(caseId: string, captureList: number[]): Promise<void> {
  const { nexBase64 } = await getJson<{ nexBase64: string }>(`/api/cases/${caseId}/nex`);
  const parsed = loadNexFileContents(fromBase64(nexBase64));
  if (!parsed.fileInfo) throw new Error(parsed.error);
  const machine = await createMachine();
  loadNexDirect(machine, parsed.fileInfo);
  log(`direct load: PC=$${machine.pc.toString(16)}`);

  const wanted = new Set(captureList);
  const last = Math.max(...captureList);
  for (let f = 1; f <= last; f++) {
    if (!state.nextRegsAtReady && machine.wasmV2Runtime!.exports.zxnextGetNextRegisterDirect(READY_REG) === READY_VALUE) {
      state.readyFrame = f;
      state.nextRegsAtReady = snapshotNextRegs(machine);
      log(`NextRegs at ready: ${JSON.stringify(state.nextRegsAtReady)}`);
    }
    runDisplayedFrame(machine, () => {
      if (!wanted.has(f)) return;
      const frame = captureFrame(machine);
      state.frames[String(f)] = toBase64(frame.rgba);
      state.width = frame.width;
      state.height = frame.height;
      paint(frame);
    });
    if (f % 25 === 0) await yieldToBrowser();
  }
}

/** Boots NextZXOS on a fresh SD session; runs the launch flow up to `stopBefore` (or all of it). */
async function bootSession(caseId: string | undefined, stopBefore?: string) {
  const session = await (await fetch("/api/session", { method: "POST" })).json();
  if (session.error) throw new Error(session.error);
  state.realCardMtimeBefore = session.realCardMtime;
  log(`SD session ${session.id} (clone of ~/Klive/ks2.cim)`);
  let sdPath = "";
  if (caseId) {
    const r = await (await fetch(`/api/session/${session.id}/nex/${caseId}`, { method: "POST" })).json();
    if (r.error) throw new Error(r.error);
    sdPath = r.sdPath;
    state.sdPath = sdPath;
    log(`copied onto the card as ${sdPath}`);
  }
  const messenger = new HttpMessenger(session.id);
  const machine = await createMachine(messenger);
  await machine.hardReset();
  return { session, messenger, machine, sdPath };
}

async function endSession(id: string, messenger: HttpMessenger): Promise<void> {
  state.mainApiCalls = messenger.calls;
  const r = await (await fetch(`/api/session/${id}`, { method: "DELETE" })).json();
  state.realCardMtimeAfter = r.realCardMtime;
}

async function runBoot(): Promise<void> {
  const { session, messenger, machine } = await bootSession(undefined);
  const runner = new FrameRunner(machine, messenger, (f) => {
    if (f % 10 === 0) paint(captureFrame(machine));
  });
  try {
    const flow = await machine.getCodeInjectionFlow("zxnext", "_klive/NONE.NEX");
    await runner.runInjectionFlow(flow, log, "Arrow down");
    const frame = captureFrame(machine);
    paint(frame);
    state.bootFrames = runner.frames;
    state.frames["boot"] = toBase64(frame.rgba);
    state.width = frame.width;
    state.height = frame.height;
    log(`boot menu idle after ${runner.frames} frames; SD calls ${JSON.stringify(messenger.calls)}`);
  } finally {
    await endSession(session.id, messenger);
  }
}

async function runNexload(caseId: string, captureList: number[]): Promise<void> {
  const { session, messenger, machine, sdPath } = await bootSession(caseId);
  const wanted = new Set(captureList);
  const last = Math.max(...captureList);
  let ready: number | undefined;
  const runner = new FrameRunner(machine, messenger, (f) => {
    if (ready === undefined) {
      if (f % 10 === 0) paint(captureFrame(machine));
      return;
    }
    const rel = f - ready;
    if (!wanted.has(rel)) return;
    const frame = captureFrame(machine);
    state.frames[String(rel)] = toBase64(frame.rgba);
    state.width = frame.width;
    state.height = frame.height;
    paint(frame);
  });
  try {
    const flow = await machine.getCodeInjectionFlow("zxnext", sdPath);
    await runner.runInjectionFlow(flow, log);
    state.bootFrames = runner.frames;
    log(`.nexload typed after ${runner.frames} frames`);
    const exports = machine.wasmV2Runtime!.exports;
    await runner.runUntil("the program's ready marker ($A5 in NextReg $7F)", () => exports.zxnextGetNextRegisterDirect(READY_REG) === READY_VALUE, 3_000);
    ready = runner.frames;
    state.readyFrame = ready;
    state.nextRegsAtReady = snapshotNextRegs(machine);
    log(`NextRegs at ready: ${JSON.stringify(state.nextRegsAtReady)}`);
    log(`ready at frame ${ready} (PC=$${machine.pc.toString(16)})`);
    await runner.runFrames(last);
  } finally {
    await endSession(session.id, messenger);
  }
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const caseId = params.get("case");
  if (params.get("mode") === "boot") {
    state.status = "running";
    await runBoot();
    state.status = "done";
    $("status").innerHTML = `<span class="ok">done</span>`;
    return;
  }
  if (!caseId) {
    const cases = await getJson<Array<{ id: string; title: string }>>("/api/cases");
    $("cases").innerHTML = cases
      .map((c) => `<div><a href="?case=${c.id}&mode=nexload">${c.id}</a> (<a href="?case=${c.id}&mode=direct">direct</a>) — ${c.title}</div>`)
      .join("");
    $("cases").innerHTML += `<p><a href="?mode=boot">Boot NextZXOS only</a></p>`;
    return;
  }
  const spec = await getJson<{ id: string; title: string; capture: number[] }>(`/api/cases/${caseId}`);
  $("title").textContent = `${spec.id} — ${spec.title}`;
  const frames = params.get("frames")?.split(",").map(Number) ?? spec.capture;
  const mode = params.get("mode") ?? "direct";
  state.status = "running";
  const started = performance.now();
  if (mode === "direct") await runDirect(caseId, frames);
  else if (mode === "nexload") await runNexload(caseId, frames);
  else throw new Error(`unknown mode ${mode}`);
  state.status = "done";
  const details = [
    `${mode}`,
    state.bootFrames !== undefined ? `.nexload typed at frame ${state.bootFrames}` : "",
    state.readyFrame !== undefined ? `ready at frame ${state.readyFrame}` : "",
    `captured ${Object.keys(state.frames).join(", ")}`,
    state.realCardMtimeBefore !== undefined
      ? state.realCardMtimeBefore === state.realCardMtimeAfter ? "~/Klive/ks2.cim untouched" : "WARNING: ~/Klive/ks2.cim changed"
      : ""
  ].filter(Boolean);
  $("status").innerHTML = `<span class="ok">done</span> in ${Math.round(performance.now() - started)} ms — ${details.join(" · ")}. The canvas shows the last captured frame; run \`npm run test:visual -- --tier browser ${caseId}\` for the oracles.`;
}

main().catch((e) => {
  state.status = "error";
  state.error = e instanceof Error ? e.stack ?? e.message : String(e);
  $("status").innerHTML = `<span class="bad">error</span>`;
  log(state.error);
});
