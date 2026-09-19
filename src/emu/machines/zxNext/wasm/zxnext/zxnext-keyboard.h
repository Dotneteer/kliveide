#ifndef ZXNEXT_KEYBOARD_H
#define ZXNEXT_KEYBOARD_H

#include <stdint.h>

static void zxnextKeyboardReset(void);
static void zxnextKeyboardSetKeyStatus(uint32_t key, uint32_t isDown);
static uint32_t zxnextKeyboardGetLine(uint32_t line);
static uint32_t zxnextKeyboardReadPort(uint32_t address);
static void zxnextKeyboardSetCancelExtended(uint32_t cancel);
static uint32_t zxnextKeyboardGetCancelExtended(void);
static uint32_t zxnextKeyboardGetNextRegB0(void);
static uint32_t zxnextKeyboardGetNextRegB1(void);

#endif
