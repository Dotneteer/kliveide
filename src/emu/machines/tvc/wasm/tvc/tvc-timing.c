/*
 * The CPU's memory-cycle timing: the clock stretch on video RAM and the WAIT circuit
 * (TVC_CLOCK_STRETCH_FIGURES.md; HW pp.53-55, pp.95-96; plan §6).
 *
 * The CPU and the CRTC share the video RAM in turns: every 640 ns character starts with a 320 ns CPU
 * slot (DEB high) and ends with a 320 ns CRTC slot. A CPU access to video RAM must line up with a CPU
 * slot, so the stretch circuit stops the CPU clock for 1-4 half-T-states. How long depends on where
 * the access's T1 starts in the character (p, in half-T units from the start of the CPU slot) and on
 * whether it is a read/write or an opcode fetch (M1), whose clock is held half a clock earlier:
 *
 *   p                        0  1  2  3
 *   read/write stretch       2  1  4  3
 *   opcode fetch stretch     3  2  1  4
 *
 * The stretch runs on the fixed clock: the video and sound see the time pass, the CPU's T-state
 * counter only the whole T-states (the half-T phase is `tvcHalfClock`'s lowest bit). The stretch
 * has no input from display enable, sync or blanking, so a video RAM access costs the same wherever
 * the beam is. I/O cycles, interrupt acknowledges and refresh cycles do not stretch (plan Q3).
 *
 * WAIT (64K only; the 64K+ board has no WAIT circuit, HW p.95): one wait state on an M1 from a slow
 * source. The cartridge is taken as slow; the system ROM is not (plan Q4: the factory setting of
 * jumpers TB1/TB9 is open); no expansion card is plugged in.
 *
 * The DEB phase after reset (plan Q7): a character starts at half-T 0.
 */

static const uint8_t tvcStretchReadWrite[4] = {2u, 1u, 4u, 3u};
static const uint8_t tvcStretchOpcode[4] = {3u, 2u, 1u, 4u};

/* Lets `halves` half-T units pass with the CPU clock stopped: whole T-states, plus the half-T phase */
static void tvcStretch(uint32_t halves) {
  const uint32_t whole = (halves + (tvcHalfClock & 1u)) >> 1;
  /* The odd half first (it may be -1, when the phase was already odd); the whole tacts after it */
  tvcHalfClock += halves - (whole << 1);
  if (whole != 0u) {
    tactPlusN(whole);
  } else {
    tvcRunVideoToNow();
  }
}

static void TVC_NOINLINE tvcDelayMemory(uint16_t address, uint32_t m1) {
  const uint32_t slot = address >> 12;
  if (tvcVramSlots & (1u << slot)) {
    /* Where T1 starts in the character: the current character began 4 half-T before the next one */
    const uint32_t phase = (tvcHalfClock - (tvcNextCharHalf - TVC_CHAR_HALVES)) & 3u;
    tactPlusN(3u);
    tvcStretch(m1 ? tvcStretchOpcode[phase] : tvcStretchReadWrite[phase]);
    return;
  }
  tactPlusN(3u);
  if (m1 && (tvcSlowSlots & (1u << slot))) tactPlusN(1u);
}
