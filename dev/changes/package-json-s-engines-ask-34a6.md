---
type: internal
---

package.json's engines now ask for the Node versions the test tools need (^22.22.2, ^24.15.0 or 26 and later), so npm warns at install on an older Node instead of the jsdom tests failing to start.
