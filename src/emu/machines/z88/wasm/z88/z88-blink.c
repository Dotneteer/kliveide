/*
 * Cambridge Z88 - the Blink: segment registers, COM, the interrupt registers, the real-time clock,
 * the LCD registers and the I/O port decoding.
 *
 * A port of `Z88BlinkDevice.ts` and of `Z88Machine.doReadPort` / `doWritePort` (Step 6 of
 * `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`). The TypeScript behaviour is the contract, quirks
 * included, and every quirk is named where it is kept:
 *
 * - F1: the interrupt line is `INT.GINT && (INT & STA)`, which pairs bits that do not correspond
 *   (STA.TIME meets INT.GINT, STA.FLAPOPEN meets INT.KWAIT).
 * - The reset re-pages SR0-SR3 with the COM value from *before* the reset, then clears COM without
 *   re-paging; and it tests the interrupt line against the old STA before clearing STA, so the line
 *   can stay active after a reset until STA or INT is written.
 * - A snoozing keyboard read answers $FF at once (the hardware holds the read).
 */

#define Z88_COM_LCDON 0x01u
#define Z88_COM_RESTIM 0x10u
#define Z88_COM_SBIT 0x40u
#define Z88_COM_SRUN 0x80u

#define Z88_INT_GINT 0x01u
#define Z88_INT_TIME 0x02u
#define Z88_INT_FLAP 0x20u
#define Z88_INT_KWAIT 0x80u

#define Z88_STA_TIME 0x01u
#define Z88_STA_BTL 0x08u
#define Z88_STA_FLAP 0x20u
#define Z88_STA_FLAPOPEN 0x80u

#define Z88_TSTA_TICK 0x01u
#define Z88_TSTA_SEC 0x02u
#define Z88_TSTA_MIN 0x04u

static uint8_t z88Sr[4];
static uint8_t z88Tim[5];
static uint8_t z88Tsta;
static uint8_t z88Tmk;
static uint8_t z88Int;
static uint8_t z88Sta;
static uint8_t z88Epr;
static uint8_t z88InterruptSignal;

/* The LCD registers: 16-bit, the port's high byte (B) supplies the high byte */
static uint16_t z88Pb[4];
static uint16_t z88Sbr;

/* The speaker's direct level: COM.SBIT, latched while COM.SRUN is clear. A reset keeps it. */
static uint8_t z88EarBit;

// -----------------------------------------------------------------------------
// Keyboard matrix (the key changes, the key interrupt and sleep are in z88-keyboard.c)
// -----------------------------------------------------------------------------

/* The KBD value for a row selection: the rows whose address line (A8-A15) is low, active low */
static uint8_t z88KeyLineStatus(uint8_t selection) {
  uint8_t status = 0u;
  uint8_t line = (uint8_t)(selection ^ 0xffu);
  for (uint32_t i = 0u; i < Z88_KEYBOARD_LINES; i++) {
    if (line & 0x01u) status |= z88KeyboardLines[i];
    line >>= 1;
  }
  return (uint8_t)(status ^ 0xffu);
}

// -----------------------------------------------------------------------------
// Registers
// -----------------------------------------------------------------------------

/* F1 (kept for parity): see the file header */
static void z88CheckMaskableInterrupt(void) {
  z88InterruptSignal = (z88Int & Z88_INT_GINT) && (z88Int & z88Sta) ? 1u : 0u;
}

static void z88BlinkSetSta(uint8_t value) {
  z88Sta = value;
  z88CheckMaskableInterrupt();
}

static void z88BlinkSetInt(uint8_t value) {
  z88Int = value;
  z88CheckMaskableInterrupt();
}

static void z88BlinkSetSr0(uint8_t bank) {
  z88Sr[0] = bank;
  z88SetMemoryPageInfo(0u, (z88Com & Z88_COM_RAMS) ? 0x20u : 0x00u, 0u);
  z88SetMemoryPageInfo(0u, bank, 1u);
}

static void z88BlinkSetSr(uint32_t index, uint8_t bank) {
  if (index == 0u) {
    z88BlinkSetSr0(bank);
    return;
  }
  z88Sr[index] = bank;
  z88SetMemoryPageInfo(index, bank, 0u);
}

static void z88BlinkResetRtc(void) {
  for (uint32_t i = 0u; i < 5u; i++) z88Tim[i] = 0u;
  z88Tsta = 0u;
  z88Tmk = Z88_TSTA_TICK;
}

static void z88BlinkSetCom(uint8_t value) {
  z88Com = value;
  if (value & Z88_COM_RESTIM) {
    z88BlinkResetRtc();
  }
  if (!(value & Z88_COM_SRUN)) {
    z88EarBit = (value & Z88_COM_SBIT) ? 1u : 0u;
  }
  /* COM.RAMS may have changed */
  z88BlinkSetSr0(z88Sr[0]);
}

static void z88BlinkSetTack(uint8_t value) {
  if (value & Z88_TSTA_TICK) z88Tsta &= 0xfeu;
  if (value & Z88_TSTA_SEC) z88Tsta &= 0xfdu;
  if (value & Z88_TSTA_MIN) z88Tsta &= 0xfbu;
  if (!z88Tsta) {
    z88BlinkSetSta(z88Sta & 0xfeu);
  }
}

static void z88BlinkSetAck(uint8_t value) {
  z88BlinkSetSta(z88Sta & (uint8_t)(value ^ 0xffu));
}

/* The reset order of `Z88BlinkDevice.reset()`, quirks included (see the file header) */
static void z88BlinkReset(void) {
  for (uint32_t i = 0u; i < 4u; i++) z88BlinkSetSr(i, 0u);
  z88BlinkResetRtc();
  z88BlinkSetAck(0u);
  z88Com = 0u;
  z88Epr = 0u;
  z88BlinkSetInt(Z88_INT_FLAP | Z88_INT_TIME | Z88_INT_GINT);
  z88Sta = 0u;
  z88Tsta = 0u;
}

// -----------------------------------------------------------------------------
// The real-time clock: one 5 ms tick per machine frame (`incrementRtc`)
// -----------------------------------------------------------------------------

static void z88BlinkIncrementRtc(void) {
  uint8_t tickEvent = 0u;

  if (z88Com & Z88_COM_RESTIM) {
    z88BlinkResetRtc();
    return;
  }

  z88Tim[0]++;
  if (z88Tim[0] > 199u) {
    z88Tim[0] = 0u;
  } else {
    if (z88Tim[0] & 0x01u) {
      /* A 10 ms TICK event (every second 5 ms count) */
      tickEvent = Z88_TSTA_TICK;
    }
    if (z88Tim[0] == 0x80u) {
      /* When TIM0 reaches $80, a second has passed */
      z88Tim[1]++;
      tickEvent = Z88_TSTA_SEC;
      if (z88Tim[1] > 59u) {
        z88Tim[1] = 0u;
        z88Tim[2]++;
        if (z88Tim[2] == 0u) {
          /* TIM2 wrapped after 255 */
          z88Tim[3]++;
          if (z88Tim[3] == 0u) {
            z88Tim[4]++;
            if (z88Tim[4] > 31u) z88Tim[4] = 0u;
          }
        }
      }
      if (z88Tim[1] == 32u) {
        tickEvent = Z88_TSTA_MIN;
      }
    }
  }

  if (!(z88Int & Z88_INT_GINT)) {
    /* No interrupts get out of the Blink */
    return;
  }

  if (z88Sta & Z88_STA_FLAPOPEN) {
    /* Flap open: no STA.TIME; the CPU is woken every third tick (OZvm's trick) */
    z88BlinkSetSta(z88Sta & 0xfeu);
    if (z88Tim[0] % 3u == 0u) {
      z80AwakeCpu();
    }
    return;
  }

  if (!(z88Int & Z88_INT_TIME)) {
    z88BlinkSetSta(z88Sta & 0xfeu);
    return;
  }

  if (!z88Tmk) {
    z88BlinkSetSta(z88Sta & 0xfeu);
    return;
  }

  if (tickEvent) {
    z88Tsta = tickEvent;
    if (z88Tmk & tickEvent) {
      z88BlinkSetSta(z88Sta | Z88_STA_TIME);
      z80AwakeCpu();
    }
  }
}

// -----------------------------------------------------------------------------
// Ports
// -----------------------------------------------------------------------------

static uint32_t z88BlinkReadPort(uint32_t address) {
  switch (address & 0xffu) {
    case 0xb0u:
      /* MID: $80 = ZVM */
      return 0x80u;
    case 0xb1u:
      return z88Sta;
    case 0xb2u:
      if ((z88Int & Z88_INT_KWAIT) && !z88KeyPressed) {
        z80SnoozeCpu();
        return 0xffu;
      }
      return z88KeyLineStatus((uint8_t)(address >> 8));
    case 0xb5u:
      return z88Tsta;
    case 0xd0u:
    case 0xd1u:
    case 0xd2u:
    case 0xd3u:
    case 0xd4u:
      return z88Tim[(address & 0xffu) - 0xd0u];
    case 0x70u:
      return z88Scw;
    case 0x71u:
      return z88Sch;
    case 0xe0u:
    case 0xe1u:
      /* RxD, RxE: the UART is not emulated */
      return 0x00u;
    case 0xe5u:
      /* UIT: always ready to receive */
      return 0x10u;
    default:
      return 0xffu;
  }
}

static void z88BlinkWritePort(uint32_t address, uint32_t value) {
  const uint32_t port = address & 0xffu;
  const uint8_t byte = (uint8_t)value;
  if (port < 0x70u) return;
  if (port <= 0x74u) {
    const uint16_t word = (uint16_t)((address & 0xff00u) | byte);
    if (port == 0x74u) {
      z88Sbr = word;
    } else {
      z88Pb[port - 0x70u] = word;
    }
    return;
  }
  switch (port) {
    case 0xd0u:
    case 0xd1u:
    case 0xd2u:
    case 0xd3u:
      z88BlinkSetSr(port - 0xd0u, byte);
      return;
    case 0xb0u:
      z88BlinkSetCom(byte);
      return;
    case 0xb1u:
      z88BlinkSetInt(byte);
      return;
    case 0xb3u:
      z88Epr = byte;
      return;
    case 0xb4u:
      z88BlinkSetTack(byte);
      return;
    case 0xb5u:
      z88Tmk = byte;
      return;
    case 0xb6u:
      z88BlinkSetAck(byte);
      return;
    default:
      /* The UART ($E2-$E6) is not emulated */
      return;
  }
}

// -----------------------------------------------------------------------------
// Flap and battery (`Z88Machine.signalFlapOpened/Closed`, `raiseBatteryLow`)
// -----------------------------------------------------------------------------

void z88SignalFlapOpened(void) {
  if ((z88Int & Z88_INT_FLAP) && (z88Int & Z88_INT_GINT)) {
    z88BlinkSetSta(z88Sta | Z88_STA_FLAP);
    z80AwakeCpu();
    z88BlinkSetSta(z88Sta | Z88_STA_FLAPOPEN);
  }
}

void z88SignalFlapClosed(void) {
  z88BlinkSetAck(Z88_STA_FLAPOPEN);
  z80AwakeCpu();
}

void z88RaiseBatteryLow(void) {
  z88BlinkSetSta(z88Sta | Z88_STA_BTL);
}

// -----------------------------------------------------------------------------
// Exports: ports and registers
// -----------------------------------------------------------------------------

uint32_t z88ReadPort(uint32_t address) { return z88BlinkReadPort(address & 0xffffu); }
void z88WritePort(uint32_t address, uint32_t value) { z88BlinkWritePort(address & 0xffffu, value); }

uint32_t z88GetSr(uint32_t index) { return z88Sr[index & 3u]; }
void z88SetSr(uint32_t index, uint32_t bank) { z88BlinkSetSr(index & 3u, (uint8_t)bank); }
uint32_t z88GetTim(uint32_t index) { return index < 5u ? z88Tim[index] : 0u; }
uint32_t z88GetTsta(void) { return z88Tsta; }
uint32_t z88GetTmk(void) { return z88Tmk; }
void z88SetTmk(uint32_t value) { z88Tmk = (uint8_t)value; }
uint32_t z88GetInt(void) { return z88Int; }
void z88SetInt(uint32_t value) { z88BlinkSetInt((uint8_t)value); }
uint32_t z88GetSta(void) { return z88Sta; }
void z88SetSta(uint32_t value) { z88BlinkSetSta((uint8_t)value); }
uint32_t z88GetCom(void) { return z88Com; }
void z88SetCom(uint32_t value) { z88BlinkSetCom((uint8_t)value); }
uint32_t z88GetEpr(void) { return z88Epr; }
void z88SetEpr(uint32_t value) { z88Epr = (uint8_t)value; }
void z88SetTack(uint32_t value) { z88BlinkSetTack((uint8_t)value); }
void z88SetAck(uint32_t value) { z88BlinkSetAck((uint8_t)value); }
uint32_t z88GetInterruptSignal(void) { return z88InterruptSignal; }
uint32_t z88GetPb(uint32_t index) { return z88Pb[index & 3u]; }
uint32_t z88GetSbr(void) { return z88Sbr; }
uint32_t z88GetEarBit(void) { return z88EarBit; }

/* The RTC's test hooks (`IZ88BlinkTestDevice`) */
void z88TestResetRtc(void) { z88BlinkResetRtc(); }
void z88TestIncrementRtc(void) { z88BlinkIncrementRtc(); }
