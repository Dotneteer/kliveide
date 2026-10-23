# HT-1080Z Tape File Viewers and `.bas` by Content — Implementation Plan

**Status:** decisions accepted by the project author 2026-10-23: option A for `.bas` (decide by
content) and D-Q1 to D-Q4 (§7), the mockup approved. Phases 1 and 2 done 2026-10-23 (§8). Next: Phase 3.
**Mockup:** `.plans/mockups/ht1080z-tape-viewers.html` (real bytes, interactive; open it in a browser).
**Follows:** `.plans/HT1080Z_PLAN.md` (complete) and `.plans/HT1080Z_CODE_INJECTION_PLAN.md`
(complete). The pattern is `.plans/TAPE_VIEWER_PLAN.md` (the TAP/TZX viewer) and the ZX81's `.p`
viewer (`DocumentPanels/PFile/`).

---

## 1. Goal

1. **`.bas` means two things, and the file decides which.** A tokenised HT-1080Z program is an
   HT program everywhere: it opens in the HT viewer, the Explorer offers Load and run, and it goes
   into the HT's tape deck. Any other `.bas` is BASIC source text, as today: the code editor, Klive
   BASIC or Boriel BASIC builds. No setting, no project type, no extension change.
2. **Viewers for `.cas`, `.cmd` and tokenised `.bas`**, as rich as the TAP/TZX viewer: a summary
   strip, a graphic of the whole file (a play-time timeline for tapes, a 64K memory map for what
   loads where), the parts grouped by file, each part's byte anatomy with hover-linked fields, the
   BASIC listing in each model's characters, and pop-outs (listing, memory, disassembly).

Out of scope: running a *text* `.bas` on the HT (option C, declined: it would give a text `.bas` two
run meanings and need a byte-exact copy of the ROM's tokeniser); editing tapes; `.wav`.

## 2. What exists today (survey, 2026-10-23)

- **File types** (`src/renderer/registry.ts`, `FileTypeEditor` in `abstractions/FileTypePattern.ts`):
  matched by name only, in `getFileTypeEntry(filename, store)` (`appIde/project/project-node.ts`),
  which **13 callers** use, synchronously: the project tree's icons and visibility, the Explorer's
  context menu, the document header's buttons, opening a file as text or binary
  (`ProjectService.readFileContent`), the build root's language (`compile-code.ts`, unit tests,
  Monaco). Some pass a full path, some only a name (`project-node.ts` passes `node.name`,
  `DocumentsHeader` the active node's name).
- **`.bas` today:** a `CODE_EDITOR` entry with `subType: "zxbas"` (Klive BASIC / Boriel BASIC).
  `.cas` and `.cmd` open in `BIN_VIEWER` (hex) with the HT launch buttons
  (`htTapeLaunchCommandBarRenderer`). A tokenised `.bas` opens as garbage text.
- **The tree** comes from the main process (`main/directory-content.ts`, `getDirectoryContent`):
  names and paths, no content. The renderer refreshes it on file-system events.
- **Tape loading:** `isHt1080zTapeFor(file, machineId)` (`Ht1080zTapeFile.ts`) takes `.bas` as an
  HT tape on the HT by name; `parseHt1080zTapeFile` already refuses a `.bas` that does not start with
  FFh (`basNotTokenised`). File › Open File… and drag and drop take only `.cas`/`.cmd`.
- **The TAP/TZX viewer** (`DocumentPanels/Tape/`): `GenericFilePanel` around a React-free model
  (`tapeView.ts`), the shared bank browser (`TapeBlockBrowser` on `BankBrowser`), `TapeTimeline`,
  `TapeHeaderBytes` + `tapeHeaderFields.ts` (the byte anatomy), pop-outs through
  `tapeBlockDocument.ts` / `TapeBlockViewerPanel` and `openStaticMemoryDump`.
- **HT pieces to reuse:** `Ht1080zTapeFile.ts` (`describeCas`, `cmdToSystemTape`, `basToBasicTape`),
  `common/ht1080z/cmdFile.ts`, `common/ht1080z/basicTokens.ts`, `ht1080zBasicListing.ts`
  (`decodeHt1080zProgram`, the model's characters, the /64's backtick pairs), `ht1080zCharsFor`,
  the HT disassembler (`ht1080z-disassembler.ts`).

## 3. The traps

1. **`getFileTypeEntry` is synchronous and name-based, and content is not.** Reading a file in it is
   impossible, and the 13 callers cannot all become async. The content kind must be known before
   anyone asks: sniffed when the tree is read, cached, and looked up by path.
2. **Some callers pass a bare name.** A name cannot be looked up in a by-path cache: those callers
   must pass the full path (or the cache cannot answer them, and a tokenised `.bas` shows the text
   icon in the tree).
3. **A file can change kind.** `CSAVE` into the project (a future feature) or an external tool can
   overwrite a text `.bas` with a tokenised one; the file watcher's events must re-sniff, and an open
   document of the old kind must be closed or reopened.
4. **The FFh rule must not misfire on text.** FFh never occurs in UTF-8, but a UTF-16 text file starts
   with `FF FE`. The rule is therefore FFh **and** a chain of lines whose links agree with their
   lengths (D1).
5. **Files outside the project** (`tape-load /somewhere/x.bas`, File › Open File…, drag and drop)
   are not in the tree: those paths sniff on demand (they are async already).
6. **A tokenised `.bas` must never become a build root.** Klive BASIC and Boriel BASIC would try to
   compile it. The build-root check refuses it with a clear message.
7. **The model's characters differ** (Series II's É at 40h, the /64's specials at 00h-1Fh and its
   backtick pairs): one file lists differently per model. The viewer needs a model switch (D-Q2).
8. **Play times** are the ROM's 500 baud: about 3,560 T-states a bit cell at 1.774 MHz, 16 ms a byte;
   the leader is 255 zero bytes and the ROM waits ~1 ms after the sync. The timeline uses these
   numbers, as the TAP viewer uses the Spectrum's pulse lengths, and a test pins them against the
   core's real-time load.

## 4. Design

### D1 - What makes a `.bas` an HT program

`src/common/ht1080z/basContent.ts`: `isTokenisedHt1080zBasic(bytes)` is true when

1. the first byte is FFh, and
2. what follows is a chain of program lines whose links agree with their lengths: each line is a
   2-byte link, a 2-byte line number, text, and a 00h, and each link exceeds the previous one by
   exactly the next line's length. The chain ends at a link of 0000h. The address the program was
   saved at does not matter (a disk BASIC saves from another TXTTAB): only the differences are
   checked. An empty program is `FF 00 00`.

The first 512 bytes are enough: the chain is followed until a link of 0000h, the end of the bytes read,
or a mismatch. Text cannot pass: FFh never occurs in UTF-8, and a UTF-16 file (`FF FE ...`) has no
00h-terminated lines whose links match their lengths. One function, used by the sniffer (D2), the
tape loader (D6), File › Open File… and drag and drop (D6), and the build-root check (D7). A unit test
covers the demo program, an empty program, a program saved from another address, UTF-8 and UTF-16
(LE/BE, with and without BOM) text, a file of FFh bytes and a truncated program.

### D2 - Content kinds, sniffed once and cached

- `ProjectNode` gains an optional `contentKind?: "ht1080zBasic"`. `getDirectoryContent` reads the
  first 512 bytes of every `.bas` (case-insensitive) it lists and sets it. Cost: one small read per
  `.bas` file; projects hold few.
- The renderer keeps the kinds in a by-path map, filled from the tree (`project-node.ts`) and updated
  by the file watcher's change/create/rename events (the main process sends the new kind with the
  event, so no extra round trip).
- `FileTypePattern` gains an optional `contentKind`. `getFileTypeEntry(path, store)` looks the path up
  and matches an entry with that `contentKind` first; entries without one match as today. Callers that
  pass a bare name (`project-node.ts`, `DocumentsHeader`, the rename path) pass the full path instead.
- When a file's kind changes while it is open, its document is closed and reopened in the right
  editor (the document hub's existing "reopen" path), with a status message.

### D3 - The registry

```text
{ pattern: ".bas", contentKind: "ht1080zBasic", editor: HT1080Z_TAPE_VIEWER, isBinary, isReadOnly,
  documentTabRenderer: htTapeLaunchCommandBarRenderer, contextMenuInfo: getHtTapeLaunchContextMenuInfo }
{ pattern: ".bas", editor: CODE_EDITOR, subType: "zxbas" }           -- unchanged, after it
{ pattern: ".cas" / ".cmd", editor: HT1080Z_TAPE_VIEWER, ... }        -- BIN_VIEWER replaced
```

`HT1080Z_TAPE_VIEWER` is one panel that picks its view by the parsed file's kind (D4). The hex view
stays reachable as a pop-out.

### D4 - The model: `ht1080zTapeView.ts` (no React)

`src/renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zTapeView.ts`, parallel to `tapeView.ts`:

```text
analyzeHt1080zFile(bytes, fileName) -> {
  kind: "basicTape" | "systemTape" | "cmd" | "bas",
  summary: { format, size, name, program/code, start, playTime, fits },
  parts: [{ index, role: leader|sync|header|basic|end|block|entry|nameRecord|loadRecord|transferRecord|line,
            offset, length, t0Ms, t1Ms, loadFrom?, loadTo?, checksum?: { stored, computed },
            fields: [{ group, offset, name, value }] }],
  groups: [{ title, partIndexes }],
  program?: { lines: [{ no, address, link, offset, length, text }] }
}
```

- `.cas`: `describeCas`'s header detection (any bit offset, the 1500-baud refusal), then the BASIC
  tape (D3 D3 D3, name, lines, 00 00) or the SYSTEM tape (55h, name, 3Ch blocks with checksums,
  78h entry). A checksum mismatch or a truncated block is a part with an error, not a parse failure,
  as the TAP viewer shows a bad checksum.
- `.cmd`: records 05/01/02 (and the others `cmdToSystemTape` skips: shown as "skipped by the loader").
- `.bas`: the FFh, then the lines (`decodeHt1080zProgram`'s walk), each a part.
- The fields are what the byte anatomy shows (D5): the same texts as the mockup, through `t()`.
- Play time per part from §3 trap 8; `.cmd`/`.bas` show "as a tape" (what Klive plays when loading).

### D5 - The view

`Ht1080zTapeViewerPanel.tsx` on `GenericFilePanel`, built from the shared pieces:

- the **summary strip** (as the TAP viewer's);
- the **graphic**: `TapeTimeline` for `.cas` (generalised to take parts with a role colour), and a new
  `MemoryMapStrip` (64K, the HT's zones, a block per loaded part, clickable) for `.cas` SYSTEM blocks,
  `.cmd` and `.bas`, with a zoomed program strip for `.bas` (one segment a line);
- the **parts list** on `BankBrowser`, grouped by file, with the role pills;
- the **detail pane**: key/value facts, then the byte anatomy: `TapeHeaderBytes` generalised into a
  `ByteAnatomy` component (byte groups linked to field rows by hover and focus; a long data group
  abbreviated), used by the TAP viewer too, with its existing tests;
- the **listing** for a BASIC part, with a **character set switch** (Series I / Series II / /64) that
  follows the running HT model and otherwise defaults to Series II (D-Q2), remembered in the view state;
- **pop-outs**: BASIC listing (a document on `decodeHt1080zProgram`), memory (`openStaticMemoryDump` at
  the load address), disassembly (the HT disassembler, ROM decoding off), hex of the whole file.

Every colour from theme tokens; the role colours join the tape viewer's (`.ai/ui-theming-intent-and-lessons.md`
gets the new tokens and the memory map's zone colours).

### D6 - Loading, opening and dropping by content

- `isHt1080zTapeFor` takes the bytes (or a sniffed kind) instead of the name alone: a `.bas` is an HT
  tape when D1 says so. `TapeLoadCommand` sniffs before validating; `MainToEmuProcessor` has the bytes.
- A text `.bas` given to the HT's deck: "This .bas is BASIC source text, not a tokenised HT-1080Z
  program" (an i18n message), instead of `basNotTokenised`'s byte-level wording.
- File › Open File… and drag and drop accept `.bas` too, sniffing it: tokenised -> the HT's deck (with
  the machine check), text -> opened in the IDE's editor if inside the project, else refused with the
  message above.

### D7 - Building

A tokenised `.bas` is never a build root: `compile-code.ts` and the build-root setter refuse it
("This .bas is a tokenised HT-1080Z program; load it as a tape"). The Explorer's "Set as build root"
is not offered for it (the registry entry has no `canBeBuildRoot`).

## 5. Phases

| Phase | Content | Exit criteria |
|---|---|---|
| **1. `.bas` by content** | D1, D2, D3 (the routing, still opening tokenised `.bas` in the hex viewer), D6, D7 | Unit tests: D1's cases; `getFileTypeEntry` by path with and without a kind; the tree sniff; the watcher re-sniff; `tape-load` of a text and a tokenised `.bas`; the build-root refusal. In the running app: a project with both kinds shows two icons, opens each in its editor, and Load and run works on the tokenised one. |
| **2. The model** | D4 | `ht1080zTapeView` tests on the real files (the demo `.bas`, the template's `.cmd`, both `.cas` made from them, a CSAVE capture from the harness): parts, offsets, fields, checksums, play times (pinned against the core's real-time load), a corrupted block and a truncated file. |
| **3. The viewer** | D5 | Component tests for each kind and the byte anatomy's hover; the TAP viewer's tests unchanged after `ByteAnatomy`; in the running app, each file kind opens, selections sync between list, graphic and detail, and pop-outs open. |
| **4. Ship** | Docs (the HT guide's tapes section, a "Viewing tape files" part with screenshots from the `ht1080z` recipe), `.ai/ui-theming-intent-and-lessons.md`, changeset | `build:check`, `lint:renderer`, `test:fast`, `test:slow`, the electron-vite build, `doc:build`/`doc:check` green |

## 6. Risks

- **The by-path cache can be stale** if a watcher event is missed; the document open path re-sniffs
  a `.bas` it is about to open, so the worst case is a wrong icon until the next refresh.
- **Generalising `TapeHeaderBytes` and `TapeTimeline`** touches the TAP viewer; its tests and
  screenshots are the guard.

## 7. Decisions (accepted by the project author, 2026-10-23)

| | Decision | Why |
|---|---|---|
| D-A | **A `.bas` is an HT-1080Z program when its content says so** (D1); any other `.bas` is source text. No setting, project type or new extension. | A tokenised program and source text never look alike; deciding by the project's machine is wrong both ways, and running text on the HT (option C) would give a text `.bas` two run meanings. |
| D-Q1 | **The mockup** (`.plans/mockups/ht1080z-tape-viewers.html`) **is the viewers' design.** | Approved as it is. |
| D-Q2 | **The listing's character set follows the running HT model, else Series II**; the switch changes it, remembered per document. | One file lists differently per model; the running machine is the likeliest target. |
| D-Q3 | **The new viewer replaces the hex viewer for `.cas` and `.cmd`**; the hex dump of the whole file stays a pop-out. | It shows the same bytes with their meaning, and the hex is one click away. |
| D-Q4 | **File › Open File… and drag and drop accept a tokenised `.bas` too** (D6); a text `.bas` gets a clear message. | The content rule makes it safe. |

## 8. As implemented

**Phase 1 (`.bas` by content) done 2026-10-23.**
- **D1:** `src/common/ht1080z/basContent.ts`, `isTokenisedHt1080zBasic(bytes, complete)`: FFh, then
  lines whose links rise by exactly each line's length, ending at a 0000h link (a whole file must
  reach it; a 512-byte sample need not). `test/ht1080z/bas-content.test.ts`: the demo program, an
  empty one, one saved from another address, a sample of a longer one, UTF-8 (with and without BOM)
  and UTF-16 (LE/BE, with and without BOM) text, FFh noise and a broken chain.
- **D2:** `src/main/sniff-content-kind.ts` reads the first 512 bytes of a `.bas` (its own module, so it
  loads without Electron); `getDirectoryContent` puts the kind on `ProjectNode.contentKind`. The file
  watcher also refreshes the tree on a `change` event of a `.bas`, so a file rewritten in place is
  sniffed again. In the renderer, `project-node.ts` keeps the kinds by full path
  (`registerFileContentKind`, `fileContentKindOf`) and notes a listed file whose kind changed
  (`takeChangedContentKinds`); after a refresh the Explorer closes such a file's documents and, once
  every hub has let it go, opens it again with `nav` (closing is asynchronous: reopening at once
  left the file closed). `getFileTypeEntry` skips an entry whose `contentKind` does not match; the tree
  and the document header now pass full paths; a rename carries the kind to the new path.
- **D3:** a `.bas` entry with `contentKind: "ht1080zBasic"` before the source-text one: the tape icon,
  the HT launch buttons and context menu, opened in the hex viewer until Phase 3 brings its own.
- **D6:** `isHt1080zTapeFor(file, machine, bytes)`: a `.bas` is a tape when its bytes are tokenised (on
  any machine, so another machine refuses it with the HT's reason), or on the HT, where a text one
  reaches the reader and is refused with the new wording ("is BASIC source text, not a tokenised
  HT-1080Z program"). `tape-load` reads a `.bas` while validating. File › Open File… offers and drag and
  drop take `.bas`: the main process sniffs it; a tokenised one goes in the HT's deck, a text one in the
  project opens in the editor, any other is refused with the same message.
- **D7:** `compile-code.ts` refuses a tokenised build root (`commands.compile.tokenisedBasRoot`), and
  the tree never marks one as a possible build root.
- In the running app: a new HT project with a tokenised `demo.bas` and a text `game.bas` shows the
  tape icon and the Klive BASIC icon; `demo.bas` opens in the hex viewer, `game.bas` in the code editor;
  `tape-load` refuses `game.bas` with the new message and loads and runs `demo.bas`; overwriting the
  open `game.bas` with a tokenised program changes its icon and reopens it in the hex viewer.
- Not done: the status message the plan mentioned when a document reopens (the reopened tab shows
  it); a `.bas` outside any project opened through `nav` is not sniffed (it opens as text).

**Phase 2 (the model) done 2026-10-23.**
- `DocumentPanels/Ht1080zTape/ht1080zTapeView.ts`, `analyzeHt1080zFile(bytes, fileName, clock)`: the
  kind (`basicTape`, `systemTape`, `cmd`, `bas`), the parts with their role, bytes, offset, play times,
  load range, entry, checksum (stored and computed), name, record type or program line, and a problem
  (`truncated`, `checksum`, `badRecord`) for a part that cannot be read; then the program's lines, the
  code's size, the entry, the highest address loaded (`fitsSixteenK`) and the play time. A `.cas` is read
  bit by bit past the sync found at any bit offset (`findSync`/`byteAtBit`, now exported from
  `Ht1080zTapeFile.ts` with the record markers); a damaged block is a part with a problem and the rest
  still reads. A `.cmd` or `.bas` gets the play time of the tape Klive makes of it.
- Deviation: the field texts are a separate module, `ht1080zTapeFields.ts` (`ht1080zPartAnatomy`,
  `ht1080zLineAnatomy`: byte groups and the fields that name them, worded through `t()` at display
  time), as `tapeHeaderFields.ts` is beside `tapeView.ts`; the model itself holds no text.
- Play times: a 1 bit is 3,557 T-states, a 0 bit 3,570, and 1,774 after the sync, as `ht1080z-tape.c`
  plays them; `test/ht1080z-hw/tape-view.test.ts` plays a tape on the core with the motor on and finds
  it ends within a frame of the model's time. It also reads a tape the ROM wrote with `CSAVE`.
- `test/ht1080z/tape-view.test.ts`: the demo `.bas`, the template's `.cmd`, the BASIC and SYSTEM tapes
  made of them, a tape shifted by 3 bits, a damaged block, three truncated files, files that are no
  tape, and the anatomy of a SYSTEM block and of a line in Series I and Series II characters.

