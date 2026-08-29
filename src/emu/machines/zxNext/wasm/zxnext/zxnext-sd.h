#ifndef ZXNEXT_SD_H
#define ZXNEXT_SD_H

#include <stdint.h>

#define ZXNEXT_SD_HOST_COMMAND_NONE 0u
#define ZXNEXT_SD_HOST_COMMAND_READ 1u
#define ZXNEXT_SD_HOST_COMMAND_WRITE 2u
#define ZXNEXT_SD_HOST_COMMAND_READ_CARD1 3u
#define ZXNEXT_SD_HOST_COMMAND_WRITE_CARD1 4u

static void zxnextSdReset(void);
static void zxnextSdSetCardInfo(uint32_t card, uint32_t totalSectors);
static void zxnextSdSpiCsWrite(uint32_t value);
static void zxnextSdWriteMmcData(uint32_t value);
static uint32_t zxnextSdReadMmcData(void);
static uint32_t zxnextSdGetSelectedCard(void);
static uint32_t zxnextSdGetPortE7Value(void);
static uint32_t zxnextSdGetState(uint32_t card);
static uint32_t zxnextSdGetCommandIndex(uint32_t card);
static uint32_t zxnextSdGetLastCommand(uint32_t card);
static uint32_t zxnextSdGetResponseReady(uint32_t card);
static uint32_t zxnextSdGetResponseIndex(uint32_t card);
static uint32_t zxnextSdGetHostCommand(void);
static uint32_t zxnextSdGetHostSector(void);
static uint32_t zxnextSdGetHostCard(void);
static uint32_t zxnextSdWriteBufferPtr(void);
static uint32_t zxnextSdGetWriteBufferLength(void);
static void zxnextSdClearHostCommand(void);
static void zxnextSdSetReadResponse(uint32_t card, uint32_t dataPtr, uint32_t length);
static void zxnextSdSetWriteResponse(uint32_t card, uint32_t success);

#endif
