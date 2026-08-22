#include "zxnext-ctc.h"

typedef struct {
  uint8_t state;
  uint8_t controlReg;
  uint8_t timeConstantReg;
  uint8_t prescalerCount;
  uint8_t count;
  uint8_t countZeroD;
  uint8_t iowrD;
  uint8_t clkTrgD;
  uint8_t zcTo;
} ZxNextCtcChannel;

static ZxNextCtcChannel zxnextCtcChannels[4];
static uint32_t zxnextCtcLastSyncClock;
static uint8_t zxnextCtcIm2VectorWrite;

static ZxNextCtcChannel *zxnextCtcChannel(uint32_t channel) {
  return &zxnextCtcChannels[channel & 3u];
}

static inline uint32_t zxnextCtcPortsEnabled(void) {
  return (zxnextNextRegs[0x85u] & 0x08u) != 0;
}

static inline uint32_t zxnextCtcPortChannel(uint32_t port) {
  return (port >> 8) & 0x07u;
}

static inline uint32_t zxnextCtcIsCounterMode(ZxNextCtcChannel *ch) {
  return (ch->controlReg & 0x10u) != 0;
}

static inline uint32_t zxnextCtcComputePrescalerFires(ZxNextCtcChannel *ch, uint32_t div, uint32_t clocks) {
  if (div == 16u) {
    const uint32_t firstFire = (0x0fu - (ch->prescalerCount & 0x0fu)) & 0x0fu;
    if (firstFire >= clocks) return 0;
    return 1u + ((clocks - 1u - firstFire) / 16u);
  }
  const uint32_t firstFire = (0xffu - ch->prescalerCount) & 0xffu;
  if (firstFire >= clocks) return 0;
  return 1u + ((clocks - 1u - firstFire) / 256u);
}

static uint32_t zxnextCtcAdvanceCounterByFires(ZxNextCtcChannel *ch, uint32_t fires) {
  if (fires == 0) return 0;

  uint32_t zcToCount = 0;
  uint32_t count = ch->count;
  const uint32_t timeConstant = ch->timeConstantReg;
  const uint32_t effectiveTimeConstant = timeConstant == 0 ? 256u : timeConstant;

  if (count == 0) {
    if (!ch->countZeroD) {
      zcToCount++;
      count = timeConstant;
      if (timeConstant == 0) {
        if (fires > 0) {
          count = 255u;
          fires--;
        } else {
          ch->count = 0;
          ch->countZeroD = 1;
          return zcToCount;
        }
      }
    } else {
      count = 255u;
      fires--;
    }
  }

  if (fires == 0) {
    ch->count = (uint8_t)count;
    ch->countZeroD = 0;
    return zcToCount;
  }

  if (fires < count) {
    ch->count = (uint8_t)(count - fires);
    ch->countZeroD = 0;
    return zcToCount;
  }

  fires -= count;
  zcToCount++;

  if (fires > 0) {
    const uint32_t fullPeriods = fires / effectiveTimeConstant;
    zcToCount += fullPeriods;
    fires -= fullPeriods * effectiveTimeConstant;
  }

  if (fires == 0) {
    ch->count = (uint8_t)timeConstant;
    ch->countZeroD = timeConstant == 0;
    return zcToCount;
  }

  if (timeConstant == 0) ch->count = (uint8_t)(256u - fires);
  else ch->count = (uint8_t)(timeConstant - fires);
  ch->countZeroD = 0;
  return zcToCount;
}

static uint32_t zxnextCtcAdvanceChannelBySysClocks(ZxNextCtcChannel *ch, uint32_t clocks) {
  if (ch->state != 3u || clocks == 0) return 0;
  const uint32_t prescalerDiv = (ch->controlReg & 0x08u) != 0 ? 256u : 16u;
  const uint32_t fires = zxnextCtcComputePrescalerFires(ch, prescalerDiv, clocks);
  ch->prescalerCount = (uint8_t)(ch->prescalerCount + clocks);
  return zxnextCtcAdvanceCounterByFires(ch, fires);
}

static uint32_t zxnextCtcAdvanceChannelByTriggers(ZxNextCtcChannel *ch, uint32_t triggers) {
  if (ch->state != 3u || triggers == 0) return 0;
  return zxnextCtcAdvanceCounterByFires(ch, triggers);
}

static void zxnextCtcAdvanceToSysClock(uint32_t currentSysClock) {
  if (currentSysClock <= zxnextCtcLastSyncClock) return;
  const uint32_t elapsed = currentSysClock - zxnextCtcLastSyncClock;
  zxnextCtcLastSyncClock = currentSysClock;

  uint32_t zcToCounts[4] = { 0, 0, 0, 0 };
  const uint32_t triggerSource[4] = { 3, 0, 1, 2 };

  for (uint32_t i = 0; i < 4; i++) {
    ZxNextCtcChannel *ch = zxnextCtcChannel(i);
    if (ch->state == 3u && !zxnextCtcIsCounterMode(ch)) {
      zcToCounts[i] = zxnextCtcAdvanceChannelBySysClocks(ch, elapsed);
    }
  }

  for (uint32_t i = 0; i < 4; i++) {
    ZxNextCtcChannel *ch = zxnextCtcChannel(i);
    if (ch->state == 3u && zxnextCtcIsCounterMode(ch)) {
      zcToCounts[i] = zxnextCtcAdvanceChannelByTriggers(ch, zcToCounts[triggerSource[i]]);
    }
  }

  for (uint32_t i = 0; i < 4; i++) {
    if (zcToCounts[i] > 0 && zxnextGetCtcIntEnabled(i)) {
      zxnextInterruptsSetDaisyStatus(3u + i, 1);
    }
  }
}

void zxnextCtcReset(void) {
  for (uint32_t i = 0; i < 4; i++) {
    zxnextCtcChannels[i].state = 0;
    zxnextCtcChannels[i].controlReg = 0;
    zxnextCtcChannels[i].timeConstantReg = 0;
    zxnextCtcChannels[i].prescalerCount = 0;
    zxnextCtcChannels[i].count = 0;
    zxnextCtcChannels[i].countZeroD = 0;
    zxnextCtcChannels[i].iowrD = 0;
    zxnextCtcChannels[i].clkTrgD = 0;
    zxnextCtcChannels[i].zcTo = 0;
  }
  zxnextCtcLastSyncClock = 0;
  zxnextCtcIm2VectorWrite = 0;
}

void zxnextCtcClock(uint32_t channel, uint32_t iowr, uint32_t cpuData, uint32_t clkTrg, uint32_t intEnWr, uint32_t intEn) {
  ZxNextCtcChannel *ch = zxnextCtcChannel(channel);
  uint8_t oldControlReg = ch->controlReg;
  uint8_t oldTimeConstantReg = ch->timeConstantReg;
  uint8_t oldPrescalerCount = ch->prescalerCount;
  uint8_t oldCount = ch->count;
  uint8_t oldState = ch->state;
  uint8_t oldCountZeroD = ch->countZeroD;
  uint8_t oldIowrD = ch->iowrD;
  uint8_t oldClkTrgD = ch->clkTrgD;
  uint8_t byteData = (uint8_t)cpuData;
  uint8_t iowrHigh = iowr != 0;
  uint8_t clkTrgHigh = clkTrg != 0;
  uint8_t isCounterMode = (oldControlReg & 0x10u) != 0;
  uint8_t prescaler256 = (oldControlReg & 0x08u) != 0;
  uint8_t triggerEdgeRising = (oldControlReg & 0x04u) != 0;
  uint8_t triggerStart = (oldControlReg & 0x02u) != 0;
  uint8_t timeConstantFollows = (oldControlReg & 0x01u) != 0;
  uint8_t iowrEdge = iowrHigh && !oldIowrD;
  uint8_t iowrTcExp = timeConstantFollows && oldState != 0;
  uint8_t iowrTc = iowrEdge && iowrTcExp;
  uint8_t iowrCr = iowrEdge && !iowrTcExp && ((byteData & 0x01u) != 0);
  uint8_t resetSoftTrigger = iowrCr && ((byteData & 0x02u) != 0);
  uint8_t clkEdgeChange = iowrCr && (((byteData & 0x10u) != 0) != triggerEdgeRising);
  uint8_t clkTrgEdge = triggerEdgeRising
    ? ((clkTrgHigh && !oldClkTrgD) || clkEdgeChange)
    : ((oldClkTrgD && !clkTrgHigh) || clkEdgeChange);
  uint8_t resetSoft = oldState != 3;
  uint8_t pCountLo = (oldPrescalerCount & 0x0fu) == 0x0fu;
  uint8_t pCountHi = ((oldPrescalerCount >> 4) & 0x0fu) == 0x0fu;
  uint8_t prescalerClk = prescaler256 ? (pCountLo && pCountHi) : pCountLo;
  uint8_t tCountEn = isCounterMode ? clkTrgEdge : prescalerClk;
  uint8_t tCountZero = oldCount == 0;
  uint8_t zcTo = tCountZero && !oldCountZeroD && oldState == 3;
  uint8_t stateNext = 0;

  if (resetSoftTrigger) {
    stateNext = (byteData & 0x04u) ? 1 : 0;
  } else if (oldState == 0) {
    stateNext = (iowrCr && (byteData & 0x04u)) ? 1 : 0;
  } else if (oldState == 1) {
    stateNext = iowrTc ? 2 : 1;
  } else if (oldState == 2) {
    stateNext = (!isCounterMode && triggerStart && !clkTrgEdge) ? 2 : 3;
  } else {
    stateNext = 3;
  }

  ch->iowrD = iowrHigh;
  ch->clkTrgD = clkTrgHigh;
  ch->countZeroD = tCountZero;
  ch->zcTo = zcTo;
  ch->state = stateNext;
  ch->prescalerCount = resetSoft ? 0 : (uint8_t)(oldPrescalerCount + 1);
  if (resetSoft) ch->count = oldTimeConstantReg;
  else if (zcTo) ch->count = oldTimeConstantReg;
  else if (tCountEn) ch->count = (uint8_t)(oldCount - 1);
  if (iowrCr) ch->controlReg = (byteData >> 2) & 0x3fu;
  else if (iowrTc) ch->controlReg = oldControlReg & ~0x01u;
  else if (intEnWr) ch->controlReg = intEn ? (oldControlReg | 0x20u) : (oldControlReg & ~0x20u);
  if (iowrTc) ch->timeConstantReg = byteData;
}

void zxnextCtcOnFrameCompleted(void) {
  zxnextCtcAdvanceToSysClock(ZXNEXT_TACTS_IN_FRAME);
  zxnextCtcLastSyncClock = 0;
}

uint32_t zxnextCtcReadPort(uint32_t port) {
  if (!zxnextCtcPortsEnabled()) return 0xffu;
  const uint32_t channel = zxnextCtcPortChannel(port);
  if (channel >= 4u) return 0x00u;
  zxnextCtcAdvanceToSysClock(frameTacts28);
  return zxnextCtcChannel(channel)->count;
}

void zxnextCtcWritePort(uint32_t port, uint32_t value) {
  if (!zxnextCtcPortsEnabled()) return;
  const uint32_t channel = zxnextCtcPortChannel(port);
  if (channel >= 4u) return;

  ZxNextCtcChannel *ch = zxnextCtcChannel(channel);
  if (((value & 0x01u) == 0) && !zxnextGetCtcExpectingTimeConstant(channel)) {
    zxnextCtcIm2VectorWrite = 1;
    return;
  }

  zxnextCtcAdvanceToSysClock(frameTacts28);
  zxnextCtcClock(channel, 1, value, 0, 0, 0);
  zxnextCtcClock(channel, 0, value, 0, 0, 0);
  zxnextCtcLastSyncClock += 2u;
}

uint32_t zxnextGetCtcState(uint32_t channel) { return zxnextCtcChannel(channel)->state; }
uint32_t zxnextGetCtcControlReg(uint32_t channel) { return zxnextCtcChannel(channel)->controlReg; }
uint32_t zxnextGetCtcTimeConstant(uint32_t channel) { return zxnextCtcChannel(channel)->timeConstantReg; }
uint32_t zxnextGetCtcCount(uint32_t channel) { return zxnextCtcChannel(channel)->count; }
uint32_t zxnextGetCtcZcTo(uint32_t channel) { return zxnextCtcChannel(channel)->zcTo; }
uint32_t zxnextGetCtcIntEnabled(uint32_t channel) { return (zxnextCtcChannel(channel)->controlReg & 0x20u) != 0; }
uint32_t zxnextGetCtcExpectingTimeConstant(uint32_t channel) {
  ZxNextCtcChannel *ch = zxnextCtcChannel(channel);
  return (ch->controlReg & 0x01u) != 0 && ch->state != 0;
}
