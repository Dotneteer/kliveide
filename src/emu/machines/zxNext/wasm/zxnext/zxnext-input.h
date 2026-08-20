#ifndef ZXNEXT_INPUT_H
#define ZXNEXT_INPUT_H

#include <stdint.h>

void zxnextInputReset(void);
uint32_t zxnextInputReadPort(uint32_t address);
void zxnextSetJoystickModes(uint32_t joystick1Mode, uint32_t joystick2Mode);
void zxnextSetJoystickLeftState(uint32_t state);
void zxnextSetJoystickRightState(uint32_t state);
uint32_t zxnextJoystickReadPort1f(void);
uint32_t zxnextJoystickReadPort37(void);
void zxnextMouseSetNextReg0A(uint32_t value);
void zxnextMouseAddDelta(int32_t dx, int32_t dy);
void zxnextMouseAddWheelDelta(int32_t dz);
void zxnextMouseSetButtons(uint32_t left, uint32_t right, uint32_t middle);
uint32_t zxnextMouseReadPortFbdf(void);
uint32_t zxnextMouseReadPortFfdf(void);
uint32_t zxnextMouseReadPortFadf(void);
uint32_t zxnextGetMouseDpi(void);
uint32_t zxnextGetMouseSwapButtons(void);

#endif
