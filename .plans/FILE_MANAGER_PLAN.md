# Klive File Manager (two-pane commander) — Implementation Plan

**Status:** Phases 1–8 built (2026-10-31): the first release is complete (§12). Phase 9 (more file systems) stays for later, with Q4 and Q5.
them the proposed answers to Q1–Q3 (§11); Q4 and Q5 stay open until Phase 8 and Phase 9.
**Mockups:** `.plans/mockups/file-manager.html` (open it in a browser; it has tabs for each screen and
a light/dark switch).

## 1. What we are building

A **two-pane file manager in the style of Total Commander**, opened as an IDE document. Each pane
shows one **drive** and a folder on it. Pick a source drive on one side and a target drive on the
other, then copy, move, rename, delete, make folders and view files, with the keyboard or the
buttons along the bottom.

A **drive** can be any of these:

| Drive group | Drives | File system | Where it is read today |
| --- | --- | --- | --- |
| **This computer** | Every mounted volume (macOS `/Volumes/*`, Windows drive letters, Linux mounts), the home folder, the Klive folders (`~/Klive`, `~/KliveProjects`) | The host's | `fs` in the main process |
| **Project** | The open project's folder, with its exclusions | The host's | `getDirectoryContent` |
| **Machine storage** (only while the machine is **stopped**) | The ZX Spectrum Next's SD card, the DivMMC's esxDOS card, the +3's drives A: and B:, the Beta 128's drives A:–D:, the Interface 1's Microdrives 1–8, the tape in the tape player | FAT16/32, +3DOS, TR-DOS, Microdrive, tape | The machine's media (`mediaStore`) and the SD card device (`withSdCardAccess`) |
| **Disk images** | Any image file opened as a drive, or entered from a pane like a folder | +3DOS (`.dsk`), TR-DOS (`.trd`, `.scl`), Microdrive (`.mdr`), FAT16/32 (`.img`, `.hdf`, `.cim`, one drive per FAT partition) | `src/common/diskfs/`, `src/main/hard-disk-images.ts` |
| **Tapes** | `.tap` (read and write), `.tzx` (read; standard-speed blocks only) | The tape's blocks as files | `TapReader`, `TzxReader` (new adapter, §5.4) |

The Spectrum file systems Klive's machines **do not** run today (IDEDOS hard-disk partitions of the
+3e, MGT +D/DISCiPLE, Opus Discovery) are not in the first release. The drive layer is built so that
each one is a new `DiskFileSystem` and nothing else (§5.6, Phase 9).

### What exists already, and is reused

Klive already has almost the whole engine; this plan is mostly UI and one new layer that puts every
source behind the same interface.

- **`DiskFileSystem`** (`src/common/diskfs/types.ts`): `list`, `read`, `write`, `delete`, `rename`,
  `setAttributes`, with `+3dos`, `trdos`, `microdrive` and `fat` implementations. FAT also has
  `mkdir`. Errors are typed (`DiskFsError` with `exists`, `diskFull`, `badName`, `readOnly`, ...).
- **`DiskEdit` / `applyEdit`** (`src/common/diskfs/edit.ts`): the edits the Disk Explorer, the `disk`
  command and `klive disk` make.
- **Host files into a Spectrum file system** (`src/common/diskfs/importFiles.ts`): `.tap` becomes its
  files with their headers, `.scr` becomes `SCREEN$`, `.bas` is tokenised, the rest is CODE; names are
  shortened to the target's rules. A FAT target takes files as they are.
- **Hard-disk images in the main process** (`src/main/hard-disk-images.ts`): `.img`/`.hdf`/`.cim` as a
  `FileBlockDevice`, read sector by sector, never sent whole to the renderer; partitions; edits under
  the SD card's lock (`src/main/sd-card-access.ts`) when the machine uses the image.
- **Floppy edits that respect a mounted disk** (`beginDiskImageEdit` / `commitDiskImageEdit` in
  `MainApi`): pause the machine, write beside and rename over, keep a `.bak`, insert the disk again.
- **The Disk Explorer's preview** (BASIC listing, `SCREEN$`, bytes, disassembly) for the viewer (F3).
- **Project file drag** (`PROJECT_FILE_DRAG_MIME`, `droppedFilePaths`): panes accept drops from the
  Project Explorer and the OS.

## 2. Scope

**In the first release (Phases 1–8):** the two panes, every drive in the table above, entering an
image from a host pane, copy and move in every direction with name and format conversion, rename,
delete, make folder, attributes, the viewer, selection by mask, conflict handling, progress and
cancel, keyboard and mouse, drag and drop between panes, localization, docs and screenshots.

**Not in it:** search across drives, compare/synchronise folders, archive formats (`.zip`), FTP,
editing files in place (F4 opens the file in Klive's own editor instead, for host files only),
the non-emulated Spectrum file systems (Phase 9, later).

## 3. Decisions (accepted 2026-10-31)

- **D1 — A document, not a window.** The file manager opens as a document tab in the IDE
  (`View › File Manager`, the `fm` command, and a button in the activity bar's overflow). It reuses
  the document hub, keeps its state per tab and can be split beside an editor. A separate Electron
  window is an open question (§11, Q1).
- **D2 — The main process owns every file operation.** The renderer sends requests (`list`, `stat`,
  `read` for the viewer, and *jobs* for copy/move/delete) through a new `MainApi` group, `fm*`. Large
  images stay in the main process; a job keeps running if the tab is closed and reports through
  messages. Nothing in the renderer touches `fs`.
- **D3 — One drive interface over every source.** `FmDrive` (§5.1) wraps the host file system, a
  `DiskFileSystem` held in memory, a hard-disk partition on its block device, the machine's media and
  a tape. The pane and the job runner see only `FmDrive`.
- **D4 — Machine storage is a drive only while the machine is stopped.** A paused machine still owns
  its media (and the Microdrive's unsaved sectors live in the machine). When the machine starts,
  every machine drive in an open pane becomes unavailable; a running job on one is refused before
  the machine starts (the Start command waits and says why) rather than raced. Paused, read-only, is
  §11, Q2.
- **D5 — Writing an image goes through the existing edit paths.** A floppy, Microdrive or tape image
  is changed in memory and committed once per job with `commitDiskImageEdit` (one `.bak` per
  session, write beside and rename). A hard-disk image is edited in place under `withSdCardAccess`
  when the machine uses it, as `editHardDisk` does today. One job, one commit: a 40-file copy to a
  `.dsk` writes the file once.
- **D6 — Conversion is explicit and previewed.** Copying between unlike file systems converts
  (§6). The copy dialog shows, per file, the name it will get and what it becomes (`BASIC`, `CODE
  32768`, `as is`), and lets the user pick the mode: **Auto** (the rules in §6), **Raw bytes**, or
  **Keep headers** (`+3DOS` header / `.tap` file).
- **D7 — Delete on the host goes to the trash** (`shell.trashItem`), with a setting to delete
  permanently. Inside an image there is no trash: the confirmation says so, and the image's `.bak`
  is the safety net.
- **D8 — Keyboard first, Total Commander's keys.** F3 view, F4 edit, F5 copy, F6 move, Shift+F6
  rename, F7 new folder, F8/Delete delete, Tab switch pane, Insert/Space select, `+`/`-` select by
  mask, Backspace up, Alt+F1/Alt+F2 the left/right drive menu, Ctrl+R refresh. The bottom button bar
  does the same for macOS keyboards without F-keys (and shows the key on each button).
- **D9 — Images are folders too.** In a host pane, Enter on a `.dsk`/`.trd`/`.scl`/`.mdr`/`.img`/
  `.hdf`/`.cim`/`.tap`/`.tzx` enters it, like Total Commander enters an archive; the breadcrumb shows
  `MyGame › disks › game.dsk › `. Backspace at the image's root leaves it. "Open as drive" in the
  context menu pins it in the drive menu for the session.
- **D10 — The Disk Explorer stays.** It remains the place for layout, sector maps, attributes and
  TR-DOS compaction of one image. The file manager links to it ("Open in Disk Explorer") and shares
  its preview and error texts (`diskErrorText.ts`), not its panel.

## 4. The user interface

See the mockups. In words:

### 4.1 The layout

```
┌ File Manager ─────────────────────────────────────────────────────────────────────────────┐
│ [▾ Macintosh HD] /Users/me/KliveProjects/MyGame ⟳ │ [▾ Next SD card ●] /GAMES          ⟳  │
│ ..                                                │ ..                                     │
│ ▸ code                          <DIR>             │ ▸ ARCADE              <DIR>            │
│ ▸ tapes                         <DIR>             │ ▸ PUZZLE              <DIR>            │
│ ■ game.tap        12,410   2026-10-30 21:14       │   LOADER.BAS  1,204  BASIC   LINE 10   │
│ ■ title.scr        6,912   2026-10-29 18:02       │   MAIN.NEX   48,640  file              │
│   klive.project      402   2026-10-29 18:00       │                                        │
├───────────────────────────────────────────────────┼────────────────────────────────────────┤
│ 2 of 5 selected, 19,322 bytes · 412 GB free       │ 4 items · FAT32 · 1.6 GB free          │
├───────────────────────────────────────────────────┴────────────────────────────────────────┤
│ F3 View  F4 Edit  F5 Copy  F6 Move  F7 New folder  F8 Delete  ⇧F6 Rename  Esc Close       │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Pane header:** the drive button (icon, name, a dot for machine storage), the path as a breadcrumb
  (each part clickable), refresh. The active pane has the accent-coloured header strip; the other is
  neutral.
- **Columns** adapt to the drive's file system: host and FAT show *Name, Size, Date*; +3DOS adds
  *Type, Start, Attr., User*; TR-DOS *Type, Start*; Microdrive and tape *Type, Start, Length*. Column
  widths are in `ch`, rows from `theming/tokens/rowSizes.ts`.
- **Status line** per pane: selection count and bytes, items, the file system, free space.
- **Button bar** along the bottom (D8).

### 4.2 The drive menu

Alt+F1 / Alt+F2 or a click on the drive button opens it, in groups: **This computer**, **Project**,
**Machine storage** (greyed with "Stop the machine to use its storage" while it runs), **Disk images**
(opened this session, recent ones), and **Open image as drive…**. A hard-disk image with several FAT
partitions shows one entry per partition. Each entry shows its free space.

### 4.3 The copy dialog

F5 opens it with the target pane's path filled in. It lists what will be copied and, when the file
systems differ, a conversion table (source name → target name → becomes), the mode selector (D6),
the code start address for headerless files, the `.bas` auto-run line, and "Replace files that
exist" as a three-way choice (ask / replace / skip). Free space is checked before anything is
written; a copy that does not fit says so and writes nothing.

### 4.4 Conflicts, progress, errors

- **Conflict dialog:** Replace / Skip / Rename (with a suggested name that fits the target's rules) /
  Replace all / Skip all / Cancel, with both files' size and date.
- **Progress:** a strip above the button bar with the current file, count and bytes, and Cancel. A
  cancelled job on an image commits nothing (the image is unchanged); on the host, files already
  copied stay.
- **Errors** use `diskErrorText.ts` and the host's error codes, per file, in a summary at the end
  ("38 copied, 2 skipped: name too long for TR-DOS").

### 4.5 The viewer (F3)

A read-only overlay over the pane: BASIC listing, `SCREEN$` as a picture, text, hex for the rest,
using the Disk Explorer's preview code. Disassembly opens a document, as the Disk Explorer does.

## 5. Architecture

### 5.1 `FmDrive` (common, process-agnostic types; implementations in the main process)

```ts
// src/common/fileManager/drives.ts
export type FmDriveKind = "host" | "project" | "image" | "hardDisk" | "machine" | "tape";

export type FmDriveRef = {
  id: string;                 // stable for the session: "host:/", "image:/path/x.dsk", "machine:next-sd", "hd:/path/x.img#1"
  kind: FmDriveKind;
  label: string;              // already localized at display, keys at definition
  fileSystem: string;         // "APFS", "+3DOS", "TR-DOS", "FAT32", "Microdrive", "TAP"
  readOnly: boolean;
  available: boolean;         // false for machine storage while the machine runs
  unavailableReason?: string; // an i18n key
};

export type FmEntry = {
  name: string; path: string; isDirectory: boolean;
  size: number; modified?: number;
  spectrum?: Pick<DiskFileEntry, "kind" | "start" | "variablesOffset" | "user" | "attributes">;
};

export interface FmDrive {
  readonly ref: FmDriveRef;
  capabilities(): { folders: boolean; attributes: boolean; rename: boolean; nameRule: FmNameRule };
  list(dir: string): Promise<FmEntry[]>;
  freeBytes(): Promise<number | undefined>;
  read(path: string): Promise<FmFileData>;   // bytes plus the Spectrum header, if any
  write(dir: string, file: FmFileData, opts: { replace: boolean }): Promise<FmEntry>;
  mkdir(dir: string, name: string): Promise<void>;
  remove(paths: string[]): Promise<void>;
  rename(path: string, newName: string): Promise<void>;
  /** Called once per job: commits an image, releases a lock */
  close(commit: boolean): Promise<void>;
}
```

Implementations in `src/main/file-manager/`:

| Class | Over | Notes |
| --- | --- | --- |
| `HostDrive` | `fs/promises` | Trash through `shell.trashItem` (D7); volume list per platform |
| `ProjectDrive` | `HostDrive` rooted at the project | Hides excluded items, refreshes the Project Explorer after a change |
| `MemoryImageDrive` | `openDiskFileSystem` on the file's bytes | `.dsk`/`.trd`/`.scl`/`.mdr`; commits through the floppy edit path (D5) |
| `HardDiskDrive` | `FileBlockDevice` + `FatFileSystem` on a partition | In place; under `withSdCardAccess` when the machine uses the image |
| `MachineMediaDrive` | the stopped machine's medium | §5.3 |
| `TapeDrive` | new `TapeFileSystem` | §5.4 |

### 5.2 Jobs

`src/main/file-manager/jobs.ts` runs copy, move and delete as **jobs**: one at a time per target drive,
cancellable, reporting progress through a main-to-IDE message (`FmJobProgress`, throttled to 10 per
second). A job plans first (lists every file, converts names, checks free space, finds conflicts),
asks the renderer about conflicts as it reaches them, then writes. Move is copy then delete of the
copied sources, never a delete of something that was not written.

The planning step is a pure function in common code, `planTransfer(sources, sourceCaps, targetCaps,
options)`, so the conversion rules are tested without a file system.

### 5.3 Machine storage drives

- The list comes from the current machine: the Next profile's SD card (`activeSdCardFile()`), the
  DivMMC card, the disk drives and Microdrives with a medium in, the tape player's file. A drive with
  nothing in it is not listed.
- **Available only while the machine state is `Stopped`** (D4). The renderer subscribes to the
  machine state; when the machine leaves `Stopped`, the panes on machine drives show an overlay
  ("The machine is running. Stop it to use its storage.") and their file lists are cleared.
- The SD card is opened through the same `withSdCardAccess` chain and `invalidateSdCardHandler()` as
  `copyZxNextStorageFile`, so the emulated card never sees a half-written FAT.
- A floppy or Microdrive is read from what the machine holds (including the Microdrive's unsaved
  sectors, `MICRODRIVE_CHANGES`), written back to its file and inserted again through the existing
  `commitDiskImageEdit` / `saveMicrodriveChanges` paths, so the next start sees the change.
- Starting the machine while a job runs on its storage: the Start command waits for the job to
  finish or be cancelled, with a toast that says so.

### 5.4 Tapes as a file system

New `src/common/diskfs/tapefs.ts`, `TapeFileSystem implements DiskFileSystem` (system `"tape"`):

- A `.tap` lists its header + data pairs as files (name from the header, kind, start, length) and
  headerless blocks as `block-07` CODE. `write` appends a header and a data block; `delete` removes
  both; `rename` rewrites the header (10 characters, padded). Order is the tape's order; the pane
  sorts by position, not name, and "Move up/down" in the context menu reorders.
- A `.tzx` lists its standard-speed blocks the same way and is **read-only** (turbo, direct-recording
  and other blocks are shown as non-copyable rows with their TZX block name).

### 5.5 Renderer

`src/renderer/appIde/DocumentPanels/FileManager/` with the Model/Controller/View split of
`.docs/dialog-mvc-pattern.md`: `fileManagerModel.ts` (two pane states: drive, path, entries, selection,
sort, focus), `fileManagerController.ts` (keys, `MainApi` calls, job messages), `FileManagerPanel.tsx`
and `FilePane.tsx` built on `@renderer/controls/data` (`DataPanel`, `DataRow`, `PanelHeader`,
`EmptyState`). Dialogs: `FmCopyDialog`, `FmConflictDialog`, `FmDeleteDialog`, `FmMkdirDialog`,
`FmRenameDialog`, each with its own model. Registered in `src/renderer/registry.ts` as a document
type; the `fm` command in `IdeCommands`.

### 5.6 Adding a file system later

A new Spectrum file system is a `DiskFileSystem` in `src/common/diskfs/`, an entry in
`openDiskFileSystem` (by extension and by sniffing), import rules in `importFiles.ts`, and its column
set in the pane. The file manager needs no other change.

## 6. Conversion rules (what a file becomes)

| From → To | Rule |
| --- | --- |
| Host/FAT → +3DOS, TR-DOS, Microdrive, TAP | `hostFileToDiskFiles` as today: `.tap` splits into its files, `.scr` → CODE 16384, `.bas` → tokenised BASIC, else CODE at the dialog's start address. Names shortened to the target's rule, clashes numbered (`GAME~1`). |
| +3DOS/TR-DOS/Microdrive/TAP → Host/FAT, mode **Auto** | BASIC → `.bas` text (detokenised); CODE 6912 at 16384 → `.scr`; other CODE and arrays → raw bytes `.bin` (name keeps the original, the start address goes in the conflict-free name only if asked). |
| … mode **Keep headers** | Each file becomes a one-file `.tap` (header + data), so it loads anywhere and keeps its start address and auto-run line. A FAT target can keep a +3DOS header (`+3DOS` 128-byte header), which esxDOS and NextZXOS read. |
| … mode **Raw bytes** | The bytes, header dropped, name as is plus `.bin` when it has no extension. |
| Between Spectrum file systems (+3DOS ↔ TR-DOS ↔ Microdrive ↔ TAP) | Header fields carried over (kind, start, variables offset, array letter); names re-fitted. |
| Host ↔ FAT | Bytes as they are; long names kept (FAT LFN). |
| Folders | Copied recursively where the target has folders (host, FAT). To a flat file system the dialog offers "Flatten folders" or skips them with a warning. |

Every row is a case in `test/file-manager/plan-transfer.test.ts`.

## 7. Safety

- Nothing is written before the plan step checks names, conflicts and free space.
- An image is committed once per job, after the last file; a failed or cancelled job leaves it as it
  was. The floppy path keeps a `.bak` (existing behaviour).
- A read-only image file, a `.tzx`, or a write-protected medium shows a lock icon and refuses writes
  before the dialog opens.
- Deleting `klive.project` or the project root from the Project drive is refused, as in the Project
  Explorer.
- The same image open in both panes, or open in the Disk Explorer, shares one in-memory copy in the
  main process (a registry keyed by path), so two views never write two versions.

## 8. Localization, theming, docs

- Every text through `t()` with English entries and translator context in
  `src/common/i18n/locales/en/fileManager.json`; `npm run i18n:keys`, `i18n:check`.
- Colours from tokens only; the active pane's header uses the accent; the machine-storage dot uses
  `--color-state-value`. Update `.ai/ui-theming-intent-and-lessons.md` with the durable rules (pane
  focus colour, column sets).
- New guide `docs/content/en/guides/media/file-manager.mdx`, linked from the Disk Explorer and Project
  Explorer guides; screenshots from a `guides-media-file-manager` recipe in
  `scripts/doc-shots/recipes/` (generated, never hand-captured).
- One changeset (`feature`) with the commit that completes the plan; none for the phase commits.

## 9. Phases

| # | Phase | Delivers | Tests |
| --- | --- | --- | --- |
| 1 | Drive layer | `FmDrive`, `HostDrive`, `ProjectDrive`, `MemoryImageDrive`, `HardDiskDrive`; the image registry; `MainApi` `fmListDrives`, `fmList`, `fmRead` | Unit tests over temp folders and `MemoryBlockDevice` images |
| 2 | Panes, read-only | The document, two panes, drive menu, breadcrumb, columns per file system, sorting, selection, keyboard navigation, entering images (D9) | jsdom tests of the model/controller; IDE check script |
| 3 | Transfer planning | `planTransfer`, the conversion rules (§6), name fitting for every target | `plan-transfer.test.ts`, one case per row of §6 |
| 4 | Jobs | Copy, move, delete, mkdir, rename; progress, cancel, conflicts; one commit per image; trash on host | Main-process tests: every source × target pair on fixture images |
| 5 | Machine storage | `MachineMediaDrive`, availability by machine state, the Start-waits rule | Harness tests: copy a file to a stopped Next's SD card and boot it (`test/harness/zxnext/`); to a +3 disk and `LOAD` it (`sp48`-style harness for the +3) |
| 6 | Tapes | `TapeFileSystem` (TAP read/write, TZX read), reorder | Unit tests; a written `.tap` loads on the 48K harness |
| 7 | Viewer, drag and drop, polish | F3 viewer, drag between panes and from the Project Explorer/OS, select by mask, settings (trash, show hidden, confirmations) | jsdom tests; IDE check |
| 8 | Docs and release | Guide, screenshots recipe, theming notes, changeset | `npm run doc:build && npm run doc:check` |
| 9 | Later: more file systems | IDEDOS (+3e partitions on `.hdf`), MGT +D/DISCiPLE (`.mgt`), Opus (`.opd`): each a `DiskFileSystem` (§5.6) | Per file system, round-trip fixtures |

Each phase ends with `npm test` on the touched tests, `npm run build:check` and
`npm run lint:renderer`; Phase 8 also runs `npm run test:slow`.

## 10. Risks

- **A gigabyte SD card listed folder by folder** is fine; copying a folder tree of thousands of files
  onto it must not hold the SD lock for minutes at a time while the IDE waits. Jobs release the lock
  between files.
- **Machine storage and a running machine** is the one place a race could corrupt a user's card: D4
  is deliberately strict.
- **Name fitting** loses information (`MY_LONG_GAME.tap` → `MY_LONG_.TAP`); the copy dialog shows
  every renamed file before writing.
- **Host volumes** differ per platform (network drives, removable media that disappear). `HostDrive`
  re-lists on focus and shows a missing drive as unavailable instead of failing a job.

## 11. Questions

Settled (2026-10-31, with D1–D10):

- **Q1.** A document tab or its own window? **A document tab** (D1).
- **Q2.** While the machine is **paused**, is its storage visible read-only? **No**: only a stopped
  machine's storage is a drive (D4).
- **Q3.** Default mode for Spectrum → host copies? **Auto** (§6); the dialog offers the other two.

Still open:

- **Q4.** Should the file manager be in the CLI too (`klive fm copy a.dsk:LOADER b.trd:`), reusing
  `planTransfer` and the jobs? The `klive disk` verb covers part of it.
- **Q5.** Phase 9's order: IDEDOS first (Klive has a +3e, though no IDE interface yet), or MGT +D?

## 12. As built

### Phases 1 and 2 (2026-10-31)

- **Drive layer** (`src/main/file-manager/fmDrives.ts`): host volumes (macOS `/Volumes` without the
  system's `com.apple.*` mounts, Windows drive letters, Linux `/media`, `/run/media`, `/mnt`), home,
  `Klive`, `KliveProjects` and the project; host folders; floppy and cartridge images read whole per
  request (`openDiskFileSystem`); hard-disk images one drive per FAT partition, read through
  `withHardDisk`. Nothing in it imports Electron: the host environment and the hard-disk access are
  handed in, so `test/file-manager/fm-drives.test.ts` runs it on temp folders and real images.
- **Requests** (`fmService.ts`, `MainApi.fmListDrives/fmOpenImage/fmList/fmRead`): the renderer
  names a drive by its **id**, never sends a drive object back. The main process keeps the drives it
  handed out and rebuilds an unknown one from its id (`host:`, `project:`, `image:`, `hd:<path>#<n>`),
  which is what restores a pane after a restart. The machine's SD card is read under
  `withSdCardAccess`. Errors cross IPC as `[fm:<code>]` in the message (`FmError`, `fmErrorCodeOf`).
- **No image registry yet.** §7's shared in-memory copy only matters once something writes; Phase 4
  adds it with the jobs.
- **Browsing** (`src/renderer/appIde/DocumentPanels/FileManager/`): MVC per `.ai/ui-mvc-guide.md`.
  `FileManagerModel.ts` (two panes, cursor, marks, sort, hidden files, the images entered),
  `FileManagerViewModel.ts` (columns per file system, texts, sizes), `FileManagerController.ts`
  (ports: `fm`, `picker`, `locations`), `fileManagerKeys.ts` (keys to intents, pure),
  `FileManagerView.tsx` (virtualized rows, drive menu), `FileManagerPanel.tsx` (wiring).
  Tested in `test/file-manager/fm-controller.test.ts` and `fm-keys.test.ts` without a DOM.
- **Opening it:** the special document `$fileManager` (restored with the workspace; the panes' places
  are its view state), the `show-file-manager` command (`fm`), and **File › File Manager...** — not
  View, as D1 said: the View menu is held to 12 items by `test/main/app-menu-structure.test.ts`.
- **Entering an image** (D9) works from host and project panes. An image *inside* an image (a `.dsk`
  on an SD card) is listed with its image icon but not entered: that needs the bytes as a host file,
  which comes with Phase 4's jobs.
- **Keys built:** arrows, Page Up/Down, Home/End, Enter, Backspace, Tab, Insert/Space, Escape (clear
  marks), Alt+F1/Alt+F2, Ctrl+R, Ctrl+H (hidden files), Ctrl+A (mark all files). Ctrl/Cmd+click marks.
  F3–F8 and the button bar come with the viewer and the jobs.
- **Column widths:** host `Name | Size 9ch | Modified 17ch`; FAT `Name | Size` (the FAT listing has no
  dates); +3DOS adds `Type 9ch | Start 6ch | Attr. 4ch | User 4ch`. The name column is
  `minmax(12ch, 1fr)`.
- **Checked in the running IDE over CDP:** home and project panes, the drive menu, entering and
  leaving a `.dsk` and an `.img`, a FAT folder, marking, Tab, and the tab restored with its panes
  after a restart.

### Phases 3 and 4 (2026-10-31)

- **Conversion** (`src/common/fileManager/fmTransfer.ts`): `convertFile` holds §6's rules, `buildPlan`
  the whole copy (folders, names, conflicts per target folder, `.tap` splits marked as parts),
  `freeName` the conflict suggestion (`name (2).ext` on a file store, `~2` within the length on a
  catalogue), `tapOf` a one-file `.tap`. Tested row by row in `test/file-manager/fm-transfer.test.ts`.
- **Deviation from §6, Auto mode, catalogue to file store:** BASIC programs and arrays become a
  one-file **`.tap`** (header kept), not detokenised `.bas` text. Klive's detokeniser lives in the
  renderer and drops colour codes and the numbers' hidden forms; a `.tap` round-trips exactly and
  esxDOS/NextZXOS load it. A SCREEN$ becomes `.scr`, other code its bytes (`.bin` added to a name
  without an extension), a headerless file stays as it is. Keep headers → `.tap` for every file with
  a header (FAT included: the `+3DOS` header option is not built). Between catalogues the header
  always goes with the file, whatever the mode.
- **Jobs** (`src/main/file-manager/fmJobs.ts`): `planTransfer` refuses a read-only target, the source
  folder itself (`sameFolder`) and a folder into itself (`intoItself`), and reports `needBytes`
  (rounded to the target's blocks) against the free space; `runTransfer` writes; `jobStatus`,
  `cancelJob`, `deleteEntries`, `makeFolder`, `renameEntry`. A floppy or cartridge target is one edit
  (`beginDiskImageEdit` … `commitDiskImageEdit`, its `.bak`), cancelled on a cancel or a full disk so
  nothing is kept; a hard-disk target is written in place, each step under `aroundSdCard` (now
  exported from `hard-disk-edit.ts`). Electron stays out (`FmJobDeps`); `fm-jobs.test.ts` copies
  between every kind of drive on real images.
- **Move** copies, then removes each chosen source whose every output was written, **permanently**
  (its copy is the file now; the Trash is for Delete). A host-to-host move on one volume is not yet a
  rename: it copies and removes. Phase 7 can add the fast path.
- **Delete** goes to the Trash on the host (`shell.trashItem`), for good on images; a card's folder is
  removed with what it holds. The setting to delete permanently on the host (D7) waits for Phase 7.
- **IPC:** `fmPlanTransfer`, `fmRunTransfer` (unbounded: it lasts as long as the copy), `fmJobStatus`,
  `fmCancelJob`, `fmDelete`, `fmMkdir`, `fmRename`. The renderer polls `fmJobStatus` every 200 ms
  while `fmRunTransfer` runs; conflicts are answered before the run, from the plan.
- **UI:** the copy dialog (mode only when crossing between a file store and a catalogue; code start
  and auto-run only towards a catalogue; flatten only when folders would be skipped; the table, the
  fit, the shortened and skipped notes; it re-plans when an option changes), the conflict dialog
  (Replace, Copy as with a free name, Skip, Replace all, Skip all, Cancel), the delete dialog, and
  the IDE's own New Folder and Rename dialogs. A progress strip with Cancel, a notice after each job,
  and the command bar (F5 Copy, F6 Move, ⇧F6 Rename, F7 New folder, F8 Delete, Alt+F1 Drives).
  Escape cancels a running job. While a job runs, commands that write are refused.
- **A refresh keeps the cursor on its file**, not its row number: found in the running IDE, where the
  `.bak` a copy made appeared above the cursor and the next F5 copied the wrong file.
- **Checked in the running IDE:** a host file copied onto a `.dsk` (dialog, notice, `.bak`), a conflict
  answered with Skip, a copy refused as the same folder, a file deleted to the Trash.

### Phases 5 and 6 (2026-10-31)

- **Machine storage** (`machineDrives` in `fmDrives.ts`, `currentMedia` in `fmService.ts`): the SD
  card (the Next's, or the DivMMC's when connected), drives A:/B: (the model's `MC_DISK_SUPPORT`),
  Microdrives 1–2 (only with the Interface 1 connected) and the tape (machines whose `mediaIds` have
  `MEDIA_TAPE`). The media come from the app state, filtered by the machine: the settings keep
  another machine's media, and a Next listed a 48K's Microdrive until this filter was added (found in
  the running IDE). Ids are `machine:<slot>[#partition]`, rebuilt on every request, never cached.
- **Stopped means `None` or `Stopped`**, as the Next and DivMMC menus already say. While the machine
  runs, its drives are listed unavailable (the menu greys them, with "stop the machine to use it"),
  every request on them fails with `machineRunning`, and a pane on one shows "The machine is
  running" with a **Stop the machine** button (`em-stop`'s `issueMachineCommand("stop")`); when the
  machine stops, the drives reopen and the pane reads its folder again.
- **Deviation from D4/§5.3, "Start waits for a running job":** not built. Start lives in the emulator
  window, the IDE and the menus; instead a job checks before every file that the machine is still
  stopped (`FmJobDeps.allowed`) and stops with `machineRunning` (an image commits nothing), and
  every write already runs through the paths that pause a running machine (`aroundSdCard`, the disk
  edit path). The Microdrive needs nothing of its own: the controller publishes a cartridge's
  changes when the machine pauses or stops, so the file is current once it is stopped.
- **Not built from Phase 5's tests:** booting a Next from a card the File Manager wrote, and `LOAD`ing
  from a +3 disk it wrote. The writes are the same code as Phase 4's image jobs, tested on real
  images; those two runs belong to the slow tier and wait for Phase 8.
- **Tapes** (`src/common/diskfs/tapefs.ts`, `TapeFileSystem`, system `tape`): `.tap` read and written
  (appended as header + data blocks, delete removes both, rename rewrites the header, `move` swaps a
  file with its neighbour), `.tzx` read from its standard-speed blocks and read only. Duplicate names
  get `#2`; headerless blocks are `block01`… `openDiskFileSystem` opens them by extension (the Disk
  Explorer and `disk` do not see tapes). A tape has no free space to run out of (`freeBytes`
  undefined). Writing the tape in the player reloads it (`setSelectedTapeFile`).
- **Tape order:** a listing marks itself `ordered`; the pane then sorts by `position` (the tape's
  order) until a column is chosen, and returns to names when it leaves the tape.
- **Not built from Phase 6:** "Move up/down" in a context menu (the File Manager has no context menu
  yet; `TapeFileSystem.move` is ready for Phase 7).
- **Proof on the machine:** `test/file-manager/fm-tape-load.test.ts` (fast core tier) copies a
  `.bas` and a `.bin` onto an empty tape through the copy's own rules, then the real 48K ROM
  `LOAD ""`s it: the BASIC auto-runs, loads its CODE and pokes what it read.
- **Checked in the running IDE:** a `.tap` entered from the project (tape columns, tape order), the
  Next's machine storage (only its SD card listed, browsed read-only). The running-machine pane was
  checked by the controller tests, not live: starting the emulated Next would boot the author's own
  card.

### Phases 7 and 8 (2026-10-31)

- **Viewer (F3)** (`FileManagerViewer.tsx`): over the active pane, a BASIC program as its listing
  (the BASIC view's decoder), a SCREEN$ (or a 6,912-byte `.scr`) as its picture, text (no zero bytes,
  98 % printable) as text, anything else as bytes; a Listing/Bytes toggle and **Open as memory**
  (the static memory document, with disassembly from the file's start). Esc or F3 closes it; a new
  folder closes it.
- **Edit (F4)** runs `nav` on the file: a project file opens in its editor or viewer (a `.dsk` in the
  Disk Explorer). Anything else says it is not a project file.
- **Right-click menu**: View, Edit, Copy, Move, Rename, Delete, Move up/down the tape (on a tape),
  Reveal in the system's file manager (this computer's files), each with its key and enabled by
  what the row allows.
- **Marking by mask**: `+` and `-` with `*`, `?` and `;`; `*.*` takes every name.
- **Tape order**: Alt+↑ and Alt+↓ (and the menu) move a file along a tape in one edit
  (`fmMoveOnTape`), the cursor following it.
- **Drag and drop**: rows drag to the other pane (copy; Shift moves) under their own MIME type, and
  this computer's rows also carry the Project Explorer's, so the Disk Explorer takes them. A pane
  takes files from the Project Explorer and the OS; they are copied from the host drive whose top
  holds them.
- **A move on one volume is a rename** (`renameOnVolume`): no copy, no removal, unless a name is
  already there.
- **Settings › General › File Manager**: *Show hidden files in new panes*, *Delete this computer's
  files permanently* (D7). The delete dialog says which of three things happens: the trash, for
  good by the setting, or for good off an image.
- **Smaller changes found while checking:** a FAT card's dot files (`.DS_Store`) are hidden like the
  host's; the project's top in the path is its name, not its full path (a path in a shot showed the
  author's home folder); the column headers go when the viewer opens.
- **Docs**: `docs/content/en/guides/media/file-manager.mdx` (Media group), linked from the Disk
  Explorer, Project Explorer and Next SD card guides. Its three shots come from
  `scripts/doc-shots/recipes/guides-file-manager.cjs`, on a fixture project and the sample `.dsk`, so
  no shot shows this computer's own drives. The changeset is `.changes/file-manager-two-pane-file-60d9.md`.
- **Not built in the first release:** a CLI (Q4), the +3DOS 128-byte header on FAT under Keep headers,
  Start waiting for a running job (§12, Phases 5–6), and the two slow machine tests of Phase 5 (a Next
  booting a card the File Manager wrote, a +3 `LOAD`ing a disk it wrote).
