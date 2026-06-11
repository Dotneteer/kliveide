// ----------------------------------------------------------------------------
// Static tape media upload and diagnostics

static void clearTapeFileName(void) {
  for (uint32_t i = 0u; i < SP48_TAPE_FILENAME_CAPACITY; i++) {
    sp48TapeFileName[i] = 0u;
  }
}

static void clearTapeBlocks(void) {
  for (uint32_t i = 0u; i < SP48_TAPE_MAX_BLOCKS; i++) {
    sp48TapeBlocks[i].offset = 0u;
    sp48TapeBlocks[i].length = 0u;
    sp48TapeBlocks[i].pauseAfter = 0u;
    sp48TapeBlocks[i].pilotPulseLength = 0u;
    sp48TapeBlocks[i].sync1PulseLength = 0u;
    sp48TapeBlocks[i].sync2PulseLength = 0u;
    sp48TapeBlocks[i].zeroBitPulseLength = 0u;
    sp48TapeBlocks[i].oneBitPulseLength = 0u;
    sp48TapeBlocks[i].endSyncPulseLength = 0u;
    sp48TapeBlocks[i].lastByteUsedBits = 0u;
    sp48TapeBlocks[i].pilotPulseCount = 0u;
  }
}

static uint8_t sp48TapeGetEarBitInternal(void);
static void setTapeEarBit(uint8_t value);
void sp48TapeProcessMicBit(uint32_t micBit);

void sp48TapeClearSavedBlocks(void) {
  sp48TapeSavedBlockCount = 0u;
  sp48TapeSavedDataLength = 0u;
  sp48TapeSaveCurrentBlockOffset = 0u;
  sp48TapeSaveCurrentBlockLength = 0u;
  for (uint32_t i = 0u; i < SP48_TAPE_SAVE_MAX_BLOCKS; i++) {
    sp48SavedTapeBlocks[i].offset = 0u;
    sp48SavedTapeBlocks[i].length = 0u;
  }
}

static void resetTapeSaveCapture(void) {
  sp48TapeSaveMicBit = 1u;
  sp48TapeSavePhase = SP48_TAPE_SAVE_PHASE_NONE;
  sp48TapeSavePreviousDataPulse = SP48_TAPE_MIC_PULSE_NONE;
  sp48TapeSaveLastPulse = SP48_TAPE_MIC_PULSE_NONE;
  sp48TapeSaveBitOffset = 0u;
  sp48TapeSaveDataByte = 0u;
  sp48TapeSaveLastMicBitTact = sp48Tacts;
  sp48TapeSavePilotPulseCount = 0u;
  sp48TapeSavedRevision = 0u;
  sp48TapeClearSavedBlocks();
}

static void beginTapeSaveCapture(void) {
  resetTapeSaveCapture();
  sp48TapeSaveLastMicBitTact = sp48Tacts;
}

static void resetTapePlayback(void) {
  sp48TapeCurrentBlockIndex = 0u;
  sp48TapeEof = sp48TapeLoaded == 0u || sp48TapeBlockCount == 0u ? 1u : 0u;
  sp48TapeMode = SP48_TAPE_MODE_PASSIVE;
  sp48TapePlayPhase = SP48_TAPE_PHASE_NONE;
  sp48TapeStartTact = sp48Tacts;
  sp48TapePilotEndPos = 0u;
  sp48TapeSync1EndPos = 0u;
  sp48TapeSync2EndPos = 0u;
  sp48TapeBitStartPos = 0u;
  sp48TapeBitPulseLength = 0u;
  sp48TapeDataIndex = 0u;
  sp48TapeBitMask = 0x80u;
  sp48TapeTermEndPos = 0u;
  sp48TapePauseEndPos = 0u;
  sp48TapeEarBit = 1u;
  sp48TapeSavePhase = SP48_TAPE_SAVE_PHASE_NONE;
  sp48TapeSaveLastPulse = SP48_TAPE_MIC_PULSE_NONE;
}

void sp48TapeClear(void) {
  sp48TapeBlockCount = 0u;
  sp48TapeDataLength = 0u;
  sp48TapeCurrentBlockIndex = 0u;
  sp48TapeUploadBlockCount = 0u;
  sp48TapeUploadDataLength = 0u;
  sp48TapeUploadActive = 0u;
  sp48TapeLoaded = 0u;
  sp48TapeEof = 1u;
  sp48TapeMode = SP48_TAPE_MODE_PASSIVE;
  sp48TapePlayPhase = SP48_TAPE_PHASE_NONE;
  sp48TapeEarBit = 1u;
  resetTapeSaveCapture();
  clearTapeFileName();
  clearTapeBlocks();
}

uint32_t sp48TapeClassifySavePulse(uint32_t length) {
  if (length >= SP48_TAPE_BIT0_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE &&
      length <= SP48_TAPE_BIT0_PULSE_LENGTH + SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_BIT0;
  }
  if (length >= SP48_TAPE_BIT1_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE &&
      length <= SP48_TAPE_BIT1_PULSE_LENGTH + SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_BIT1;
  }
  if (length >= SP48_TAPE_PILOT_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE &&
      length <= SP48_TAPE_PILOT_PULSE_LENGTH + SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_PILOT;
  }
  if (length >= SP48_TAPE_SYNC1_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE &&
      length <= SP48_TAPE_SYNC1_PULSE_LENGTH + SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_SYNC1;
  }
  if (length >= SP48_TAPE_SYNC2_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE &&
      length <= SP48_TAPE_SYNC2_PULSE_LENGTH + SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_SYNC2;
  }
  if (length >= SP48_TAPE_TERM_SYNC_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE &&
      length <= SP48_TAPE_TERM_SYNC_PULSE_LENGTH + SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_TERM_SYNC;
  }
  if (length < SP48_TAPE_SYNC1_PULSE_LENGTH - SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_TOO_SHORT;
  }
  if (length > SP48_TAPE_PILOT_PULSE_LENGTH + 2u * SP48_TAPE_SAVE_PULSE_TOLERANCE) {
    return SP48_TAPE_MIC_PULSE_TOO_LONG;
  }
  return SP48_TAPE_MIC_PULSE_NONE;
}

static void beginTapeSaveDataBlock(uint32_t firstPulse) {
  sp48TapeSavePreviousDataPulse = (uint8_t)firstPulse;
  sp48TapeSaveBitOffset = 0u;
  sp48TapeSaveDataByte = 0u;
  sp48TapeSaveCurrentBlockOffset = sp48TapeSavedDataLength;
  sp48TapeSaveCurrentBlockLength = 0u;
}

static void finishTapeSaveDataBlock(void) {
  if (sp48TapeSavedBlockCount >= SP48_TAPE_SAVE_MAX_BLOCKS) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_SAVE_BLOCK_OVERFLOW;
    sp48TapeSavePhase = SP48_TAPE_SAVE_PHASE_ERROR;
    return;
  }

  sp48SavedTapeBlocks[sp48TapeSavedBlockCount].offset = sp48TapeSaveCurrentBlockOffset;
  sp48SavedTapeBlocks[sp48TapeSavedBlockCount].length = sp48TapeSaveCurrentBlockLength;
  sp48TapeSavedBlockCount++;
  sp48TapeSavedRevision++;
}

static void appendTapeSaveBit(uint32_t pulse) {
  sp48TapeSaveBitOffset++;
  sp48TapeSaveDataByte = (uint8_t)((sp48TapeSaveDataByte * 2u +
    (pulse == SP48_TAPE_MIC_PULSE_BIT0 ? 0u : 1u)) & 0xffu);

  if (sp48TapeSaveBitOffset != 8u) {
    return;
  }

  if (sp48TapeSavedDataLength >= SP48_TAPE_SAVE_DATA_CAPACITY) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_SAVE_DATA_OVERFLOW;
    sp48TapeSavePhase = SP48_TAPE_SAVE_PHASE_ERROR;
    return;
  }

  sp48TapeSaveData[sp48TapeSavedDataLength++] = sp48TapeSaveDataByte;
  sp48TapeSaveCurrentBlockLength++;
  sp48TapeSaveDataByte = 0u;
  sp48TapeSaveBitOffset = 0u;
}

void sp48TapeProcessMicBit(uint32_t micBit) {
  const uint8_t nextMicBit = micBit != 0u ? 1u : 0u;
  if (sp48TapeMode != SP48_TAPE_MODE_SAVE || sp48TapeSaveMicBit == nextMicBit) {
    return;
  }

  const uint32_t length = sp48Tacts - sp48TapeSaveLastMicBitTact;
  const uint32_t pulse = sp48TapeClassifySavePulse(length);
  sp48TapeSaveMicBit = nextMicBit;
  sp48TapeSaveLastMicBitTact = sp48Tacts;
  sp48TapeSaveLastPulse = (uint8_t)pulse;

  uint8_t nextPhase = SP48_TAPE_SAVE_PHASE_ERROR;
  switch (sp48TapeSavePhase) {
    case SP48_TAPE_SAVE_PHASE_NONE:
      if (pulse == SP48_TAPE_MIC_PULSE_TOO_SHORT || pulse == SP48_TAPE_MIC_PULSE_TOO_LONG) {
        nextPhase = SP48_TAPE_SAVE_PHASE_NONE;
      } else if (pulse == SP48_TAPE_MIC_PULSE_PILOT) {
        sp48TapeSavePilotPulseCount = 1u;
        nextPhase = SP48_TAPE_SAVE_PHASE_PILOT;
      }
      break;

    case SP48_TAPE_SAVE_PHASE_PILOT:
      if (pulse == SP48_TAPE_MIC_PULSE_PILOT) {
        sp48TapeSavePilotPulseCount++;
        nextPhase = SP48_TAPE_SAVE_PHASE_PILOT;
      } else if (pulse == SP48_TAPE_MIC_PULSE_SYNC1 &&
                 sp48TapeSavePilotPulseCount >= SP48_TAPE_MIN_SAVE_PILOT_PULSE_COUNT) {
        nextPhase = SP48_TAPE_SAVE_PHASE_SYNC1;
      }
      break;

    case SP48_TAPE_SAVE_PHASE_SYNC1:
      if (pulse == SP48_TAPE_MIC_PULSE_SYNC2) {
        nextPhase = SP48_TAPE_SAVE_PHASE_SYNC2;
      }
      break;

    case SP48_TAPE_SAVE_PHASE_SYNC2:
      if (pulse == SP48_TAPE_MIC_PULSE_BIT0 || pulse == SP48_TAPE_MIC_PULSE_BIT1) {
        beginTapeSaveDataBlock(pulse);
        nextPhase = SP48_TAPE_SAVE_PHASE_DATA;
      }
      break;

    case SP48_TAPE_SAVE_PHASE_DATA:
      if (pulse == SP48_TAPE_MIC_PULSE_BIT0 || pulse == SP48_TAPE_MIC_PULSE_BIT1) {
        if (sp48TapeSavePreviousDataPulse == SP48_TAPE_MIC_PULSE_NONE) {
          sp48TapeSavePreviousDataPulse = (uint8_t)pulse;
          nextPhase = SP48_TAPE_SAVE_PHASE_DATA;
        } else if (sp48TapeSavePreviousDataPulse == pulse) {
          sp48TapeSavePreviousDataPulse = SP48_TAPE_MIC_PULSE_NONE;
          appendTapeSaveBit(pulse);
          nextPhase = sp48TapeSavePhase == SP48_TAPE_SAVE_PHASE_ERROR
            ? SP48_TAPE_SAVE_PHASE_ERROR
            : SP48_TAPE_SAVE_PHASE_DATA;
        }
      } else if (pulse == SP48_TAPE_MIC_PULSE_TERM_SYNC) {
        finishTapeSaveDataBlock();
        nextPhase = sp48TapeSavePhase == SP48_TAPE_SAVE_PHASE_ERROR
          ? SP48_TAPE_SAVE_PHASE_ERROR
          : SP48_TAPE_SAVE_PHASE_NONE;
      }
      break;
  }

  sp48TapeSavePhase = nextPhase;
}

void sp48TapeSetFileNameByte(uint32_t index, uint32_t value) {
  if (index >= SP48_TAPE_FILENAME_CAPACITY) {
    return;
  }
  sp48TapeFileName[index] = (uint8_t)(value & 0xffu);
}

uint32_t sp48TapeBeginUpload(uint32_t blockCount, uint32_t totalDataLength) {
  sp48TapeClear();

  if (blockCount > SP48_TAPE_MAX_BLOCKS) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_BLOCK_OVERFLOW;
    return 0u;
  }

  if (totalDataLength > SP48_TAPE_DATA_CAPACITY) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW;
    return 0u;
  }

  sp48TapeUploadBlockCount = blockCount;
  sp48TapeUploadDataLength = totalDataLength;
  sp48TapeUploadActive = 1u;
  return 1u;
}

uint32_t sp48TapeSetBlock(
  uint32_t index,
  uint32_t offset,
  uint32_t length,
  uint32_t pauseAfter,
  uint32_t pilotPulseLength,
  uint32_t sync1PulseLength,
  uint32_t sync2PulseLength,
  uint32_t zeroBitPulseLength,
  uint32_t oneBitPulseLength,
  uint32_t endSyncPulseLength,
  uint32_t lastByteUsedBits,
  uint32_t pilotPulseCount
) {
  if (sp48TapeUploadActive == 0u || index >= sp48TapeUploadBlockCount) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE;
    return 0u;
  }

  if (offset > sp48TapeUploadDataLength || length > sp48TapeUploadDataLength - offset) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW;
    return 0u;
  }

  Sp48TapeBlock *block = &sp48TapeBlocks[index];
  block->offset = offset;
  block->length = length;
  block->pauseAfter = pauseAfter;
  block->pilotPulseLength = pilotPulseLength;
  block->sync1PulseLength = sync1PulseLength;
  block->sync2PulseLength = sync2PulseLength;
  block->zeroBitPulseLength = zeroBitPulseLength;
  block->oneBitPulseLength = oneBitPulseLength;
  block->endSyncPulseLength = endSyncPulseLength;
  block->lastByteUsedBits = (uint8_t)(lastByteUsedBits & 0xffu);
  block->pilotPulseCount = pilotPulseCount;
  return 1u;
}

uint32_t sp48TapeWriteData(uint32_t offset, uint32_t value) {
  if (sp48TapeUploadActive == 0u || offset >= sp48TapeUploadDataLength) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_DATA_OVERFLOW;
    return 0u;
  }
  sp48TapeData[offset] = (uint8_t)(value & 0xffu);
  return 1u;
}

uint32_t sp48TapeFinishUpload(void) {
  if (sp48TapeUploadActive == 0u) {
    sp48DiagnosticFlags |= SP48_DIAGNOSTIC_TAPE_UPLOAD_INCOMPLETE;
    return 0u;
  }

  sp48TapeBlockCount = sp48TapeUploadBlockCount;
  sp48TapeDataLength = sp48TapeUploadDataLength;
  sp48TapeUploadActive = 0u;
  sp48TapeLoaded = sp48TapeBlockCount != 0u ? 1u : 0u;
  resetTapePlayback();
  return 1u;
}

void sp48TapeRewind(void) {
  resetTapePlayback();
}

static uint32_t tapeBlockPilotPulseCount(const Sp48TapeBlock *block) {
  if (block->pilotPulseCount != 0u) {
    return block->pilotPulseCount;
  }
  if (block->length > 0u && sp48TapeData[block->offset] < 0x80u) {
    return SP48_TAPE_HEADER_PILOT_COUNT;
  }
  return SP48_TAPE_DATA_PILOT_COUNT;
}

static uint32_t tapeBlockPauseTacts(const Sp48TapeBlock *block) {
  return (sp48BaseClockFrequency / 1000u) * block->pauseAfter;
}

static uint32_t currentTapeBlockAvailable(void) {
  return sp48TapeLoaded != 0u &&
    sp48TapeEof == 0u &&
    sp48TapeCurrentBlockIndex < sp48TapeBlockCount;
}

static Sp48TapeBlock *currentTapeBlock(void) {
  return &sp48TapeBlocks[sp48TapeCurrentBlockIndex];
}

static void setTapeModeInternal(uint32_t mode) {
  if (mode > SP48_TAPE_MODE_SAVE) {
    mode = SP48_TAPE_MODE_PASSIVE;
  }

  if (sp48TapeMode == (uint8_t)mode) {
    return;
  }

  sp48TapeMode = (uint8_t)mode;
  sp48TapeModeChangeCount++;
  sp48TapeLastModeChangeTact = sp48Tacts;
  sp48TapeLastModeChangePc = z80GetPc();
}

static void nextTapeBlock(void) {
  if (sp48TapeLoaded == 0u || sp48TapeCurrentBlockIndex >= sp48TapeBlockCount) {
    sp48TapeEof = 1u;
    sp48TapePlayPhase = SP48_TAPE_PHASE_COMPLETED;
    sp48TapeEarBit = 1u;
    return;
  }

  Sp48TapeBlock *block = currentTapeBlock();
  sp48TapeStartTact = sp48Tacts;
  sp48TapePlayPhase = SP48_TAPE_PHASE_PILOT;
  sp48TapeDataIndex = 0u;
  sp48TapeBitMask = 0x80u;
  sp48TapeBitStartPos = 0u;
  sp48TapeBitPulseLength = 0u;
  sp48TapeTermEndPos = 0u;
  sp48TapePauseEndPos = 0u;

  const uint32_t pilotPulses = tapeBlockPilotPulseCount(block);
  sp48TapePilotEndPos = block->pilotPulseLength * pilotPulses;
  sp48TapeSync1EndPos = sp48TapePilotEndPos + block->sync1PulseLength;
  sp48TapeSync2EndPos = sp48TapeSync1EndPos + block->sync2PulseLength;

  if (block->length == 0u) {
    sp48TapePlayPhase = SP48_TAPE_PHASE_PAUSE;
    sp48TapePauseEndPos = tapeBlockPauseTacts(block);
  } else if (block->pilotPulseLength == 0u &&
             block->sync1PulseLength == 0u &&
             block->sync2PulseLength == 0u) {
    sp48TapePlayPhase = SP48_TAPE_PHASE_DATA;
    sp48TapeBitPulseLength =
      (sp48TapeData[block->offset] & sp48TapeBitMask) != 0u
        ? block->oneBitPulseLength
        : block->zeroBitPulseLength;
  }
}

static void completeFastLoadBlock(void) {
  sp48TapeCurrentBlockIndex++;
  if (sp48TapeCurrentBlockIndex >= sp48TapeBlockCount) {
    sp48TapeEof = 1u;
    sp48TapePlayPhase = SP48_TAPE_PHASE_COMPLETED;
    setTapeEarBit(1u);
    return;
  }

  sp48TapePlayPhase = SP48_TAPE_PHASE_NONE;
  sp48TapeDataIndex = 0u;
  sp48TapeBitMask = 0x80u;
  sp48TapeEarBit = 1u;
}

static void fastLoadCurrentTapeBlock(void) {
  if (currentTapeBlockAvailable() == 0u) {
    return;
  }

  Sp48TapeBlock *block = currentTapeBlock();
  const uint32_t blockEnd = block->offset + block->length;
  uint32_t dataIndex = block->offset;

  AF = AF_ALT;
  const uint8_t isVerify = (AF & 0xff01u) == 0xff00u ? 1u : 0u;

  if (dataIndex >= blockEnd || sp48TapeData[dataIndex] != A) {
    A ^= L;
    F &= 0xbeu;
    cpu.pc = SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE;
    completeFastLoadBlock();
    return;
  }

  H = A;
  dataIndex++;

  while (DE > 0u) {
    if (dataIndex >= blockEnd) {
      F &= 0xfeu;
      cpu.pc = SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE;
      completeFastLoadBlock();
      return;
    }

    L = sp48TapeData[dataIndex];
    if (isVerify != 0u && sp48CpuReadMemory(IX) != L) {
      F &= 0xbeu;
      cpu.pc = SP48_TAPE_LOAD_BYTES_INVALID_HEADER_ROUTINE;
      return;
    }

    sp48CpuWriteMemory(IX, L);

    H ^= L;
    dataIndex++;
    IX = (uint16_t)(IX + 1u);
    DE = (uint16_t)(DE - 1u);
  }

  if (dataIndex > blockEnd - 1u) {
    F &= 0xfeu;
  } else if (sp48TapeData[dataIndex] != H) {
    F &= 0xfeu;
  } else {
    F |= 0x01u;
  }

  cpu.pc = SP48_TAPE_LOAD_BYTES_RESUME_ROUTINE;
  completeFastLoadBlock();
}

void sp48TapeSetMode(uint32_t mode) {
  if (mode > SP48_TAPE_MODE_SAVE) {
    mode = SP48_TAPE_MODE_PASSIVE;
  }
  setTapeModeInternal(mode);
  if (sp48TapeMode == SP48_TAPE_MODE_LOAD && sp48TapePlayPhase == SP48_TAPE_PHASE_NONE) {
    nextTapeBlock();
  }
}

void sp48TapeSetFastLoad(uint32_t enabled) {
  sp48TapeFastLoad = enabled != 0u ? 1u : 0u;
}

uint32_t sp48TapeGetFastLoad(void) {
  return sp48TapeFastLoad;
}

static void updateTapeMode(void) {
  if (sp48TapeMode == SP48_TAPE_MODE_PASSIVE) {
    if (z80GetPc() == SP48_TAPE_LOAD_BYTES_ROUTINE) {
      setTapeModeInternal(SP48_TAPE_MODE_LOAD);
      sp48TapeLoadStartCount++;
      nextTapeBlock();
      if (sp48TapeFastLoad != 0u) {
        fastLoadCurrentTapeBlock();
        setTapeModeInternal(SP48_TAPE_MODE_PASSIVE);
      }
    } else if (z80GetPc() == SP48_TAPE_SAVE_BYTES_ROUTINE) {
      setTapeModeInternal(SP48_TAPE_MODE_SAVE);
      sp48TapeSaveStartCount++;
      beginTapeSaveCapture();
    }
    return;
  }

  if (sp48TapeMode == SP48_TAPE_MODE_LOAD) {
    (void)sp48TapeGetEarBitInternal();
    if (sp48TapeEof != 0u || z80GetPc() == 0x0008u) {
      setTapeModeInternal(SP48_TAPE_MODE_PASSIVE);
    }
    return;
  }

  if (sp48TapeMode == SP48_TAPE_MODE_SAVE) {
    if (z80GetPc() == 0x0008u ||
        sp48Tacts - sp48TapeSaveLastMicBitTact > SP48_TAPE_TOO_LONG_SAVE_PAUSE) {
      setTapeModeInternal(SP48_TAPE_MODE_PASSIVE);
    }
  }
}

static void setTapeEarBit(uint8_t value) {
  value = value != 0u ? 1u : 0u;
  if (sp48TapeEarBit == value) {
    return;
  }
  sp48TapeEarBit = value;
  sp48BeeperLevel = (uint8_t)((sp48MicBit != 0u ? 1u : 0u) | (sp48TapeEarBit != 0u ? 2u : 0u));
  recordAudioTransition(sp48Tacts, sp48TapeEarBit, sp48MicBit);
}

static uint8_t sp48TapeGetEarBitInternal(void) {
  if (currentTapeBlockAvailable() == 0u) {
    setTapeEarBit(1u);
    return 1u;
  }

  Sp48TapeBlock *block = currentTapeBlock();
  uint32_t pos = sp48Tacts - sp48TapeStartTact;

  if (sp48TapePlayPhase == SP48_TAPE_PHASE_PILOT ||
      sp48TapePlayPhase == SP48_TAPE_PHASE_SYNC) {
    if (pos <= sp48TapePilotEndPos) {
      const uint8_t bit = ((pos / block->pilotPulseLength) % 2u) == 0u ? 1u : 0u;
      setTapeEarBit(bit);
      return bit;
    }

    if (pos <= sp48TapeSync1EndPos) {
      sp48TapePlayPhase = SP48_TAPE_PHASE_SYNC;
      setTapeEarBit(0u);
      return 0u;
    }

    if (pos <= sp48TapeSync2EndPos) {
      sp48TapePlayPhase = SP48_TAPE_PHASE_SYNC;
      setTapeEarBit(1u);
      return 1u;
    }

    sp48TapePlayPhase = SP48_TAPE_PHASE_DATA;
    sp48TapeBitStartPos = sp48TapeSync2EndPos;
    sp48TapeBitPulseLength =
      (sp48TapeData[block->offset + sp48TapeDataIndex] & sp48TapeBitMask) != 0u
        ? block->oneBitPulseLength
        : block->zeroBitPulseLength;
  }

  if (sp48TapePlayPhase == SP48_TAPE_PHASE_DATA) {
    if (block->length > 0u) {
      const uint32_t bitPos = pos - sp48TapeBitStartPos;

      if (bitPos < sp48TapeBitPulseLength) {
        setTapeEarBit(0u);
        return 0u;
      }
      if (bitPos < sp48TapeBitPulseLength * 2u) {
        setTapeEarBit(1u);
        return 1u;
      }

      sp48TapeBitMask = (uint8_t)(sp48TapeBitMask >> 1u);
      if (sp48TapeDataIndex == block->length - 1u &&
          block->lastByteUsedBits > 0u &&
          block->lastByteUsedBits < 8u) {
        sp48TapeBitMask &= (uint8_t)(0xffu << (8u - block->lastByteUsedBits));
      }
      if (sp48TapeBitMask == 0u) {
        sp48TapeBitMask = 0x80u;
        sp48TapeDataIndex++;
      }

      if (sp48TapeDataIndex < block->length) {
        sp48TapeBitStartPos += 2u * sp48TapeBitPulseLength;
        sp48TapeBitPulseLength =
          (sp48TapeData[block->offset + sp48TapeDataIndex] & sp48TapeBitMask) != 0u
            ? block->oneBitPulseLength
            : block->zeroBitPulseLength;
        setTapeEarBit(0u);
        return 0u;
      }

      sp48TapePlayPhase = SP48_TAPE_PHASE_TERM_SYNC;
      sp48TapeTermEndPos =
        sp48TapeBitStartPos + 2u * sp48TapeBitPulseLength + block->endSyncPulseLength;
      setTapeEarBit(0u);
      return 0u;
    }

    sp48TapePlayPhase = SP48_TAPE_PHASE_PAUSE;
    sp48TapePauseEndPos = tapeBlockPauseTacts(block);
    sp48TapeStartTact = sp48Tacts;
    pos = 0u;
  }

  if (sp48TapePlayPhase == SP48_TAPE_PHASE_TERM_SYNC) {
    if (pos < sp48TapeTermEndPos) {
      setTapeEarBit(0u);
      return 0u;
    }

    sp48TapePlayPhase = SP48_TAPE_PHASE_PAUSE;
    sp48TapePauseEndPos = sp48TapeTermEndPos + tapeBlockPauseTacts(block);
    setTapeEarBit(1u);
    return 1u;
  }

  if (pos > sp48TapePauseEndPos) {
    sp48TapeCurrentBlockIndex++;
    if (sp48TapeCurrentBlockIndex >= sp48TapeBlockCount) {
      sp48TapeEof = 1u;
      sp48TapePlayPhase = SP48_TAPE_PHASE_COMPLETED;
      setTapeEarBit(1u);
      return 1u;
    }
    nextTapeBlock();
  }

  setTapeEarBit(1u);
  return 1u;
}

uint32_t sp48TapeGetEarBit(void) {
  return sp48TapeGetEarBitInternal();
}

uint8_t *sp48TapeDataPtr(void) {
  return sp48TapeData;
}

uint8_t *sp48TapeFileNamePtr(void) {
  return sp48TapeFileName;
}

uint32_t sp48TapeGetMaxBlocks(void) {
  return SP48_TAPE_MAX_BLOCKS;
}

uint32_t sp48TapeGetDataCapacity(void) {
  return SP48_TAPE_DATA_CAPACITY;
}

uint32_t sp48TapeGetFileNameCapacity(void) {
  return SP48_TAPE_FILENAME_CAPACITY;
}

uint32_t sp48TapeGetBlockCount(void) {
  return sp48TapeBlockCount;
}

uint32_t sp48TapeGetDataLength(void) {
  return sp48TapeDataLength;
}

uint32_t sp48TapeGetCurrentBlockIndex(void) {
  return sp48TapeCurrentBlockIndex;
}

uint32_t sp48TapeGetLoaded(void) {
  return sp48TapeLoaded;
}

uint32_t sp48TapeGetEof(void) {
  return sp48TapeEof;
}

uint32_t sp48TapeGetUploadActive(void) {
  return sp48TapeUploadActive;
}

uint32_t sp48TapeGetMode(void) {
  return sp48TapeMode;
}

uint32_t sp48TapeGetPlayPhase(void) {
  return sp48TapePlayPhase;
}

uint32_t sp48TapeGetCurrentEarBit(void) {
  return sp48TapeEarBit;
}

uint32_t sp48TapeGetCurrentDataIndex(void) {
  return sp48TapeDataIndex;
}

uint32_t sp48TapeGetCurrentBitMask(void) {
  return sp48TapeBitMask;
}

uint32_t sp48TapeGetStartTact(void) {
  return sp48TapeStartTact;
}

uint32_t sp48TapeGetModeChangeCount(void) {
  return sp48TapeModeChangeCount;
}

uint32_t sp48TapeGetLastModeChangeTact(void) {
  return sp48TapeLastModeChangeTact;
}

uint32_t sp48TapeGetLastModeChangePc(void) {
  return sp48TapeLastModeChangePc;
}

uint32_t sp48TapeGetLoadStartCount(void) {
  return sp48TapeLoadStartCount;
}

uint32_t sp48TapeGetSaveStartCount(void) {
  return sp48TapeSaveStartCount;
}

uint32_t sp48TapeGetSavePhase(void) {
  return sp48TapeSavePhase;
}

uint32_t sp48TapeGetSaveLastPulse(void) {
  return sp48TapeSaveLastPulse;
}

uint32_t sp48TapeGetSaveMicBit(void) {
  return sp48TapeSaveMicBit;
}

uint32_t sp48TapeGetSaveLastMicBitTact(void) {
  return sp48TapeSaveLastMicBitTact;
}

uint32_t sp48TapeGetSavePilotPulseCount(void) {
  return sp48TapeSavePilotPulseCount;
}

uint32_t sp48TapeGetSavedBlockCount(void) {
  return sp48TapeSavedBlockCount;
}

uint32_t sp48TapeGetSavedDataLength(void) {
  return sp48TapeSavedDataLength;
}

uint32_t sp48TapeGetSavedRevision(void) {
  return sp48TapeSavedRevision;
}

uint32_t sp48TapeGetSaveDataCapacity(void) {
  return SP48_TAPE_SAVE_DATA_CAPACITY;
}

uint32_t sp48TapeGetSaveMaxBlocks(void) {
  return SP48_TAPE_SAVE_MAX_BLOCKS;
}

uint32_t sp48TapeGetSavedBlockOffset(uint32_t index) {
  return index < sp48TapeSavedBlockCount ? sp48SavedTapeBlocks[index].offset : 0u;
}

uint32_t sp48TapeGetSavedBlockLength(uint32_t index) {
  return index < sp48TapeSavedBlockCount ? sp48SavedTapeBlocks[index].length : 0u;
}

uint8_t *sp48TapeSaveDataPtr(void) {
  return sp48TapeSaveData;
}

uint32_t sp48TapeGetBlockOffset(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].offset : 0u;
}

uint32_t sp48TapeGetBlockLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].length : 0u;
}

uint32_t sp48TapeGetBlockPauseAfter(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].pauseAfter : 0u;
}

uint32_t sp48TapeGetBlockPilotPulseLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].pilotPulseLength : 0u;
}

uint32_t sp48TapeGetBlockSync1PulseLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].sync1PulseLength : 0u;
}

uint32_t sp48TapeGetBlockSync2PulseLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].sync2PulseLength : 0u;
}

uint32_t sp48TapeGetBlockZeroBitPulseLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].zeroBitPulseLength : 0u;
}

uint32_t sp48TapeGetBlockOneBitPulseLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].oneBitPulseLength : 0u;
}

uint32_t sp48TapeGetBlockEndSyncPulseLength(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].endSyncPulseLength : 0u;
}

uint32_t sp48TapeGetBlockLastByteUsedBits(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].lastByteUsedBits : 0u;
}

uint32_t sp48TapeGetBlockPilotPulseCount(uint32_t index) {
  return index < sp48TapeBlockCount ? sp48TapeBlocks[index].pilotPulseCount : 0u;
}
