# Interactive Command Notes

Use this note before creating or updating IDE interactive commands.

## Command Shape

- Commands live in `src/renderer/appIde/commands/` and usually extend
  `IdeCommandBase`.
- Register commands in `src/renderer/appIde/IdeCommands.ts`.
- Define concise metadata: `id`, `description`, `usage`, optional `aliases`.
- Prefer `CommandArgumentInfo` for parsing:
  - `mandatory` and `optional` for positional args;
  - `commandOptions` for boolean flags;
  - `namedOptions` for options with values, such as `-cim <file>`.
- Put user-facing argument checks in `validateCommandArgs()` so invalid commands
  show usage/help consistently.
- Use `commandSuccessWith`, `commandError`, and `writeSuccessMessage` from
  `src/renderer/appIde/services/ide-commands.ts`.

## Renderer/Main Split

- Renderer commands should orchestrate command semantics and user-facing
  validation.
- Main-process filesystem, shell, Electron dialogs, project settings, and image
  mutation belong behind `context.mainApi`.
- Add typed API methods to `src/common/messaging/MainApi.ts` and implement them
  in `src/main/RendererToMainProcessor.ts`.
- If main-process logic is nontrivial, put it in a small helper module under
  `src/main/` so it can be unit-tested without Electron window plumbing.

## Path Handling

- Keep host filesystem paths native and resolve them in the main process with
  Node `path` APIs.
- Do not rewrite Windows paths in renderer command mapping.
- For paths inside disk/storage images, normalize explicitly to the format the
  image layer expects, usually POSIX `/` separators.
- Preserve directory-target hints before native resolution, because
  `path.resolve("folder/")` loses the trailing separator.
- If a target may be a folder, resolve the final file path close to the storage
  or filesystem layer, where existence checks are accurate.

## Overwrite And State Guards

- Do existence and overwrite checks before mutation.
- If an overwrite prompt is needed, let the main/API helper report a target-exists
  condition, then let the renderer command ask the user and retry with an
  explicit `overwrite: true`.
- Do not start, stop, or pause the emulator as a side effect of command
  validation. If a command requires a particular machine state, reject clearly.

## Tests

- Add command tests under `test/commands/` using
  `test/commands/test-helpers/mock-context.ts`.
- Add helper tests under `test/main/` for main-process logic that can avoid
  Electron.
- Add lower-level tests near the affected domain, such as `test/fat32/`, when
  changing reusable primitives.
- Prove path behavior with Windows-style, POSIX-style, relative, and folder-hint
  examples when the command accepts file paths.
- Run focused tests first, then `npm run build:check`; run
  `npm run lint:renderer -- --quiet` when renderer command code changes.

## Documentation

- When adding or changing a user-facing interactive command, update
  `docs/pages/commands-reference.mdx`.
- Keep command docs aligned with the command metadata: id, aliases, usage,
  required state, important side effects, and a few practical examples.
