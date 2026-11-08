# ZX Spectrum Next Wi-Fi Emulation Plan

Status: **draft, nothing implemented** (2026-11-08). The design below was agreed with the project author
in conversation; §11 lists what is still theirs to answer. Phase 0 is a short spike with real hardware.

Goal: a program running on Klive's emulated Next talks to an emulated ESP-01 on UART 0, exactly as it
talks to the real one, and reaches the real network through the host. `.UART`, `WIFI.BAS`, `.http`, the
ESPAT driver, NextSync and programs of the user's own work without being changed or knowing.

Background: how the real thing works is `docs/content/en/under-the-hood/emulator-internals/next-wifi.mdx`.

Not in scope:
- **Emulating the ESP8266 itself** (Xtensa CPU, radio MAC, Espressif's firmware binary). See D1.
- Download mode and flashing. GPIO0 low at reset gives a module that says nothing, so ESPUPDATE reports
  that it cannot find one. Non-AT firmware cannot be used.
- Real association with Wi-Fi networks, or listing the networks around the host (D5).
- Joining the host's Wi-Fi by switching it. Klive never changes the host's network settings.
- The full joystick-port redirect of the UARTs, which the core does not model (only what T7 needs).
- Wi-Fi for machines other than the Next.

Relationship to other plans:
- [SEND_TO_NEXT_WIFI_PLAN.md](SEND_TO_NEXT_WIFI_PLAN.md) (G6.5) plans a test-only fake ESP (`EspAtPeer`,
  its D12) and names emulation as a follow-up. **`EspAtModule` here replaces that fake**: whichever plan
  starts first builds it, once. With this plan done, `.klive` can be tested end to end on the emulated
  Next against the real `NextLinkServer`, in the local-network mode of D8.

---

## 1. What the user gets

1. Settings ▸ the Next's page ▸ **Network access for the emulated Wi-Fi module**: Off (the default),
   Internet only, or Internet and local network. A second row: **Show my Wi-Fi network's name to
   programs**, on by default, which says what it does.
2. With access on, a Next program finds a working module: `AT` answers `OK`, `AT+CWLAP` lists the network
   the computer is on, `WIFI.BAS` joins it, `.http` fetches a file.
3. A status-bar item shows that the module is active and has connections open.
4. Debugging keeps working: stepping backwards through a network program shows the bytes that really
   arrived, without touching the network.

With access Off nothing changes: no module answers, exactly as today.

---

## 2. What exists today

Checked in the source on 2026-11-08.

- **The UART peer** (`src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.c`). The core already models both
  lines a frame at a time on the 28 MHz clock, with a peer that sends and collects frames: a 4,096-entry
  send queue (`zxnextUartPeerSend`, which silently drops when full) and a 4,096-byte ring of what the Next
  transmitted. Only the test harness uses it (`test/harness/zxnext/script/uart-peer.ts`).
- **Overflow is already right.** The peer waits for the Next only when the program has set the flow control
  bit (`zxnextUartReadyToReceive`, frame bit 5). With it clear, the default, the peer pushes on and the
  receive buffer overflows as on real hardware. The one wrong case is T5.
- **Replay is mostly solved.** The reverse-debugging journal (`src/emu/machines/reverse/`) records every
  call into a `journaled` export and every host write into core memory, and mutes both during a replay.
  Every `UartPeer*` export is journaled by the prefix rule in `exportContract.ts`. Three existing
  features show the patterns to copy:
  - `NextRtcHost` (`nextRtcHost.ts`): real-world input applied between frames through journaled exports,
    never running during a replay, with `rebase()` after one.
  - `feedPiI2s` in `ZxNextWasmV2Machine.ts`: bulk data delivered with journaled `writeCoreBytes` into a
    core ring plus one journaled append call.
  - `undoForkedHostEffects` in `MachineController.ts`: effects on the outside world that a "Take over here"
    cannot undo, reported to the user.
- **Sockets are possible only in the main process.** The emulator runs in a renderer. Main already uses
  Node's `net` (`src/main/automation/AutomationServer.ts`) and talks to the emulator through
  `MainApi` / `EmuApi`.
- **Not modelled** (`src/emu/machines/zxNext/wasm/README.md`): a baud-rate mismatch between the two ends,
  and the redirect of a UART to the joystick ports. Both Next profiles are board issue 2
  (`nextProfiles.ts`).

---

## 3. Decisions

| # | Decision |
|---|---|
| D1 | **Emulate the AT firmware's behaviour, not the chip.** All the Next ever sees is text on UART 0. Emulating the Xtensa core and the undocumented radio MAC, and shipping Espressif's binary, would cost far more for almost nothing a program can observe. The price is the out-of-scope list above. |
| D2 | **`EspAtModule` is pure TypeScript with no I/O**: bytes in, bytes out, on an injected emulated clock, talking to the network through a port interface. The same class runs in the product, in unit tests and in the harness. |
| D3 | **One pump between frames**, `EspHost`, called beside `rtcHost.beforeFrame()` in `executeMachineFrame`. It takes what the Next transmitted, runs the module, and queues the replies. The core times the bytes on the wire, so batching per frame adds at most 20 ms, about what a real module takes to answer. |
| D4 | **The network lives in the main process**, in `EspNetBridge`: sockets, DNS, the access policy of D8, the host network lookup. The renderer holds no socket. Data flows in batches over `MainApi` / `EmuApi`, with credit-based backpressure: main pauses a socket when the module's buffer for that link is full, so TCP slows the server down. |
| D5 | **The module sees only the network the host is connected to.** `AT+CWLAP` lists that one network; it is honest, because the module's traffic really goes through it. No scan of the neighbourhood, no BSSID read. |
| D6 | **When the name is unavailable, the network is `Klive-Emulated`**: on Ethernet, when the OS refuses the name (macOS Location Services), or when the user turned the name off. Everything else works the same. A declined permission never breaks networking. |
| D7 | **The join is simulated and accepts any password.** Klive cannot check it and never reads the real one from the Keychain or the Windows credential store. `AT+CWJAP` with another network's name fails with `+CWJAP:3` ("cannot find target AP"). An optional **emulated password** setting makes a wrong one fail with `+CWJAP:2`, so programs can test that path. A password a program sends is compared and forgotten, never stored. |
| D8 | **Off by default, and a three-way access policy**, because a downloaded `.nex` is untrusted code that would otherwise open connections from the user's computer. **Internet only** blocks loopback, private, link-local and multicast addresses, checked after DNS resolution on the address actually connected to, so DNS rebinding does not get round it. **Internet and local network** allows private addresses and loopback. Link-local addresses stay blocked in both (cloud metadata). A blocked connection answers `ERROR`, as a refused one does, and the status bar says why. |
| D9 | **Default firmware profile: AT 1.x**, the commonest on real modules, modelled from transcripts of a real one (Phase 0). Differences (`CONNECT` / `Linked`, passive receive, command names) are data in `espFirmwareProfiles.ts`. A later profile adds 2.2. |
| D10 | **The saved network means "whatever the host is on".** The module's flash (`esp-flash.json` in the main process, like `zxnext-rtc.json`) keeps the fact that it has joined, its saved baud rate and its mode: never a password. Otherwise a laptop moved from home to the office would need `WIFI.BAS` again for no reason. When the host's network changes, the module reports `WIFI DISCONNECT`, then `WIFI CONNECTED` and `WIFI GOT IP`. |
| D11 | **Identity.** `AT+CIFSR` reports the host's real LAN address, the one connections come from; `0.0.0.0` when the host is offline. Channel, signal strength and MAC address are plausible fixed values. A 5 GHz host network is shown anyway: faithfulness would only lock those users out. |
| D12 | **Replay never touches the module.** The module's output reaches the core only through journaled calls, so a replay gets the same bytes in the same places with the module idle (§6). |
| D13 | **Module state is not in keyframes or state files.** It is not needed for replay (D12). After anything that replaces the machine's past or present, D14 applies. |
| D14 | **On "Take over here", a machine state load, a `.klr` load or a user reset, the links are gone.** All sockets close and the module returns to idle, still on its network, without printing anything. A program that still believes in its connection gets the real answer for a dead link on its next `AT+CIPSEND`. The fork message names the closed connections, next to the existing line about tape files. Network effects of a discarded future cannot be undone. |
| D15 | **Timing of the module's own actions runs on the emulated clock**, the network on real time. A breakpoint stops the module and the pump; main keeps the data, under backpressure. Emulated delays (join, boot) come from Phase 0's measurements. |
| D16 | **Provenance.** Klive's own code, written from Espressif's public AT documentation and from transcripts of real modules. No code from ESP-AT or from other emulators. |

---

## 4. Architecture

```
 Next program
   │  ports $133B / $143B
   ▼
 WASM core: UART 0 + peer (frame timing, FIFOs, overflow)
   │  new block exports, journaled
   ▼
 EspHost.beforeFrame()  ◄── reset / GPIO0 / $0B / prescaler (read from the core)
   │
   ▼
 EspAtModule (pure): AT parser, data mode, +IPD framing, links, profile
   │  IEspNetwork port
   ▼
 renderer adapter ── MainApi / EmuApi ── EspNetBridge (main)
                                           ├─ policy (D8)
                                           ├─ net / tls / dgram / dns
                                           └─ hostNetwork: name, address, changes
```

New and changed code:

| Where | What |
|---|---|
| `src/emu/machines/zxNext/esp/EspAtModule.ts` | The module: command table, states (idle, data mode, passive receive), link table, boot sequence |
| `src/emu/machines/zxNext/esp/espAtParser.ts` | Line assembly and argument parsing |
| `src/emu/machines/zxNext/esp/espFirmwareProfiles.ts` | Per-firmware replies (D9) |
| `src/emu/machines/zxNext/esp/espTypes.ts` | `IEspNetwork`, `EspFlash`, the events |
| `src/emu/machines/zxNext/esp/EspHost.ts` | The pump (D3), modelled on `NextRtcHost`: cursor, `rebase()`, baud comparison, reset and GPIO watching |
| `src/emu/machines/zxNext/wasm/zxnext/zxnext-uart.c` + `ZxNextWasmV2Loader.ts`, `reverse/exportContract.ts` | The exports of §5; rebuild the core |
| `src/emu/machines/zxNext/ZxNextWasmV2Machine.ts` | Create `EspHost`, call it, wire reset, `restoreHostState`, fork |
| `src/main/esp-net/EspNetBridge.ts` | Sockets, link ids, batching, credit |
| `src/main/esp-net/espNetPolicy.ts` | D8, as a pure function over a resolved address |
| `src/main/esp-net/hostNetwork.ts` | Per-platform name lookup, the LAN address, change polling while in use |
| `src/common/messaging/MainApi.ts`, `EmuApi.ts` | `espNetConnect/Send/Close/Credit/GetHostNetwork`, `espNetEvents` |
| `src/common/settings/` + `src/renderer/appEmu/MachineService.ts` | Settings (the `NEXT_RTC_*` route), English texts through `t()` |
| `src/renderer/appEmu/StatusBar/` | The status-bar item |
| `test/harness/zxnext/` | A session method that attaches the module with a fake network (README, "Adding a method") |

---

## 5. Core changes

All small; the UART model itself does not change.

- **`zxnextUartPeerSendBlock(channel, count)`** taking frames from a core buffer written with
  `writeCoreBytes`. Journaling one `zxnextUartPeerSend` per byte costs about 48 journal bytes per data byte,
  over 500 KB/s at 115,200 baud. A block costs one write and one call per frame.
- **`zxnextUartPeerQueueFree(channel)`**, `pure`, so the pump never overflows the send queue.
- **`zxnextUartPeerOutputTotal(channel)`**, journaled because it syncs the UART (as `OutputCount` is), and
  **`zxnextUartPeerOutputPtr(channel)`**, `pure`. `OutputCount` saturates at 4,096 and cannot show how much
  is new; the pump keeps its own cursor against the running total.
- **`zxnextUartGetPrescaler(channel)`**, `pure`. The low 14 bits cannot be read through the ports.
- **`zxnextUartPeerSetIgnoreRtr(channel, on)`** for T5.

Each goes through the contract test (`test/wasm/reverse/export-contract.test.ts`), which fails on an
unclassified export and checks every `pure` claim.

---

## 6. Replay and time travel

| Event | What happens |
|---|---|
| Live running, recording | `EspHost` runs; everything it does to the core is journaled |
| Stepping back, replay, forward | The journal is muted and supplies the bytes. `EspHost.beforeFrame` returns at once |
| Return to the present | `rebase()` moves the cursor to the core's output total, so bytes the Next "re-sent" in the replay are not fed to the module again. Module and sockets are as they were left |
| Paused at a breakpoint | No frames, no pump. Main holds data under backpressure (D15). A server may time out: T2 |
| "Take over here" | D14 |
| State file or `.klr` load | D14 |

A `.klr` recording contains the network data the program received, journaled like any input. The save
dialog's help says so.

---

## 7. Phases

Effort is a rough estimate.

| Phase | Content | Gate |
|---|---|---|
| **0. Spike** (2-3 days) | On a real Next: transcripts of every command in Phases 1-3, on the author's `AT+GMR` firmware; the boot sequence (junk length, banner, delay to `WIFI GOT IP`); join and scan delays; what `WIFI.BAS`, `.http` and the ESPAT driver actually send. On each OS: how to get the current network's name, what permission it needs, and whether it works unsigned (T1). | **Go** if the transcripts are complete enough to write the module from. The name lookup decides only how much D6's fallback is used |
| **1. Module, offline** (1 week) | §5's exports; `EspAtModule` with `AT`, `ATE0/1`, `AT+GMR`, `AT+RST`, `AT+CWMODE`, `AT+UART_CUR/DEF`, `AT+CIPMUX`, `AT+CIPMODE`, unknown commands; `EspHost`; reset and boot; the setting (Off / on, with no network yet). | `.UART` typed by a harness gets the right replies on the real core. With the setting Off, a run is byte-identical to today's and journals nothing new |
| **2. Virtual Wi-Fi** (3-4 days) | `hostNetwork`; `AT+CWLAP`, `AT+CWJAP`, `AT+CWQAP`, `AT+CIFSR`; the flash file; host network changes; fallback. | `WIFI.BAS` joins on the emulated Next, on all three OSes, and on a host with no Wi-Fi |
| **3. TCP** (1-1.5 weeks) | `EspNetBridge`; policy; `AT+CIPSTART` (TCP), `AT+CIPSEND`, `+IPD`, `AT+CIPCLOSE`, `AT+CIPSTATUS`; credit; the second access setting; the status bar. | `.http` fetches a file from a test server and an Internet host. The policy tests pass |
| **4. Debugging** (3-4 days) | §6; fork message; determinism test. | Reverse-debugging determinism test passes with a live transfer in the recording |
| **5. Fidelity** (1 week) | Baud mismatch (T3); boot junk; `AT+CIPSEND` length errors and `busy`; transparent mode; `AT+CIPMUX=1`; passive receive; UDP; TLS (T4); server mode, on loopback unless the policy is local network; profile 2.2. | `.UART -f` finds a module set to 57,600. NextSync completes a transfer |
| **6. Docs and close** (2-3 days) | §9; as-built notes; a changeset. | `npm run doc:build && npm run doc:check` pass |

Phases 1-3 are useful on their own and could be released without 5. Phase 4 must ship with 3: a network
program that breaks time travel is a regression for every user of the debugger.

---

## 8. Traps

1. **T1. The network name on macOS.** Recent versions hide it without Location Services, and the old
   command-line tools have been removed or redacted. It may need a signed native helper. D6 means this
   cannot block the feature: Phase 0 decides whether macOS gets the name in the first release.
2. **T2. Real servers time out while the machine is stopped at a breakpoint.** Unavoidable. When the link
   drops, the module reports `CLOSED` as it would for any lost connection.
3. **T3. Baud mismatch must be built, since the core does not model it.** `.UART -f` depends on seeing
   garbage. `EspHost` compares the module's rate with the prescaler (a few per cent of tolerance) and on a
   mismatch feeds the module nothing and sends deterministic scrambled frames, some with the framing-error
   kind. `AT+UART_CUR` takes effect after its `OK`.
4. **T4. TLS works better than on a real module.** Node negotiates modern TLS where a real 1.x firmware
   would fail on memory or ciphers. Accepted and documented: a program tested here may fail on hardware.
   Certificates are not verified, as the firmware does not by default.
5. **T5. The peer honours flow control a board issue 2 module cannot.** A program that sets frame bit 5 today
   pauses the peer; on issue 2 the RTR line goes nowhere. `EspHost` sets `IgnoreRtr` for those profiles.
6. **T6. Bursts.** At 2,000,000 baud a frame carries about 4,000 bytes and the send queue holds 4,096. The
   pump tops up each frame and honours `QueueFree`.
7. **T7. A UART 0 redirected to a joystick port** must cut the module off. `EspHost` reads NextReg `$0B`
   and feeds nothing in either direction while it is redirected.
8. **T8. Reset wiring.** NextReg `$02` bit 7 holds the module in reset; a hard reset restarts it; a soft reset
   does so only when the expansion bus is enabled. Check the frame-granular read of `$02` against a program
   that pulses the bit within one frame, and move to a core latch if a real program does that.
9. **T9. The journal grows with traffic.** A long download fills the reverse-debugging budget sooner. It is
   the same budget rule as any other input; check that the display and the limit behave.
10. **T10. An emulated program can hit a real server hard.** `AT+CIPMUX` caps links at five, as the firmware
    does. No further rate limit in v1; the access setting is the control.

---

## 9. Testing

- **Node unit tests** (`test/emu/esp/`): every command, each profile, malformed input, data mode at exact
  length and either side of it, `+IPD` framing, link numbers, flash contents (no password, ever). Golden
  transcripts from Phase 0 replayed against the module.
- **Policy tests**: every address class in each mode, IPv6 and IPv4-mapped forms, DNS answers that mix allowed
  and blocked addresses, rebinding.
- **`EspNetBridge` tests** on loopback sockets: batching, credit, pause and resume, close from each side.
- **Real core, harness, fake network** (`test/zxnext-hw/uart/`, already in the fast e2e tier): boot junk;
  a real overflow when a program stops reading; `+IPD` through `test/zxnext-hw/uart/wifi-ipd-reader.test.ts`'s
  listing; reset and GPIO0; T3, T5, T6, T7.
- **Determinism**: extend the reverse-debugging determinism test with a live transfer, checked against the
  recorded history; a fork mid-transfer.
- **Off means off**: a run with the setting Off makes no new journal entries and stays byte-identical.
- **Export contract** for every new export.
- **Real programs** in the slow tier, booting NextZXOS: `.http`, `WIFI.BAS`, NextSync.
- **By hand**, each OS: the permission path, Ethernet only, moving between networks, the status bar.

---

## 10. Documentation and records

- A guide page, `docs/content/en/guides/next/wifi-emulation.mdx` or the place `dev/ai/docs-site.md` says:
  turning it on, what the access levels mean and the risk of each, what programs can see, and the differences
  from a real module (join, TLS, flashing).
- Update `src/emu/machines/zxNext/wasm/README.md` ("No ESP and no Pi", the baud note) and
  `docs/content/en/book/20-uart.mdx`, which describes the socket as hardware only.
- The Wi-Fi chapter stays about the machine (`dev/ai/hardware-articles-guide.md`) and does not change.
- A `feature` changeset with the commit that completes the plan; earlier phases carry none.
- Move the design to a durable note (`dev/ai/zxnext-wifi.md`) when the plan closes.

---

## 11. Questions for the project author

1. **Which firmware is on your module?** `AT+GMR` decides the first profile. Can you record the Phase 0
   transcripts, or should Phase 0 give you a script to run in `.UART`?
2. **A native macOS helper, if T1 requires one?** Klive would need a small signed binary and a Location
   prompt, for a cosmetic gain. *Suggested: no, unless Phase 0 finds a route without one; macOS uses
   `Klive-Emulated`.*
3. **Default when the user turns it on:** *suggested: Internet only.*
4. **Should this enter `CLOSING_THE_GAPS_PLAN.md`** as a feature, with the comparison tables updated when
   done? *Suggested: yes, if other Next emulators offer it; to be checked.*
