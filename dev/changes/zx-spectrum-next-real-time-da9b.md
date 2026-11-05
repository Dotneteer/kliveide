---
type: feature
---

**ZX Spectrum Next real-time clock options:** the Next's clock now follows the host's clock, so it
shows the real time even after the debugger paused the machine, and it keeps a time set with `.time`
or `.date`, and the clock's 56 bytes of RAM, from one session to the next, as the battery on a real
board does. Each Next model keeps its own clock. **Settings › Machine** has a **Real-time clock**
group: choose emulated time instead, switch keeping off, and set the clock to the host's time or
forget a kept one.
