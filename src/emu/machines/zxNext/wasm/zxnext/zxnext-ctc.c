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

static ZxNextCtcChannel *zxnextCtcChannel(uint32_t channel) {
  return &zxnextCtcChannels[channel & 3u];
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
