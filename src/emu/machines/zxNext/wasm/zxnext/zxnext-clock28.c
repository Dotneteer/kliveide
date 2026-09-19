/*
 * A running count of the machine's 28 MHz clock (frames * tacts in frame + frameTacts28) for devices
 * that keep time between frames lazily (the UARTs, the DS1307). A reset restarts the frame without
 * completing it, so the count is kept monotonic. Clock28.ts is the TypeScript counterpart.
 */

#define ZXNEXT_CLOCK28_PER_SECOND 28000000ull

typedef struct {
  uint64_t base;
  uint32_t seenFrames;
  uint64_t last;
} ZxNextClock28;

static uint64_t zxnextClock28Now(ZxNextClock28 *c) {
  if (frames != c->seenFrames) {
    if (frames > c->seenFrames) c->base += (uint64_t)(frames - c->seenFrames) * ZXNEXT_TACTS_IN_FRAME;
    c->seenFrames = frames;
  }
  uint64_t t = c->base + frameTacts28;
  if (t < c->last) {
    c->base += c->last - t;
    t = c->last;
  }
  c->last = t;
  return t;
}
