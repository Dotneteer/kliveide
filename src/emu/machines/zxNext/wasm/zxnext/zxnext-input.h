#ifndef ZXNEXT_INPUT_H
#define ZXNEXT_INPUT_H

#include <stdint.h>

void zxnextInputReset(void);
uint32_t zxnextInputReadPort(uint32_t address);
void zxnextSetJoystickLeftState(uint32_t state);
void zxnextSetJoystickRightState(uint32_t state);
uint32_t zxnextJoystickReadPort1f(void);
uint32_t zxnextJoystickReadPort37(void);
void zxnextMousePacket(uint32_t buttons, int32_t dx, int32_t dy, int32_t dz);
uint32_t zxnextMouseReadPortFbdf(void);
uint32_t zxnextMouseReadPortFfdf(void);
uint32_t zxnextMouseReadPortFadf(void);

#endif
