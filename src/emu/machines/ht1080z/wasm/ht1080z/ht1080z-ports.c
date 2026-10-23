/*
 * The HT-1080Z I/O ports (HARDWARE.md §4; `.plans/HT1080Z_PLAN.md` §8). Only A0-A7 are decoded.
 *
 *   FF write  bits 0-1 cassette out (three levels), bit 2 the relay/motor; clears the cassette-in latch
 *   FF read   bit 7 the cassette-in latch; the other bits read 1 (undocumented)
 *   FE write  bit 4 selects recorder 2 (stored only: one deck is modelled, D8)
 *   FD read   printer status: 30h, the status of no printer attached (MiST's value)
 *   1F write  AY register select; 1E write AY data; 1F read AY data; 1E read open bus (FFh)
 *
 * Every other port reads FFh.
 *
 * The tape (Phase 6) sets the cassette-in latch; port FF's level also drives the beeper
 * (`ht1080z-audio.c`).
 */

/* The last value written to port FF (bits 0-3 are latched on the real machine) */
static uint8_t htPortFf;
/* Port FE bit 4: recorder 2 selected */
static uint8_t htRecorder2;
/* The cassette-in latch: set by a rising edge from the tape, cleared by any write to FF */
static uint8_t htCassetteLatch;

static void htResetPorts(void) {
  htPortFf = 0u;
  htRecorder2 = 0u;
  htCassetteLatch = 0u;
}

static uint8_t htCpuReadPort(uint16_t address) {
  switch ((uint8_t)address) {
    case 0xffu:
      return (uint8_t)((htCassetteLatch ? 0x80u : 0x00u) | 0x7fu);
    case 0xfdu:
      return 0x30u;
    case 0x1fu:
      return htAyDataRead();
    default:
      return 0xffu;
  }
}

static void htCpuWritePort(uint16_t address, uint8_t value) {
  switch ((uint8_t)address) {
    case 0xffu:
      htPortFf = value;
      htCassetteLatch = 0u;
      htBeeperPortWrite(value);
      break;
    case 0x1fu:
      htAyAddressWrite(value);
      break;
    case 0x1eu:
      htAyDataWrite(value);
      break;
    case 0xfeu:
      htRecorder2 = (value & 0x10u) ? 1u : 0u;
      break;
    default:
      break;
  }
}

uint32_t ht1080zReadPort(uint32_t address) { return htCpuReadPort((uint16_t)address); }
void ht1080zWritePort(uint32_t address, uint32_t value) { htCpuWritePort((uint16_t)address, (uint8_t)value); }
uint32_t ht1080zGetPortFf(void) { return htPortFf; }
uint32_t ht1080zGetRecorder2(void) { return htRecorder2; }
uint32_t ht1080zGetCassetteLatch(void) { return htCassetteLatch; }
/* The tape's hook until Phase 6 (and the probes'): a rising edge on the cassette input */
void ht1080zSetCassetteLatch(void) { htCassetteLatch = 1u; }
