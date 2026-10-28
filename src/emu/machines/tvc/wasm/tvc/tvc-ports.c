/*
 * The TVC I/O ports (rtvc/info/tvc.md "I/O Map"; HW pp.125-130). Only A0-A7 are decoded.
 *
 *   00 write  border colour (I/G/R/B in bits 7/5/3/1)
 *   02 write  the main paging register (tvc-memory.c)
 *   03 write  bits 3-0 the keyboard row, bits 7-6 the card shown in the EXT window
 *   04 write  sound divider bits 7-0; 05 write: divider bits 11-8, sound and timer IT enables, the
 *             cassette motors (tvc-audio.c, tvc-tape.c)
 *   06 write  bits 1-0 the video mode; bits 5-2 the sound amplitude; bit 7 the printer strobe
 *   07 write  any value clears the shared cursor/sound interrupt flip-flop
 *   0C-0F     the 64K+ video paging register (mirrors)
 *   10-4F     the four expansion slots' 16 ports each: the HBF card at 10-1F (tvc-hbf.c), else FFh
 *   50-57     any access toggles the cassette output
 *   58 read   the selected keyboard row (active low)
 *   59, 5D    status: bit 7 printer ACK, bit 6 colour monitor, bit 5 cassette in, bit 4 the shared
 *             interrupt (0 = pending), bits 3-0 the expansion slots' interrupts (1 = none)
 *   5A, 5E    the cards' type codes, two bits a slot: 3 (11b) is an empty slot, 2 the HBF card
 *   5B, 5F    a read restarts the sound divider and its counter (tvc-audio.c)
 *   60-63     the palette registers 0-3 (I/G/R/B in bits 6/4/2/0)
 *   70-7F     the CRTC: A0 selects the address (even) or the data (odd) register
 *
 * Every other read is FFh.
 */

/* The port registers tvcPort03-06 are in tvc.c: the sound and the tape read them too */
/* The cassette output flip-flop (toggled by any access to 50h-57h) */
static uint8_t tvcCassetteOut;
/* Port 59h bit 6: a colour monitor (the ROM picks its default palette by it) */
static uint8_t tvcColorMonitor = 1u;

static void tvcResetPorts(void) {
  tvcPort03 = 0u;
  tvcPort04 = 0u;
  tvcPort05 = 0u;
  tvcPort06 = 0u;
  tvcCassetteOut = 0u;
}

static uint8_t tvcCpuReadPort(uint16_t address) {
  const uint8_t port = (uint8_t)address;
  if (port >= 0x70u) return tvcCrtcReadPort(port);
  if (port >= 0x10u && port <= 0x1fu && tvcHbfPresent) return tvcHbfReadPort(port);
  if (port >= 0x50u && port <= 0x57u) {
    tvcCassetteOut ^= 1u;
    tvcTapeOutputToggle();
    return 0xffu;
  }
  switch (port) {
    case 0x58u:
      return tvcReadKeyboard();
    case 0x59u:
    case 0x5du:
      return (uint8_t)(0x80u | (tvcColorMonitor ? 0x40u : 0u) | (tvcTapeInput() ? 0x20u : 0u) |
                       (tvcItPending ? 0u : 0x10u) | 0x0fu);
    case 0x5au:
    case 0x5eu:
      // --- Two bits a slot, 3 empty: the HBF card in slot 0 is type 2
      return tvcHbfPresent ? (uint8_t)(0xfcu | TVC_HBF_TYPE) : 0xffu;
    case 0x5bu:
    case 0x5fu:
      tvcSoundRestart();
      return 0xffu;
    default:
      return 0xffu;
  }
}

static void tvcCpuWritePort(uint16_t address, uint8_t value) {
  const uint8_t port = (uint8_t)address;
  if (port >= 0x70u) {
    tvcCrtcWritePort(port, value);
    return;
  }
  if (port >= 0x60u && port <= 0x63u) {
    tvcVideoSetPalette(port & 3u, value);
    return;
  }
  if (port >= 0x10u && port <= 0x1fu) {
    if (tvcHbfPresent) tvcHbfWritePort(port, value);
    return;
  }
  if (port >= 0x50u && port <= 0x57u) {
    tvcCassetteOut ^= 1u;
    tvcTapeOutputToggle();
    return;
  }
  switch (port) {
    case 0x00u:
      tvcVideoSetBorder(value);
      break;
    case 0x02u:
      tvcPort02 = value;
      tvcRemap();
      break;
    case 0x03u:
      tvcPort03 = value;
      tvcKeyboardRow = value & 0x0fu;
      if ((uint8_t)(value >> 6) != tvcExtCard) {
        tvcExtCard = (uint8_t)(value >> 6);
        tvcRemap();
      }
      break;
    case 0x04u:
      tvcAudioBeforeChange();
      tvcPort04 = value;
      tvcSoundSetDivisor();
      break;
    case 0x05u:
      tvcAudioBeforeChange();
      tvcTapeBeforeMotorChange();
      tvcPort05 = value;
      tvcSoundSetDivisor();
      tvcTapeAfterMotorChange();
      break;
    case 0x06u:
      tvcAudioBeforeChange();
      tvcPort06 = value;
      tvcVideoSetMode(value);
      break;
    case 0x07u:
      tvcItPending = 0u;
      cpu.sigInt = 0u;
      break;
    case 0x0cu:
    case 0x0du:
    case 0x0eu:
    case 0x0fu:
      if (tvcIsPlus) {
        tvcPort0c = value;
        tvcRemap();
      }
      break;
    default:
      break;
  }
}

uint32_t tvcReadPort(uint32_t address) { return tvcCpuReadPort((uint16_t)address); }
void tvcWritePort(uint32_t address, uint32_t value) { tvcCpuWritePort((uint16_t)address, (uint8_t)value); }
uint32_t tvcGetPort03(void) { return tvcPort03; }
uint32_t tvcGetPort05(void) { return tvcPort05; }
uint32_t tvcGetPort06(void) { return tvcPort06; }
uint32_t tvcGetCassetteOut(void) { return tvcCassetteOut; }
/* Port 59h bit 6: 1 a colour monitor (the default), 0 a monochrome one (`MC_TVC_COLOUR`) */
void tvcSetColorMonitor(uint32_t color) { tvcColorMonitor = color != 0u; }
