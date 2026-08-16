#include <stdint.h>

#define ZXNEXT_FLAT_MEMORY_SIZE 0x10000u
#define ZXNEXT_SRAM_CAPACITY (4u * 1024u * 1024u)
#define ZXNEXT_ROM_SIZE 0x20000u
#define ZXNEXT_NEXT_ROM_OFFSET 0x00000u
#define ZXNEXT_DIVMMC_ROM_OFFSET 0x10000u
#define ZXNEXT_MULTIFACE_ROM_OFFSET 0x14000u
#define ZXNEXT_ALT_ROM_OFFSET 0x18000u
#define ZXNEXT_NEXT_ROM_SIZE 0x10000u
#define ZXNEXT_SMALL_ROM_SIZE 0x4000u
#define ZXNEXT_ALT_ROM_SIZE 0x8000u
#define ZXNEXT_KEYBOARD_ROW_COUNT 8u
#define ZXNEXT_NEXTREG_COUNT 256u
#define ZXNEXT_SCREEN_WIDTH 720u
#define ZXNEXT_SCREEN_HEIGHT 288u
#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 4096u
#define ZXNEXT_SD_COMMAND_BUFFER_SIZE 32u
#define ZXNEXT_SD_RESPONSE_BUFFER_SIZE 512u
#define ZXNEXT_DIAGNOSTIC_BUFFER_SIZE 64u

static uint8_t flatMemory[ZXNEXT_FLAT_MEMORY_SIZE];
static uint8_t sram[ZXNEXT_SRAM_CAPACITY];
static uint8_t rom[ZXNEXT_ROM_SIZE];
static uint8_t keyboardRows[ZXNEXT_KEYBOARD_ROW_COUNT];
static uint8_t nextRegs[ZXNEXT_NEXTREG_COUNT];
static uint32_t pixelBuffer[ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT];
static int16_t audioSamples[ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u];
static uint8_t sdCommandBuffer[ZXNEXT_SD_COMMAND_BUFFER_SIZE];
static uint8_t sdResponseBuffer[ZXNEXT_SD_RESPONSE_BUFFER_SIZE];
static uint32_t diagnosticBuffer[ZXNEXT_DIAGNOSTIC_BUFFER_SIZE];

static uint32_t frames = 0;
static uint32_t tacts = 0;
static uint32_t hardResetCount = 0;
static uint32_t resetCount = 0;
static uint32_t romUploadCount = 0;
static uint32_t uploadedRomMask = 0;
static uint16_t cpuPc = 0;
static uint16_t cpuSp = 0xffffu;

static void clearMutableState(void) {
  for (uint32_t i = 0; i < ZXNEXT_FLAT_MEMORY_SIZE; i++) flatMemory[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_KEYBOARD_ROW_COUNT; i++) keyboardRows[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_NEXTREG_COUNT; i++) nextRegs[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SCREEN_WIDTH * ZXNEXT_SCREEN_HEIGHT; i++) pixelBuffer[i] = 0xff000000u;
  for (uint32_t i = 0; i < ZXNEXT_AUDIO_SAMPLE_CAPACITY * 2u; i++) audioSamples[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_COMMAND_BUFFER_SIZE; i++) sdCommandBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_SD_RESPONSE_BUFFER_SIZE; i++) sdResponseBuffer[i] = 0;
  for (uint32_t i = 0; i < ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; i++) diagnosticBuffer[i] = 0;
  frames = 0;
  tacts = 0;
  cpuPc = 0;
  cpuSp = 0xffffu;
}

static uint32_t romBaseForKind(uint32_t kind) {
  switch (kind) {
    case 0: return ZXNEXT_NEXT_ROM_OFFSET;
    case 1: return ZXNEXT_DIVMMC_ROM_OFFSET;
    case 2: return ZXNEXT_MULTIFACE_ROM_OFFSET;
    case 3: return ZXNEXT_ALT_ROM_OFFSET;
    default: return ZXNEXT_ROM_SIZE;
  }
}

static uint32_t romLimitForKind(uint32_t kind) {
  switch (kind) {
    case 0: return ZXNEXT_NEXT_ROM_SIZE;
    case 1: return ZXNEXT_SMALL_ROM_SIZE;
    case 2: return ZXNEXT_SMALL_ROM_SIZE;
    case 3: return ZXNEXT_ALT_ROM_SIZE;
    default: return 0;
  }
}

uint32_t zxnextMemoryPtr(void) { return (uint32_t)(uintptr_t)flatMemory; }
uint32_t zxnextSramPtr(void) { return (uint32_t)(uintptr_t)sram; }
uint32_t zxnextRomPtr(void) { return (uint32_t)(uintptr_t)rom; }
uint32_t zxnextKeyboardRowsPtr(void) { return (uint32_t)(uintptr_t)keyboardRows; }
uint32_t zxnextNextRegsPtr(void) { return (uint32_t)(uintptr_t)nextRegs; }
uint32_t zxnextPixelBufferPtr(void) { return (uint32_t)(uintptr_t)pixelBuffer; }
uint32_t zxnextAudioSamplesPtr(void) { return (uint32_t)(uintptr_t)audioSamples; }
uint32_t zxnextSdCommandBufferPtr(void) { return (uint32_t)(uintptr_t)sdCommandBuffer; }
uint32_t zxnextSdResponseBufferPtr(void) { return (uint32_t)(uintptr_t)sdResponseBuffer; }
uint32_t zxnextDiagnosticBufferPtr(void) { return (uint32_t)(uintptr_t)diagnosticBuffer; }

void zxnextHardReset(void) {
  hardResetCount++;
  resetCount++;
  clearMutableState();
}

void zxnextReset(void) {
  resetCount++;
  clearMutableState();
}

uint32_t zxnextUploadRomByte(uint32_t kind, uint32_t offset, uint32_t value) {
  const uint32_t limit = romLimitForKind(kind);
  if (offset >= limit) return 0;
  const uint32_t base = romBaseForKind(kind);
  if (base >= ZXNEXT_ROM_SIZE || base + offset >= ZXNEXT_ROM_SIZE) return 0;
  rom[base + offset] = (uint8_t)(value & 0xffu);
  romUploadCount++;
  uploadedRomMask |= 1u << kind;
  return 1;
}

uint32_t zxnextReadRomByte(uint32_t kind, uint32_t offset) {
  const uint32_t limit = romLimitForKind(kind);
  if (offset >= limit) return 0xffu;
  const uint32_t base = romBaseForKind(kind);
  if (base >= ZXNEXT_ROM_SIZE || base + offset >= ZXNEXT_ROM_SIZE) return 0xffu;
  return rom[base + offset];
}

uint32_t zxnextGetFlatMemorySize(void) { return ZXNEXT_FLAT_MEMORY_SIZE; }
uint32_t zxnextGetSramSize(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetSramCapacity(void) { return ZXNEXT_SRAM_CAPACITY; }
uint32_t zxnextGetRomSize(void) { return ZXNEXT_ROM_SIZE; }
uint32_t zxnextGetKeyboardRowCount(void) { return ZXNEXT_KEYBOARD_ROW_COUNT; }
uint32_t zxnextGetNextRegCount(void) { return ZXNEXT_NEXTREG_COUNT; }
uint32_t zxnextGetScreenWidth(void) { return ZXNEXT_SCREEN_WIDTH; }
uint32_t zxnextGetScreenHeight(void) { return ZXNEXT_SCREEN_HEIGHT; }
uint32_t zxnextGetAudioSampleCapacity(void) { return ZXNEXT_AUDIO_SAMPLE_CAPACITY; }
uint32_t zxnextGetSdCommandBufferSize(void) { return ZXNEXT_SD_COMMAND_BUFFER_SIZE; }
uint32_t zxnextGetSdResponseBufferSize(void) { return ZXNEXT_SD_RESPONSE_BUFFER_SIZE; }
uint32_t zxnextGetDiagnosticBufferSize(void) { return ZXNEXT_DIAGNOSTIC_BUFFER_SIZE; }
uint32_t zxnextGetFrames(void) { return frames; }
uint32_t zxnextGetTacts(void) { return tacts; }
uint32_t zxnextGetHardResetCount(void) { return hardResetCount; }
uint32_t zxnextGetResetCount(void) { return resetCount; }
uint32_t zxnextGetRomUploadCount(void) { return romUploadCount; }
uint32_t zxnextGetUploadedRomMask(void) { return uploadedRomMask; }
uint32_t zxnextGetCpuPc(void) { return cpuPc; }
uint32_t zxnextGetCpuSp(void) { return cpuSp; }
uint32_t zxnextGetDiagnosticFlags(void) { return 0; }
