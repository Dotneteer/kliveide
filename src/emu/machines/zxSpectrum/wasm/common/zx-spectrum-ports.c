// ----------------------------------------------------------------------------
// Port I/O

#ifndef SP48_PORT_READ_NON_FE
#define SP48_PORT_READ_NON_FE(address) sp48ReadFloatingBus()
#endif

#ifndef SP48_PORT_WRITE_NON_FE
#define SP48_PORT_WRITE_NON_FE(address, value) ((void)(address), (void)(value))
#endif

static void resetPortFe(void) {
  sp48PortFeValue = 0u;
  sp48BorderColor = 7u;
  sp48EarBit = 0u;
  sp48MicBit = 0u;
  sp48BeeperLevel = 0u;
  sp48EarBitChangedFrom0Tacts = 0u;
  sp48EarBitChangedFrom1Tacts = 0u;
}

uint32_t sp48ReadPort(uint32_t address) {
  if ((address & 0x0001u) != 0u) {
    return SP48_PORT_READ_NON_FE(address);
  }

  const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
  const uint8_t status = sp48KeyboardSelectedLineValue[selectedLines];
  uint32_t portValue = ((uint32_t)~status) & 0xffu;
  if (sp48TapeMode == SP48_TAPE_MODE_LOAD) {
    const uint32_t tapeEarBit = sp48TapeGetEarBit() != 0u ? 0x40u : 0x00u;
    return (portValue & 0xbfu) | tapeEarBit;
  }

  uint8_t bit4Sensed = sp48EarBit;
  if (bit4Sensed == 0u) {
    uint32_t chargeTime = sp48EarBitChangedFrom1Tacts - sp48EarBitChangedFrom0Tacts;
    if (chargeTime > 0u) {
      chargeTime = chargeTime > 700u ? 2800u : 4u * chargeTime;
      bit4Sensed = sp48Tacts - sp48EarBitChangedFrom1Tacts < chargeTime ? 1u : 0u;
    }
  }

  const uint32_t bit6Value = bit4Sensed != 0u ? 0x40u : 0x00u;
  return (portValue & 0xbfu) | bit6Value;
}

void sp48WritePort(uint32_t address, uint32_t value) {
  if ((address & 0x0001u) != 0u) {
    SP48_PORT_WRITE_NON_FE(address, value);
    return;
  }

  sp48PortFeValue = (uint8_t)value;
  const uint8_t nextBorderColor = (uint8_t)(value & 0x07u);
  if (nextBorderColor != sp48BorderColor) {
    renderUlaUntilCurrentTact();
  }
  sp48BorderColor = nextBorderColor;

  const uint8_t nextMicBit = (value & 0x08u) != 0u ? 1u : 0u;
  const uint8_t nextEarBit = (value & 0x10u) != 0u ? 1u : 0u;
  if (nextEarBit != sp48EarBit || nextMicBit != sp48MicBit) {
    recordAudioTransition(sp48Tacts, sp48TapeMode == SP48_TAPE_MODE_LOAD ? sp48TapeEarBit : nextEarBit, nextMicBit);
  }
  sp48MicBit = nextMicBit;
  sp48TapeProcessMicBit(sp48MicBit);
  sp48BeeperLevel = (uint8_t)((sp48MicBit != 0u ? 1u : 0u) | (nextEarBit != 0u ? 2u : 0u));

  if (sp48EarBit != 0u) {
    if (nextEarBit == 0u) {
      sp48EarBitChangedFrom1Tacts = sp48Tacts;
      sp48EarBit = 0u;
    }
  } else if (nextEarBit != 0u) {
    sp48EarBitChangedFrom0Tacts = sp48Tacts;
    sp48EarBit = 1u;
  }
}

#undef SP48_PORT_WRITE_NON_FE
#undef SP48_PORT_READ_NON_FE
