# IDE + Emulator Recording Plan

Status: **Implemented** — phases 1–7 done; verified in the running app on macOS only (see §8)
Scope: a second recording mode that captures the **IDE window and the emulator window side by side**
in one video, using the encoding options the emulator screen recording already has (fps, quality,
format), with emulator audio, an optional mouse pointer with click indication, and a start/stop menu command with a
configurable shortcut.

---

## 1. What is being added, and why

Klive can already record the emulator screen (Machine → Recording). That recording is built from the
machine's own pixel buffer, frame by frame, so it shows the emulated picture only. Tutorials and bug
reports usually need to show the **code and the running machine together**. This feature records
both windows into a single video.

### 1.1 Decisions taken before drafting

| # | Decision |
| --- | --- |
| D1 | **Layout, not screen positions.** The two windows are composed side by side in the video, whatever their real positions on the screen. The user chooses where the IDE goes: **Left, Right, Top or Bottom** of the emulator. |
| D2 | **Video size = the bounding rectangle of the arrangement.** Left/Right: `(wIde + wEmu) × max(hIde, hEmu)`. Top/Bottom: `max(wIde, wEmu) × (hIde + hEmu)`. The shorter/narrower window is centred along its side; the empty area is filled with a solid colour (§4.3). |
| D3 | **Same encoding options** as the emulator recording: `screenRecordingFps`, `screenRecordingQuality`, `screenRecordingFormat`. No second set of options. |
| D4 | **Include pointer** is a menu checkbox (default **on**). The pointer is drawn into the composed frame by Klive (§4.4). |
| D5 | **Audio is the emulator's audio, padded with silence** whenever the emulator does not supply enough to match the wall-clock video (paused, stopped, running slower than real time, or not yet started). |
| D6 | **Frames are recorded at 1× (DIP) size by default.** A menu checkbox "Full resolution (HiDPI)" records at the device pixel ratio instead. |
| D7 | **Capture with `webContents.beginFrameSubscription`** in the main process: page content only (no OS title bar or native menu bar), no macOS Screen Recording permission, works for both windows from the process that owns FFmpeg. |
| D8 | **One recording at a time.** The emulator recording and this recording are mutually exclusive; each command is disabled while the other is active. |
| D9 | **The command lives in Machine → Recording** (with the encoding options it uses), and has a shortcut read from the `shortcuts.recordIdeEmu` setting, default **`Ctrl+Shift+F7`** (§6). |
| D10 | **The video size is fixed at start.** If a window is resized while recording, its frames are scaled to fit the slot reserved for it at start, keeping the aspect ratio, with bars (§4.3). |
| D11 | **Show mouse clicks** is a menu checkbox (default **on**), enabled only when *Include pointer* is on. A held button draws a ring around the pointer tip; a release plays a short fading ring. Presses come from each window's `webContents` `input-event` (§4.4.1). |

### 1.2 Out of scope (later work)

- Recording any other window or a screen region.
- Real window positions / overlap as on the desktop.
- Microphone or system audio.
- A pause command for this recording mode (stopping and starting again produces separate files).
- A shortcut that works while Klive is not focused (`globalShortcut`).

---

## 2. Current code paths this touches

| Concern | Where |
| --- | --- |
| FFmpeg encoder | `src/main/recording/FfmpegRecordingBackend.ts` — `start(outputPath, w, h, fps, xRatio, yRatio, sampleRate, crf, format)`, `appendFrame`, `appendAudioSamples`, `finish`. With ratios 1 the frame is passed through without a copy. |
| Backend interface | `src/main/recording/IRecordingBackend.ts` |
| Output path / availability | `src/main/recording/outputPath.ts` (`resolveRecordingPath`), `ffmpegAvailable.ts` |
| Current recording IPC | `src/main/RendererToMainProcessor.ts` ~993–1040 — module-level `_recordingBackend`, `startScreenRecording`, `appendRecordingFrame`, `appendRecordingAudio`, `stopScreenRecording` |
| Main API surface | `src/common/messaging/MainApi.ts` ~577–637 |
| Renderer recorder | `src/renderer/appEmu/recording/RecordingManager.ts` — state machine, CRF mapping (`_getCrf`), audio interleaving (`submitAudioSamples`) |
| Audio source | `src/renderer/features/emulator/audioFrameRendering.ts` (calls `recordingManager.submitAudioSamples`), driven from `EmulatorPanel.tsx` on every full frame |
| Menu commands → emu renderer | `src/common/messaging/EmuApi.ts` `issueRecordingCommand`, `src/renderer/appEmu/MainToEmuProcessor.ts` ~1200 |
| Recording state | `src/common/state/AppState.ts` 93–148, `actions.ts` 140–170, `ActionTypes.ts` 103, `emulator-state-reducer.ts` |
| Menu | `src/main/app-menu.ts` — Recording submenu ~975–1062 (inside the Machine menu), shortcut defaults ~271–278 |
| Windows | `src/main/index.ts` — `emuWindow`, `ideWindow` (158–159), `isIdeWindowVisible` (723); the IDE window can be hidden (~500) |
| Recording overlay | `src/renderer/features/emulator/RecordingStateOverlay.tsx` |
| Shortcut setting pattern | `src/common/utils/navigationShortcuts.ts` (setting key + default + trimmed read) |
| Existing tests | `test/recording/FfmpegRecordingBackend.test.ts`, `test/recording/RecordingManager.test.ts` |

---

## 3. Architecture

Everything for this mode runs in the **main process**, except the audio, which originates in the
emulator renderer.

```
 ideWindow.webContents ──beginFrameSubscription──┐
                                                 ├─► WindowFrameSource ×2 (latest frame, 1×/HiDPI)
 emuWindow.webContents ──beginFrameSubscription──┘                │
                                                                  ▼
             screen.getCursorScreenPoint() ──────────► FrameComposer (layout, fill, pointer)
                                                                  │  RGBA, fixed W×H
                                                 wall-clock FramePump (fps tick, drop when busy)
                                                                  │
 emu renderer audio ─IPC─► AudioPadder (silence fill to wall clock) ──► FfmpegRecordingBackend
```

New main-process module: `src/main/recording/window-recording/`

| File | Responsibility |
| --- | --- |
| `WindowFrameSource.ts` | Subscribes to one `webContents`; keeps the **latest** frame as RGBA at the chosen scale; records its DIP size; unsubscribes on stop or when the window is destroyed/hidden. |
| `layout.ts` | Pure: given the two content sizes and `IdePosition`, returns the video size and both destination rectangles. Even dimensions guaranteed. |
| `FrameComposer.ts` | Pure-ish: fills the background, blits/scales each source into its rectangle, draws the pointer. Reuses one output buffer. |
| `pointer.ts` | A small built-in arrow sprite (RGBA, 1× and 2×) and the blit with alpha; the press ring and release ripple drawing. |
| `ClickTracker.ts` | Pure: turns `mouseDown` / `mouseUp` events (with timestamps) into the click state to draw at a given frame time, including the latch and the ripple animation. |
| `AudioPadder.ts` | Pure: tracks samples written vs. `elapsed × sampleRate × 2` and returns the silence block to append. |
| `WindowRecordingSession.ts` | Owns the backend, sources, composer, pump timer and padder; `start()` / `stop()`; reports failures. |

### 3.1 Why the existing `RecordingManager` is not reused for video

`RecordingManager` is paced by **emulated** frames and lives in the emulator renderer. This mode is
paced by the **wall clock** and its frames come from the main process. Only its preference values
(fps / quality / format) and its CRF mapping are shared; the CRF mapping moves to
`src/common/utils/recordingCrf.ts` so both sides call the same function.

---

## 4. Detailed design

### 4.1 Capture (`WindowFrameSource`)

- `webContents.beginFrameSubscription(false, (image, dirtyRect) => …)`. Frames arrive only when the
  page repaints, so the source keeps the last full image and the pump repeats it.
- On every frame: `image.getSize()` is in device pixels. At **1×** (D6), `image.resize({ width:
  dipW, height: dipH, quality: "good" })` before `toBitmap()`; at HiDPI use it as is.
- `toBitmap()` is **BGRA** on all platforms Electron supports; convert to RGBA once when copying into
  the source's buffer (or feed FFmpeg `-pix_fmt bgra` — see §4.6, preferred: no per-pixel swap).
- **Occlusion / background throttling.** A covered or minimised window may stop painting. Mitigation:
  while recording, call `webContents.setBackgroundThrottling(false)` on both windows and restore the
  previous value on stop. A minimised window keeps its last frame (acceptable; documented).
- Hidden IDE window: the command is disabled (D8/§5). If the IDE window is hidden **during** a
  recording, its slot keeps its last frame; if a window is destroyed, the recording stops cleanly.
- The first frame: call `webContents.invalidate()` right after subscribing so both windows paint once
  immediately; the pump does not emit until both sources have a frame (bounded wait, 1 s; after that a
  missing source is drawn as fill colour).

### 4.2 Pacing (`FramePump`)

- Fps: `native` → **30**, `half` → **15** (the emulator's "native" is a machine rate and meaningless
  for windows; recorded here as a decision, shown in the menu as before).
- A `setInterval`-free loop driven by `performance.now()`: each tick computes how many frames are due
  since start and emits that many (normally one) so the timeline stays exact even when a tick is late.
- **Backpressure:** `FfmpegRecordingBackend.appendFrame` gains a return value (`stdin.write`'s
  boolean). While FFmpeg's stdin is not drained, the pump **duplicates nothing and composes nothing**;
  it counts the dropped frames and, after `drain`, writes the latest composed frame for each due slot
  only up to a small cap (drop the rest). Memory stays bounded; the video stays the right length.
  Dropped-frame count is logged at stop.

### 4.3 Layout and composition

- `IdePosition = "left" | "right" | "top" | "bottom"` (default `"left"`).
- Sizes are taken from `webContents` content (DIP × scale), **at start**, and fixed (D10).
- Each window gets a slot equal to its start size; the smaller window is centred on the shared axis.
- If a source frame's size differs from its slot (window resized), it is scaled to fit with the
  aspect ratio kept (nearest-neighbour is fine for the emulator; bilinear via `nativeImage.resize`
  for the IDE — do the resize in the source, not the composer).
- Fill colour: the theme's window background, read once at start from the IDE renderer through the
  existing theming tokens (no colour literal — see AGENTS.md theming rules). Fallback: black.
- Width and height are rounded up to even numbers (the encoders need it; the backend's `scale` filter
  already guards this, but even input avoids a rescale).

### 4.4 Pointer (D4)

- Each tick: `screen.getCursorScreenPoint()` (DIP, screen coordinates). For each window, test it
  against `getContentBounds()`; if inside, map it to that window's slot (× scale) and blit the sprite.
- Outside both windows → no pointer drawn.
- The sprite is a plain arrow with a dark outline, defined as pixel data in `pointer.ts` (not the OS
  cursor shape — Electron cannot read the current cursor image). It is a *drawn* image, not UI chrome,
  so the theming colour rule does not apply; note this in the file header.

#### 4.4.1 Mouse clicks (D11)

- **Source.** While recording with *Show mouse clicks* on, `WindowRecordingSession` subscribes to
  `webContents.on("input-event", …)` on both windows and keeps `mouseDown` / `mouseUp` events with
  their `button` (`left` / `middle` / `right`) and a `performance.now()` timestamp. Nothing is added to
  the renderers and there is no new IPC. Listeners are removed on stop.
- **Spike first (phase 3).** Electron's typings declare the listener argument as the plain
  `InputEvent`; the `MouseInputEvent` fields (`button`, `x`, `y`) must be confirmed at runtime on
  macOS, Windows and Linux. **Fallback** if they are missing: a capture-phase `mousedown` / `mouseup`
  listener in each renderer (IDE and emulator), active only while recording, reporting the button
  to the main process through a new `MainApi.reportRecordingMouseButton(button, down)` call.
- **Scope.** Only clicks on the two windows' page content are seen. Clicks on the title bar, the
  native menu bar or OS dialogs are not; none of those are in the video either.
- **Drawing** (in `FrameComposer`, after the pointer position is known, and only when the pointer is
  drawn at all):
  - *Held:* a translucent filled ring centred on the pointer tip, radius ≈ 14 DIP (× scale), drawn
    **under** the arrow so the arrow stays sharp. Left button uses the theme's primary accent, right
    button the secondary accent (`--accent-*` / `--accent-secondary-*`, read once at start with the
    fill colour, §4.3); middle uses the primary accent. Fallback colours if the read fails.
  - *Released:* a ring outline that expands from ≈ 14 to ≈ 28 DIP and fades to transparent over
    **300 ms**, in the colour of the button released.
- **Latch.** At 15 fps a frame is taken only every 66 ms, so a quick click could fall entirely
  between two frames. `ClickTracker` guarantees a press is drawn in **at least one** recorded frame:
  a `mouseDown` not yet shown keeps the *held* state until a frame has been composed with it, and
  only then starts the release ripple.
- **Stuck press.** The held state is cleared when either window loses focus (`blur`), when the
  pointer leaves both windows for longer than 1 s without a `mouseUp`, and on stop.
- **Mouse capture.** While the emulator holds the mouse (`MouseCaptureOverlay`, e.g. the Next mouse),
  the OS pointer is hidden and its screen position is meaningless. Neither the pointer nor clicks
  are drawn in that state; the session reads the capture flag from the emulator state.

### 4.5 Audio (D5)

- New `MainApi.appendWindowRecordingAudio(samples: Float32Array)` IPC, called by the emulator
  renderer **while a window recording is active**. `RecordingManager` gains a `windowRecordingActive`
  flag (set through `issueRecordingCommand("window-recording-on" | "window-recording-off")`) and
  `submitAudioSamples` forwards to the new IPC when the flag is set, independent of its own state.
- `AudioPadder` (main): on each pump tick, `due = round(elapsedSeconds × sampleRate) × 2` floats.
  If fewer have been written, append zeros for the difference. Emulator samples arriving while ahead
  of the clock by more than 250 ms (emulator faster than real time) are **dropped** so audio cannot
  drift ahead. Sample rate: the emulator's current rate, obtained once at start through the
  `issueRecordingCommand("window-recording-on")` round trip (returns it); default 44100.

### 4.6 Backend changes

- `IRecordingBackend.start` gets an options object overload `{ pixelFormat?: "rgba" | "bgra" }` so the
  window recorder can feed BGRA directly (`-pix_fmt bgra`). Existing callers are unchanged.
- `appendFrame` returns `boolean` (written without backpressure) and exposes `onceDrained(cb)`.
- `RendererToMainProcessor`: `_recordingBackend` stays for the emulator recording; the window
  recording keeps its backend inside `WindowRecordingSession`. Mutual exclusion is enforced by state
  (§5), and `startScreenRecording` additionally throws if a window session is active.

### 4.7 Recording indicator

`RecordingStateOverlay` is drawn in the emulator window and would appear in the video. In this mode
the emulator overlay is **not shown**; instead the menu label ("Stop IDE + Emulator recording") and a
window-title suffix (" — ● REC") on both windows indicate recording. The title is outside the
captured page content, so it never appears in the video.

---

## 5. State, menu and commands

### 5.1 State (`AppState.emulatorState`)

| Field | Type | Default | Persisted |
| --- | --- | --- | --- |
| `windowRecordingState` | `"idle" \| "recording"` | `"idle"` | no |
| `windowRecordingFile` | `string` | — | no |
| `windowRecordingIdePosition` | `IdePosition` | `"left"` | yes (app settings) |
| `windowRecordingPointer` | `boolean` | `true` | yes |
| `windowRecordingHiDpi` | `boolean` | `false` | yes |
| `windowRecordingClicks` | `boolean` | `true` | yes |

Actions + reducer cases next to the existing screen-recording ones; persistence through the same app
settings path the other persisted emulator preferences use.

### 5.2 Menu (Machine → Recording)

```
Recording ▸
  Half fps                         (existing)
  ─ Quality: Lossless / High / Good (existing)
  ─ Format: MP4 / WebM / MKV        (existing)
  ─ Start recording / Stop recording           (existing, emulator only)
    Pause recording / Continue recording        (existing)
  ─────────────
  Start IDE + Emulator recording   Ctrl+Shift+F7   (toggles to "Stop …")
  IDE position ▸  ◉ Left  ○ Right  ○ Top  ○ Bottom
  ☑ Include pointer
  ☑ Show mouse clicks              (enabled only when Include pointer is on)
  ☐ Full resolution (HiDPI)
```

Enablement:

- Start IDE + Emulator: enabled when `windowRecordingState === "idle"`, emulator recording is idle,
  and `isIdeWindowVisible()`; "Stop" is always enabled while recording.
- IDE position / Include pointer / Show mouse clicks / HiDPI: enabled only while idle;
  Show mouse clicks additionally requires Include pointer.
- Existing fps/quality/format items: also disabled while a window recording is active.
- Existing emulator Start: disabled while a window recording is active.

The new items are main-process actions (no `issueRecordingCommand` round trip for video); only the
audio on/off goes to the emulator renderer.

### 5.3 Shortcut

- `src/common/utils/recordingShortcuts.ts`: `SHORTCUT_RECORD_IDE_EMU = "shortcuts.recordIdeEmu"`,
  default `"Ctrl+Shift+F7"` on all platforms, read with the same trimmed fallback as
  `readNavigationShortcuts`.
- Before settling the default, verify it is free: the menu (`app-menu.ts`), machine menus
  (`machine-menus/`), Monaco's key table (`MonacoEditor.tsx` ~100–125 lists `F7`, `Shift+F7`,
  `Ctrl+F7`, `Alt+F7` but not `Ctrl+Shift+F7`) and the key-mapping parser.
- If Monaco consumes the key while the editor has focus, handle it in the IDE renderer first, as
  `useNavigationShortcuts` does for Back/Forward, and call the same main-process command.

### 5.4 After stopping

Same behaviour as the emulator recording: the file goes to `resolveRecordingPath(...)` with the
format's extension; failures surface the backend's message (issue #1374 behaviour) instead of
returning a path to a file that was never written.

---

## 6. Phases

Each phase ends with its tests green, `npm run build:check`, and `npm run lint:renderer` when
renderer code changed.

1. **Pure core.** `layout.ts`, `AudioPadder.ts`, `pointer.ts`, `FrameComposer.ts`, the shared
   `recordingCrf.ts`. Unit tests: all four positions, unequal sizes, odd sizes → even, centring,
   resized source scaled into its slot, pointer clipping at slot edges, padder (silence when nothing
   arrives, no padding when on time, dropping when ahead). `ClickTracker`: held state while down,
   ripple timing and fade, a down+up between two frames still shown once (latch), per-button colour,
   cleared on blur / leave timeout; ring drawn under the arrow and clipped at slot edges.
2. **Backend changes.** `pixelFormat` option, `appendFrame` return value / `onceDrained`. Extend
   `test/recording/FfmpegRecordingBackend.test.ts` (argument building for `bgra`, backpressure flag).
3. **Session.** `WindowFrameSource`, `FramePump`, `WindowRecordingSession` with injected clock,
   `webContents` and backend fakes. Tests: waits for both first frames (and the 1 s fallback),
   repeats the last frame, drops under backpressure and keeps the timeline length, stops on window
   destroy, restores background throttling. **Spike:** log real `input-event` mouse events on all
   three platforms to confirm `button` is present; switch to the renderer fallback (§4.4.1) if not.
   Session test: `input-event` listeners are added only with *Show mouse clicks* on and removed on stop.
4. **State + menu + shortcut.** Actions/reducer/persistence, the menu items and enablement rules,
   `shortcuts.recordIdeEmu`, mutual exclusion with the emulator recording, window-title indicator.
   Menu tests in `test/main/` (model them on `z88-lcd-menu.test.ts` / `zx-next-mouse-menu.test.ts`).
5. **Audio wiring.** `appendWindowRecordingAudio` IPC, `RecordingManager` forwarding flag, the
   `window-recording-on/off` commands (returning the sample rate). Extend
   `test/recording/RecordingManager.test.ts`.
6. **In-app verification.** Run the app; record each position, with and without pointer, 1× and
   HiDPI, each format; with and without mouse clicks (quick clicks, held drags, right-clicks, clicks
   with the emulator's mouse captured); pause the emulator mid-recording (audio becomes silence, video continues);
   cover a window with another app; resize a window mid-recording; hide the IDE mid-recording.
   Check results with `ffprobe` (size, fps, duration of audio ≈ video). A scripted smoke run can use
   the `scripts/doc-shots/` Playwright Electron driver (see `.ai/doc-screenshots-guide.md`).
7. **Docs.** Extend `docs/content/howto/screen-recording.mdx` with a section on this mode;
   `npm run doc:build && npm run doc:check`.

---

## 7. Risks and open questions

| Risk | Mitigation / question |
| --- | --- |
| Covered windows stop painting on some platforms even with throttling off | Accept a frozen last frame; document it. Revisit with `desktopCapturer` only if this proves common. |
| Encoding cost of large frames (e.g. lossless HiDPI) cannot keep up in real time | Backpressure dropping (§4.2) keeps memory and length right; the HiDPI option is off by default. Consider forcing `ultrafast` preset for this mode at any quality. |
| `beginFrameSubscription` frame format / scale differences between macOS, Windows, Linux | Phase 6 must be run on all three; the source normalises size from `getContentBounds()` × scale, not from the image alone. |
| Pointer shape is generic, not the OS cursor | Accepted (D4). |
| `input-event` may not carry the mouse button on every platform | Phase 3 spike; renderer-listener fallback (§4.4.1). |
| A missed `mouseUp` (released outside Klive, focus lost) leaves the ring on | Cleared on blur and after the pointer has been outside both windows for 1 s (§4.4.1). |
| Emulator audio sample rate changes mid-recording (machine switch) | Machine switch while recording: stop the recording (same as the emulator recording does on machine stop). |
| Default shortcut collides with a user key mapping or Monaco | Verified in phase 4; the setting overrides it. |

---

## 8. Implementation notes (where the build differs from the plan, and why)

Code: `src/main/recording/window-recording/` (`layout`, `AudioPadder`, `ClickTracker`, `pointer`,
`FrameComposer`, `WindowFrameSource`, `WindowRecordingSession`, `themeColors`,
`windowRecordingMenu`, `windowRecordingController`), `src/common/utils/recordingCrf.ts`,
`src/common/utils/recordingShortcuts.ts`. Tests: `test/recording/window-recording/`,
`test/main/window-recording-menu.test.ts`, additions to the backend and `RecordingManager` tests.

- **Audio forwarding (§4.5)** uses a store flag, not `issueRecordingCommand("window-recording-on/off")`:
  the emulator renderer's `RecordingManager` takes an `isWindowRecording()` getter that reads
  `emulatorState.windowRecordingState`, and the sample rate comes from `emulatorState.audioSampleRate`.
  No round trip is needed.
- **Background throttling (§4.1)** was already off on both windows (`backgroundThrottling: false` in
  `index.ts`), so the session does not toggle it.
- **Colours (§4.3, §4.4.1)** are read with `executeJavaScript` from the IDE page's theme root
  (`--surface-canvas`, `--accent-solid`, `--accent-secondary-solid`).
- **The menu items** are built by `windowRecordingMenu.ts`, so their enablement rules are testable
  without the whole app menu; `app-menu.ts` spreads them into Machine | Recording.
- **Start-up (new).** FFmpeg 4.4 (the bundled `@ffmpeg-installer` build) probed the raw audio input
  before taking a second video frame: with less than 1-3 s of sound written, it never took the second
  frame at all. That stalled the encoder for about a second at the start of every recording (the video
  opened with ~37 repeats of its first frame) and deadlocked a clock that waited for the encoder. Fixes:
  - the backend passes `-probesize 32 -analyzeduration 0` before the audio input (its format is given
    in full) — this also applies to the emulator screen recording;
  - the session writes silence for the priming frames first, then two priming frames, and starts the
    clock only when the encoder has taken the second (`_prime`). Measured: 9 repeats in the first
    second (encoder warm-up) instead of 37, then one frame per tick.
- **Busy loop (new).** While the encoder was backed up, the tick loop ran every ~1 ms; it now keeps the
  plain frame interval while backed up.
- **Spike result (§4.4.1).** On macOS, `input-event` carries `button` (`left` / `right`) for mouse
  events on both windows. The renderer-listener fallback was not needed. Windows and Linux are not yet
  checked.
- **Verified in the app (macOS, 2x display):** all four positions' layout math (left, right, top
  checked as video), 1x and HiDPI (3838x508 and 3840x1898), MP4 and WebM, pointer and click rings
  (left = accent, right = secondary accent), machine pause padded with silence (audio length within
  ~65 ms of the video), window titles marked while recording, the emulator screen recording unchanged.
  Not yet: MKV, Windows/Linux, a window resized or the IDE hidden mid-recording, real (non-CDP) clicks.
- **Seen once, not reproduced:** an FFmpeg `write after end` on stdin when stopping the very first
  recording; none of the later recordings showed it (four of them had every write after `end()`
  instrumented and caught none).

