#include "zxnext-floppy.h"

static uint8_t zxnextFloppyMsr;
static uint8_t zxnextFloppySr0;
static uint8_t zxnextFloppySr1;
static uint8_t zxnextFloppySr2;
static uint8_t zxnextFloppySr3;
static uint8_t zxnextFloppyOperationPhase;
static uint8_t zxnextFloppyCommandRegister;
static uint8_t zxnextFloppyCommandBytesReceived;
static uint8_t zxnextFloppyResultBytes[8];
static uint8_t zxnextFloppyResultLength;
static uint8_t zxnextFloppyResultIndex;
static uint8_t zxnextFloppyStepRate;
static uint8_t zxnextFloppyHeadUnloadTime;
static uint8_t zxnextFloppyHeadLoadTime;
static uint8_t zxnextFloppyNonDmaMode;

void zxnextFloppyReset(void) {
  zxnextFloppyMsr = 0x80u;
  zxnextFloppySr0 = 0;
  zxnextFloppySr1 = 0;
  zxnextFloppySr2 = 0;
  zxnextFloppySr3 = 0;
  zxnextFloppyOperationPhase = 0;
  zxnextFloppyCommandRegister = 0;
  zxnextFloppyCommandBytesReceived = 0;
  zxnextFloppyResultLength = 0;
  zxnextFloppyResultIndex = 0;
  zxnextFloppyStepRate = 16;
  zxnextFloppyHeadUnloadTime = 240;
  zxnextFloppyHeadLoadTime = 254;
  zxnextFloppyNonDmaMode = 1;
}

uint32_t zxnextFloppyReadMainStatusRegister(void) { return zxnextFloppyMsr; }

uint32_t zxnextFloppyReadDataRegister(void) {
  if (zxnextFloppyOperationPhase != 2 || zxnextFloppyResultIndex >= zxnextFloppyResultLength) return 0xffu;
  uint8_t value = zxnextFloppyResultBytes[zxnextFloppyResultIndex++];
  if (zxnextFloppyResultIndex >= zxnextFloppyResultLength) {
    zxnextFloppyOperationPhase = 0;
    zxnextFloppyMsr = 0x80u;
    zxnextFloppyResultIndex = 0;
    zxnextFloppyResultLength = 0;
  }
  return value;
}

void zxnextFloppyWriteDataRegister(uint32_t value) {
  uint8_t byteValue = value & 0xffu;
  if ((zxnextFloppyMsr & 0xc0u) != 0x80u) return;
  zxnextFloppyCommandRegister = byteValue;
  zxnextFloppyCommandBytesReceived = 1;
  zxnextFloppyMsr = 0x90u;
  if ((byteValue & 0x1fu) == 0x08u) {
    zxnextFloppyOperationPhase = 2;
    zxnextFloppyResultBytes[0] = 0x80u;
    zxnextFloppyResultLength = 1;
    zxnextFloppyResultIndex = 0;
    zxnextFloppyMsr = 0xd0u;
  }
}

uint32_t zxnextGetFloppyOperationPhase(void) { return zxnextFloppyOperationPhase; }
uint32_t zxnextGetFloppyCommandRegister(void) { return zxnextFloppyCommandRegister; }
uint32_t zxnextGetFloppyCommandBytesReceived(void) { return zxnextFloppyCommandBytesReceived; }
uint32_t zxnextGetFloppySr0(void) { return zxnextFloppySr0; }
uint32_t zxnextGetFloppySr1(void) { return zxnextFloppySr1; }
uint32_t zxnextGetFloppySr2(void) { return zxnextFloppySr2; }
uint32_t zxnextGetFloppySr3(void) { return zxnextFloppySr3; }
uint32_t zxnextGetFloppyStepRate(void) { return zxnextFloppyStepRate; }
uint32_t zxnextGetFloppyHeadUnloadTime(void) { return zxnextFloppyHeadUnloadTime; }
uint32_t zxnextGetFloppyHeadLoadTime(void) { return zxnextFloppyHeadLoadTime; }
uint32_t zxnextGetFloppyNonDmaMode(void) { return zxnextFloppyNonDmaMode; }
