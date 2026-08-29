#ifndef ZXNEXT_KEYBOARD_H
#define ZXNEXT_KEYBOARD_H

#include <stdint.h>

static void zxnextKeyboardReset(void);
static void zxnextKeyboardSetKeyStatus(uint32_t key, uint32_t isDown);
static uint32_t zxnextKeyboardGetLine(uint32_t line);
static uint32_t zxnextKeyboardReadPort(uint32_t address);

#endif
