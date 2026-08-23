#pragma once

#include <stdint.h>

static void zxnextTraceReset(void);
static void zxnextTraceRecordInstruction(uint32_t pcBefore);
static void zxnextTraceSetEnabledImpl(uint32_t enabled);
static void zxnextTraceClearImpl(uint32_t frameIndex);
static void zxnextTraceFinishFrameImpl(void);
static uint32_t zxnextTraceGetStartOffsetImpl(void);
static uint32_t zxnextTraceGetHeaderSizeImpl(void);
static uint32_t zxnextTraceGetRecordSizeImpl(void);
static uint32_t zxnextTraceGetCapacityImpl(void);
static uint32_t zxnextTraceGetCountImpl(void);
static uint32_t zxnextTraceGetOverflowImpl(void);
