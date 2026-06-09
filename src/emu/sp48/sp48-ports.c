// ----------------------------------------------------------------------------
// Port I/O

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
    return sp48ReadFloatingBus();
  }

  uint8_t status = 0u;
  const uint32_t selectedLines = (~(address >> 8u)) & 0xffu;
  for (uint32_t line = 0u; line < 8u; line++) {
    if ((selectedLines & (1u << line)) != 0u) {
      status |= sp48KeyboardLines[line];
    }
  }
  uint32_t portValue = ((uint32_t)~status) & 0xffu;
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
    return;
  }

  sp48PortFeValue = (uint8_t)value;
  sp48BorderColor = (uint8_t)(value & 0x07u);

  const uint8_t nextMicBit = (value & 0x08u) != 0u ? 1u : 0u;
  const uint8_t nextEarBit = (value & 0x10u) != 0u ? 1u : 0u;
  if (nextEarBit != sp48EarBit || nextMicBit != sp48MicBit) {
    recordAudioTransition(sp48Tacts, nextEarBit, nextMicBit);
  }
  sp48MicBit = nextMicBit;
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
