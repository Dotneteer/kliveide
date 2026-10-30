/*
 * The Enterprise I/O ports (plan §5; DAVE_MEMORY_IO.md §9). Decoding is 8-bit: every port mirrors
 * across the high byte.
 *
 *   80-8F  NICK: A1-A0 select FIXBIAS, BORDER, LPL, LPH (ep-nick.c); a read returns NICK's last fetch
 *   A0-AF  DAVE's sound registers (write-only; ep-dave.c, ep-audio.c)
 *   B0-B3  the page registers (read/write; ep-memory.c)
 *   B4     interrupt enables and resets / the dividers, inputs and latches (ep-dave.c)
 *   B5     write: bits 3-0 the keyboard row, 4 printer strobe, 5 tape sound off, 6-7 REM1/REM2
 *          read: the selected keyboard row (active low)
 *   B6     write: printer data; read: bits 2-0 the J/K/L control columns (active low), 3 printer
 *          ready (0 = ready), 4-5 serial/net data and status in, 6 the tape level comparator,
 *          7 the tape data comparator (both 1 with no input)
 *   B7     write: serial/net data and status out
 *   BF     write: the system register (ep-dave.c)
 *
 * Reads of write-only and undefined ports return FFh (plan Q12).
 */

/* B5h, B6h (printer data) and B7h as last written */
static uint8_t epPortB5;
static uint8_t epPortB6;
static uint8_t epPortB7;

static void epResetPorts(void) {
  epPortB5 = 0u;
  epPortB6 = 0u;
  epPortB7 = 0u;
  epKeyboardRow = 0u;
}

static uint8_t epCpuReadPort(uint16_t address) {
  const uint8_t port = (uint8_t)address;
  if (port >= 0x80u && port <= 0x8fu) return epNickDataBus;
  switch (port) {
    case 0xb0u:
    case 0xb1u:
    case 0xb2u:
    case 0xb3u:
      return epPageReg[port & 3u];
    case 0xb4u:
      return epDaveReadB4();
    case 0xb5u:
      return epReadKeyboard();
    case 0xb6u:
      // --- No printer (not ready), the serial inputs as ep128emu gives them, no tape signal
      return (uint8_t)(0xc0u | 0x08u | epReadControlColumns());
    default:
      return 0xffu;
  }
}

static void epCpuWritePort(uint16_t address, uint8_t value) {
  const uint8_t port = (uint8_t)address;
  if (port >= 0x80u && port <= 0x8fu) {
    epNickWritePort(port, value);
    return;
  }
  if (port >= 0xa0u && port <= 0xafu) {
    epDaveReg[port & 15u] = value;
    return;
  }
  switch (port) {
    case 0xb0u:
    case 0xb1u:
    case 0xb2u:
    case 0xb3u:
      epPageReg[port & 3u] = value;
      epRemap();
      break;
    case 0xb4u:
      epDaveWriteB4(value);
      break;
    case 0xb5u:
      epPortB5 = value;
      epKeyboardRow = value & 0x0fu;
      break;
    case 0xb6u:
      epPortB6 = value;
      break;
    case 0xb7u:
      epPortB7 = value;
      break;
    case 0xbfu:
      epDaveWriteBf(value);
      break;
    default:
      break;
  }
}

uint32_t epReadPort(uint32_t address) { return epCpuReadPort((uint16_t)address); }
void epWritePort(uint32_t address, uint32_t value) { epCpuWritePort((uint16_t)address, (uint8_t)value); }
uint32_t epGetPortB5(void) { return epPortB5; }
