#include "zxnext-nmi.h"

static uint8_t nmiSignalActive;
static uint8_t nmiCause;
static uint8_t stacklessNmiEnabled;
static uint8_t stacklessNmiProcessed;
static uint16_t nmiReturnAddress;

static void zxnextNmiReset(void) {
  nmiSignalActive = 0;
  nmiCause = 0;
  stacklessNmiEnabled = 0;
  stacklessNmiProcessed = 0;
  nmiReturnAddress = 0;
}

static void zxnextNmiSetSignal(uint32_t active) {
  nmiSignalActive = active != 0;
  if (nmiSignalActive && nmiCause == 0) nmiCause = 1;
}

static uint32_t zxnextNmiGetSignal(void) {
  return nmiSignalActive;
}

static void zxnextNmiSetCause(uint32_t cause) {
  nmiCause = (uint8_t)cause;
  nmiSignalActive = cause != 0;
}

static uint32_t zxnextNmiGetCause(void) {
  return nmiCause;
}

static void zxnextNmiSetStacklessEnabled(uint32_t enabled) {
  stacklessNmiEnabled = enabled != 0;
}

static uint32_t zxnextNmiGetStacklessEnabled(void) {
  return stacklessNmiEnabled;
}

static void zxnextNmiSetReturnAddress(uint32_t address) {
  nmiReturnAddress = (uint16_t)address;
}

static uint32_t zxnextNmiGetReturnAddress(void) {
  return nmiReturnAddress;
}

static uint32_t zxnextNmiGetStacklessProcessed(void) {
  return stacklessNmiProcessed;
}

static void zxnextNmiMarkAccepted(void) {
  nmiSignalActive = 0;
  if (stacklessNmiEnabled) stacklessNmiProcessed = 1;
}

static void zxnextNmiAfterRetn(void) {
  nmiCause = 0;
  if (stacklessNmiProcessed) {
    stacklessNmiProcessed = 0;
    cpuPc = nmiReturnAddress;
  }
}
