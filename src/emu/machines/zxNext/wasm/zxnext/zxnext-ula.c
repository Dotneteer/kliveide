#include "zxnext.h"

static void resetUlaState(void) {
  ulaBorderColor = 7u;
  ulaEarBit = 0u;
  ulaMicBit = 0u;
  ulaBeeperEar = 0u;
  ulaBeeperMic = 0u;
  ulaBit4ChangedFrom0Tacts = 0u;
  ulaBit4ChangedFrom1Tacts = 0u;
}

uint32_t zxnextReadUlaPort(uint32_t address) {
  uint32_t value = readKeyboardRows(address) & 0xbfu;
  uint32_t bit4Sensed = ulaEarBit;
  if (bit4Sensed == 0u && ulaBit4ChangedFrom1Tacts > ulaBit4ChangedFrom0Tacts) {
    uint32_t chargeTime = ulaBit4ChangedFrom1Tacts - ulaBit4ChangedFrom0Tacts;
    chargeTime = chargeTime > 700u ? 2800u : 4u * chargeTime;
    bit4Sensed = (tacts - ulaBit4ChangedFrom1Tacts) < chargeTime;
  }
  const uint32_t issue2Keyboard = nextRegs[0x08] & 0x01u;
  if (bit4Sensed != 0u || (ulaMicBit != 0u && issue2Keyboard != 0u)) {
    value |= 0x40u;
  }
  return value & 0xffu;
}

void zxnextWriteUlaPort(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  ulaBorderColor = byteValue & 0x07u;
  ulaMicBit = (byteValue & 0x08u) != 0u;
  const uint8_t newEarBit = (byteValue & 0x10u) != 0u;
  if (ulaEarBit != 0u) {
    if (newEarBit == 0u) {
      ulaBit4ChangedFrom1Tacts = tacts;
      ulaEarBit = 0u;
    }
  } else if (newEarBit != 0u) {
    ulaBit4ChangedFrom0Tacts = tacts;
    ulaEarBit = 1u;
  }
  ulaBeeperEar = ulaEarBit;
  ulaBeeperMic = ulaMicBit;
}

uint32_t zxnextGetUlaBorderColor(void) { return ulaBorderColor; }
uint32_t zxnextGetUlaEarBit(void) { return ulaEarBit; }
uint32_t zxnextGetUlaMicBit(void) { return ulaMicBit; }
uint32_t zxnextGetUlaBeeperEar(void) { return ulaBeeperEar; }
uint32_t zxnextGetUlaBeeperMic(void) { return ulaBeeperMic; }
uint32_t zxnextGetUlaBit4ChangedFrom0Tacts(void) { return ulaBit4ChangedFrom0Tacts; }
uint32_t zxnextGetUlaBit4ChangedFrom1Tacts(void) { return ulaBit4ChangedFrom1Tacts; }
