# The File Manager: decisions, architecture and what is not built

The two-pane File Manager (a Total Commander style commander, opened as an IDE document) was built
in nine phases on 2026-10-31 and its plan was closed on 2026-11-04 (git history:
`.plans/FILE_MANAGER_PLAN.md`). The user guide is `docs/content/en/guides/media/file-manager.mdx`;
the plan's UI mockup is in git history (`.plans/mockups/file-manager.html`). Read this before changing
`src/main/file-manager/`, `src/common/fileManager/`, `src/common/diskfs/` or
`src/renderer/appIde/DocumentPanels/FileManager/`.

## What it is

Each pane shows one **drive** and a folder on it. A drive is: this computer (volumes, home, `~/Klive`,
`~/KliveProjects`), the open project, **machine storage** (the Next's SD card, the DivMMC card, disk
drives A:-D:, Microdrives, the tape player; only while the machine is stopped), a **disk image**
(`.dsk` +3DOS, `.trd`/`.scl` TR-DOS, `.mdr` Microdrive, `.mgt` MGT +D/DISCiPLE, `.img`/`.hdf`/`.cim`
FAT, one drive per FAT partition, plus one per +3DOS partition of an IDEDOS disk), or a **tape**
(`.tap` read and written, `.tzx` read only, standard-speed blocks). Copy, move, rename, delete, make
folder, view, select by mask, with conflict handling, progress and cancel.
Not in it: search across drives, folder compare/sync, archives, FTP, editing in place (F4 opens a
project file in Klive's own editor).

## Decisions

| # | Decision |
| --- | --- |
| D1 | **A document, not a window:** the special document `$fileManager` (restored with the workspace; the panes' places are its view state). Opened by `show-file-manager` (`fm`) and **File › File Manager...** (not View: `test/main/app-menu-structure.test.ts` holds that menu to 12 items). |
| D2 | **The main process owns every file operation.** The renderer sends `fm*` requests through `MainApi` and names a drive by its **id**, never sends a drive object back; main rebuilds an unknown id (`host:`, `project:`, `image:`, `hd:<path>#<n>`, `machine:<slot>[#partition]`), which restores a pane after a restart. Large images stay in main. Errors cross IPC as `[fm:<code>]` (`FmError`, `fmErrorCodeOf`). |
| D3 | **One drive interface** (`FmDrive`, `src/common/fileManager/fmTypes.ts`) over the host, a `DiskFileSystem` in memory, a hard-disk partition, the machine's media and a tape. The pane and the job runner see only it. |
| D4 | **Machine storage is a drive only while the machine is stopped** (`None` or `Stopped`, as the Next and DivMMC menus say). While it runs the drives are listed unavailable, every request fails with `machineRunning`, and the pane offers **Stop the machine**; when it stops the drives reopen. A paused machine's storage is not shown (Q2). A job checks before every file that the machine is still stopped (`FmJobDeps.allowed`). Deviation: "Start waits for a running job" was not built. |
| D5 | **Writing an image goes through the existing edit paths:** a floppy or cartridge image is one edit per job (`beginDiskImageEdit` … `commitDiskImageEdit`, with its `.bak`); a hard-disk image is written in place, each step under `aroundSdCard` (`hard-disk-edit.ts`); a cancelled or full job commits nothing. One job, one commit. |
| D6 | **Conversion is explicit and previewed:** the copy dialog shows each file's resulting name and what it becomes, with modes **Auto**, **Raw bytes**, **Keep headers** (the mode shows only when crossing between a file store and a catalogue). |
| D7 | **Delete on the host goes to the Trash** (`shell.trashItem`); the setting *Delete this computer's files permanently* changes it. Inside an image there is no trash (the image's `.bak` is the net); the delete dialog says which of the three happens. A **move** removes sources permanently (their copy is the file now). |
| D8 | **Total Commander's keys:** F3 view, F4 edit, F5 copy, F6 move, Shift+F6 rename, F7 new folder, F8/Delete delete, Tab, Insert/Space, `+`/`-` select by mask (`*`, `?`, `;`), Backspace up, Alt+F1/Alt+F2 drive menus, Ctrl+R refresh, Ctrl+H hidden files, Ctrl+A mark all, Alt+↑/↓ reorder a tape. A button bar shows the keys for keyboards without F-keys. `fileManagerKeys.ts` maps keys to intents, pure. |
| D9 | **Images are folders too:** Enter on a recognised image in a host or project pane enters it; Backspace at its root leaves. An image *inside* an image is listed but not entered. |
| D10 | **The Disk Explorer stays** for layout, sector maps, attributes and TR-DOS compaction; the File Manager links to it and shares its preview and `diskErrorText.ts`. The Disk Explorer and `disk` do not see tapes. |

## Architecture

- **Common** (`src/common/fileManager/`): `fmTypes.ts` (drives, listings), `fmJobTypes.ts` (jobs as
  MainApi carries them), `fmTransfer.ts` (`convertFile` = the conversion rules, `buildPlan` = the whole
  copy with folders, names, conflicts and `.tap` splits, `freeName` = the conflict suggestion, `tapOf`).
  Pure, so the rules are tested without a file system.
- **File systems** (`src/common/diskfs/`): `DiskFileSystem` implementations `plus3dos`, `trdos`,
  `microdrive`, `fat`, `tape` (`tapefs.ts`), `mgt` (`mgtfs.ts`), and `idedos.ts` (a `Plus3DosFileSystem`
  on an `IdedosPlus3Store`). `openDiskFileSystem` picks one by extension and sniffing. **Adding a file
  system** = a `DiskFileSystem` there, an entry in `openDiskFileSystem`, import rules in
  `importFiles.ts` and a column set in the pane; the File Manager needs nothing else.
- **Main** (`src/main/file-manager/`): `fmDrives.ts` (the drives; imports no Electron, the host
  environment and hard-disk access are handed in so tests run on temp folders and real images),
  `fmJobs.ts` (`planTransfer`, `runTransfer`, `jobStatus`, `cancelJob`, `deleteEntries`, `makeFolder`,
  `renameEntry`; `FmJobDeps` keeps Electron out), `fmService.ts` (the `MainApi` serving; `currentMedia`
  reads the machine's media from the app state **filtered by the machine**, because the settings keep
  other machines' media). `planTransfer` refuses a read-only target, the source folder itself
  (`sameFolder`) and a folder into itself (`intoItself`), and reports `needBytes` (rounded to the
  target's blocks) against the free space. IPC: `fmListDrives`, `fmOpenImage`, `fmList`, `fmRead`,
  `fmPlanTransfer`, `fmRunTransfer` (unbounded), `fmJobStatus` (polled every 200 ms by the renderer),
  `fmCancelJob`, `fmDelete`, `fmMkdir`, `fmRename`, `fmMoveOnTape`. A move on one volume is a rename
  (`renameOnVolume`).
- **Renderer** (`src/renderer/appIde/DocumentPanels/FileManager/`, Model/Controller/View per
  `dev/ai/ui-mvc-guide.md`): `FileManagerModel.ts` (two panes, cursor, marks, sort, hidden files, images
  entered), `FileManagerViewModel.ts` (columns per file system, texts), `FileManagerController.ts`
  (ports `fm`, `picker`, `locations`), `FileManagerView.tsx` (virtualized rows, drive menu),
  `FileManagerDialogs.tsx` (copy, conflict, delete), `FileManagerViewer.tsx` (F3: BASIC listing,
  SCREEN$, text or bytes, **Open as memory**), `FileManagerPanel.tsx` (wiring). A refresh keeps the
  cursor on its **file**, not its row number (a `.bak` appearing above the cursor made the next F5 copy
  the wrong file).
- **Columns:** host `Name | Size 9ch | Modified 17ch`; FAT `Name | Size`; +3DOS adds
  `Type 9ch | Start 6ch | Attr. 4ch | User 4ch`. The name column is `minmax(12ch, 1fr)`. A tape listing
  marks itself `ordered`: the pane sorts by `position` until a column is chosen.
- **Hard disks:** IDEDOS: `readIdedos` finds the `PLUSIDEDOS` system partition at LBA 0 or head 1
  (behind an MBR); each type-3 partition is a drive `hd:<file>#<1000 + entry>`.

## Conversion rules (`fmTransfer.ts`, tested row by row in `test/file-manager/fm-transfer.test.ts`)

- Host or FAT → catalogue (+3DOS, TR-DOS, Microdrive, TAP, MGT): `hostFileToDiskFiles`: `.tap` splits
  into its files, `.scr` → CODE 16384, `.bas` → tokenised BASIC, else CODE at the dialog's start
  address; names shortened to the target's rule, clashes numbered (`GAME~1`).
- Catalogue → file store, **Auto**: a BASIC program or array becomes a one-file **`.tap`** (header kept;
  deviation from the plan's detokenised `.bas`: Klive's detokeniser lives in the renderer and loses
  colour codes and the numbers' hidden forms, and a `.tap` round-trips and loads in esxDOS/NextZXOS);
  SCREEN$ → `.scr`; other code → its bytes (`.bin` added to a name without an extension); a headerless
  file stays as it is. **Keep headers** → a one-file `.tap` for every file with a header (FAT too).
  **Raw bytes** → header dropped.
- Between catalogues the header always goes with the file; names are re-fitted.
- Host ↔ FAT: bytes as they are, long names kept. Folders copy recursively where the target has
  folders; to a flat file system the dialog offers **Flatten folders** or skips them with a warning.
- The dialog shows every renamed file before writing (name fitting loses information).

## Safety rules

- Nothing is written before the plan step checks names, conflicts and free space.
- A read-only image, a `.tzx` or a write-protected medium refuses writes before the dialog opens.
- Deleting `klive.project` or the project root from the Project drive is refused.
- While a job runs, commands that write are refused; Escape cancels it.
- Jobs release the SD card lock between files, so the IDE does not wait for minutes.
- A removed or unavailable host volume shows as unavailable instead of failing a job.
- The machine's SD card is opened through `withSdCardAccess` and `invalidateSdCardHandler()` as
  `copyZxNextStorageFile` does. A Microdrive needs nothing of its own: the controller publishes a
  cartridge's changes when the machine pauses or stops.

## File system facts (Phase 9)

Sources were read for format facts only, each recorded in the file's header: the DISCiPLE/+D Technical
Guide (directory, sector count high byte first, the sector address map from track 4 sector 1, 510 data
bytes and a (track, sector) link, side 1 as 128+, a 9-byte header first in a ZX file), MAME's SAM Coupé
image format for the `.mgt` file's order (heads alternate), the Sinclair Wiki's IDEDOS page (partition
table), and the +3 manual's XDPB. MGT: `.mgt` of 819,200 bytes, 80 directory entries on tracks 0-3,
files allocated from the map side 0 first, SCREEN$ has its own type (7), a file over 64K is refused,
names up to 10 characters. IDEDOS: 4K blocks and 512 directory entries in `formatIdedos`. **No
oracle:** Klive emulates neither interface, so these are checked against the documents' own examples
and by round trips, not by a machine reading what Klive wrote.

## Not built, open

- **Opus Discovery** (`.opd`). The manual gives the catalogue's 16-byte entries and the image order
  (40 tracks, 18 sectors of 256 bytes, sides alternating), but not where the catalogue starts or whether
  a file's data carries a header. Writing disks on a guess could spoil real ones; it waits for a real
  `.opd` to read the rest from.
- **A command line** (`klive fm copy a.dsk:LOADER b.trd:`), which would reuse `planTransfer` and the
  jobs. `klive disk` covers part of it. Not decided.
- The `+3DOS` 128-byte header on a FAT target under **Keep headers** (esxDOS and NextZXOS read it).
- **Start waits for a running job** (D4's deviation).
- Two slow-tier proofs of machine storage: a Next booting a card the File Manager wrote, and a +3
  `LOAD`ing a disk it wrote. The writes are Phase 4's image jobs, tested on real images, and
  `test/file-manager/fm-tape-load.test.ts` proves a written tape loads on the real 48K ROM.
- An image inside an image is not entered, and the viewer has no search.
