---
type: fix
---

On macOS, a key pressed together with Command (for example Cmd+P) stayed down on the emulated keyboard, and the machine kept repeating it until reset. Keys pressed with Command now never reach the machine, and every held key and joystick direction is released when Command is let go, the window loses focus, a dialog opens or the machine stops.
