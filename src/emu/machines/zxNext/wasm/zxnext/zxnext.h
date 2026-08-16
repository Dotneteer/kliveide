#ifndef ZXNEXT_WASM_ZXNEXT_H
#define ZXNEXT_WASM_ZXNEXT_H

#include <stdint.h>

#define ZXNEXT_FLAT_MEMORY_SIZE 0x10000u
#define ZXNEXT_SRAM_CAPACITY (4u * 1024u * 1024u)
#define ZXNEXT_ROM_SIZE 0x20000u
#define ZXNEXT_PAGE_SIZE 0x2000u
#define ZXNEXT_PAGE_COUNT 8u
#define ZXNEXT_INVALID_PAGE_OFFSET 0xffffffffu
#define ZXNEXT_NEXT_ROM_OFFSET 0x00000u
#define ZXNEXT_DIVMMC_ROM_OFFSET 0x10000u
#define ZXNEXT_MULTIFACE_ROM_OFFSET 0x14000u
#define ZXNEXT_ALT_ROM_OFFSET 0x18000u
#define ZXNEXT_DIVMMC_RAM_OFFSET 0x20000u
#define ZXNEXT_NEXT_RAM_OFFSET 0x40000u
#define ZXNEXT_NEXT_ROM_SIZE 0x10000u
#define ZXNEXT_SMALL_ROM_SIZE 0x4000u
#define ZXNEXT_ALT_ROM_SIZE 0x8000u
#define ZXNEXT_DIVMMC_RAM_SIZE 0x20000u
#define ZXNEXT_SENTINEL_SIZE ZXNEXT_PAGE_SIZE
#define ZXNEXT_DEFAULT_MEMORY_SIZE_KB 2048u
#define ZXNEXT_DEFAULT_MAIN_RAM_PAGES 224u
#define ZXNEXT_MAX_MAIN_RAM_PAGES 480u
#define ZXNEXT_KEYBOARD_ROW_COUNT 8u
#define ZXNEXT_NEXTREG_COUNT 256u
#define ZXNEXT_SCREEN_WIDTH 720u
#define ZXNEXT_SCREEN_HEIGHT 288u
#define ZXNEXT_SCREEN_DISPLAY_WIDTH 512u
#define ZXNEXT_SCREEN_DISPLAY_HEIGHT 192u
#define ZXNEXT_ULA_LOGICAL_WIDTH 256u
#define ZXNEXT_ULA_LOGICAL_HEIGHT 192u
#define ZXNEXT_AUDIO_SAMPLE_CAPACITY 4096u
#define ZXNEXT_SD_COMMAND_BUFFER_SIZE 32u
#define ZXNEXT_SD_RESPONSE_BUFFER_SIZE 512u
#define ZXNEXT_DIAGNOSTIC_BUFFER_SIZE 64u

uint32_t zxnextReadPort(uint32_t address);
void zxnextWritePort(uint32_t address, uint32_t value);
uint32_t zxnextReadNextReg(uint32_t reg);
void zxnextWriteNextReg(uint32_t reg, uint32_t value);
uint32_t zxnextReadMemory(uint32_t address);
void zxnextWriteMemory(uint32_t address, uint32_t value);
void zxnextWritePhysical(uint32_t offset, uint32_t value);
uint32_t zxnextReadDivMmcPortE3(void);
void zxnextWriteDivMmcPortE3(uint32_t value);
void zxnextSetDivMmcEnabled(uint32_t enabled);
void zxnextSetDivMmcEnableAutomap(uint32_t enabled);
uint32_t zxnextReadUlaPort(uint32_t address);
void zxnextWriteUlaPort(uint32_t value);
uint32_t zxnextRenderInstantScreen(void);
uint32_t zxnextReadScreenMemoryOffset(uint32_t offset);
uint32_t zxnextGetDiagnosticFlags(void);

static uint32_t activeMemorySize(void);
static void clearMutablePhysicalMemory(void);
static void resetMmuLayout(void);
static void updateMemoryConfig(uint32_t fromPort);
static void rebuildFlatMemory(void);
static void updateFlatMemoryForPhysicalOffset(uint32_t physicalOffset);
static void writeNextRegInternal(uint32_t reg, uint32_t value);
static void resetNextRegs(uint32_t hard);
static uint32_t isPortGroupEnabled(uint32_t regIndex, uint32_t bit);
static uint32_t readPhysical(uint32_t offset);
static void resetDivMmcState(void);
static void syncDivMmcStateFromNextRegs(void);
static uint32_t divMmcIsActive(void);
static uint32_t divMmcReadOffset(uint32_t address);
static uint32_t divMmcHandleWrite(uint32_t address, uint32_t value);
static void zxnextDivMmcBeforeOpcodeFetch(uint32_t pc);
static void zxnextDivMmcAfterOpcodeFetch(uint32_t retnExecuted);
static void resetKeyboardState(void);
static uint32_t readKeyboardRows(uint32_t address);
static void resetUlaState(void);
static void resetScreenState(void);
static void updateScreenTimingFromNextRegs(void);
static void initializeScreenRenderingTables(void);

#endif
