/*
 * The ZX Spectrum cores' frame loop and RZX playback steps (`.plans/WASM_CORE_LEAN_AND_DEBUG_PLAN.md`
 * Phase 2, D8). The 48K (with the Timex), the 128K and the +2E/+3E had the same code under their own
 * names; each now includes this file once, after `zx-spectrum-rzx.c` and its own ULA and frame
 * functions, and before `<prefix>ExecuteInstruction` (which calls the playback step).
 *
 * The core defines:
 *   - `ZXS_FRAME_PREFIX`: its export prefix (`sp48`, `sp128`, `spp3e`); the variables it names are
 *     `<prefix>CaptureBusEvents`, `<prefix>FrameCompleted`, `<prefix>FrameBegun`, `<prefix>Tacts`,
 *     `<prefix>NextFrameStartTact`, `<prefix>TactsInFrame`, `<prefix>Frames`, `<prefix>TactEpoch`,
 *     `<prefix>InterruptsRaised`, `<prefix>InterruptLineActive`, `<prefix>CpuInstructionsExecuted`,
 *     `<prefix>CpuFrameSliceInstructions`, and the function `<prefix>ShiftTactOrigin`;
 *   - `ZXS_BEGIN_FRAME()`: begins a machine frame;
 *   - `ZXS_FRAME_LENGTH`: the current frame's length in T-states (the clock multiplier included);
 *   - `ZXS_RENDER_UNTIL_CURRENT_TACT()`: brings the picture up to the current tact;
 *   - `ZXS_TACT_REBASE_THRESHOLD`: where the tact counter is rebased;
 *   - optionally `ZXS_ON_PLAY_PICTURE()` (more work when a playback picture completes) and
 *     `ZXS_AFTER_PLAY_CYCLE()` (after each playback CPU cycle) - the +3E's FDC and audio.
 * It provides `<prefix>ExecuteFrame`, `<prefix>RzxSetFrameTact` and the static playback step
 * `<prefix>ExecutePlayInstruction`.
 */

#ifndef ZXS_FRAME_PREFIX
#error "Define ZXS_FRAME_PREFIX before including zx-spectrum-frame.c"
#endif
#ifndef ZXS_ON_PLAY_PICTURE
#define ZXS_ON_PLAY_PICTURE() ((void)0)
#endif
#ifndef ZXS_AFTER_PLAY_CYCLE
#define ZXS_AFTER_PLAY_CYCLE() ((void)0)
#endif

#define ZXS_PASTE2(a, b) a##b
#define ZXS_PASTE(a, b) ZXS_PASTE2(a, b)
#define ZXS(name) ZXS_PASTE(ZXS_FRAME_PREFIX, name)

uint32_t ZXS(ExecuteInstruction)(void);

/*
 * A playback frame longer than an EI/retrigger frame ended: the picture is complete, and the next
 * frame starts at this tact, so the interrupt falls on frame tact 0 where the ULA expects it
 * (`.plans/RZX_PLAN.md` trap 5). Frames of 4 fetches or fewer complete no picture (D19).
 */
static void ZXS(CompletePlayPicture)(void) {
  ZXS(FrameCompleted) = 1u;
  ZXS_RENDER_UNTIL_CURRENT_TACT();
  ZXS(NextFrameStartTact) = ZXS(Tacts);
  ZXS(Frames)++;
  ZXS_ON_PLAY_PICTURE();
  if (ZXS(NextFrameStartTact) >= ZXS_TACT_REBASE_THRESHOLD) {
    const uint32_t rebase = ZXS(NextFrameStartTact);
    ZXS(ShiftTactOrigin)(rebase);
    ZXS(TactEpoch) += rebase;
  }
}

/*
 * One playback step (`.plans/RZX_PLAN.md` §4.2): the interrupt comes from the recording, never
 * from the ULA, and a step that reaches the frame's fetch count runs nothing - it ends the frame.
 */
static uint32_t ZXS(ExecutePlayInstruction)(void) {
  const uint32_t step = rzxPlayBeforeStep();
  if (step == RZX_STEP_NONE) return 0u;
  if (step == RZX_STEP_BOUNDARY) {
    if (rzxStatus == RZX_STATUS_FRAME_DONE && rzxPlayTarget > RZX_SHORT_FRAME_FETCHES) {
      ZXS(CompletePlayPicture)();
    }
    return 0u;
  }
  if (ZXS(FrameCompleted) != 0u) {
    ZXS_BEGIN_FRAME();
  }
  if (ZXS(CaptureBusEvents) != 0u) {
    z80ClearBusEvents();
  }
  const uint8_t intActive = step == RZX_STEP_RUN_INT ? 1u : 0u;
  if (intActive != 0u) ZXS(InterruptsRaised)++;
  ZXS(InterruptLineActive) = intActive;
  z80SetSigInt(intActive);
  z80SetTacts(ZXS(Tacts));
  z80ExecuteCpuCycle();
  ZXS(Tacts) = z80GetTacts();
  ZXS_AFTER_PLAY_CYCLE();
  z80SetSigInt(0u);
  ZXS(InterruptLineActive) = 0u;
  ZXS(CpuInstructionsExecuted)++;
  ZXS(CpuFrameSliceInstructions)++;
  return 0u;
}

uint32_t ZXS(ExecuteFrame)(void) {
  if (rzxMode == RZX_MODE_PLAY) {
    /*
     * RZX playback: one call plays the current RZX frame to its end, or to a desync. The frame
     * starts where the previous one stopped, so no new machine frame is begun here; the step that
     * follows a completed picture begins it.
     */
    ZXS(CaptureBusEvents) = 0u;
    z80ClearBusEvents();
    while (rzxStatus == RZX_STATUS_OK) {
      ZXS(ExecutePlayInstruction)();
    }
    ZXS(CaptureBusEvents) = 1u;
    return 0u;
  }

  /* A frame a stop target or the debug loop left mid-way goes on where it stopped */
  if (ZXS(FrameCompleted) != 0u || ZXS(FrameBegun) == 0u) ZXS_BEGIN_FRAME();
  /* A fast frame records no bus activity (the IDE's access log and port event) */
  ZXS(CaptureBusEvents) = 0u;
  z80ClearBusEvents();

  /*
   * The frame's completion ends the loop as well as its end tact: the instruction that reaches the
   * end tact is the one that completes the frame, and a completion that rebases the counter (see
   * `<prefix>ShiftTactOrigin`) moves the counter back below the end tact computed here.
   */
  const uint32_t frameEndTact = ZXS(NextFrameStartTact) + ZXS_FRAME_LENGTH;
  while (ZXS(Tacts) < frameEndTact) {
    ZXS(ExecuteInstruction)();
    /* Checked on the frame's last instruction too: the host reads the reached mark after the call */
    const uint32_t stop = z80HistoryStopNow();
    if (ZXS(FrameCompleted) != 0u) break;
    if (stop != 0u) break;
  }
  ZXS(CaptureBusEvents) = 1u;
  return 0u;
}

/*
 * RZX: puts the machine at `tact` of its frame, from an input block's T-state field
 * (`.plans/RZX_PLAN.md` trap 11). Values past the frame's end are ignored.
 */
void ZXS(RzxSetFrameTact)(uint32_t tact) {
  if (tact >= ZXS(TactsInFrame)) return;
  if (tact > ZXS(Tacts)) {
    ZXS(ShiftTactOrigin)(-(int64_t)(tact - ZXS(Tacts)));
  }
  ZXS(NextFrameStartTact) = ZXS(Tacts) - tact;
}

#undef ZXS
#undef ZXS_PASTE
#undef ZXS_PASTE2
#undef ZXS_FRAME_PREFIX
#undef ZXS_BEGIN_FRAME
#undef ZXS_FRAME_LENGTH
#undef ZXS_RENDER_UNTIL_CURRENT_TACT
#undef ZXS_TACT_REBASE_THRESHOLD
#undef ZXS_ON_PLAY_PICTURE
#undef ZXS_AFTER_PLAY_CYCLE
