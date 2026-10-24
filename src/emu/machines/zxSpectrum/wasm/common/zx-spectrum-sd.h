/*
 * An SD card on the SPI bus (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C3): port $E7 selects the
 * card, port $EB moves the bytes; the sectors come from the host - shared by the Next's two cards and
 * the classic machines' DivMMC.
 */
#ifndef ZX_SPECTRUM_SD_H
#define ZX_SPECTRUM_SD_H

#include <stdint.h>

#define ZX_SD_HOST_COMMAND_NONE 0u
#define ZX_SD_HOST_COMMAND_READ 1u
#define ZX_SD_HOST_COMMAND_WRITE 2u
#define ZX_SD_HOST_COMMAND_READ_CARD1 3u
#define ZX_SD_HOST_COMMAND_WRITE_CARD1 4u

static void zxSdReset(void);
static void zxSdSetCardInfo(uint32_t card, uint32_t totalSectors);
static void zxSdSpiCsWrite(uint32_t value);
static void zxSdWriteMmcData(uint32_t value);
static uint32_t zxSdReadMmcData(void);
static uint32_t zxSdGetSelectedCard(void);
static uint32_t zxSdGetPortE7Value(void);
static uint32_t zxSdGetState(uint32_t card);
static uint32_t zxSdGetCommandIndex(uint32_t card);
static uint32_t zxSdGetLastCommand(uint32_t card);
static uint32_t zxSdGetResponseReady(uint32_t card);
static uint32_t zxSdGetResponseIndex(uint32_t card);
static uint32_t zxSdGetHostCommand(void);
static uint32_t zxSdGetHostSector(void);
static uint32_t zxSdGetHostCard(void);
static uint32_t zxSdWriteBufferPtr(void);
static uint32_t zxSdGetWriteBufferLength(void);
static void zxSdClearHostCommand(void);
static void zxSdSetReadResponse(uint32_t card, uint32_t dataPtr, uint32_t length);
static void zxSdSetWriteResponse(uint32_t card, uint32_t success);

#endif
