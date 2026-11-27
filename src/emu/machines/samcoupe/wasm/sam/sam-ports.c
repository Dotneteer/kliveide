/*
 * The SAM Coupé I/O decode (plan §5; ASIC_VIDEO_MEMORY_TIMING.md §6, SOUND_INPUT_IO.md §7). The ASIC
 * decodes A7-A0 = F8h-FFh and uses the high byte as data; the board decodes the disk ports.
 *
 *   F8h  write: CLUT entry A11-A8          read: LPEN (A8 = 0) / HPEN (A8 = 1)
 *   F9h  write: LINE                       read: STATUS, bits 5-7 the keyboard rows A8-A15 select
 *   FAh  LMPR, FBh HMPR, FCh VMPR (read: bit 7 MIDI IN, idle 1)
 *   FDh  write: MIDI OUT                   read: MIDI IN (FFh, nothing attached)
 *   FEh  write: border/MIC/BEEP/THROM/SOFF read: keyboard bits 0-4, SPEN 5, EAR 6, SOFF 7
 *   FFh  write: SAA data (A8 = 0) / address (A8 = 1)   read: ATTR
 *   E0h-E7h / F0h-F7h  drive 1 / drive 2 (sam-fdc.c)
 *   80h / 81h  the external page registers LEPR / HEPR (write only, plan Q8), with external memory fitted
 *
 * Everything else reads the ASIC's current fetch byte in the screen area and FFh elsewhere (SimCoupé's
 * floating-bus rule, plan Q14); writes go nowhere.
 */

/*
 * FEh read bit 5 (SPEN, the light-pen strobe / serial input): idle low, with no light pen fitted (MIST and
 * ZX-Uno read 0, MAME 1). ROM 3.0's copyright bars depend on it: with SPEN low the line-interrupt
 * handler waits on the pen position (port F8h) and writes each colour in the blanking; with it high it
 * writes at once, 16-24 T into the right border (SimCoupé oracle run, 2026-11-24, dev/ai/sam-coupe.md).
 */
#define SAM_SPEN_IDLE 0x00u

/* Defined in sam-tape.c: FEh bit 6 */
static uint8_t samTapeEarBit(void);
static void samTapeMicChanged(uint8_t border);

static uint8_t samCpuReadPort(uint16_t address) {
  const uint8_t port = (uint8_t)address;
  const uint8_t high = (uint8_t)(address >> 8);
  if (port >= 0xe0u && port <= 0xe7u) return samFdcRead(port);
  if (port >= 0xf0u && port <= 0xf7u) return samFdcRead(port);
  switch (port) {
    case 0xf8u:
      return (high & 0x01u) ? samReadHpen() : samReadLpen();
    case 0xf9u: {
      const uint8_t keys = high == 0xffu ? 0u : (uint8_t)(samKeyRowsPressed(high) & 0xe0u);
      return (uint8_t)((~keys & 0xe0u) | samStatusBits());
    }
    case 0xfau:
      return samLmpr;
    case 0xfbu:
      return samHmpr;
    case 0xfcu:
      return (uint8_t)(samVmpr | 0x80u);
    case 0xfdu:
      return 0xffu;
    case 0xfeu: {
      uint8_t low = (uint8_t)(~samKeyRowsPressed(high) & 0x1fu);
      if (high == 0xffu && samMouseFitted) low &= (uint8_t)(0x10u | samMouseRead());
      return (uint8_t)(low | SAM_SPEN_IDLE | samTapeEarBit() | (samScreenOff() ? 0x80u : 0u));
    }
    case 0xffu:
      return samAttrLatch;
    default:
      return samBeamInScreen() ? samFetchByte : 0xffu;
  }
}

static void samCpuWritePort(uint16_t address, uint8_t value) {
  const uint8_t port = (uint8_t)address;
  const uint8_t high = (uint8_t)(address >> 8);
  if (port >= 0xe0u && port <= 0xe7u) {
    samFdcWrite(port, value);
    return;
  }
  if (port >= 0xf0u && port <= 0xf7u) {
    samFdcWrite(port, value);
    return;
  }
  switch (port) {
    case 0x80u:
    case 0x81u:
      if (samExtPages != 0u) {
        if (port == 0x80u) samLepr = value;
        else samHepr = value;
        samRemap();
      }
      break;
    case 0xf8u:
      samClut[high & 0x0fu] = (uint8_t)(value & 0x7fu);
      break;
    case 0xf9u:
      samWriteLine(value);
      break;
    case 0xfau:
      samLmpr = value;
      samRemap();
      break;
    case 0xfbu:
      samHmpr = value;
      samRemap();
      break;
    case 0xfcu: {
      const uint8_t wasOff = samScreenOff();
      samVmpr = value;
      samPensBeforeSoffChange(wasOff);
      break;
    }
    case 0xfdu:
      samWriteMidi(value);
      break;
    case 0xfeu: {
      const uint8_t wasOff = samScreenOff();
      samBeeperWrite(value);
      samTapeMicChanged(value);
      samBorder = value;
      samPensBeforeSoffChange(wasOff);
      break;
    }
    case 0xffu:
      samAudioCatchUp();
      if (high & 0x01u) samSaaWriteAddress(value);
      else samSaaWriteData(value);
      break;
    default:
      break;
  }
}

uint32_t samReadPort(uint32_t address) { return samCpuReadPort((uint16_t)address); }
void samWritePort(uint32_t address, uint32_t value) { samCpuWritePort((uint16_t)address, (uint8_t)value); }
