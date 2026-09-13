# ZX Spectrum Next Storage Copy Command Plan

Created: 2026-08-29

Status: Implemented on 2026-08-29.

## Implementation Result

Implemented `ncp` / `next-copy` as a renderer interactive command, backed by a
main-process `copyZxNextStorageFile` API. The implementation supports copying
one file from host to ZX Spectrum Next storage and one file from storage to host.
Current-storage mode is gated to the ZX Spectrum Next machine in the command,
while explicit `-cim <file.cim>` mode works independently of the current
emulator type. The command refuses all copy operations while the emulator is
Running or Paused; it does not start or stop the machine automatically.
When the target is a folder, the source filename is reused. Missing target
folders are created recursively for both host and storage destinations. Existing
target files require an overwrite confirmation before the command retries with
`overwrite: true`.

Path handling is split by responsibility:

- host filesystem paths are resolved in the main process with native Node path
  semantics, relative to the open project folder when available;
- storage paths are normalized to slash-separated FAT paths and reject empty,
  `.`, and `..` path segments.

Validation run:

```text
npm test -- --project node test/common/zx-next-storage-paths.test.ts test/main/zx-next-storage-copy.test.ts test/fat32/FileManager.test.ts test/commands/ZxNextStorageCopyCommand.test.ts
npm test -- --project node test/commands/ZxNextStorageCopyCommand.test.ts
npm run build:check
npm run lint:renderer -- --quiet
```

## Goal

Add an interactive IDE command that copies files between the host filesystem and
a ZX Spectrum Next storage image.

The command must support exactly these storage targets:

- the current emulator's selected storage, but only when the current machine is
  ZX Spectrum Next;
- an explicitly specified `.cim` file that can be opened as a ZX Spectrum Next
  FAT32 storage image.

The command should support both copy directions:

- host filesystem to Next storage;
- Next storage to host filesystem.

## Proposed Command

Add a renderer interactive command named `ncp` with alias `next-copy`.

Usage:

```text
ncp to <host-source> <next-destination> [-cim <cim-file>]
ncp from <next-source> <host-destination> [-cim <cim-file>]
```

Examples:

```text
ncp to "build/game.nex" "/games/game.nex"
ncp from "/nextzxos/autoexec.1st" "./autoexec.1st"
ncp to "./assets/title.scr" "/assets/title.scr" -cim "/tmp/test-card.cim"
ncp from "/logs/boot.txt" "./boot.txt" -cim "/tmp/test-card.cim"
```

Rules:

- Without `-cim`, the command uses the current emulator storage and fails unless
  `context.store.getState().emulatorState?.machineId === MI_ZXNEXT`.
- With `-cim`, the command uses that image path and does not require the current
  emulator to be a Next.
- `to` and `from` are the only valid directions.
- The storage path is always interpreted with `/` separators.
- The first implementation handles files. Directory recursion can be added
  later only if requested explicitly.

## Current Code Context

- Interactive commands are registered in `src/renderer/appIde/IdeCommands.ts`.
- Commands live under `src/renderer/appIde/commands/` and generally subclass
  `IdeCommandBase`.
- The command parser already supports value-bearing named options through
  `CommandArgumentInfo.namedOptions`, so `-cim <path>` fits the existing style.
- Renderer commands call main-process operations through `context.mainApi`,
  typed in `src/common/messaging/MainApi.ts` and handled in
  `src/main/RendererToMainProcessor.ts`.
- `.cim` storage primitives already exist:
  - `src/main/fat32/CimFileManager.ts`
  - `src/main/fat32/CimHandlers.ts`
  - `src/main/fat32/Fat32Volume.ts`
  - `src/main/fat32/FileManager.ts`
- `FileManager.copyFile()` already copies a host file into a FAT32 volume.
- `FatFile.readFileData()` and `FatFile.fileSize` provide the pieces needed for
  extracting a file from a FAT32 volume.
- `src/main/machine-menus/zx-next-menus.ts` tracks the selected SD card image
  through `MEDIA_SD_CARD`, but `RendererToMainProcessor.copyToSdCard()` currently
  writes to the default `ks2.cim` path rather than the selected/current image.

## Implementation Steps

### 1. Add Main API Types And Methods

Extend `src/common/messaging/MainApi.ts` with a focused storage-copy API.

Suggested types:

```ts
export type ZxNextStorageRef =
  | { kind: "current" }
  | { kind: "cim"; cimFile: string };

export type ZxNextStorageCopyDirection = "to" | "from";

export type ZxNextStorageCopyRequest = {
  direction: ZxNextStorageCopyDirection;
  storage: ZxNextStorageRef;
  hostPath: string;
  storagePath: string;
};

export type ZxNextStorageCopyResult = {
  hostPath: string;
  storagePath: string;
  cimFile: string;
  bytesCopied: number;
};
```

Add:

```ts
async copyZxNextStorageFile(
  _request: ZxNextStorageCopyRequest
): Promise<ZxNextStorageCopyResult>
```

Keep the existing `copyToSdCard()` for current compiler flows, but consider
moving it internally onto the same helper after this feature is in place.

### 2. Resolve The Target CIM In Main

In `src/main/RendererToMainProcessor.ts`, implement target resolution in the
main process so filesystem checks and settings access stay out of the renderer.

For `{ kind: "current" }`:

- read `mainStore.getState().media?.[MEDIA_SD_CARD]`;
- fall back to the same default SD image path currently used by
  `getSdCardHandler()`;
- do not perform the machine-id check here as the primary gate. The renderer
  command should produce the user-facing "current machine must be ZX Spectrum
  Next" error before calling the main API.

For `{ kind: "cim" }`:

- require an existing file;
- require a `.cim` extension, case-insensitive;
- open it with `new CimFile(cimFile)` and `new Fat32Volume(cimFile).init()`;
- surface invalid header, invalid sector size, or invalid FAT32 layout errors as
  command failures.

Always close `CimFile` in `finally`.

### 3. Extract Reusable FAT/CIM File Operations

Extend `src/main/fat32/FileManager.ts` so it supports both directions.

Add:

```ts
async copyFileFromVolume(sourceFilePath: string, targetFilePath: string): Promise<number>
```

Expected behavior:

- open `sourceFilePath` in the FAT32 volume with `O_RDONLY`;
- fail if the entry does not exist or is a directory;
- create the host target directory with `fs.promises.mkdir(..., { recursive: true })`;
- stream out in chunks using `readFileData()` until `fileSize` bytes are written;
- return bytes copied;
- close both handles in `finally`.

Adjust `copyFile()` to return bytes copied as well, so the interactive command
can report an accurate result.

While touching this file, fix the stray duplicated import text near the top:

```ts
const CHUNK_SIZE = 64 * 1024; // 64 KBimport { Fat32Volume } from "./Fat32Volume";
```

should become a normal constant declaration.

### 4. Invalidate Current Emulator Storage After Writes

For `direction: "to"` and `storage.kind === "current"`, call
`invalidateSdCardHandler()` before mutating the selected/current `.cim`, matching
the intent already documented in `zx-next-menus.ts`.

After the write completes, leave the handler invalidated so the emulator
reopens fresh storage metadata on the next sector access.

For explicit `-cim` writes, do not invalidate the current emulator handler
unless the resolved absolute `.cim` path is the same file as the current storage
path. Use path normalization or `fs.realpathSync.native` where available.

### 5. Implement The Renderer Command

Create `src/renderer/appIde/commands/ZxNextStorageCopyCommand.ts`.

Suggested structure:

- `id = "ncp"`
- `aliases = ["next-copy"]`
- `description = "Copies files between the host filesystem and ZX Spectrum Next storage."`
- `usage = ["ncp to <host-source> <next-destination> [-cim <cim-file>]", "ncp from <next-source> <host-destination> [-cim <cim-file>]"]`
- `argumentInfo`:

```ts
{
  mandatory: [
    { name: "direction" },
    { name: "source", type: "string" },
    { name: "destination", type: "string" }
  ],
  namedOptions: [{ name: "-cim", type: "string" }]
}
```

Validation:

- reject directions other than `to` or `from`;
- reject empty source/destination;
- reject `-cim` values that do not end with `.cim`;
- when `-cim` is absent, require `MI_ZXNEXT`;
- normalize mapping:
  - `to`: `hostPath = source`, `storagePath = destination`;
  - `from`: `storagePath = source`, `hostPath = destination`.

Execution:

- call `context.mainApi.copyZxNextStorageFile(...)`;
- write a green success line showing direction, source, destination, image path,
  and byte count;
- return `commandSuccessWith(...)` or `commandError(...)`.

Register the command in `src/renderer/appIde/IdeCommands.ts`.

### 6. Keep Storage Path Validation Conservative

Use FAT32 path parsing as the final authority for legal storage paths, but do a
small preflight in the command/helper:

- normalize backslashes in storage paths to `/`;
- trim one leading `/` before passing to `Fat32Volume`/`FatFile`, unless current
  behavior is confirmed to prefer absolute-looking paths;
- reject `.` and `..` storage path segments for this command, even if lower
  layers would handle them accidentally;
- keep host paths untouched except for main-process resolution with existing
  path helpers when applicable.

This avoids a command that appears to support host-style path traversal inside
the image.

### 7. Add Tests

Focused tests first:

- `test/commands/ZxNextStorageCopyCommand.test.ts`
  - metadata and usage;
  - `to` argument mapping;
  - `from` argument mapping;
  - `-cim` bypasses current-machine requirement;
  - no `-cim` rejects non-Next machines;
  - invalid direction and invalid `.cim` extension fail validation;
  - main API errors return `commandError`.

- `test/fat32/FileManager.test.ts`
  - host-to-volume copy still works and returns byte count;
  - volume-to-host copy extracts exact bytes;
  - missing volume file fails clearly;
  - directory-as-source fails clearly for `from`.

- Main-process helper tests if an existing pattern exists for
  `RendererToMainProcessor`; otherwise isolate the target-resolution helper in a
  small exported function and test that:
  - current storage resolves selected `MEDIA_SD_CARD` before default;
  - explicit `.cim` rejects non-`.cim`;
  - invalid CIM/FAT32 images surface an error.

Validation commands:

```sh
npm test -- --project node test/fat32/FileManager.test.ts
npm test -- --project jsdom test/commands/ZxNextStorageCopyCommand.test.ts
npm run build:check
```

Run `npm run lint:renderer` because this adds renderer command code.

### 8. Manual Smoke Test

After automated tests pass:

1. Start the IDE with a ZX Spectrum Next selected.
2. Run `ncp to "<small-host-file>" "/tmp/small-host-file"`.
3. Run `ncp from "/tmp/small-host-file" "<host-temp-output>"`.
4. Compare source and extracted bytes.
5. Repeat the same two commands with `-cim "<copy-of-ks2.cim>"` while a non-Next
   machine is selected, confirming explicit `.cim` mode still works.
6. Confirm omitting `-cim` on a non-Next machine fails with a clear message.

## Non-Goals

- No general disk-image abstraction beyond ZX Spectrum Next `.cim` storage.
- No support for non-CIM formats.
- No support for arbitrary emulator types.
- No UI dialog is required for the first implementation.
- No directory recursion in the first slice.
- No delete, list, rename, or mkdir command surface unless needed internally to
  copy one file to an existing or creatable directory path.

## Risks And Notes

- `copyToSdCard()` currently targets the default SD card image even when the user
  selected a different current image. The new API should resolve current storage
  correctly and can later be used to fix that older path.
- FAT32 path handling currently lives mostly in `FatFile.parsePathToLfn()`. The
  command should avoid adding a second full parser; it only needs conservative
  preflight checks.
- Mutating an image used by a running emulator may race with sector reads. The
  first implementation should either document that the command should be used
  while the machine is stopped/paused or add an explicit guard if testing shows
  live writes are unsafe.
- `CimFile` and `CimHandler` keep file descriptors open. Any implementation must
  close handles reliably and invalidate the cached handler for current-image
  writes.

## Done When

- `ncp` is available in interactive command help.
- `ncp to` copies one host file into current Next storage.
- `ncp from` copies one file out of current Next storage.
- `ncp to/from ... -cim <file.cim>` works independently of the current emulator
  machine type.
- Current-storage mode rejects non-Next machines.
- Invalid `.cim` files and invalid FAT32 layouts fail with readable messages.
- Focused command and FAT32 file-manager tests pass.
- `npm run build:check` and `npm run lint:renderer` pass.
