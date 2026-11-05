#[cfg(all(feature = "web-vid-simple", feature = "web-vid-realistic"))]
compile_error!("features `web-vid-simple` and `web-vid-realistic` are mutually exclusive");

#[path = "emulator/asm.rs"]
pub mod asm;
#[path = "emulator/basic.rs"]
pub mod basic;
#[path = "emulator/bus.rs"]
pub mod bus;
#[path = "emulator/cas.rs"]
pub mod cas;
#[path = "emulator/disasm.rs"]
pub mod disasm;
#[path = "emulator/expansion.rs"]
pub mod expansion;
#[path = "emulator/fd1793.rs"]
pub mod fd1793;
#[path = "emulator/hbf.rs"]
pub mod hbf;
#[path = "emulator/instruction_trace.rs"]
pub mod instruction_trace;
#[path = "emulator/key.rs"]
pub mod key;
#[path = "emulator/log.rs"]
pub mod log;
#[path = "emulator/machine.rs"]
pub mod machine;
#[path = "emulator/mmu.rs"]
pub mod mmu;
#[path = "emulator/snapshot.rs"]
pub mod snapshot;
#[path = "emulator/sound.rs"]
pub mod sound;
#[path = "emulator/tape.rs"]
pub mod tape;
#[path = "emulator/tvc.rs"]
pub mod tvc;
#[path = "emulator/tvc_snapshot.rs"]
pub mod tvc_snapshot;
#[path = "emulator/vid.rs"]
pub mod vid;
#[path = "emulator/z80.rs"]
pub mod z80;
#[path = "emulator/z80_state.rs"]
pub mod z80_state;
#[path = "emulator/zx82.rs"]
pub mod zx82;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "ui/app_state.rs"]
pub mod app_state;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "ui/audio.rs"]
pub mod audio;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "emulator/emu.rs"]
pub mod emu;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "ui/ui.rs"]
pub mod ui;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "debugger/debug_ui.rs"]
pub mod debug_ui;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "debugger/frame_history.rs"]
pub mod frame_history;

#[cfg(any(feature = "native", feature = "wasm-full"))]
#[path = "ui/workspace.rs"]
pub mod workspace;

#[cfg(all(feature = "native", not(target_arch = "wasm32")))]
#[path = "debugger/debugger.rs"]
pub mod debugger;

#[cfg(any(feature = "wasm", feature = "wasm-full"))]
#[path = "emulator/wasm.rs"]
pub mod wasm;
