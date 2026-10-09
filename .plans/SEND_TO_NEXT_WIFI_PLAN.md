# Send to Next over Wi-Fi — Implementation Plan (G6.5)

Status: **draft, open questions** (2026-10-08). Nothing is implemented. §10 lists the questions the
project author must answer before Phase 1. Phase 0 is a short spike on real hardware with a go/no-go
gate.

Scope:
- [CLOSING_THE_GAPS_PLAN.md](CLOSING_THE_GAPS_PLAN.md) **G6.5**: send a `.nex` that Klive built (or
  any `.nex` in the project) to a physical ZX Spectrum Next **over Wi-Fi**, and start it there,
  without debugging.
- **A user guide for setting up Wi-Fi on the Next itself** (§8.1). This feature is useless until the
  Next's ESP module is on the network, and that set-up is where most users get stuck, so the guide is
  a deliverable of this plan, not an afterthought.

Relationship to G6.4 (decided by the project author, 2026-10-08):
- **G6.4 (debugging on real hardware) is deferred.** It may never be built. G6.5 therefore
  **stands alone**. It must not depend on G6.4's agent, its KDP protocol, its `IByteLink` layer or its
  serial cable.
- [NEXT_HARDWARE_DEBUGGING_PLAN.md](NEXT_HARDWARE_DEBUGGING_PLAN.md) planned G6.5 as its Phase 2, over
  a joystick-port UART and a USB-serial adapter. That path is replaced by this plan. If G6.4 is ever
  built, it can add a serial "send" on top of its own link, and keep this Wi-Fi path as well.
- That plan's §2.2 rejected Wi-Fi **for debugging** (latency, an AT state machine in a resident agent,
  conflicts with programs that use the ESP). None of those objections apply to a one-shot file push,
  which is what this plan does. The two plans agree.

Not in scope:
- Debugging, breakpoints, reading memory or registers from the real machine (G6.4).
- Serial or USB transports.
- Syncing whole folders (NextSync already does that, §2.3), or reading files back from the Next.
- Emulating the ESP inside Klive's own Next emulator for users ("Wi-Fi in the emulator"). The fake ESP
  this plan builds for its tests (§6) is a natural start for that, but it is a separate follow-up.
- Internet access, a cloud relay, or connecting to a Next that is on a different network.

---

## 1. What the user gets

1. **Once:** set up Wi-Fi on the Next (§8.1). Get Klive's small dot command `.klive` onto the SD card.
   It can be fetched over Wi-Fi with the Next's own `.http` command, so no card reader is needed (D8).
   Pair it with Klive by typing one line that Klive shows: `.klive -s 192.168.1.20 482913`.
2. **Every time:**
   - On the Next, type `.klive -w`. The Next waits for Klive.
   - In Klive, choose **Run ▸ Send to Next** (or type the IDE command `next-send`). Klive builds the
     project and exports the NEX, like Run does.
   - The Next downloads the file, saves it to the SD card and starts it with `.nexload`.
   - The status bar shows the progress, then "Started on Next".
3. **Pull instead of wait:** if Klive already holds a file to send, typing `.klive` on the Next fetches
   and runs it straight away.
4. **No install at all:** the Next's stock `.http` command can fetch the same file, and Klive shows the
   exact command line to type. This works before `.klive` exists on the card, and it is also the
   fallback when `.klive` misbehaves.

**Why the Next pulls.** The ESP in AT mode cannot do anything until a program on the Next drives it.
So "push" means that a program on the Next (`.klive -w`) waits for Klive. Klive is the server; the Next
is the client. NextSync works the same way (§2.3).

---

## 2. Background (researched 2026-10-08; items marked ⚑ are checked in Phase 0)

### 2.1 The ESP module

- The Next's Wi-Fi is an **ESP8266 ESP-01** module, push-fitted on a header behind the VGA port. It
  speaks Espressif's **AT command set** over the Next's UART 0 (ports `$133B` Tx / `$143B` Rx).
  - It was optional on the original Kickstarter cased Next. ⚑ Which later models fit it as standard
    (KS2, Next Plus/N-Go) is confirmed for the guide.
  - Boards without the module can have one added. It must carry the **standard AT firmware**.
    v0.30, v1.3, v1.5.4, v2.2.1 and v3.0.3 have all been seen; v1.x is the most common.
- **Radio.** 802.11 b/g/n on **2.4 GHz only**, with WPA/WPA2.
- **UART.** The Next's UART runs at 2,400 bps to 2 Mbps; it is reset to 115,200. Most ESP modules
  default to 115,200, but some ship at 57,600 or 19,200. **There is no flow control between the ESP
  and the Next**, so the Next must drain its Rx FIFO fast enough (512 bytes deep on current cores).
- **The distribution's tools:**
  - `C:/DEMOS/ESP/WIFI.BAS` joins a network.
  - The `.UART` dot command and `TERMINAL.BAS` are AT terminals; `.UART -f` searches for the module's
    baud rate.
  - `UART.DRV` and the ESPAT driver serve BASIC programs.
  - The read-me `docs/extra-hw/wifi/WIFIand UARTReadME1st.txt` covers the rest.
  - ⚑ The `.espbaud` dot command (one tool's notes suggest `.espbaud -dR` when a program hangs while
    checking Wi-Fi) is checked and documented only if it is confirmed.
- **The AT commands** that matter for set-up and for the guide's troubleshooting section:
  - `AT`, then `AT+GMR` (firmware version);
  - `AT+CWMODE=1` (station mode);
  - `AT+CWLAP` (list networks), `AT+CWJAP="ssid","password"` (join);
  - `AT+CIFSR` (show the IP address);
  - `AT+RST` (the module rejoins the saved network: `WIFI CONNECTED`, `WIFI GOT IP`);
  - `AT+CWQAP` (forget the network).
- **The module remembers the network** across power cycles. Set-up is a one-off.

### 2.2 The Next-side commands this plan relies on

- **`.http`**, an HTTP GET/POST dot command written by Remy Sharp and included in the Next
  distribution. ⚑ Its exact options are confirmed in Phase 0: `-h` host, `-p` port, `-u` path, `-f`
  file, and whether it handles files of several hundred KB.
- **`.nexload <file>`** starts a NEX. Klive's emulator already drives it this way
  (`src/common/utils/nex-launch-paths.ts`).
- ⚑ **esxDOS `M_EXECCMD`** (`RST $08` / `$8F`) runs a dot command line from inside a program. It is
  how `.klive` hands over to `.nexload`. Phase 0 checks that it works from inside a dot command, and
  that `.nexload` then takes over cleanly.

### 2.3 Prior art: NextSync

Jari Komppa's **NextSync** is the established tool for this:
- A Python server on the PC listens on **TCP 2048**. The `.sync` dot command on the Next connects to it
  and mirrors a PC folder onto the SD card.
- Its server address is stored in `c:/sys/config/nextsync.cfg`.
- It is released under the Unlicense. ZX-Next-Unite extends it as `.sync5`.
- Its documented peak speed is about **48 kB/s**, which is a useful benchmark for this plan.

What it shows:
- the pull model works;
- a Next-side config file in `c:/sys/config/` is the accepted convention;
- macOS and Windows firewalls must allow an inbound port;
- chunked, checksummed transfers with retries are needed over this link.

Klive does not copy or reuse its code. It could *speak its protocol* instead of having its own dot
command (Q2); the suggested answer is no.

---

## 3. Decisions (proposed; confirm or change in §10)

| # | Decision |
|---|---|
| D1 | **Klive runs a small HTTP server; the Next pulls.** It is HTTP/1.1, GET only, in the main process, on Node's `http` module, with no new dependency. HTTP rather than a custom protocol for three reasons: the stock `.http` command works with no install (D8, §1 item 4); `curl` works for testing and support; and the parsing on the Next side is a status line, two headers and a body. |
| D2 | **The server is off by default** and starts only while the setting **Send to Next over Wi-Fi** is on. It listens on all IPv4 interfaces (the Next is on the LAN), on one port: proposed default **6464**, configurable, never NextSync's 2048. It is **read-only**: it serves the current *offer* (D4), the `.klive` binary (D8) and nothing else. There is no directory listing, no path built from request input, and no write endpoint. |
| D3 | **A 6-digit pairing code** in the URL path (`/k/<code>/…`). Klive generates it; it is shown in Settings and in the Send to Next dialog, and can be regenerated. A wrong code gets a plain 404, the same as an unknown path. **Threat model, stated plainly in the docs:** the code keeps out port scanners and other Nexts on the network, not an attacker on the LAN who can read plain HTTP. What it protects is only the file the user chose to send. |
| D4 | **An "offer" is one file at a time.** It has an id (a counter), a name, a size, a CRC-16/CCITT and the bytes. **Send to Next** replaces the offer; **Cancel** withdraws it. The server keeps a copy in memory, so a rebuild during a download cannot tear the file. |
| D5 | **Endpoints** (all under `/k/<code>/`): `hello` returns `klive <version> proto 1` and the current offer (`id name size crc`) or `none`. `offer` returns the file. It supports `Range: bytes=a-b`, and each range carries an `X-Klive-Crc` header. `wait?after=<id>` is a long poll: it returns as soon as an offer newer than `<id>` exists, or `204` after 20 s, and the client then asks again. `done?id=<id>&r=<result>` reports the outcome to the status bar (saved / started / error code). |
| D6 | **`.klive` downloads in ranges of at most 4 KiB into RAM, and writes to the SD card only between ranges.** The ESP pushes `+IPD` data with no flow control. A Z80N at 28 MHz polling a 512-byte FIFO at 115,200 baud keeps up easily, as long as it never stops to write to the SD card mid-range. A range whose CRC does not match is fetched again, up to 3 times. The buffer is an 8K page allocated from NextZXOS (⚑ the allocation call is confirmed in Phase 0), so the dot's own 8K stays code. |
| D7 | **The file is written to a temporary name, then renamed**, so a failed transfer never leaves a half-written NEX over a good one. Target folder `/klive/` (configurable). The file name follows `nexSdCardTarget()`'s shortening rules, so the `.nexload` line stays short. Then `.klive` runs `.nexload <path>` through `M_EXECCMD`, unless `-n` (copy only) was given. Non-NEX files are offered too, but are only copied (Q4). |
| D8 | **`.klive` is a dot command written in Klive asm** (dogfooding, as G6.4's agent would have been). Its source is in `src/main/next-dot/`, and Klive ships the built binary. Three ways onto the card: (1) **over Wi-Fi with the stock `.http`**: the server serves the binary at `/klive.dot` with no code, because it is public software; Klive shows the line, e.g. `.http -h 192.168.1.20 -p 6464 -u /klive.dot -f /dot/klive`; (2) a card reader; (3) for emulator users, Klive's existing ZX Next storage copy into a `.cim` image. |
| D9 | **`.klive` options:** `-s <host> <code> [port]` saves the pairing to `c:/sys/config/klive.cfg`, following NextSync's convention; `-w` waits for the next offer (long poll; BREAK cancels); no option fetches the current offer; `-n` copies without running; `-t` tests: it joins nothing and changes nothing, it only checks the ESP, the IP address and `hello`, and prints each step; `-v` prints the AT conversation. **`.klive` never changes the ESP's saved network or baud rate.** Set-up stays in `WIFI.BAS`, so a bug in `.klive` cannot take a Next off the network. |
| D10 | **The baud rate between the Next and the ESP stays at 115,200 in v1**, about 10 KB/s after AT overhead, so a 200 KB NEX takes about 20 s. A temporary speed-up (`AT+UART_CUR`, which is not saved) and a matching Next prescaler are a Phase 3 option, only if Phase 0 shows it is reliable on the common firmware versions. |
| D11 | **IDE side:** a **Run ▸ Send to Next** menu item; an IDE command `next-send [file] [-n]` (no file: build and export like `run`; with a file: offer that file; `-n`: copy only); a status-bar item (off / waiting for Next / sending 45 % / started on Next / error); a **Send to Next** dialog showing the Next-side lines to type, the Mac's LAN addresses and the code, with Copy buttons; and settings rows (enable, port, code, regenerate, target folder). The dialog follows the Model/Controller/View split (`.ai/ui-mvc-guide.md`), because it reacts to an async server. |
| D12 | **Everything except the radio is tested without hardware.** A **fake ESP** (`EspAtPeer`, test-only) speaks the AT subset `.klive` uses on the emulated Next's UART 0. It bridges `AT+CIPSTART` to a real Node socket, so the e2e tests run the real dot command on the WASM core against the real Klive server. Real hardware gets a manual checklist, never CI. |

---

## 4. Architecture

```
 Klive IDE
   Run ▸ Send to Next / next-send ─► build + NEX export (existing path)
        │ MainApi.nextLinkOffer(path)
        ▼
 main: NextLinkServer (node:http, off by default)
        │  GET /k/<code>/hello | offer (Range) | wait | done      GET /klive.dot
        ▼  LAN, Wi-Fi
 ESP-01 (AT firmware) ◄── UART 0 ──► .klive dot command (Klive asm, ~6–8K)
                                        ├─ save to /klive/<name>.tmp, rename
                                        └─ M_EXECCMD ".nexload /klive/<name>.nex"
```

New and changed code:

| Where | What |
|---|---|
| `src/main/next-link/NextLinkServer.ts` | Server lifecycle, routing, pairing code check (constant-time), long-poll registry, offer store |
| `src/main/next-link/lan-addresses.ts` | IPv4 addresses that the Next can reach (`os.networkInterfaces()`, without loopback, link-local or VPN tunnels when they can be recognised) |
| `src/main/next-link/crc16.ts` | Shared CRC-16/CCITT. A TS twin of the dot's routine, tested against it |
| `src/main/next-dot/klive.asm` (+ includes) | The dot command: AT driver, HTTP client, esxDOS file I/O, config file, `M_EXECCMD` |
| `src/common/messaging/MainApi.ts` | `nextLinkOffer`, `nextLinkCancel`, `nextLinkStatus`; state actions for the status bar |
| `src/main/settings.ts` + settings rows | `nextLink.enabled`, `.port`, `.code`, `.targetFolder` |
| `src/renderer/appIde/commands/NextSendCommand.ts` | `next-send`; reuses the export step of the run path and `nexSdCardTarget()` |
| `src/renderer/appIde/dialogs/sendToNext/` | MVC dialog (D11) |
| `test/harness/zxnext/esp-at-peer.ts` + a session method | The fake ESP (D12), added the README's "Adding a method" way |
| `scripts/next-wifi-check.md` | Manual real-hardware checklist |

**Building the dot command.** A dot command is a raw binary, loaded at `$2000` and at most 8K. ⚑
Klive asm has no "dot command" output today. Phase 0 checks whether the existing export can emit a
raw binary for `ORG $2000`. If not, Phase 2 adds a small raw-binary export, which also helps users
who write their own dot commands.

---

## 5. Traps

1. **T1. Guest networks and client isolation.** Many routers stop Wi-Fi clients from reaching each
   other, especially on guest SSIDs and in mesh "IoT" networks. The symptom is `hello` timing out,
   although the Next has an IP. `.klive -t` reports this case in words, and so does the guide.
2. **T2. 2.4 GHz only.** If the router uses separate SSIDs for 2.4 and 5 GHz, the Next must join the
   2.4 GHz one. A Mac on the 5 GHz SSID of the same router is usually still reachable; on some mesh
   systems it is not. The guide covers both.
3. **T3. The macOS application firewall** asks once whether Klive may accept incoming connections.
   A "Deny" fails silently later. The Send to Next dialog says "if macOS asked about incoming
   connections, choose Allow", and the guide shows where to change it afterwards. On Windows, Defender
   asks the same per network profile; on a "Public" profile it blocks.
4. **T4. Several LAN addresses** (Ethernet plus Wi-Fi, Docker, VPN). The dialog lists all candidates;
   `-t` on the Next shows which one answers.
5. **T5. AT firmware differences.** `+IPD` framing, `busy p...` replies and `CLOSED` timing differ
   between v1.x, v2.x and v3.x. `.klive` uses only the oldest, most common subset (`AT`, `ATE0`,
   `AT+CIPSTART`, `AT+CIPSEND`, `AT+CIPCLOSE`, `AT+CIFSR`, single connection mode), and the fake ESP
   models the variants Phase 0 records.
6. **T6. The Rx FIFO overruns while the SD card is written** (D6). The fix is by design. A test makes
   the fake ESP send at full speed while the dot is mid-write, and checks that the CRC check catches
   the damage.
7. **T7. The ESP is still mid-connection after BREAK or a crash.** On start, `.klive` sends
   `AT+CIPCLOSE` and ignores the reply.
8. **T8. A program that left the ESP at another baud rate.** `.klive` starts at 115,200, tries `AT`,
   and on failure says "run `.UART -f`" (or `.espbaud`, ⚑). It never re-saves the module's rate (D9).
9. **T9. Rebuild while the Next is downloading.** The offer is an in-memory snapshot (D4); a new offer
   gets a new id, and the next `wait` delivers it.

---

## 6. Testing

- **Node unit tests** (`test/main/next-link/`):
  - routing and 404s, including a wrong code, path traversal attempts and unknown verbs;
  - `Range` edges and `X-Klive-Crc`;
  - the long poll: resolve on a new offer, 204 on timeout, cleanup on client disconnect;
  - offer replacement during a download;
  - `done` reporting;
  - CRC-16 test vectors;
  - LAN address filtering on fixture `networkInterfaces()` output;
  - the server stays closed when the setting is off.
- **Fake ESP** (`EspAtPeer`): unit-tested against recorded AT transcripts from Phase 0 (v1.x and the
  newest firmware the author has).
- **e2e-cores tier** (registered in `build/e2e-tests.ts`), the real dot command on the WASM Next with
  the fake ESP and a real `NextLinkServer`:
  - a NEX of 1 byte, 4 KiB, 4 KiB + 1 and about 300 KB arrives intact on the emulated SD card;
  - `-n` copies only; the default runs `.nexload` (⚑ the harness route for NextZXOS and dot commands
    is chosen in Phase 0: boot NextZXOS from the `.cim` and type, or a stubbed `RST $08`);
  - faults:
    - dropped and corrupted `+IPD` bytes → the range is retried;
    - the connection closes mid-range → the error is reported and no file is changed;
    - a wrong code → the error says "pairing";
    - the server is gone → a timeout with a message;
    - BREAK during `-w` → back to BASIC with the ESP idle.
  - `-s` writes and reads back `klive.cfg`.
- **The stock `.http` route** is covered by a server test that replays the request `.http` sends (as
  recorded in Phase 0).
- **Real hardware**: `scripts/next-wifi-check.md`: set-up with `WIFI.BAS`; bootstrap with `.http`;
  pair; send and run a NEX from the ZX Next project template; the cases from T1, T3 and T4; timing of
  a 200 KB NEX.

---

## 7. Phases

| Phase | Content | Gate |
|---|---|---|
| **0. Spike** (≈3–4 days, on the author's Next and MacBook Pro) | Record the module's `AT+GMR`, and AT transcripts for CIPSTART/CIPSEND/+IPD/CLOSED. Confirm the `.http` options and its file-size limits. Fetch a 300 KB file from a throwaway Node server with `.http` and time it. Confirm `M_EXECCMD` → `.nexload` from inside a dot command, and the page-allocation call. Confirm Klive asm can emit a `$2000` raw binary. Choose the harness route for dot commands. Confirm `.espbaud` and `C:/DEMOS/ESP/WIFI.BAS` on the current distribution, and capture its screens for the guide. Note the macOS firewall prompt text. | **Go** if `.http` fetches a NEX from a Mac over Wi-Fi and `.nexload` runs it. That alone proves the zero-install path; the rest decides the dot command's details. |
| **1. Server and IDE** (≈1 week) | `NextLinkServer`, LAN addresses, settings, MainApi, `next-send`, the Send to Next dialog with the `.http` lines, the status bar. **First usable release: send-to-Next works with stock `.http` + `.nexload`.** | Node tests green. On hardware: a project built in Klive runs on the Next through the lines the dialog shows. |
| **2. The `.klive` dot command** (≈1.5–2 weeks) | AT driver, HTTP client with ranges and CRC, temp file and rename, `.nexload` hand-over, `-s/-w/-n/-t/-v`, `/klive.dot` bootstrap; the fake ESP, the harness method and the e2e tests. | The e2e suite is green, including the fault cases. On hardware: `.klive -w` + Send to Next starts the NEX with no typing per send. |
| **3. Polish** (≈2–3 days) | `done` reporting to the status bar; better error texts from the Phase 0 failure cases; optional D10 speed-up if Phase 0 showed it safe; an optional NextZXOS menu entry tip (`enMenus.cfg`). | Checklist in `scripts/next-wifi-check.md` passes on hardware. |
| **4. Docs and roadmap** (≈2–3 days) | The two pages of §8; `_meta.ts` entries; route goldens; links from book chapter 20 (UART and ESP); `LANDING_PAGE_COMPETITIVE_ANALYSIS.md` §2 and §4; mark G6.5 done in `CLOSING_THE_GAPS_PLAN.md`. | `npm run doc:build && npm run doc:check` pass. |

**Effort: M, about 3–4 weeks**, which matches the roadmap's rating. Phase 1 alone delivers a working
feature after the spike.

---

## 8. Documentation (Phase 4 deliverables)

Both pages are user-facing and live under `docs/content/`. Next-side command lines go in code fences
**without a language tag**: `text` is not registered in `mdxOptions…langs` (`docs/next.config.mjs`),
and an unregistered language fails the build (AGENTS.md). Klive-side screenshots come from
`scripts/doc-shots/` (read `.ai/doc-screenshots-guide.md`). Next-side screens are captured by the
author in Phase 0 (HDMI capture or photos), or the page goes without them.

### 8.1 `docs/content/howto/next-wifi-setup.mdx` — "Setting up Wi-Fi on the ZX Spectrum Next"

The guide stands on its own: it is useful to any Next owner, not only to Klive users. Outline:

1. **What you need.**
   - A Next with an ESP-01 module: where it sits (behind the VGA port), which models have one, how to
     tell, and buying a replacement with **standard AT firmware**.
   - A **2.4 GHz** network with WPA/WPA2. Not supported: WPA3-only, enterprise (802.1X) networks,
     and networks with a captive-portal login page.
   - A NextZXOS distribution recent enough to include the tools (minimum version confirmed in
     Phase 0).
2. **Joining your network with WIFI.BAS.**
   - Open the Browser and run `C:/DEMOS/ESP/WIFI.BAS`.
   - Step through its screens: pick the network, enter the password, wait for the confirmation. The
     steps are written from the Phase 0 capture, not guessed.
   - The module remembers the network: you do this once.
3. **Checking the connection.**
   - Run `.UART`, type `AT` → `OK`, then `AT+CIFSR` → the Next's IP address.
   - How to leave the terminal (Symbol Shift + Space).
4. **Joining by hand** (when WIFI.BAS does not work), in the `.UART` terminal:
   - `AT+CWMODE=1`
   - `AT+CWLAP`
   - `AT+CWJAP="network","password"`
   - `AT+RST`, then look for `WIFI CONNECTED` / `WIFI GOT IP`
   - `AT+CWQAP` to forget a network.
5. **Troubleshooting.**
   - No `OK` and garbled text means a baud mismatch: try `.UART -f`, or Shift+9 in the terminal to
     cycle the rate; set the module to 115,200 once.
   - No reply at all: the module is not seated, or it has non-AT firmware (`AT+GMR`).
   - Connected but unreachable: guest network or client isolation (T1), and the 2.4/5 GHz split (T2).
   - The module reboots: the `rst cause` codes.
   - The router hands out a new IP address each time: suggest a DHCP reservation.
   - The distribution's own read-me, `docs/extra-hw/wifi/WIFIand UARTReadME1st.txt`.
6. **Connecting to your computer.**
   - The computer and the Next must be on the same network.
   - Find the computer's address (macOS: System Settings ▸ Wi-Fi ▸ Details; Windows: `ipconfig`;
     Linux: `ip addr`). Klive's Send to Next dialog lists it too.
   - Firewall prompts on macOS and Windows (T3), and how to fix a "Deny" afterwards.
7. **Next steps:** link to 8.2; a mention of NextSync for syncing whole folders.

### 8.2 `docs/content/working-with-ide/send-to-next.mdx` — "Sending programs to your Next"

1. What it does, and what it does not (no debugging; the program runs on the real machine).
2. Turning it on in Settings: the port, the pairing code and the security note (D3).
3. Quick start with no install: the `.http` line and `.nexload`.
4. Installing `.klive` (the three routes from D8) and pairing (`-s`).
5. Everyday use: `.klive -w` + Run ▸ Send to Next; `.klive` alone; `-n`; the `next-send` command;
   the status bar states.
6. Reference: every `.klive` option, `klive.cfg`, the target folder, error messages and what to do.
7. Troubleshooting: `.klive -t` output explained step by step; link back to 8.1 §5.

Also:
- add `next-send` to `docs/content/commands-reference.mdx`;
- add a "see also" from `docs/content/book/20-uart.mdx`, whose "Talking to the ESP" section covers
  the same AT commands from the programmer's side.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| AT firmware variety breaks `.klive` on some modules | The oldest common subset (T5); Phase 0 transcripts in the fake ESP; `-v` for bug reports; the `.http` path as a fallback |
| `M_EXECCMD` cannot start `.nexload` from inside a dot command | `.klive` saves the file and prints the `.nexload` line to type; a later NextZXOS API route if one exists |
| The speed is too low for big NEX files | D10 speed-up in Phase 3; NextSync's ~48 kB/s shows the link can do better than 115,200 baud |
| Networks that block client-to-client traffic | Documented (T1); out of Klive's control |
| An open port on the developer's machine | Off by default, read-only, pairing code, 404 for everything unknown (D2, D3); documented threat model |
| Few contributors own a Next | D12: everything but the radio runs in CI |

## 10. Questions for the project author

1. **Confirm the standalone scope:** G6.5 is Wi-Fi only, and G6.4 is deferred. Should
   `NEXT_HARDWARE_DEBUGGING_PLAN.md` stay as a draft for the future, with its Phase 2 marked as
   replaced by this plan? *Suggested: yes; the edit is already made in this change.*
2. **Own dot command, or speak NextSync's protocol?** Speaking it would let users with `.sync` skip
   installing `.klive`. But NextSync mirrors folders, has no "run after copy" step, and Klive would
   follow another project's protocol changes (`.sync5`). *Suggested: own dot command, plus the stock
   `.http` route, which already needs no install.*
3. **Phase 1 alone as a release?** The stock-`.http` path is a complete feature, if a little clunky:
   one line to type per send. *Suggested: yes, ship it, then add `.klive`.*
4. **Non-NEX files** (`.bas`, `.tap`, data files): copy only in v1, or out of scope? *Suggested: copy
   only (`-n` is implied); they cost nothing extra.*
5. **Default port:** 6464 is suggested. Any preference?
6. **Hardware for Phase 0:** which Next model, which NextZXOS and core versions, and what does
   `AT+GMR` report? Can you capture `WIFI.BAS`'s screens for the guide?

---

## References

- SpecNext wiki, *ESP8266-01*: https://wiki.specnext.dev/ESP8266-01 (module, firmware versions, AT
  commands, `.UART` keys, baud-rate troubleshooting, reset causes)
- nxtp wiki, *Setting Up Your Next WiFi*:
  https://github.com/Threetwosevensixseven/nxtp/wiki/Setting-Up-Your-Next-WiFi (location of
  `WIFI.BAS`)
- SpecNext, *The Next on the network*: https://www.specnext.com/the-next-on-the-network/ (ports, UART
  speeds, no flow control)
- NextSync 1.1 notes: https://github.com/jarikomppa/specnext/blob/master/sync/nextsync.txt (port
  2048, `nextsync.cfg`, chunking, speed)
- ZX-Next-Unite wiki, *NextSync tab*: https://github.com/jclauzel/ZX-Next-Unite/wiki/NextSync-tab
  (`.sync5`, firewall notes)
- Remy Sharp's devlog on writing `.http`: https://remysharp.itch.io/marbles2/devlog/270964/2021-07-05
- Klive's own UART/ESP chapter: `docs/content/book/20-uart.mdx`
