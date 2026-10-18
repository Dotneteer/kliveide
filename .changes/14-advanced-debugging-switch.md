---
type: feature
issues: [1445, 1446]
---
**The advanced debugging features can be turned off:** the execution history, reverse debugging,
debug recordings, code coverage and the profiler are on by default.
`set -u features.advancedDebugging 0` and a restart turn them all off; a debug session then
records nothing extra, and the related commands say how to turn the features back on.
