---
type: internal
---

The ZX Spectrum Next test harness seeds the real-time clock from a fixed host time unless a test gives its own, so two sessions are equal byte for byte whenever they are created; the audio mixer's non-volatile-byte test failed now and then when a second ticked between its two sessions.
