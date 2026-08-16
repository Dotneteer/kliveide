#include "zxnext.h"

#define CTC_STATE_CONTROL_WORD 0u
#define CTC_STATE_TIME_CONSTANT 1u
#define CTC_STATE_WAIT 2u
#define CTC_STATE_RUNNING 3u

static uint32_t ctcValidChannel(uint32_t channel) {
  return channel < ZXNEXT_CTC_CHANNEL_COUNT;
}

static uint32_t ctcImplementedChannel(uint32_t channel) {
  return channel < 4u;
}

static uint32_t ctcPortsEnabled(void) {
  return isPortGroupEnabled(3u, 3u);
}

static uint32_t ctcChannelFromPort(uint32_t address) {
  return (address >> 8u) & 0x07u;
}

static uint32_t ctcExpectingTimeConstant(uint32_t channel) {
  if (!ctcValidChannel(channel)) return 0u;
  return ((ctcControlReg[channel] & 0x01u) != 0u && ctcState[channel] != CTC_STATE_CONTROL_WORD) ? 1u : 0u;
}

static void resetCtcState(void) {
  for (uint32_t i = 0; i < ZXNEXT_CTC_CHANNEL_COUNT; i++) {
    ctcState[i] = CTC_STATE_CONTROL_WORD;
    ctcControlReg[i] = 0u;
    ctcTimeConstantReg[i] = 0u;
    ctcPrescalerCount[i] = 0u;
    ctcCount[i] = 0u;
    ctcCountZeroD[i] = 0u;
    ctcIowrD[i] = 0u;
    ctcClkTrgD[i] = 0u;
    ctcZcTo[i] = 0u;
  }
  ctcIm2VectorWrite = 0u;
  ctcLastSyncClock = 0u;
}

static void ctcClockChannel(
  uint32_t channel,
  uint32_t iowr,
  uint32_t cpuData,
  uint32_t clkTrg,
  uint32_t intEnWr,
  uint32_t intEn
) {
  if (!ctcValidChannel(channel)) return;

  const uint8_t oldControlReg = ctcControlReg[channel];
  const uint8_t oldTimeConstantReg = ctcTimeConstantReg[channel];
  const uint8_t oldPrescalerCount = ctcPrescalerCount[channel];
  const uint8_t oldCount = ctcCount[channel];
  const uint8_t oldState = ctcState[channel];
  const uint8_t oldCountZeroD = ctcCountZeroD[channel];
  const uint8_t oldIowrD = ctcIowrD[channel];
  const uint8_t oldClkTrgD = ctcClkTrgD[channel];

  const uint32_t isCounterMode = (oldControlReg & 0x10u) != 0u;
  const uint32_t prescaler256 = (oldControlReg & 0x08u) != 0u;
  const uint32_t triggerEdgeRising = (oldControlReg & 0x04u) != 0u;
  const uint32_t triggerStart = (oldControlReg & 0x02u) != 0u;
  const uint32_t timeConstantFollows = (oldControlReg & 0x01u) != 0u;
  const uint8_t byteData = (uint8_t)(cpuData & 0xffu);

  const uint32_t iowrEdge = iowr != 0u && oldIowrD == 0u;
  const uint32_t iowrTcExp = timeConstantFollows != 0u && oldState != CTC_STATE_CONTROL_WORD;
  const uint32_t iowrTc = iowrEdge != 0u && iowrTcExp != 0u;
  const uint32_t iowrCr = iowrEdge != 0u && iowrTcExp == 0u && (byteData & 0x01u) != 0u;
  const uint32_t resetSoftTrigger = iowrCr != 0u && (byteData & 0x02u) != 0u;
  const uint32_t clkEdgeChange = iowrCr != 0u && (((byteData & 0x10u) != 0u) != (triggerEdgeRising != 0u));

  uint32_t clkTrgEdge;
  if (triggerEdgeRising != 0u) {
    clkTrgEdge = ((clkTrg != 0u && oldClkTrgD == 0u) || clkEdgeChange != 0u) ? 1u : 0u;
  } else {
    clkTrgEdge = ((oldClkTrgD != 0u && clkTrg == 0u) || clkEdgeChange != 0u) ? 1u : 0u;
  }

  const uint32_t resetSoft = oldState != CTC_STATE_RUNNING;
  const uint32_t pCountLo = (oldPrescalerCount & 0x0fu) == 0x0fu;
  const uint32_t pCountHi = ((oldPrescalerCount >> 4u) & 0x0fu) == 0x0fu;
  const uint32_t prescalerClk = prescaler256 != 0u ? (pCountLo != 0u && pCountHi != 0u) : pCountLo;
  const uint32_t tCountEn = isCounterMode != 0u ? clkTrgEdge : prescalerClk;
  const uint32_t tCountZero = oldCount == 0u;
  const uint32_t zcTo = tCountZero != 0u && oldCountZeroD == 0u && oldState == CTC_STATE_RUNNING;

  uint8_t stateNext = CTC_STATE_CONTROL_WORD;
  if (resetSoftTrigger != 0u) {
    stateNext = (byteData & 0x04u) != 0u ? CTC_STATE_TIME_CONSTANT : CTC_STATE_CONTROL_WORD;
  } else {
    switch (oldState) {
      case CTC_STATE_CONTROL_WORD:
        stateNext = (iowrCr != 0u && (byteData & 0x04u) != 0u) ? CTC_STATE_TIME_CONSTANT : CTC_STATE_CONTROL_WORD;
        break;
      case CTC_STATE_TIME_CONSTANT:
        stateNext = iowrTc != 0u ? CTC_STATE_WAIT : CTC_STATE_TIME_CONSTANT;
        break;
      case CTC_STATE_WAIT:
        if (isCounterMode == 0u && triggerStart != 0u && clkTrgEdge == 0u) {
          stateNext = CTC_STATE_WAIT;
        } else {
          stateNext = CTC_STATE_RUNNING;
        }
        break;
      case CTC_STATE_RUNNING:
        stateNext = CTC_STATE_RUNNING;
        break;
      default:
        stateNext = CTC_STATE_CONTROL_WORD;
        break;
    }
  }

  ctcIowrD[channel] = iowr != 0u;
  ctcClkTrgD[channel] = clkTrg != 0u;
  ctcCountZeroD[channel] = tCountZero != 0u;
  ctcZcTo[channel] = zcTo != 0u;
  ctcState[channel] = stateNext;
  ctcPrescalerCount[channel] = resetSoft != 0u ? 0u : (uint8_t)((oldPrescalerCount + 1u) & 0xffu);

  if (resetSoft != 0u) {
    ctcCount[channel] = oldTimeConstantReg;
  } else if (zcTo != 0u) {
    ctcCount[channel] = oldTimeConstantReg;
  } else if (tCountEn != 0u) {
    ctcCount[channel] = (uint8_t)((oldCount - 1u) & 0xffu);
  }

  if (iowrCr != 0u) {
    ctcControlReg[channel] = (byteData >> 2u) & 0x3fu;
  } else if (iowrTc != 0u) {
    ctcControlReg[channel] = oldControlReg & (uint8_t)~0x01u;
  } else if (intEnWr != 0u) {
    ctcControlReg[channel] = intEn != 0u ? (oldControlReg | 0x20u) : (oldControlReg & (uint8_t)~0x20u);
  }

  if (iowrTc != 0u) {
    ctcTimeConstantReg[channel] = byteData;
  }
}

static uint32_t ctcComputePrescalerFires(uint32_t channel, uint32_t div, uint32_t n) {
  if (n == 0u || !ctcValidChannel(channel)) return 0u;
  if (div == 16u) {
    const uint32_t firstFire = (0x0fu - (ctcPrescalerCount[channel] & 0x0fu)) & 0x0fu;
    if (firstFire >= n) return 0u;
    return 1u + ((n - 1u - firstFire) / 16u);
  }
  const uint32_t firstFire = (0xffu - ctcPrescalerCount[channel]) & 0xffu;
  if (firstFire >= n) return 0u;
  return 1u + ((n - 1u - firstFire) / 256u);
}

static uint32_t ctcAdvanceCounterByFires(uint32_t channel, uint32_t fires) {
  if (fires == 0u || !ctcValidChannel(channel)) return 0u;

  uint32_t zcToCount = 0u;
  uint32_t count = ctcCount[channel];
  const uint32_t tc = ctcTimeConstantReg[channel];
  const uint32_t effectiveTc = tc == 0u ? 256u : tc;

  if (count == 0u) {
    if (ctcCountZeroD[channel] == 0u) {
      zcToCount++;
      count = tc;
      if (tc == 0u) {
        if (fires > 0u) {
          count = 255u;
          fires--;
        } else {
          ctcCount[channel] = 0u;
          ctcCountZeroD[channel] = 1u;
          return zcToCount;
        }
      }
    } else {
      count = 255u;
      fires--;
    }
  }

  if (fires == 0u) {
    ctcCount[channel] = (uint8_t)(count & 0xffu);
    ctcCountZeroD[channel] = 0u;
    return zcToCount;
  }

  if (fires < count) {
    ctcCount[channel] = (uint8_t)((count - fires) & 0xffu);
    ctcCountZeroD[channel] = 0u;
    return zcToCount;
  }

  fires -= count;
  zcToCount++;

  if (fires > 0u) {
    const uint32_t fullPeriods = fires / effectiveTc;
    zcToCount += fullPeriods;
    fires -= fullPeriods * effectiveTc;
  }

  if (fires == 0u) {
    ctcCount[channel] = (uint8_t)(tc & 0xffu);
    ctcCountZeroD[channel] = tc == 0u;
    return zcToCount;
  }

  if (tc == 0u) {
    ctcCount[channel] = (uint8_t)((256u - fires) & 0xffu);
  } else {
    ctcCount[channel] = (uint8_t)((tc - fires) & 0xffu);
  }
  ctcCountZeroD[channel] = 0u;
  return zcToCount;
}

static uint32_t ctcAdvanceBySysClocks(uint32_t channel, uint32_t n) {
  if (!ctcImplementedChannel(channel) || ctcState[channel] != CTC_STATE_RUNNING || n == 0u) return 0u;
  const uint32_t div = (ctcControlReg[channel] & 0x08u) != 0u ? 256u : 16u;
  const uint32_t fires = ctcComputePrescalerFires(channel, div, n);
  ctcPrescalerCount[channel] = (uint8_t)((ctcPrescalerCount[channel] + n) & 0xffu);
  return ctcAdvanceCounterByFires(channel, fires);
}

static uint32_t ctcAdvanceByTriggers(uint32_t channel, uint32_t triggers) {
  if (!ctcImplementedChannel(channel) || ctcState[channel] != CTC_STATE_RUNNING || triggers == 0u) return 0u;
  return ctcAdvanceCounterByFires(channel, triggers);
}

static uint32_t ctcCurrentSysClock(void) {
  return frameTacts * 8u;
}

void zxnextCtcAdvanceToSysClock(uint32_t currentSysClock) {
  if (currentSysClock <= ctcLastSyncClock) return;
  const uint32_t elapsed = currentSysClock - ctcLastSyncClock;
  ctcLastSyncClock = currentSysClock;

  uint32_t zcToCounts[4] = { 0u, 0u, 0u, 0u };
  const uint32_t triggerSrc[4] = { 3u, 0u, 1u, 2u };

  for (uint32_t i = 0; i < 4u; i++) {
    if (ctcState[i] == CTC_STATE_RUNNING && (ctcControlReg[i] & 0x10u) == 0u) {
      zcToCounts[i] = ctcAdvanceBySysClocks(i, elapsed);
    }
  }

  for (uint32_t i = 0; i < 4u; i++) {
    if (ctcState[i] == CTC_STATE_RUNNING && (ctcControlReg[i] & 0x10u) != 0u) {
      zcToCounts[i] = ctcAdvanceByTriggers(i, zcToCounts[triggerSrc[i]]);
    }
  }

  for (uint32_t i = 0; i < 4u; i++) {
    if (zcToCounts[i] > 0u && (ctcControlReg[i] & 0x20u) != 0u) {
      interruptCtcStatus[i] = 1u;
    }
  }
}

void zxnextCtcOnNewFrame(uint32_t tactsInFrame) {
  zxnextCtcAdvanceToSysClock(tactsInFrame);
  ctcLastSyncClock = 0u;
}

void zxnextCtcClockTick(void) {
  const uint8_t prevZcTo[4] = { ctcZcTo[0], ctcZcTo[1], ctcZcTo[2], ctcZcTo[3] };
  ctcClockChannel(0u, 0u, 0u, prevZcTo[3], 0u, 0u);
  ctcClockChannel(1u, 0u, 0u, prevZcTo[0], 0u, 0u);
  ctcClockChannel(2u, 0u, 0u, prevZcTo[1], 0u, 0u);
  ctcClockChannel(3u, 0u, 0u, prevZcTo[2], 0u, 0u);

  for (uint32_t i = 0; i < 4u; i++) {
    if (ctcZcTo[i] != 0u) {
      interruptCtcStatus[i] = 1u;
    }
  }
  ctcLastSyncClock++;
}

static void ctcWriteIntEnable(uint32_t mask) {
  for (uint32_t i = 0; i < 4u; i++) {
    ctcClockChannel(i, 0u, 0u, 0u, 1u, (mask & (1u << i)) != 0u);
  }
}

uint32_t zxnextReadCtcPort(uint32_t address) {
  if (ctcPortsEnabled() == 0u) return 0xffu;
  const uint32_t channel = ctcChannelFromPort(address);
  if (!ctcImplementedChannel(channel)) return 0x00u;
  zxnextCtcAdvanceToSysClock(ctcCurrentSysClock());
  return ctcCount[channel];
}

void zxnextWriteCtcPort(uint32_t address, uint32_t value) {
  if (ctcPortsEnabled() == 0u) return;
  const uint32_t channel = ctcChannelFromPort(address);
  if (!ctcImplementedChannel(channel)) return;
  const uint8_t byteValue = (uint8_t)(value & 0xffu);

  if ((byteValue & 0x01u) == 0u && ctcExpectingTimeConstant(channel) == 0u) {
    ctcIm2VectorWrite = 1u;
    return;
  }

  zxnextCtcAdvanceToSysClock(ctcCurrentSysClock());
  ctcClockChannel(channel, 1u, byteValue, 0u, 0u, 0u);
  ctcClockChannel(channel, 0u, byteValue, 0u, 0u, 0u);
  ctcLastSyncClock += 2u;
}

uint32_t zxnextGetCtcChannelState(uint32_t channel) { return ctcValidChannel(channel) ? ctcState[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcControlReg(uint32_t channel) { return ctcValidChannel(channel) ? ctcControlReg[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcTimeConstant(uint32_t channel) { return ctcValidChannel(channel) ? ctcTimeConstantReg[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcPrescalerCount(uint32_t channel) { return ctcValidChannel(channel) ? ctcPrescalerCount[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcCount(uint32_t channel) { return ctcValidChannel(channel) ? ctcCount[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcCountZeroD(uint32_t channel) { return ctcValidChannel(channel) ? ctcCountZeroD[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcIowrD(uint32_t channel) { return ctcValidChannel(channel) ? ctcIowrD[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcClkTrgD(uint32_t channel) { return ctcValidChannel(channel) ? ctcClkTrgD[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcZcTo(uint32_t channel) { return ctcValidChannel(channel) ? ctcZcTo[channel] : 0xffffffffu; }
uint32_t zxnextGetCtcExpectingTimeConstant(uint32_t channel) { return ctcExpectingTimeConstant(channel); }
uint32_t zxnextGetCtcIm2VectorWrite(void) { return ctcIm2VectorWrite; }
uint32_t zxnextGetCtcLastSyncClock(void) { return ctcLastSyncClock; }
