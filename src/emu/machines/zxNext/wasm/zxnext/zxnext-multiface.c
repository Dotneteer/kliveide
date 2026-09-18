#include "zxnext-multiface.h"

/*
 * The Multiface (multiface.vhd, zxnext.vhd ~4270-4300). Mirrors MultifaceDevice.ts in the TypeScript
 * core:
 * - `nmi_active`: the Multiface NMI is being served; set when the NMI state machine takes an MF NMI.
 * - `mf_enable`: MF ROM ($0000-$1FFF) and RAM ($2000-$3FFF) are paged in, above DivMMC and Layer 2.
 * - `invisible`: MF128/+3 hide their ports until an NMI makes them visible.
 * The type (NextReg $0A bits 7-6) picks the enable/disable ports: +3 $3F/$BF, 128 v87.2 $BF/$3F,
 * 128 v87.12 and MF1 $9F/$1F. The device is held in reset while port enable $83 bit 1 is clear.
 */
static uint8_t mfNmiActive;
static uint8_t mfEnabled;
static uint8_t mfInvisible;

static uint32_t zxnextMultifaceDeviceEnabled(void) { return zxnextPortsGroupEnabled(1, 1); }
static uint32_t zxnextMultifaceType(void) { return (zxnextNextRegs[0x0au] >> 6u) & 0x03u; }
static uint32_t zxnextMultifaceMode48(void) { return zxnextMultifaceType() == 3u; }
static uint32_t zxnextMultifaceModeP3(void) { return zxnextMultifaceType() == 0u; }
static uint32_t zxnextMultifaceEnablePort(void) {
  uint32_t t = zxnextMultifaceType();
  return t >= 2u ? 0x9fu : t == 1u ? 0xbfu : 0x3fu;
}
static uint32_t zxnextMultifaceDisablePort(void) {
  uint32_t t = zxnextMultifaceType();
  return t >= 2u ? 0x1fu : t == 1u ? 0x3fu : 0xbfu;
}

static void zxnextMultifaceReset(void) {
  mfNmiActive = 0u;
  mfEnabled = 0u;
  mfInvisible = 1u;
}

static uint32_t zxnextMultifaceIsPaged(void) { return mfEnabled && zxnextMultifaceDeviceEnabled(); }
static uint32_t zxnextMultifaceIsActive(void) {
  return zxnextMultifaceDeviceEnabled() && (mfEnabled || mfNmiActive);
}
static uint32_t zxnextMultifaceNmiHold(void) { return zxnextMultifaceDeviceEnabled() && mfNmiActive; }

static void zxnextMultifacePressNmiButton(void) {
  if (!zxnextMultifaceDeviceEnabled() || mfNmiActive) return;
  mfNmiActive = 1u;
  mfInvisible = 0u;
}

static void zxnextMultifaceOnFetch0066(void) {
  if (zxnextMultifaceDeviceEnabled() && mfNmiActive) mfEnabled = 1u;
}

/* cpu_retn_seen clears nmi_active and mf_enable unconditionally. */
static void zxnextMultifaceRetn(void) {
  mfNmiActive = 0u;
  mfEnabled = 0u;
}

/* mf_port_dat (zxnext.vhd ~4287-4299): the paging registers the MF ROM reads back. */
static uint32_t zxnextMultifacePortData(uint32_t port) {
  if (zxnextMultifaceModeP3()) {
    switch ((port >> 12u) & 0x0fu) {
      case 0x1u: return zxnextMemoryGetPort1ffd();
      case 0x7u: return zxnextMemoryGetPort7ffd();
      case 0xdu: return zxnextMemoryGetPortDffd();
      case 0xeu: return zxnextMemoryGetPortEff7(); /* bits 3-2 */
      default: return borderColor & 0x07u;
    }
  }
  return ((zxnextMemoryGetPort7ffd() >> 3u) & 0x01u) << 7u | 0x7fu;
}

/* Returns the byte and sets *handled when the Multiface drives the bus; otherwise other devices answer. */
static uint32_t zxnextMultifaceReadPort(uint32_t port, uint32_t *handled) {
  uint32_t low = port & 0xffu;
  *handled = 0u;
  if (!zxnextMultifaceDeviceEnabled()) return 0xffu;
  if (low == zxnextMultifaceEnablePort()) {
    uint32_t invisibleEff = mfInvisible && !zxnextMultifaceMode48();
    uint32_t portEn = !invisibleEff && !zxnextMultifaceMode48(); /* mode 128 or +3 */
    mfEnabled = !invisibleEff;
    if (portEn) {
      *handled = 1u;
      return zxnextMultifacePortData(port);
    }
    return 0xffu;
  }
  if (low == zxnextMultifaceDisablePort()) {
    mfEnabled = 0u;
    if (zxnextMultifaceModeP3()) mfNmiActive = 0u;
  }
  return 0xffu;
}

static void zxnextMultifaceWritePort(uint32_t port, uint32_t value) {
  uint32_t low = port & 0xffu;
  (void)value;
  if (!zxnextMultifaceDeviceEnabled()) return;
  if (low == zxnextMultifaceEnablePort()) {
    mfNmiActive = 0u;
    if (zxnextMultifaceModeP3()) mfInvisible = 1u;
  } else if (low == zxnextMultifaceDisablePort()) {
    mfNmiActive = 0u;
    if (!zxnextMultifaceModeP3()) mfInvisible = 1u;
  }
}
