# Screen Recording Feature — Implementation Plan

## Decisions Made

| Topic | Decision |
|---|---|
| Video format | MP4 / H.264 (universal OS compatibility) |
| FFmpeg delivery | Bundle via `@ffmpeg-installer/ffmpeg` (no user setup required) |
| Frame rate | User-selectable: native (50 or 60 Hz per machine) or half (25 / 30 Hz) |
| Pause behaviour | Video pauses — last frame held (repeated) until machine resumes |
| IPC transfer | Raw RGBA pixel data sent frame-by-frame from renderer → main → FFmpeg stdin |

---

## Build Strategy

Build in two phases. **Phase A** wires up the full UI and a lightweight stub backend so the entire flow can be exercised and tested end-to-end without FFmpeg. **Phase B** replaces the stub with real FFmpeg encoding.

---

## Architecture

```
Renderer process                       Main process
────────────────────────────           ──────────────────────────────────────
EmulatorPanel
  │
  │  arm() / stop()                    IRecordingBackend (interface)
  │  ◄── RecordingManager ──────IPC──► │
  │        │                           ├── StubRecordingBackend  (Phase A)
  │  submitFrame(canvas)               └── FfmpegRecordingBackend (Phase B)
  │        │
  │        │  appendRecordingFrame
  └────────┴───────────────────────►  ~/Klive/KliveExports/
                                        recording_YYYYMMDD_HHmmss.{txt|mp4}
```

---

## Phase A — UI + Stub Backend (implement & test first)

### Step A1 — Redux state extension

**Files changed:**
- `src/common/state/ActionTypes.ts` — add `SET_SCREEN_RECORDING_STATE`
- `src/common/state/AppState.ts` — extend `EmulatorState`:
  ```ts
  screenRecordingState?: "idle" | "armed" | "recording" | "paused";
  screenRecordingFile?: string;   // path of file being written
  screenRecordingFps?: "native" | "half"; // user preference
  ```
- `src/common/state/actions.ts` — add `setScreenRecordingStateAction`
- `src/common/state/emulator-state-reducer.ts` — handle `SET_SCREEN_RECORDING_STATE`

**Testable:** Reducer unit tests covering every state transition
(`idle → armed → recording → paused → recording → idle`).

---

### Step A2 — IPC API surface

**Files changed:**
- `src/common/messaging/MainApi.ts` — add three method stubs:
  ```ts
  async startScreenRecording(width: number, height: number, fps: number): Promise<string>
  async appendRecordingFrame(rgba: Uint8Array): Promise<void>
  async stopScreenRecording(): Promise<string>
  ```
- `src/main/RendererToMainProcessor.ts` — add concrete implementations backed by `StubRecordingBackend` (see A3)

**Testable:** Unit tests swap in a mock backend; assert each IPC method delegates correctly.

---

### Step A3 — Stub recording backend

**New file:** `src/main/recording/StubRecordingBackend.ts`

Implements the same `IRecordingBackend` interface that `FfmpegRecordingBackend` will later satisfy:

```ts
export interface IRecordingBackend {
  start(outputPath: string, width: number, height: number, fps: number): void;
  appendFrame(rgba: Uint8Array): void;
  holdFrame(): void;
  finish(): Promise<string>; // returns output path
}
```

`StubRecordingBackend` behaviour:
- `start()` — records `startedAt = new Date()`, `width`, `height`, `fps`
- `appendFrame()` — increments an internal frame counter; does **not** process pixel data
- `holdFrame()` — increments the frame counter identically to `appendFrame` (counts pause-held frames)
- `finish()` — writes a plain-text `.txt` file to the resolved output path with:
  ```
  Recording started:  2026-02-28T14:05:00.000Z
  Recording stopped:  2026-02-28T14:05:10.000Z
  Duration (s):       10.0
  Frames recorded:    500
  Resolution:         352 x 296
  Target FPS:         50
  ```
  Returns the file path.

**Testable:** Unit tests call `start` / `appendFrame` / `holdFrame` / `finish` and assert the written text content without FFmpeg or file I/O (mock `fs`).

---

### Step A4 — Output path resolver

**New file:** `src/main/recording/outputPath.ts`

Pure function, shared by both the stub and the real backend:

```ts
export function resolveRecordingPath(
  homeDir: string,
  kliveDir: string,
  ext: "txt" | "mp4",
  now?: Date
): string
```

- Builds `{homeDir}/{kliveDir}/KliveExports/recording_YYYYMMDD_HHmmss.{ext}`
- Creates the directory if it does not exist
- `now` is injectable for deterministic unit tests

**Testable:** Pass fixed arguments; assert the returned path format.

---

### Step A5 — RecordingManager (renderer, framework-agnostic class)

**New file:** `src/renderer/appEmu/recording/RecordingManager.ts`

```ts
export type RecordingFps = "native" | "half";

export class RecordingManager {
  constructor(private readonly mainApi: MainApiImpl, private readonly dispatch: Dispatch<Action>) {}

  arm(fps: RecordingFps): void
  disarm(): void                       // stop even if machine is running
  onMachineStarted(width: number, height: number, nativeFps: number): Promise<void>
  onMachinePaused(): void
  onMachineResumed(width: number, height: number, nativeFps: number): Promise<void>
  onMachineStopped(): Promise<void>
  submitFrame(canvas: HTMLCanvasElement, frameIndex: number): Promise<void>
  get state(): "idle" | "armed" | "recording" | "paused"
}
```

State machine:

| Event | From | To | Side effect |
|---|---|---|---|
| `arm()` | idle | armed | dispatch |
| `disarm()` | armed | idle | dispatch |
| `onMachineStarted` | armed | recording | `startScreenRecording` IPC, dispatch |
| `onMachinePaused` | recording | paused | dispatch — stops submitting new frames |
| `onMachineResumed` | paused | recording | dispatch — resumes submitting |
| `onMachineStopped` | recording\|paused | idle | `stopScreenRecording` IPC, dispatch |
| `disarm()` | recording\|paused | idle | `stopScreenRecording` IPC, dispatch |

`submitFrame` logic:
- If state ≠ `"recording"`, return immediately
- If `fps === "half"`, skip odd-numbered `frameIndex` values
- Extract RGBA via `ctx.getImageData`
- Call `mainApi.appendRecordingFrame(rgba)`

**Testable:** Inject a mock `mainApi`; exercise every transition with no React or Electron dependency.

---

### Step A6 — Integration into EmulatorPanel

**File changed:** `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx`

Purely additive changes:

1. Instantiate `RecordingManager` in a `useRef`
2. `machineControllerChanged` → `recordingManager.onMachineStarted(w, h, fps)`
3. `machineStateChanged`:
   - `Running` → `recordingManager.onMachineResumed(w, h, fps)`
   - `Paused` → `recordingManager.onMachinePaused()`
   - `Stopped` → `await recordingManager.onMachineStopped()`
4. `machineFrameCompleted` (after `displayScreenData`) → `recordingManager.submitFrame(screenElement.current, controller.machine.frames)`
5. Expose `recordingManager` ref so the toolbar button can call `arm()` / `disarm()`

**Testable:** Component test with mock `RecordingManager`; assert lifecycle calls on each state transition.

---

### Step A7 — Toolbar button

**New file:** `src/renderer/appEmu/EmulatorArea/RecordingButton.tsx`

- Reads `screenRecordingState` / `screenRecordingFps` from Redux
- When `idle`: shows **"Record (native fps)"** / **"Record (half fps)"** selector + **Start** button
- When `armed`: shows an amber **●** and **Cancel** button (machine not yet running)
- When `recording`: shows a pulsing red **●**, the filename, and a **Stop** button
- When `paused`: shows the red **●** dimmed and **"Paused"** label
- On Start → `recordingManager.arm(fps)`; on Stop/Cancel → `recordingManager.disarm()`

**Testable:** React Testing Library — mock store and ref; assert labels and handler calls.

---

## Phase B — Real FFmpeg Backend (after Phase A is fully working)

### Step B1 — Install FFmpeg dependency

```
npm install @ffmpeg-installer/ffmpeg --save
```

Add to `package.json` `build` section:
```json
"asarUnpack": ["node_modules/@ffmpeg-installer/**"]
```

---

### Step B2 — FfmpegRecordingBackend

**New file:** `src/main/recording/FfmpegRecordingBackend.ts`

Implements `IRecordingBackend`. Spawns:
```
ffmpeg -y -f rawvideo -pix_fmt rgba -s {W}x{H} -r {fps}
       -i pipe:0 -c:v libx264 -preset fast -crf 18
       -vf format=yuv420p {outputPath}
```

- `appendFrame(rgba)` — writes raw bytes to FFmpeg `stdin`
- `holdFrame()` — re-writes the last buffer (paused machine, held frame in video)
- `finish()` — closes `stdin`, awaits process exit, returns output path

**Testable:** Unit tests mock `child_process.spawn`; integration test produces a non-zero-byte `.mp4`.

---

### Step B3 — Switch backend in RendererToMainProcessor

Change the one line in `RendererToMainProcessor.ts` that instantiates `StubRecordingBackend` to instantiate `FfmpegRecordingBackend` instead. No other files change.

---

## File Map

```
src/
  main/
    recording/
      outputPath.ts              ← A4: shared path builder
      StubRecordingBackend.ts    ← A3: text-file stub
      FfmpegRecordingBackend.ts  ← B2: real FFmpeg encoder
      IRecordingBackend.ts       ← A3: shared interface
    RendererToMainProcessor.ts   ← A2: +3 IPC handlers
  common/
    messaging/
      MainApi.ts                 ← A2: +3 method stubs
    state/
      ActionTypes.ts             ← A1
      AppState.ts                ← A1
      actions.ts                 ← A1
      emulator-state-reducer.ts  ← A1
  renderer/
    appEmu/
      recording/
        RecordingManager.ts      ← A5: state machine
      EmulatorArea/
        EmulatorPanel.tsx        ← A6: wiring
        RecordingButton.tsx      ← A7: toolbar button
package.json                     ← B1: dependency + asarUnpack
```

---

## Test File Map

```
test/
  recording/
    outputPath.test.ts           ← A4
    StubRecordingBackend.test.ts ← A3
    FfmpegRecordingBackend.test.ts ← B2
    RecordingManager.test.ts     ← A5
  redux/
    recording-reducer.test.ts    ← A1
```

---

## Open Questions / Future Considerations

- **Transfer cost:** At ZX Spectrum resolution (352 × 296, RGBA) each frame is ~416 KB; at 50 fps that is ~20 MB/s over IPC. Acceptable for now; revisit for higher-resolution machines.
- **Audio:** Video only for now. Audio can be added in Phase C by piping beeper/AY sample buffers as a second FFmpeg input.
- **Progress indication:** The toolbar button shows state but not duration or file size. A live timer can be added as a future iteration.
