#include "zxnext-cpu.h"

static uint32_t executedInstructions;

static void zxnextCpuReset(void) {
  executedInstructions = 0;
}

static uint8_t zxnextCpuReadOpcode(void) {
  uint16_t address = cpuPc;
  uint8_t value = zxnextMemory[address];
  lastMemoryAddress = address;
  lastMemoryValue = value;
  lastMemoryIsWrite = 0;
  cpuPc = (uint16_t)(cpuPc + 1);
  return value;
}

static uint8_t zxnextCpuFetchByte(void) {
  uint8_t value = zxnextMemory[cpuPc];
  cpuPc = (uint16_t)(cpuPc + 1);
  return value;
}

static uint16_t zxnextCpuFetchWord(void) {
  uint8_t low = zxnextCpuFetchByte();
  uint8_t high = zxnextCpuFetchByte();
  return (uint16_t)((high << 8) | low);
}

static uint8_t zxnextCpuReadMemory(uint16_t address) {
  uint8_t value = zxnextMemory[address];
  lastMemoryAddress = address;
  lastMemoryValue = value;
  lastMemoryIsWrite = 0;
  return value;
}

static void zxnextCpuWriteMemory(uint16_t address, uint8_t value) {
  zxnextMemory[address] = value;
  lastMemoryAddress = address;
  lastMemoryValue = value;
  lastMemoryIsWrite = 1;
}

static void zxnextCpuStepTacts(uint32_t instructionTacts) {
  uint32_t previousFrameTact = currentFrameTact;
  tacts += instructionTacts;
  currentFrameTact = (previousFrameTact + instructionTacts * 2u) % ZXNEXT_TACTS_IN_FRAME;
  if (currentFrameTact < previousFrameTact) {
    frames++;
    frameCompleted = 1;
  } else {
    frameCompleted = 0;
  }
}

static void zxnextCpuRefreshMemory(void) {
  uint8_t refreshed = (uint8_t)(((cpuIr & 0x00ffu) + 1u) & 0x7fu);
  cpuIr = (uint16_t)((cpuIr & 0xff00u) | refreshed | (cpuIr & 0x0080u));
}

static uint16_t zxnextCpuSetHighByte(uint16_t value, uint8_t high) {
  return (uint16_t)((high << 8) | (value & 0x00ffu));
}

static uint16_t zxnextCpuSetLowByte(uint16_t value, uint8_t low) {
  return (uint16_t)((value & 0xff00u) | low);
}

static void zxnextCpuLoad8Immediate(uint16_t *pair, uint8_t highByte) {
  uint8_t value = zxnextCpuFetchByte();
  *pair = highByte ? zxnextCpuSetHighByte(*pair, value) : zxnextCpuSetLowByte(*pair, value);
  zxnextCpuStepTacts(7);
}

static void zxnextCpuLoad16Immediate(uint16_t *pair) {
  *pair = zxnextCpuFetchWord();
  zxnextCpuStepTacts(10);
}

static uint32_t zxnextCpuExecuteInstruction(void) {
  executedInstructions++;
  cpuPrefix = 0;
  uint8_t opcode = zxnextCpuReadOpcode();
  zxnextCpuRefreshMemory();

  switch (opcode) {
    case 0x00:
      zxnextCpuStepTacts(4);
      break;
    case 0x01:
      zxnextCpuLoad16Immediate(&cpuBc);
      break;
    case 0x06:
      zxnextCpuLoad8Immediate(&cpuBc, 1);
      break;
    case 0x0e:
      zxnextCpuLoad8Immediate(&cpuBc, 0);
      break;
    case 0x11:
      zxnextCpuLoad16Immediate(&cpuDe);
      break;
    case 0x16:
      zxnextCpuLoad8Immediate(&cpuDe, 1);
      break;
    case 0x1e:
      zxnextCpuLoad8Immediate(&cpuDe, 0);
      break;
    case 0x21:
      zxnextCpuLoad16Immediate(&cpuHl);
      break;
    case 0x26:
      zxnextCpuLoad8Immediate(&cpuHl, 1);
      break;
    case 0x2e:
      zxnextCpuLoad8Immediate(&cpuHl, 0);
      break;
    case 0x31:
      zxnextCpuLoad16Immediate(&cpuSp);
      break;
    case 0x32: {
      uint16_t address = zxnextCpuFetchWord();
      uint8_t accumulator = (uint8_t)(cpuAf >> 8);
      cpuWz = (uint16_t)((accumulator << 8) | ((address + 1) & 0x00ffu));
      zxnextCpuWriteMemory(address, accumulator);
      zxnextCpuStepTacts(13);
      break;
    }
    case 0x3a: {
      uint16_t address = zxnextCpuFetchWord();
      uint8_t value = zxnextCpuReadMemory(address);
      cpuAf = zxnextCpuSetHighByte(cpuAf, value);
      cpuWz = (uint16_t)(address + 1);
      zxnextCpuStepTacts(13);
      break;
    }
    case 0x3e:
      zxnextCpuLoad8Immediate(&cpuAf, 1);
      break;
    case 0xc3:
      cpuWz = zxnextCpuFetchWord();
      cpuPc = cpuWz;
      zxnextCpuStepTacts(10);
      break;
    default:
      zxnextCpuStepTacts(4);
      break;
  }

  return executedInstructions;
}
