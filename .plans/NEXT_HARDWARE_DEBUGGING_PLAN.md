# Real Next Hardware Debugging Plan (G6.4, with G6.5 as its first milestone)

Status: **draft, open questions** (2026-10-08). Nothing is implemented. §9 lists the questions the
project author must answer before Phase 1. Phase 0 is a feasibility spike with a go/no-go gate.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G6.4**: run and debug a program on a
  physical ZX Spectrum Next **from Klive's own debugger UI**. Klive is the client (decision D1).
- **G6.5** (send a built `.nex` to the Next and run it, without debugging). It falls out of the same
  link and agent, so it is this plan's first shippable milestone (Phase 2).

Not in scope:
- A DAP server, VS Code, or acting as a DeZog remote (D1 dropped G6.2/G6.3).
- A custom FPGA core with a debug port (JTAG-style). It would mean the user runs a different core than
  the one they ship on, and core work is out of Klive's reach.
- Reverse debugging, execution history, coverage and profiling on hardware. The real CPU records
  nothing. These stay emulator features (§4).
- Other real machines (48K/128K over an interface). The Next is the only Spectrum with a UART the
  program can talk to without extra hardware on the edge connector.

---

## 1. Is it feasible?

**Yes. The approach is proven, and the hardware has what it needs.** DeZog already debugs programs on
a real Next with a serial cable and a resident program on the Next. Its documentation should be
checked in Phase 0, but the existence of a working tool settles the "is it possible at all" question.
Klive's open questions are about effort and design, not possibility:

| Need | What the Next provides (`_input/next-fpga/`) |
|---|---|
| A byte link to a PC | Two UARTs (ESP and Pi) on ports `$133B`–`$163B`, each with a 512-byte Rx and 64-byte Tx FIFO. Their baud rate is a 17-bit prescaler on the system clock (`Fsys / baud`; Fsys depends on NextReg `$11`). **NextReg `$0B` can route either UART to a joystick port**: Tx out on pin 7, Rx in on pin 9, CTS_n in on pin 6. |
| A way to stop a running program from outside | The NMI. The **M1 (Multiface) and DRIVE (divMMC) buttons**, or NextReg `$02` from software. NextReg `$C0` bit 3 gives a **stackless NMI**: the return address goes to NextRegs `$C2`/`$C3` instead of the user's stack. |
| A way for a breakpoint to land in the agent | A patched single-byte `RST n`. Its vector can be routed to the agent in three ways (D5): **divMMC entry points** (NextRegs `$B8`–`$BA`, configurable per RST address), the **alternate ROM** (NextReg `$8C`, a RAM copy of the ROM with a patched vector), or RAM in slot 0 when the program maps it there. |
| A place for the agent to live | 8K pages that the MMU can map into any slot. The agent maps itself in while it runs and restores the program's mapping when it leaves. |
| A way to test all of this without hardware | **Klive's own WASM Next core already models the UARTs**, with a peer API (`zxnextUartPeerSend`, `…PeerOutputByte`, CTS, break, loopback). It also models the stackless NMI, the divMMC entry points, the alt ROM and the NMI buttons. The harness exposes the UART peer (`uartSend`, `uartOutput`). **The whole stack (agent, protocol, Klive client) can run in CI against the emulated Next**, with real hardware needed only for the final check. |

The hard parts, in order of risk:
1. **Getting control without breaking the program or NextZXOS** (D5, D6). Every RST vector and both
   NMI handlers already belong to someone: the ROM, esxDOS/NextZXOS or the Multiface menu.
2. **Host-initiated Pause.** The agent cannot see a "pause" byte while the program runs, unless the
   program polls or uses UART interrupts. The reliable pause is a physical button (D6).
3. **Stepping without a trap flag.** The Z80 has no single-step. Klive steps by placing temporary
   breakpoints at every possible successor instruction (D9).
4. **The rest of the hardware keeps running while the CPU is stopped.** Video, Copper, DMA, CTC and
   audio carry on. Raster timing is lost at every stop. That is inherent to stop-mode debugging on
   real hardware, and the docs must say so.

**Effort: XL**, about 2–3 months of focused work (§7), with the spike deciding whether the
optimistic or pessimistic end applies.

---

## 2. Which hardware link? (the recommendation)

### 2.1 Recommended: UART on a joystick port, through a USB-to-serial adapter

- **Hardware:** a **3.3 V TTL USB-to-serial adapter** (FTDI FT232R or FT231X preferred, because
  they are reliable at high baud rates; CP2102N also works; avoid cheap CH340 clones above 1 Mbaud).
  Add a **DB9 female plug** wired to the Next's joystick port: adapter RX ← pin 7 (Next Tx),
  adapter TX → pin 9 (Next Rx), adapter RTS → pin 6 (Next CTS_n, optional), and GND → pin 8. It costs
  about €10–15. The docs ship a wiring diagram.
- **On macOS (the author's development machine is a MacBook Pro, 2026-10-08):**
  - **Prefer an FTDI chip.** macOS ships a driver for FTDI adapters (verify on the current macOS in
    Phase 0), so they need no install. CP210x and CH340 adapters may need a vendor driver or a System
    Settings approval, and a debugging guide should not start with a kernel-extension detour.
  - **USB-C.** Recent MacBook Pros have only USB-C/Thunderbolt ports. Buy a USB-C FT232R breakout,
    or use a USB-A adapter with a USB-C-to-A dongle. Hubs work, but connect directly for the
    Phase 0 baud-rate tests.
  - **The port appears as `/dev/cu.usbserial-<serial>`.** Klive lists the `cu.*` device, not the
    `tty.*` one: on macOS, opening `tty.*` waits for carrier detect. Web Serial (D4) hides this
    behind its port picker, but the docs' troubleshooting section names it.
  - **Rates above 230,400 are non-standard on macOS.** Chromium's serial backend sets them through
    the `IOSSIOSPEED` ioctl. Phase 0 confirms that 921,600 and 2,000,000 baud really reach the
    FTDI chip from Electron on macOS, on Apple Silicon.
  - **Windows and Linux stay supported.** The user base is not Mac-only. The docs cover all three
    platforms, and the CI tests are platform-free anyway (D12).
- **⚠ The voltage levels are a Phase 0 check, not an assumption.** The joystick port is an Atari-style
  connector whose pins also carry Sega pad signals. Verify the port's I/O levels on the user's board
  issue before connecting anything, and never use a 5 V adapter until that is confirmed.
- **Why this link:**
  - It is a raw byte pipe. The agent's link code is about ten instructions of port polling.
  - It is fast. At a 28 MHz Fsys the prescaler for 921,600 baud is ~30, and for 2 Mbaud it is 14, so
    both are reachable. 921,600 baud is about 90 KB/s: a whole 8K page in ~90 ms and the full 64K in
    under a second. Panels refresh only when the program is stopped, so this is plenty.
  - It has no network setup, no firewall prompts and no ESP firmware lottery.
  - It leaves the ESP free for programs that use Wi-Fi themselves.
  - Every Next model has joystick ports. The only cost is that the chosen port cannot read a
    joystick while debugging, so the user picks the port the game does not use.
- **One protocol constraint follows from the hardware.** In joystick mode only CTS exists (Next ←
  PC), and the Next has no RTS to tell the PC to stop. The PC must therefore **never overrun the
  512-byte Rx FIFO**: host → Next data goes in chunks of ≤ 256 bytes, each acknowledged (D3).

### 2.2 Wi-Fi through the ESP8266: not for debugging, possibly for G6.5 later

The Next's ESP-01 sits on UART 0 and speaks Espressif **AT commands**. For debugging it is the wrong
link:
- **The agent would grow an AT/TCP state machine.** It would need connect, `+IPD,n:` framing, send
  prompts and error recovery, in a program that must stay small and must run when the user's program
  has crashed.
- **It is slow and laggy.** The Next ↔ ESP link usually runs at 115,200 baud (raising it depends on
  the module and firmware), and every round trip adds network latency. Stepping does many small round
  trips, so it would feel sluggish.
- **It is not uniform.** The ESP is optional or varies by board, and AT firmware versions differ.
- **It conflicts with programs that use Wi-Fi**, and it needs the PC and the Next on one network,
  with a listening port the OS firewall asks about.

It is still attractive for **G6.5 "send to Next" without a cable**, because a one-shot file push
tolerates latency. Community tools already push files to the Next over Wi-Fi this way. The transport
abstraction (D2) keeps a `TcpLink` possible; it becomes a follow-up item once the serial path works
(Q5).

### 2.3 Rejected

- **The Pi accelerator's UART (UART 1 on the GPIO).** Not every board has a Pi, and a Pi Zero without
  the W has no network. It is also already redirectable to the joystick port (NextReg `$0B` bit 0),
  which is §2.1 again.
- **Writing to the SD card and pressing reset.** This is not debugging, and swapping SD cards is
  slower than a cable.

---

## 3. Architecture

```
 Klive IDE (renderer panels, unchanged)
        │ EmuApi (getCpuState, getMemoryContents, setBreakpoint, …)
        ▼
 Emu renderer: RemoteNextTarget  ── implements the EmuApi subset that hardware can serve
        │ KDP requests / notifications (§3.2)
        ▼
 IByteLink ── WebSerialLink (real Next) │ EmulatedUartLink (WASM core's UART peer: tests, CI)
        │                                │ TcpLink (ESP Wi-Fi, later, G6.5 only)
        ▼
 Next: agent (Z80N, ~4–6K, Klive asm) ── owns the trap vector, the NMI entry, the UART
```

### 3.1 The seam: `EmuApi`

Every debugger panel already gets its data through `EmuApi`
(`src/common/messaging/EmuApi.ts`): `getCpuState`, `getMemoryContents`, `setBreakpoint`,
`getNextRegState`, `getNextMemoryMapping`, `getCallStack`, `sourceStep`, and so on. That makes it the
natural seam. A **`RemoteNextTarget`** in the emu renderer answers the methods that hardware can
serve, from the agent, and answers the rest with a typed "not available on hardware" result. Panels
show that result as an `EmptyState`. The panels themselves need no new data paths. This mirrors how
the Z88 or ZX81 already return nothing for Next-only panels.

`MachineController` (2,357 lines, bound to an in-process machine) is **not** reused. The remote
target gets its own small controller with the same state machine (`MachineControllerState`: running,
paused, stopped), so the toolbar, status bar and keyboard shortcuts keep working.

### 3.2 KDP, the Klive Debug Protocol

The protocol is a small binary request/response protocol with one notification.

- **Frame:** `0xA5 | len (2) | seq (1) | cmd (1) | payload | CRC-16/CCITT`.
- **Requests:** at most 256 payload bytes host → Next (§2.1), each answered (ACK carries the data or
  an error code).
- **Notification:** a single unsolicited `STOPPED {reason, pc, bpId}` from the agent when it takes
  control.
- **Commands (v1):**
  - `HELLO`: agent version, capabilities bitmap, core version (NextRegs `$01`/`$0E`), board ID
    (`$0F`), the agent's page, Fsys.
  - `GET_REGS` / `SET_REG`: main and alternate sets, IX/IY, SP, PC, I, R, IM and IFF. IFF is read with
    the `LD A,I` P/V trick at entry.
  - `READ_MEM` / `WRITE_MEM`: by **8K page and offset**, so banked code works without remapping on
    the host. A logical-address form is also available, through the program's saved MMU.
  - `READ_NEXTREG` / `WRITE_NEXTREG`: the program's view. MMU0–7 and the registers the agent changed
    come from the agent's save area.
  - `SET_BP` / `CLEAR_BP` / `CLEAR_ALL_BP`: the agent keeps the table of patched bytes, so it can
    restore originals when it detaches or when the host vanishes.
  - `CONTINUE`, `DETACH` (restore everything, leave the program running), `RESET`.
  - `LOAD_PAGES` + `START {pc, sp, mmu[8], nextregs[]}`: G6.5 (Phase 2).
- **Versioning:** `HELLO` carries a version, and the host refuses a mismatch with a "copy the new
  agent to your SD card" message.

### 3.3 The agent

- **It is written in Klive asm**, which dogfoods the assembler, and lives in `src/main/next-agent/`.
  It is built to a `.nex` (and a dot command if Q6 says so) that the user copies to the SD card once.
  Klive ships the binary, and Klive can also copy it onto the user's SD card image.
- **Footprint:** one 8K page, chosen by setting (default: a high page that NEX loaders do not use),
  plus a stub of under 16 bytes at the trap vector (D5).
- **On entry:**
  1. Save all registers, IFF, MMU0–7, the CPU speed (`$07`), the UART select, prescaler and frame
     settings, and NextReg `$0B`.
  2. Switch to its own stack.
  3. Set the link up. The prescaler is recomputed from NextReg `$11`, because Fsys changes with the
     video timing.
  4. Send `STOPPED` and poll the UART with interrupts disabled.
- **On exit:** restore everything in reverse and return to the program with `RETN`/`RET` as entered.
- **Known side effect:** the NextReg select port `$243B` cannot be read back. A program that relies
  on a NextReg number staying selected across a breakpoint will see it changed. The docs list this.

---

## 4. What works on hardware, panel by panel

| Feature | On hardware | How |
|---|---|---|
| Run / Pause / Stop / Reset | ✓ (Pause: D6) | `CONTINUE`; NMI; `RESET` |
| CPU registers, edit registers | ✓ | `GET_REGS`/`SET_REG` |
| Memory view, edit memory | ✓ | paged `READ_MEM`/`WRITE_MEM`, fetched lazily per visible page |
| Disassembly | ✓ | memory reads + Klive's Z80N disassembler |
| Execution breakpoints, banked | ✓ | `RST` patch in the physical page |
| Breakpoints in ROM | ✗ (✓ with alt ROM, D5) | ROM cannot be patched |
| Conditions, hit counts, logpoints, ASSERTION | ✓, but each hit stops the program | evaluated on the host after the trap; the docs warn about timing |
| Memory / I/O / NextReg-write breakpoints, WPMEM | ✗ | no hardware watchpoints |
| Step into / over / out | ✓ | temporary breakpoints at successors (D9) |
| Source-level debugging (asm, sjasmplus, Klive BASIC) | ✓ | debug info is host-side; same `SourceStepDecision` |
| Call stack | ≈ | the emulator's is a shadow stack recorded by the core; on hardware it is a stack walk validated against debug info (D10) |
| Next Registers, Memory Mapping, palette | ✓ (readable registers) | `READ_NEXTREG` |
| Layer 2, tilemap inspectors | ✓ | memory + registers |
| Sprite inspector, Copper | ✗ (verify in Phase 0) | sprite attributes, patterns and Copper RAM are written through ports with no read-back path in `ports.txt` |
| Screen in the emulator window | ✗ | the user watches the real monitor |
| History, reverse debugging, coverage, profiler, beam overlay | ✗ | no recorder in real silicon |

---

## 5. Decisions (proposed; confirm or change in §9)

| # | Decision |
|---|---|
| D1 | **Klive is the client, and the Next runs Klive's own agent.** The alternative, speaking DeZog's protocol to DeZog's Next-side program, is Q1. |
| D2 | **Transports sit behind `IByteLink`** (`open`, `write`, `onData`, `close`). Implementations: `WebSerialLink` (real hardware), `EmulatedUartLink` (the WASM core's UART peer; used by every automated test) and `TcpLink` later. |
| D3 | **Flow control is in the protocol, not the wire.** Host → Next chunks are ≤ 256 bytes and are acknowledged. Next → host relies on the PC keeping up, and optionally on CTS. |
| D4 | **The serial port is opened with Web Serial in the emu renderer** (`navigator.serial`; Electron 44 supports it through `select-serial-port` and the permission handlers in main). This means no native module and no per-platform `serialport` rebuild in electron-builder. The fallback is the `serialport` package in main (Q2). |
| D5 | **The breakpoint trap is a single-byte `RST n` with `n` configurable.** Its vector is reached by one of three strategies, chosen by the Phase 0 spike (Q3): (a) a **divMMC entry point** on that RST (NextRegs `$B8`–`$BA`), with the stub in divMMC memory; (b) the **alt ROM** (`$8C`), a RAM copy of the ROM with that vector patched, which also enables ROM breakpoints; (c) **RAM in slot 0**, for programs that map it. Whichever stub is used chains to the original handler when the RST is not one of Klive's breakpoints, so esxDOS/NextZXOS calls keep working. |
| D6 | **Pause has three tiers.** (1) The **M1/DRIVE button** on the Next, a stackless NMI routed to the agent; this always works. (2) **UART Rx interrupt** (NextReg `$C6`), if the program uses hardware IM2; the host then sends a break byte. (3) An optional **`KLIVE_POLL` macro** the program can call in its main loop. The Pause button in Klive tries (2) and tells the user to press M1 if nothing answers within 500 ms. |
| D7 | **G6.5 needs no SD writes.** `LOAD_PAGES` streams the NEX banks straight into memory, then `START` applies the NEX header (MMU, border, CPU speed, entry PC/SP). The NEX parsing reuses Klive's existing loader on the host. "Run on Next" (no debugging) and "Debug on Next" share it. |
| D8 | **The agent stays resident after a detach** (its page is marked used), so a reconnect does not need a reload from SD. A hard reset removes it. |
| D9 | **Stepping is done on the host.** Decode the instruction at PC with the Z80N decoder, compute every possible successor (fall-through, `JP`/`JR`/`DJNZ`/`CALL`/`RST` targets, the `RET` target from the stack, `JP (HL)`/`(IX)`/`(IY)` from the registers), patch them all as temporary breakpoints, continue, and remove them on stop. Step over is a temporary breakpoint after the `CALL`/`RST`. Step out is one at the return address. A step into ROM or other unpatchable memory becomes "run to return" with a note. |
| D10 | **The hardware call stack is a heuristic stack walk.** Words on the stack are taken as return addresses when the preceding bytes decode as a `CALL`/`RST` to the right target. It is shown with a "≈" marker. Klive BASIC frames use the compiler's frame info, which is exact. |
| D11 | **A connection is a machine choice.** "ZX Spectrum Next (hardware)" appears in the machine selector. Choosing it opens a connection bar (port, baud, Connect/Disconnect, agent version) in place of the emulator screen. Settings: port, baud (default 921,600), joystick port (left/right), agent page, trap RST. |
| D12 | **Everything is testable without hardware.** The harness gains a `remoteTarget()` session helper that loads the agent into the emulated Next, wires `EmulatedUartLink` to the UART peer, and drives `RemoteNextTarget` exactly as the IDE does. Real hardware gets a manual checklist script (`scripts/next-hw-check.cjs`), never CI. |

---

## 6. Phases

| Phase | Content | Gate |
|---|---|---|
| **0. Spike** (≈1–1.5 wk) | **On the bench:** confirm the joystick-port voltage levels; reach 921,600 and 2 Mbaud in loopback and with the adapter; send 1 MB with CRC and count the errors. **In the emulator:** a 300-byte agent prototype (HELLO, READ_MEM, stop at RST) on the WASM core through the UART peer. Evaluate D5 (a)/(b)/(c) under NextZXOS: does an esxDOS call still work with the trap installed? Does a NEX started by `.nexload` keep running? Check whether DeZog's documented approach (Q1) changes the choice. Check D6 tier (1): does the M1 button reach the agent with the Multiface enabled? | **Go** if a breakpoint stops a NEX on real hardware, regs and memory read back correctly, and an esxDOS call still works. **No-go**: stop and record why in the roadmap. |
| **1. Link and protocol** (≈1.5–2 wk) | `IByteLink`, `WebSerialLink`, `EmulatedUartLink`; KDP framing, CRC, chunking, timeouts and resync on both sides; the agent's framing; HELLO and version check; harness `remoteTarget()`. | A fuzz test (dropped and corrupted bytes on the emulated link) never wedges either side. |
| **2. G6.5 Send to Next** (≈1 wk) | `LOAD_PAGES`/`START`; "Run on Next" in the Run menu and as an IDE command (`next run`); progress in the status bar. **First user-visible release; G6.5 is done here.** | A NEX built in Klive starts on real hardware, with the same picture as in the emulator. |
| **3. Stop and inspect** (≈2–3 wk) | Agent entry/exit with full save and restore; `SET_BP`/`CLEAR_BP` with the agent-held table; `RemoteNextTarget` for registers, memory, breakpoints and continue; Pause tiers (D6); detach and crash safety (the host vanishing restores patches on the next entry). | Harness: a program stopped and continued 1,000 times ends with the same memory as an unstopped run. |
| **4. Stepping and source level** (≈1.5–2 wk) | D9 successor stepping; step over and out; source stepping through the existing `SourceStepDecision`; conditions, hit counts and logpoints evaluated host-side; the D10 call stack. | Harness: stepping every instruction of the Z80N opcode table lands where the emulator lands. |
| **5. Panels** (≈1–1.5 wk) | Next Registers, Memory Mapping, palette, Layer 2 and tilemap through the remote target; "not available on hardware" `EmptyState`s everywhere else (§4). | Every panel either works or says why, with no errors in the console. |
| **6. UX and docs** (≈1 wk) | The machine choice and connection bar (D11), settings rows, the docs page (shopping list, wiring diagram, copying the agent, troubleshooting, timing caveats); update `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2/§4 and mark G6.4/G6.5 done in the roadmap. | Docs build and check pass. |

---

## 7. Effort

About **9–12 weeks** in total; Phase 0 narrows it. The pessimistic end applies if no D5 strategy
coexists cleanly with NextZXOS and the agent has to take over the Multiface instead. In that case the
agent must also provide the NMI menu's essential job (returning to the program), and installing it
becomes a two-step user procedure.

## 8. Risks

| Risk | Mitigation |
|---|---|
| The trap vector conflicts with NextZXOS/esxDOS | D5's three strategies plus chaining; the Phase 0 gate tests esxDOS calls explicitly |
| Programs that remap slot 0, change the CPU speed or switch video timing mid-run | The agent saves and restores the MMU and speed, and recomputes the prescaler from `$11` at every entry |
| Programs that disable the NMI or reprogram NextReg `$06` | Pause tier 1 fails; Klive says so, and breakpoints still work |
| Programs that use the chosen joystick port's UART or the ESP UART themselves | The user picks the other joystick port; documented |
| Self-modifying code overwrites a patched breakpoint | The agent verifies the patch on every entry and reports "breakpoint lost" |
| The hardware keeps running while the CPU is stopped (Copper, DMA, audio, raster) | Inherent; documented with the logpoint timing warning |
| Few contributors own a Next to test on | D12: everything except the wire runs in CI on the emulated Next |

## 9. Questions for the project author

1. **Own agent, or DeZog's?** DeZog's Next-side program and protocol exist, so speaking its protocol
   would skip writing an agent. D3's rule ("only conventions, no DeZog code") would be kept, because
   Klive would only talk to a program the user installs. The costs: Klive would depend on another
   project's release cadence, and could not add Next-specific commands (Layer 2, NextReg views,
   `LOAD_PAGES`) as it needs. **Suggested: own agent (D1).**
2. **Web Serial in the renderer (D4) or `serialport` in main?** Suggested: Web Serial (no native
   module).
3. **Trap strategy (D5):** decide after the Phase 0 spike, with the spike's evidence. Is a "requires
   NextZXOS version ≥ X" constraint acceptable if the best strategy needs it?
4. **Which Next(s) and core version do you have for the spike?** *(Partly answered: the host is a MacBook Pro, so macOS on USB-C is the Phase 0 bench platform; see §2.1.)* (KS1, KS2, an N-Go, the core
   version.) Do you have a 3.3 V FTDI adapter, or should the docs name one to buy?
5. **Is Wi-Fi "send to Next" (§2.2) wanted as a follow-up?** Suggested: yes, after Phase 2, as a
   separate small item.
6. **Agent distribution:** a `.nex` the user runs, a dot command (`.klive`), or both? Suggested:
   a dot command, so it loads before the program under test without leaving BASIC.
