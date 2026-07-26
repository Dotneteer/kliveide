# React Emulator Panel Refactor Notes

- For machine controller events, register stable wrappers once per controller and read the latest callback from refs. Otherwise state/frame events can call stale render closures.
- In `EmulatorPanel`, prefer reading the active controller from `controllerRef.current` inside async state/frame handlers instead of closing over `controller`.
- Screen hook callbacks should read mutable refs and be memoized before they are used as effect dependencies; this keeps panel effects honest without running on every render.
- Keyboard hooks should memoize the event handler chain and test both current mappings and listener cleanup.
