#include "zx-spectrum-sd.h"

/*
 * The SD card on the SPI bus, shared by the Next and the classic cores' DivMMC
 * (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md, C3); moved here from the Next's zxnext-sd.c unchanged.
 * The card answers the SPI-mode commands from the SD Physical Layer specification; the sectors are the
 * host's: a read or a write sets the host command (zxSdGetHostCommand), the frame loop stops, and the
 * host answers with zxSdSetReadResponse / zxSdSetWriteResponse.
 *
 * The including core defines:
 * - ZX_SD_TACTS: the CPU's T-state counter (the read delay after a command)
 * - ZX_SD_CONFIG_MODE_OR_FLASH_RESET(): the Next's config mode or flash reset ($E7 = $7F selects the
 *   flash); 0 on a classic machine
 */

#define ZX_SD_BYTES_PER_SECTOR 512u
#define ZX_SD_RESPONSE_CAPACITY 540u
#define ZX_SD_READ_DELAY 56u

enum {
  ZX_SD_STATE_IDLE = 0,
  ZX_SD_STATE_READY = 1,
  ZX_SD_STATE_TRAN = 2,
  ZX_SD_STATE_DATA = 3,
  ZX_SD_STATE_DATA_MULTI = 4,
  ZX_SD_STATE_WRITE_WAITFE = 5,
  ZX_SD_STATE_WRITE_DATA = 6
};

typedef struct {
  uint8_t cid[16];
  uint8_t commandIndex;
  uint8_t lastCommand;
  uint32_t lastByteReceived;
  uint8_t response[ZX_SD_RESPONSE_CAPACITY];
  int16_t responseIndex;
  uint16_t responseLength;
  uint8_t responseReady;
  uint8_t ocr[5];
  uint8_t commandParams[4];
  uint8_t commandParamCount;
  uint8_t state;
  uint8_t blockToWrite[ZX_SD_BYTES_PER_SECTOR + 2u];
  uint16_t dataIndex;
  uint8_t bACMD;
  uint32_t totalSectors;
  uint32_t blknext;
  uint8_t infoKnown;       /* the host reported the size (0 = no card) */
  uint8_t multiR1Pending;  /* CMD18's R1 still has to precede the first block */
} ZxSdCard;

static uint8_t sdSelectedCard;
static uint8_t sdPortE7Value;
static ZxSdCard sdCards[2];
static uint8_t sdHostCommand;
static uint8_t sdHostCard;
static uint32_t sdHostSector;
static uint16_t sdWriteBufferLength;

static uint16_t zxSdCrc16(const uint8_t *data, uint32_t length) {
  uint16_t crc = 0;
  for (uint32_t i = 0; i < length; i++) {
    crc ^= (uint16_t)data[i] << 8;
    for (uint32_t bit = 0; bit < 8u; bit++) {
      crc = (crc & 0x8000u) ? (uint16_t)((crc << 1) ^ 0x1021u) : (uint16_t)(crc << 1);
    }
  }
  return crc;
}

static uint8_t zxSdCrc7(const uint8_t *data, uint32_t length) {
  uint8_t crc = 0;
  for (uint32_t i = 0; i < length; i++) {
    uint8_t value = data[i];
    for (uint32_t bit = 0; bit < 8u; bit++) {
      crc <<= 1;
      if (((value ^ crc) & 0x80u) != 0) crc ^= 0x09u;
      value <<= 1;
    }
  }
  return crc & 0x7fu;
}

static void zxSdSetResponse(ZxSdCard *card, const uint8_t *response, uint32_t length, uint32_t ready) {
  uint32_t capped = length > ZX_SD_RESPONSE_CAPACITY ? ZX_SD_RESPONSE_CAPACITY : length;
  for (uint32_t i = 0; i < capped; i++) card->response[i] = response[i];
  card->responseLength = (uint16_t)capped;
  card->responseIndex = 0;
  card->responseReady = ready != 0;
}

static void zxSdSetResponseBytes(ZxSdCard *card, uint8_t a) {
  uint8_t response[1] = { a };
  zxSdSetResponse(card, response, 1, 1);
}

static void zxSdSetResponse2(ZxSdCard *card, uint8_t a, uint8_t b) {
  uint8_t response[2] = { a, b };
  zxSdSetResponse(card, response, 2, 1);
}

static void zxSdBuildCsd(ZxSdCard *card, uint8_t *csd) {
  for (uint32_t i = 0; i < 16u; i++) csd[i] = 0;
  uint32_t totalSectors = card->totalSectors > 0 ? card->totalSectors : 8u * 1024u * 1024u;
  uint32_t cSize = (totalSectors >> 10) - 1u;
  csd[0] = 0x40; csd[1] = 0x0e; csd[2] = 0x00; csd[3] = 0x32;
  csd[4] = 0x5b; csd[5] = 0x59; csd[6] = 0x00;
  csd[7] = (uint8_t)((cSize >> 16) & 0x3fu);
  csd[8] = (uint8_t)((cSize >> 8) & 0xffu);
  csd[9] = (uint8_t)(cSize & 0xffu);
  csd[10] = 0x3f; csd[11] = 0x80; csd[12] = 0x06; csd[13] = 0x40; csd[14] = 0x00; csd[15] = 0x01;
}

static uint32_t zxSdArg(const ZxSdCard *card) {
  return ((uint32_t)card->commandParams[0] << 24) |
    ((uint32_t)card->commandParams[1] << 16) |
    ((uint32_t)card->commandParams[2] << 8) |
    (uint32_t)card->commandParams[3];
}

static void zxSdSetHostCommand(uint32_t command, uint32_t card, uint32_t sector) {
  sdHostCommand = (uint8_t)command;
  sdHostCard = (uint8_t)card;
  sdHostSector = sector;
}

static void zxSdResetCard(ZxSdCard *card, uint32_t index) {
  uint32_t savedSectors = card->totalSectors;
  uint8_t manufacturer = index == 0 ? 0x01u : 0x02u;
  uint8_t serial0 = index == 0 ? 0x01u : 0x05u;
  uint8_t serial1 = index == 0 ? 0x02u : 0x06u;
  uint8_t serial2 = index == 0 ? 0x03u : 0x07u;
  uint8_t serial3 = index == 0 ? 0x04u : 0x08u;
  card->cid[0] = manufacturer;
  card->cid[1] = 'K'; card->cid[2] = 'l'; card->cid[3] = 'i'; card->cid[4] = 'v';
  card->cid[5] = 'e'; card->cid[6] = 'I'; card->cid[7] = 'D'; card->cid[8] = index == 0 ? 'E' : '1';
  card->cid[9] = 1; card->cid[10] = serial0; card->cid[11] = serial1; card->cid[12] = serial2;
  card->cid[13] = serial3; card->cid[14] = 127;
  card->cid[15] = (uint8_t)(((uint32_t)zxSdCrc7(card->cid, 15) << 1) | 0x01u);
  card->commandIndex = 0;
  card->lastCommand = 0;
  card->lastByteReceived = 0;
  card->responseIndex = -1;
  card->responseLength = 0;
  card->responseReady = 0;
  card->ocr[0] = 0x00; card->ocr[1] = 0xc0; card->ocr[2] = 0xff; card->ocr[3] = 0x80; card->ocr[4] = 0x00;
  for (uint32_t i = 0; i < 4u; i++) card->commandParams[i] = 0;
  card->commandParamCount = 0;
  card->state = savedSectors > 0 ? ZX_SD_STATE_TRAN : ZX_SD_STATE_IDLE;
  card->dataIndex = 0;
  card->bACMD = 0;
  card->totalSectors = savedSectors;
  card->blknext = 0;
  card->multiR1Pending = 0;
}

static void zxSdReset(void) {
  sdSelectedCard = 0;
  sdPortE7Value = 0xff;
  sdHostCommand = ZX_SD_HOST_COMMAND_NONE;
  sdHostCard = 0xff;
  sdHostSector = 0;
  sdWriteBufferLength = 0;
  zxSdResetCard(&sdCards[0], 0);
  zxSdResetCard(&sdCards[1], 1);
}

static void zxSdSetCardInfo(uint32_t card, uint32_t totalSectors) {
  sdCards[card & 0x01u].totalSectors = totalSectors;
  sdCards[card & 0x01u].infoKnown = 1;
}

/*
 * Whether a card sits in the slot (SdCardDevice.cardPresent): card 0 unless the host reported no sectors
 * (its size is fetched lazily at the first sector access); card 1 only once given a size. An empty slot
 * never drives MISO - the bus reads $FF - and hears nothing.
 */
static uint32_t zxSdCardPresent(uint32_t cardIndex) {
  const ZxSdCard *card = &sdCards[cardIndex & 0x01u];
  return (cardIndex & 0x01u) == 0u ? !(card->infoKnown && card->totalSectors == 0u) : card->totalSectors > 0u;
}

static void zxSdSpiCsWrite(uint32_t value) {
  uint8_t data = (uint8_t)value;
  uint8_t reg;
  if ((data & 0x03u) == 0x02u) {
    reg = 0xfe;
  } else if ((data & 0x03u) == 0x01u) {
    reg = 0xfd;
  } else if (data == 0xfbu || data == 0xf7u) {
    reg = data;
  } else if (data == 0x7fu && ZX_SD_CONFIG_MODE_OR_FLASH_RESET()) {
    reg = 0x7f;
  } else {
    reg = 0xff;
  }
  sdPortE7Value = reg;
  sdSelectedCard = (reg & 0x01u) == 0 ? 0 : (((reg & 0x02u) == 0) ? 1 : 0xffu);
}

static void zxSdCompleteCommand(ZxSdCard *card, uint32_t cardIndex) {
  uint8_t response[ZX_SD_RESPONSE_CAPACITY];
  switch (card->lastCommand) {
    case 0x40:
      card->state = ZX_SD_STATE_IDLE;
      zxSdSetResponseBytes(card, 0x01u);
      break;
    case 0x41:
      card->state = ZX_SD_STATE_READY;
      zxSdSetResponseBytes(card, 0x00);
      break;
    case 0x48:
      response[0] = 0x01; response[1] = 0x00; response[2] = 0x00; response[3] = 0x01; response[4] = 0xaa;
      zxSdSetResponse(card, response, 5, 1);
      break;
    case 0x49: {
      response[0] = 0x00; response[1] = 0xff; response[2] = 0xfe;
      if ((cardIndex & 0x01u) == 0u) {
        zxSdBuildCsd(card, &response[3]);
      } else {
        for (uint32_t i = 3u; i < 19u; i++) response[i] = 0x00u;
      }
      zxSdSetResponse(card, response, 19, 1);
      break;
    }
    case 0x4a: {
      response[0] = 0x00; response[1] = 0xff; response[2] = 0xfe;
      for (uint32_t i = 0; i < 16u; i++) response[3u + i] = card->cid[i];
      uint16_t crc = zxSdCrc16(card->cid, 16);
      response[19] = (uint8_t)(crc >> 8);
      response[20] = (uint8_t)(crc & 0xffu);
      zxSdSetResponse(card, response, 21, 1);
      break;
    }
    case 0x4c:
      card->state = ZX_SD_STATE_TRAN;
      zxSdSetResponseBytes(card, 0x00);
      break;
    case 0x4d:
      zxSdSetResponse2(card, 0x00, 0x00);
      break;
    case 0x50:
      zxSdSetResponseBytes(card, zxSdArg(card) == ZX_SD_BYTES_PER_SECTOR ? 0x00u : 0x40u);
      break;
    case 0x51:
      card->state = ZX_SD_STATE_DATA;
      zxSdSetHostCommand(cardIndex == 0 ? ZX_SD_HOST_COMMAND_READ : ZX_SD_HOST_COMMAND_READ_CARD1, cardIndex, zxSdArg(card));
      card->responseReady = 0;
      break;
    case 0x52:
      card->state = ZX_SD_STATE_DATA_MULTI;
      card->multiR1Pending = 1;
      card->blknext = zxSdArg(card);
      response[0] = 0x00;
      zxSdSetResponse(card, response, 1, 0);
      zxSdSetHostCommand(cardIndex == 0 ? ZX_SD_HOST_COMMAND_READ : ZX_SD_HOST_COMMAND_READ_CARD1, cardIndex, card->blknext++);
      card->responseReady = 0;
      break;
    case 0x58:
      card->state = ZX_SD_STATE_WRITE_WAITFE;
      response[0] = 0x00;
      zxSdSetResponse(card, response, 1, 0);
      break;
    case 0x69:
      if (card->bACMD) {
        card->state = ZX_SD_STATE_READY;
        zxSdSetResponseBytes(card, 0x00);
      } else {
        zxSdSetResponseBytes(card, 0xff);
      }
      break;
    case 0x77:
      zxSdSetResponseBytes(card, 0x01);
      break;
    case 0x7a:
      zxSdSetResponse(card, card->ocr, 5, 1);
      break;
    case 0x7b:
      zxSdSetResponseBytes(card, 0x00);
      break;
    default:
      break;
  }
  card->bACMD = card->lastCommand == 0x77u;
}

static void zxSdWriteCardData(uint32_t cardIndex, uint32_t value) {
  ZxSdCard *card = &sdCards[cardIndex & 0x01u];
  uint8_t data = (uint8_t)value;
  card->responseIndex = -1;
  card->responseReady = 0;

  if (card->state == ZX_SD_STATE_WRITE_WAITFE) {
    if (data == 0xfeu) {
      card->state = ZX_SD_STATE_WRITE_DATA;
      card->dataIndex = 0;
    }
    return;
  }

  if (card->state == ZX_SD_STATE_WRITE_DATA) {
    card->blockToWrite[card->dataIndex++] = data;
    if (card->dataIndex == ZX_SD_BYTES_PER_SECTOR + 2u) {
      card->state = ZX_SD_STATE_TRAN;
      sdWriteBufferLength = ZX_SD_BYTES_PER_SECTOR;
      zxSdSetHostCommand(cardIndex == 0 ? ZX_SD_HOST_COMMAND_WRITE : ZX_SD_HOST_COMMAND_WRITE_CARD1, cardIndex, zxSdArg(card));
      card->responseReady = 0;
    }
    return;
  }

  /* a command starts with bits 01; anything else (the $FF of an idle bus) is not a command */
  if (card->commandIndex == 0) {
    if ((data & 0xc0u) != 0x40u) return;
    card->lastCommand = data;
    card->commandParamCount = 0;
    card->commandIndex = 1;
    card->lastByteReceived = ZX_SD_TACTS;
    return;
  }

  if (card->commandIndex >= 1 && card->commandIndex <= 4) {
    card->commandParams[card->commandIndex - 1u] = data;
    card->commandParamCount = card->commandIndex;
  }
  card->commandIndex++;
  if (card->commandIndex == 6) {
    card->commandIndex = 0;
    zxSdCompleteCommand(card, cardIndex & 0x01u);
  }
}

static void zxSdWriteMmcData(uint32_t value) {
  if (sdSelectedCard == 0xffu || !zxSdCardPresent(sdSelectedCard)) return;
  zxSdWriteCardData(sdSelectedCard & 0x01u, value);
}

static uint32_t zxSdReadCardData(uint32_t cardIndex) {
  ZxSdCard *card = &sdCards[cardIndex & 0x01u];
  if (!card->responseReady) {
    if (card->responseIndex == -1 && ZX_SD_TACTS - card->lastByteReceived < ZX_SD_READ_DELAY) return 0xffu;
  }
  if (card->responseIndex >= 0 && card->responseIndex < (int16_t)card->responseLength) {
    uint8_t byteValue = card->response[card->responseIndex++];
    if (card->responseIndex == (int16_t)card->responseLength && card->state == ZX_SD_STATE_DATA_MULTI) {
      zxSdSetHostCommand(cardIndex == 0 ? ZX_SD_HOST_COMMAND_READ : ZX_SD_HOST_COMMAND_READ_CARD1, cardIndex, card->blknext++);
      card->responseReady = 0;
      card->responseIndex = -1;
    }
    return byteValue;
  }
  return 0xffu;
}

static uint32_t zxSdReadMmcData(void) {
  if (sdSelectedCard == 0xffu || !zxSdCardPresent(sdSelectedCard)) return 0xffu;
  return zxSdReadCardData(sdSelectedCard & 0x01u);
}

static uint32_t zxSdGetSelectedCard(void) { return sdSelectedCard; }
static uint32_t zxSdGetPortE7Value(void) { return sdPortE7Value; }
static uint32_t zxSdGetState(uint32_t card) { return sdCards[card & 0x01u].state; }
static uint32_t zxSdGetCommandIndex(uint32_t card) { return sdCards[card & 0x01u].commandIndex; }
static uint32_t zxSdGetLastCommand(uint32_t card) { return sdCards[card & 0x01u].lastCommand; }
static uint32_t zxSdGetResponseReady(uint32_t card) { return sdCards[card & 0x01u].responseReady; }
static uint32_t zxSdGetResponseIndex(uint32_t card) { return (uint32_t)sdCards[card & 0x01u].responseIndex; }
static uint32_t zxSdGetHostCommand(void) { return sdHostCommand; }
static uint32_t zxSdGetHostSector(void) { return sdHostSector; }
static uint32_t zxSdGetHostCard(void) { return sdHostCard; }
static uint32_t zxSdWriteBufferPtr(void) { return (uint32_t)(uintptr_t)sdCards[sdHostCard & 0x01u].blockToWrite; }
static uint32_t zxSdGetWriteBufferLength(void) { return sdWriteBufferLength; }

static void zxSdClearHostCommand(void) {
  sdHostCommand = ZX_SD_HOST_COMMAND_NONE;
  sdHostCard = 0xff;
  sdHostSector = 0;
  sdWriteBufferLength = 0;
}

static void zxSdSetReadResponse(uint32_t cardIndex, uint32_t dataPtr, uint32_t length) {
  ZxSdCard *card = &sdCards[cardIndex & 0x01u];
  uint8_t *data = (uint8_t *)(uintptr_t)dataPtr;
  uint8_t response[ZX_SD_RESPONSE_CAPACITY];
  uint32_t dataLength = length < ZX_SD_BYTES_PER_SECTOR ? length : ZX_SD_BYTES_PER_SECTOR;
  uint16_t crc = zxSdCrc16(data, dataLength);
  if (card->state == ZX_SD_STATE_DATA_MULTI) {
    /* token + data + CRC16; the first block still carries CMD18's R1 + a gap byte */
    uint32_t p = 0;
    if (card->multiR1Pending) {
      response[p++] = 0x00;
      response[p++] = 0xff;
      card->multiR1Pending = 0;
    }
    response[p] = 0xfe;
    for (uint32_t i = 0; i < dataLength; i++) response[p + 1u + i] = data[i];
    response[p + 1u + dataLength] = (uint8_t)(crc >> 8);
    response[p + 2u + dataLength] = (uint8_t)(crc & 0xffu);
    zxSdSetResponse(card, response, p + 1u + dataLength + 2u, 1);
  } else {
    response[0] = 0x00; response[1] = 0xff; response[2] = 0xfe;
    for (uint32_t i = 0; i < dataLength; i++) response[3u + i] = data[i];
    response[3u + dataLength] = (uint8_t)(crc >> 8);
    response[4u + dataLength] = (uint8_t)(crc & 0xffu);
    zxSdSetResponse(card, response, 3u + dataLength + 2u, 1);
  }
}

static void zxSdSetWriteResponse(uint32_t cardIndex, uint32_t success) {
  ZxSdCard *card = &sdCards[cardIndex & 0x01u];
  uint8_t response[3] = {
    success ? 0x05u : 0x0du,
    0xffu,
    success ? 0xfeu : 0xffu
  };
  zxSdSetResponse(card, response, 3, 1);
}
