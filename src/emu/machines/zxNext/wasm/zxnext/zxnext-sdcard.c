#include "zxnext.h"

#define SD_STATE_IDLE 0u
#define SD_STATE_READY 1u
#define SD_STATE_TRAN 2u
#define SD_STATE_DATA 3u
#define SD_STATE_WRITE_WAITFE 5u
#define SD_STATE_WRITE_DATA 6u
#define SD_PENDING_NONE 0u
#define SD_PENDING_READ 1u
#define SD_PENDING_WRITE 2u
#define SD_SECTOR_SIZE 512u

static uint16_t crc16Ccitt(const uint8_t *data, uint32_t length) {
  uint16_t crc = 0u;
  for (uint32_t i = 0; i < length; i++) {
    crc ^= (uint16_t)data[i] << 8u;
    for (uint32_t bit = 0; bit < 8u; bit++) {
      crc = (crc & 0x8000u) != 0u ? (uint16_t)((crc << 1u) ^ 0x1021u) : (uint16_t)(crc << 1u);
    }
  }
  return crc;
}

static uint32_t activeSdCard(void) {
  return sdSelectedCard <= 1u ? sdSelectedCard : 0xffu;
}

static void setSdResponse(uint32_t card, const uint8_t *data, uint32_t length) {
  if (card > 1u) return;
  if (length > ZXNEXT_SD_RESPONSE_BUFFER_SIZE) length = ZXNEXT_SD_RESPONSE_BUFFER_SIZE;
  for (uint32_t i = 0; i < length; i++) {
    sdResponse[card][i] = data[i];
    if (card == 0u) sdResponseBuffer[i] = data[i];
  }
  sdResponseLength[card] = length;
  sdResponseIndex[card] = 0u;
  sdResponseReady[card] = 1u;
}

static void setSdResponse1(uint32_t card, uint8_t value) {
  const uint8_t data[1] = { value };
  setSdResponse(card, data, 1u);
}

static void buildCsd(uint32_t card, uint8_t *out) {
  const uint32_t sectors = sdTotalSectors[card] != 0u ? sdTotalSectors[card] : 8u * 1024u * 1024u;
  const uint32_t cSize = (sectors >> 10u) - 1u;
  for (uint32_t i = 0; i < 16u; i++) out[i] = 0u;
  out[0] = 0x40u;
  out[1] = 0x0eu;
  out[3] = 0x32u;
  out[4] = 0x5bu;
  out[5] = 0x59u;
  out[7] = (uint8_t)((cSize >> 16u) & 0x3fu);
  out[8] = (uint8_t)((cSize >> 8u) & 0xffu);
  out[9] = (uint8_t)(cSize & 0xffu);
  out[10] = 0x3fu;
  out[11] = 0x80u;
  out[12] = 0x06u;
  out[13] = 0x40u;
  out[15] = 0x01u;
}

static void buildCid(uint32_t card, uint8_t *out) {
  for (uint32_t i = 0; i < 16u; i++) out[i] = 0u;
  out[0] = card == 0u ? 0x01u : 0x02u;
  out[1] = 'K';
  out[2] = 'l';
  out[3] = 'i';
  out[4] = 'v';
  out[5] = 'e';
  out[6] = 'I';
  out[7] = 'D';
  out[8] = card == 0u ? 'E' : '1';
  out[9] = 1u;
  out[10] = card == 0u ? 1u : 5u;
  out[11] = card == 0u ? 2u : 6u;
  out[12] = card == 0u ? 3u : 7u;
  out[13] = card == 0u ? 4u : 8u;
  out[14] = 127u;
  out[15] = 1u;
}

static uint32_t commandSector(uint32_t card) {
  return ((uint32_t)sdCommandParams[card][0] << 24u) |
    ((uint32_t)sdCommandParams[card][1] << 16u) |
    ((uint32_t)sdCommandParams[card][2] << 8u) |
    sdCommandParams[card][3];
}

static void recordPendingSdCommand(uint32_t type, uint32_t card, uint32_t sector) {
  sdPendingCommand = type;
  sdPendingCard = card;
  sdPendingSector = sector;
  sdCommandBuffer[0] = (uint8_t)type;
  sdCommandBuffer[1] = (uint8_t)card;
  sdCommandBuffer[2] = (uint8_t)(sector >> 24u);
  sdCommandBuffer[3] = (uint8_t)(sector >> 16u);
  sdCommandBuffer[4] = (uint8_t)(sector >> 8u);
  sdCommandBuffer[5] = (uint8_t)sector;
}

static void completeSdCommand(uint32_t card) {
  uint8_t response[24];
  uint8_t payload[16];
  const uint8_t ocr[5] = { 0x00u, 0xc0u, 0xffu, 0x80u, 0x00u };
  const uint8_t command = sdLastCommand[card];
  sdCommandCount++;
  switch (command) {
    case 0x40u:
      if (sdTotalSectors[card] == 0u) {
        setSdResponse1(card, 0x00u);
      } else {
        sdState[card] = SD_STATE_IDLE;
        setSdResponse1(card, 0x01u);
      }
      break;
    case 0x41u:
      sdState[card] = SD_STATE_READY;
      setSdResponse1(card, 0x00u);
      break;
    case 0x48u: {
      const uint8_t r7[5] = { 0x01u, 0x00u, 0x00u, 0x01u, 0xaau };
      setSdResponse(card, r7, 5u);
      break;
    }
    case 0x49u:
      response[0] = 0x00u;
      response[1] = 0xffu;
      response[2] = 0xfeu;
      buildCsd(card, payload);
      for (uint32_t i = 0; i < 16u; i++) response[3u + i] = payload[i];
      setSdResponse(card, response, 19u);
      break;
    case 0x4au: {
      response[0] = 0x00u;
      response[1] = 0xffu;
      response[2] = 0xfeu;
      buildCid(card, payload);
      for (uint32_t i = 0; i < 16u; i++) response[3u + i] = payload[i];
      const uint16_t crc = crc16Ccitt(payload, 16u);
      response[19] = (uint8_t)(crc >> 8u);
      response[20] = (uint8_t)crc;
      setSdResponse(card, response, 21u);
      break;
    }
    case 0x4cu:
      sdState[card] = SD_STATE_TRAN;
      setSdResponse1(card, 0x00u);
      break;
    case 0x4du: {
      const uint8_t status[2] = { 0x00u, 0x00u };
      setSdResponse(card, status, 2u);
      break;
    }
    case 0x50u:
      setSdResponse1(card, commandSector(card) == SD_SECTOR_SIZE ? 0x00u : 0x40u);
      break;
    case 0x51u:
      sdState[card] = SD_STATE_DATA;
      sdResponseReady[card] = 0u;
      sdResponseLength[card] = 0u;
      sdReadRequestCount++;
      recordPendingSdCommand(SD_PENDING_READ, card, commandSector(card));
      break;
    case 0x58u:
      sdState[card] = SD_STATE_WRITE_WAITFE;
      setSdResponse1(card, 0x00u);
      sdResponseReady[card] = 0u;
      break;
    case 0x69u:
      if (sdAcmd[card] != 0u) {
        sdState[card] = SD_STATE_READY;
        setSdResponse1(card, 0x00u);
      } else {
        setSdResponse1(card, 0xffu);
      }
      break;
    case 0x77u:
      setSdResponse1(card, 0x01u);
      break;
    case 0x7au:
      setSdResponse(card, ocr, 5u);
      break;
    case 0x7bu:
      setSdResponse1(card, 0x00u);
      break;
    default:
      break;
  }
  sdAcmd[card] = command == 0x77u;
}

static void resetSdCardState(void) {
  sdSelectedCard = 0u;
  sdPendingCommand = SD_PENDING_NONE;
  sdPendingSector = 0u;
  sdPendingCard = 0u;
  sdCommandCount = 0u;
  sdReadRequestCount = 0u;
  sdWriteRequestCount = 0u;
  for (uint32_t card = 0; card < 2u; card++) {
    sdCommandIndex[card] = 0u;
    sdLastCommand[card] = 0u;
    sdAcmd[card] = 0u;
    sdResponseLength[card] = 0u;
    sdResponseIndex[card] = 0u;
    sdResponseReady[card] = 0u;
    sdState[card] = sdTotalSectors[card] != 0u ? SD_STATE_TRAN : SD_STATE_IDLE;
    sdDataIndex[card] = 0u;
    for (uint32_t i = 0; i < 4u; i++) sdCommandParams[card][i] = 0u;
  }
}

void zxnextWriteSpiCsPort(uint32_t value) {
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  if ((byteValue & 0x03u) == 0x02u) sdSelectedCard = 0u;
  else if ((byteValue & 0x03u) == 0x01u) sdSelectedCard = 1u;
  else sdSelectedCard = 0xffu;
}

void zxnextWriteSpiDataPort(uint32_t value) {
  const uint32_t card = activeSdCard();
  if (card > 1u) return;
  const uint8_t byteValue = (uint8_t)(value & 0xffu);
  sdResponseIndex[card] = 0u;
  sdResponseLength[card] = 0u;
  sdResponseReady[card] = 0u;

  if (sdState[card] == SD_STATE_WRITE_WAITFE) {
    if (byteValue == 0xfeu) {
      sdState[card] = SD_STATE_WRITE_DATA;
      sdDataIndex[card] = 0u;
    }
    return;
  }
  if (sdState[card] == SD_STATE_WRITE_DATA) {
    if (sdDataIndex[card] < ZXNEXT_SD_COMMAND_BUFFER_SIZE) {
      sdBlockToWrite[sdDataIndex[card]] = byteValue;
      if (card == 0u) sdCommandBuffer[6u + sdDataIndex[card]] = byteValue;
    }
    sdDataIndex[card]++;
    if (sdDataIndex[card] == SD_SECTOR_SIZE + 2u) {
      sdState[card] = SD_STATE_TRAN;
      sdWriteRequestCount++;
      recordPendingSdCommand(SD_PENDING_WRITE, card, commandSector(card));
    }
    return;
  }

  if (sdCommandIndex[card] == 0u) {
    sdLastCommand[card] = byteValue;
    sdCommandIndex[card] = 1u;
    return;
  }
  if (sdCommandIndex[card] >= 1u && sdCommandIndex[card] <= 4u) {
    sdCommandParams[card][sdCommandIndex[card] - 1u] = byteValue;
  }
  sdCommandIndex[card]++;
  if (sdCommandIndex[card] == 6u) {
    sdCommandIndex[card] = 0u;
    completeSdCommand(card);
  }
}

uint32_t zxnextReadSpiDataPort(void) {
  const uint32_t card = activeSdCard();
  if (card > 1u) return 0xffu;
  if (sdResponseIndex[card] < sdResponseLength[card]) {
    return sdResponse[card][sdResponseIndex[card]++];
  }
  return 0xffu;
}

void zxnextSetSdCardInfo(uint32_t card, uint32_t totalSectors) {
  if (card > 1u) return;
  sdTotalSectors[card] = totalSectors;
  sdState[card] = totalSectors != 0u ? SD_STATE_TRAN : SD_STATE_IDLE;
}

void zxnextSetSdReadResponseByte(uint32_t offset, uint32_t value) {
  if (offset < SD_SECTOR_SIZE) sdResponseBuffer[3u + offset] = (uint8_t)(value & 0xffu);
}

void zxnextCommitSdReadResponse(uint32_t card) {
  if (card > 1u) return;
  uint8_t response[ZXNEXT_SD_RESPONSE_BUFFER_SIZE];
  response[0] = 0x00u;
  response[1] = 0xffu;
  response[2] = 0xfeu;
  for (uint32_t i = 0; i < SD_SECTOR_SIZE; i++) response[3u + i] = sdResponseBuffer[3u + i];
  const uint16_t crc = crc16Ccitt(&response[3], SD_SECTOR_SIZE);
  response[3u + SD_SECTOR_SIZE] = (uint8_t)(crc >> 8u);
  response[4u + SD_SECTOR_SIZE] = (uint8_t)crc;
  setSdResponse(card, response, 5u + SD_SECTOR_SIZE);
}

void zxnextSetSdWriteResponse(uint32_t card, uint32_t success) {
  if (card > 1u) return;
  const uint8_t ok[3] = { 0x05u, 0xffu, 0xfeu };
  const uint8_t fail[3] = { 0x0du, 0xffu, 0xffu };
  setSdResponse(card, success != 0u ? ok : fail, 3u);
}

void zxnextClearSdPendingCommand(void) {
  sdPendingCommand = SD_PENDING_NONE;
}

uint32_t zxnextGetSdSelectedCard(void) { return sdSelectedCard; }
uint32_t zxnextGetSdPendingCommand(void) { return sdPendingCommand; }
uint32_t zxnextGetSdPendingSector(void) { return sdPendingSector; }
uint32_t zxnextGetSdPendingCard(void) { return sdPendingCard; }
uint32_t zxnextGetSdCommandCount(void) { return sdCommandCount; }
uint32_t zxnextGetSdReadRequestCount(void) { return sdReadRequestCount; }
uint32_t zxnextGetSdWriteRequestCount(void) { return sdWriteRequestCount; }
uint32_t zxnextGetSdResponseReady(uint32_t card) { return card < 2u ? sdResponseReady[card] : 0u; }
uint32_t zxnextGetSdResponseLength(uint32_t card) { return card < 2u ? sdResponseLength[card] : 0u; }
uint32_t zxnextGetSdResponseIndex(uint32_t card) { return card < 2u ? sdResponseIndex[card] : 0u; }
