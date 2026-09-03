# SJASMPLUS Integration GUI Plan

**Status:** Draft plan, updated with accepted decisions
**Created:** 2026-09-03
**Updated:** 2026-09-03
**Scope:** Add GUI-driven SJASMPLUS integration setup under the IDE menu. ZX BASIC, PASTA/80, and other integrations are explicitly out of scope for this plan.

---

## 1. Goal

Klive IDE currently configures SJASMPLUS through the interactive `sjasmp-reset` command. This works, but it asks users to know the expected install-folder shape, command syntax, and user/project settings behavior.

The goal is to add:

- `IDE > Integrations > SJASMPLUS...` menu item.
- A dedicated SJASMPLUS integration dialog.
- Online release discovery from the official SJASMPLUS GitHub releases.
- Guided download and extraction of a compatible release.
- Offline setup by selecting an existing install folder or executable file.
- Executable validation by compiling a small Z80 smoke-test program.
- User-level or project-level integration, defaulting to user settings.
- Clear status showing the effective configured path and whether it comes from user or project settings.

---

## 2. Current Repo Touchpoints

Relevant current files:

- Menu wiring: `src/main/app-menu.ts`
- IDE dialog IDs: `src/common/messaging/dialog-ids.ts`
- IDE dialog registry: `src/renderer/appIde/dialogs/ideDialogRegistry.tsx`
- Dialog request bridge: `src/renderer/appIde/IdeDialogBridge.tsx`
- Dialog pattern docs: `.docs/dialog-pattern.md`
- Main API renderer calls: `src/common/messaging/MainApi.ts`
- Main-process API implementation: `src/main/RendererToMainProcessor.ts`
- Current SJASMPLUS settings keys: `src/main/sjasmp-integration/sjasmp-config.ts`
- Current SJASMPLUS interactive command: `src/renderer/appIde/commands/SjasmPlusCommands.ts`
- Current SJASMPLUS execution:
  - `src/script-packages/sjasm/sjasm.ts`
  - `src/main/sjasmp-integration/SjasmPCompiler.ts`

Important existing behavior:

- `sjasmp.root` currently stores the SJASMPLUS install folder.
- The compiler builds the executable path as `<sjasmp.root>/sjasmplus`.
- Settings are merged as user settings first, project settings second, so project settings override user settings.
- User settings are saved through `mainApi.applyUserSettings(...)`.
- Project settings are saved through `mainApi.applyProjectSettings(...)`.
- Main menu actions can call `getIdeApi().displayDialog(...)`, and the renderer opens registered dialogs through `ideDialogRegistry`.

---

## 3. Product Decisions

These decisions are accepted and should be treated as implementation requirements:

- Add explicit `sjasmp.executablePath` support immediately.
- Keep `sjasmp.root` for backward compatibility.
- Prefer `sjasmp.executablePath` when present; fall back to `<sjasmp.root>/sjasmplus(.exe)`.
- Do not show prereleases by default; hide them behind an advanced option.
- Do not allow "save anyway" in the first implementation. Failed validation must not update the active compiler setting.
- Do not write normal GUI success output to the interactive command output pane. Keep diagnostics inside the dialog.
- Show effective settings clearly, including whether the active value comes from user settings or project settings.
- Add a `Test again` action after a path is selected or configured.
- Detect common package-manager installs from `PATH` as suggestions only.
- Keep downloaded tools self-contained under versioned folders.
- Store detected version metadata for future update checks.
- Avoid a generic multi-tool integration framework until at least one more real GUI integration exists.

---

## 4. Menu Shape

Add under the existing IDE menu:

```text
IDE
  Integrations
    SJASMPLUS...
```

Keep the submenu near the existing IDE-specific actions, before `IDE Settings`, so setup reads as part of IDE configuration rather than generic app settings.

Implementation sketch:

```ts
{
  type: "submenu",
  id: IDE_INTEGRATIONS,
  label: "Integrations",
  submenu: [
    {
      id: IDE_INTEGRATION_SJASMPLUS,
      label: "SJASMPLUS...",
      click: async () => await getIdeApi().displayDialog(SJASMPLUS_INTEGRATION_DIALOG)
    }
  ]
}
```

---

## 5. SJASMPLUS Dialog UX

Use a single modal dialog with a wizard-like body rather than multiple popups.

Suggested sections:

1. Current status
   - Show current effective configuration, if any.
   - Show whether the value came from user settings or project settings.
   - Show detected executable path, install folder, version, and last validation state.

2. Setup source
   - `Download a release` radio option.
   - `Use existing folder or executable` radio option.
   - `Detected on PATH` suggestions if any are found.

3. Online release picker
   - Fetch releases from `https://api.github.com/repos/z00m128/sjasmplus/releases`.
   - Suggest the newest non-prerelease release with an asset matching the current OS/architecture.
   - Let advanced users show prereleases.
   - Let advanced users choose another compatible release or raw asset if asset naming is ambiguous.
   - Provide retry, offline, and no-compatible-asset states.

4. Local selection
   - Folder picker: user selects a folder containing `sjasmplus` or `sjasmplus.exe`.
   - File picker: user selects the executable directly.
   - Normalize either choice into both `installFolder` and `executablePath`.

5. Scope
   - Segmented control or radio buttons:
     - `User settings` default
     - `Project settings`
   - Disable `Project settings` with a concise reason if no Klive project is loaded.

6. Validation
   - Run a smoke compile before saving, or as part of the final `Apply` button.
   - Provide `Test again` after a candidate path exists.
   - Show executable path, stdout/stderr tail, and generated output status when validation fails.
   - Save settings only after validation succeeds.

7. Completion
   - Show configured path, version, and scope.
   - Offer `Open containing folder` as a secondary action.

---

## 6. Main Process Services

Do network, archive extraction, filesystem probing, PATH detection, and executable validation in the main process. The renderer should own presentation and user intent, not low-level process execution.

Add a focused SJASMPLUS integration service, for example:

```text
src/main/sjasmp-integration/
  sjasmplus-resolver.ts
  sjasmplus-integration-service.ts
```

The resolver should be reusable by both the existing compiler and the new integration service.

Add corresponding methods to `MainApi` and `RendererToMainProcessor`, for example:

```ts
type IntegrationScope = "user" | "project";

type SjasmplusRelease = {
  tagName: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  assets: SjasmplusReleaseAsset[];
};

type SjasmplusReleaseAsset = {
  name: string;
  downloadUrl: string;
  size: number;
  platform: "windows" | "macos" | "linux" | "unknown";
  arch: "x64" | "arm64" | "unknown";
};

type SjasmplusProbeResult = {
  ok: boolean;
  executablePath?: string;
  installFolder?: string;
  version?: string;
  stdout?: string;
  stderr?: string;
  error?: string;
};

type SjasmplusIntegrationStatus = {
  effective?: SjasmplusProbeResult;
  source: "project" | "user" | "none";
  user?: SjasmplusProbeResult;
  project?: SjasmplusProbeResult;
  pathSuggestions: SjasmplusProbeResult[];
};
```

Potential API methods:

- `getSjasmplusIntegrationStatus()`
- `listSjasmplusReleases({ includePrereleases?: boolean })`
- `downloadSjasmplusRelease(asset, destinationFolder)`
- `probeSjasmplusPath(path)`
- `validateSjasmplusExecutable(executablePath)`
- `applySjasmplusIntegration({ scope, installFolder, executablePath, version? })`

Keep these APIs SJASMPLUS-specific for this plan.

---

## 7. Settings Model

Add an explicit executable-path setting while keeping folder compatibility:

```ts
export const SJASMP_INSTALL_FOLDER = "sjasmp.root";
export const SJASMP_EXECUTABLE_PATH = "sjasmp.executablePath";
export const SJASMP_VERSION = "sjasmp.version";
```

Update SJASMPLUS command resolution to prefer `sjasmp.executablePath` when present, then fall back to `<sjasmp.root>/sjasmplus(.exe)`.

Recommended implementation order:

1. Add `SJASMP_EXECUTABLE_PATH` and `SJASMP_VERSION`.
2. Add `resolveSjasmplusExecutable(settingsReader, platform)`.
3. Return the explicit executable path if set.
4. Otherwise return `<sjasmp.root>/sjasmplus.exe` on Windows and `<sjasmp.root>/sjasmplus` elsewhere.
5. Use the resolver from both `src/script-packages/sjasm/sjasm.ts` and the integration service.
6. Keep `sjasmp.root` populated whenever the GUI applies a setting.
7. Store `sjasmp.version` when validation can detect a version.
8. Keep `sjasmp-reset` working with folder-only behavior; optionally update it later to set `sjasmp.executablePath` too when the expected executable exists.

---

## 8. Release Discovery

Use GitHub Releases as the first data source:

- Official repo: `https://github.com/z00m128/sjasmplus`
- Releases page: `https://github.com/z00m128/sjasmplus/releases`
- Releases API: `https://api.github.com/repos/z00m128/sjasmplus/releases`

Release selection policy:

- Default suggestion: newest stable release with a compatible asset.
- Hide prereleases unless the user enables an advanced option.
- If the newest release has no compatible asset, show that fact and suggest the newest compatible release.
- Cache the last successful release response in memory only for the dialog session; avoid persistent cache in the first slice.

Asset matching should be conservative:

- Windows: prefer asset names containing `win`, `windows`, or `.exe` inside an archive.
- macOS: prefer `macos`, `darwin`, or `osx`; distinguish `arm64` and `x64`.
- Linux: prefer `linux`; distinguish `x64`, `x86_64`, `amd64`, and `arm64`.

If asset names are inconsistent, expose the raw asset list under an advanced chooser rather than guessing silently.

---

## 9. Download And Extraction

Main-process download behavior:

- Use Electron/Node fetch or HTTPS from the main process.
- Stream to disk, not memory.
- Download to a temporary file inside the chosen destination folder.
- Verify the downloaded byte count against the GitHub asset size when available.
- Extract `.zip`, `.tar.gz`, or `.tgz` assets.
- If an asset is a direct executable, save it directly.
- Mark executable permission on POSIX with `chmod 755`.
- Avoid overwriting an existing install folder unless the user confirms.
- Install to a versioned folder:

```text
<chosen-folder>/sjasmplus/<tag>/
```

Store the resolved folder/path only after successful extraction and validation.

Remember the last download folder in `appSettings.folders` or the existing folder-dialog settings mechanism if it fits the local pattern.

---

## 10. Validation Smoke Test

Validation should run a tiny assembly in a temp directory:

```asm
  DEVICE ZXSPECTRUM48
  ORG $8000
start:
  ld a, $42
  ret
  SAVEBIN "_probe.bin", start, $0003
```

Run:

```text
sjasmplus -nologo probe.asm
```

Validation succeeds when:

- Process exits with code 0.
- Expected output file exists.
- Output bytes match `3E 42 C9`.

Also run `sjasmplus --version` or equivalent version command separately if SJASMPLUS supports it consistently; treat version detection as helpful metadata, not a hard requirement.

Validation failures should report:

- Executable path tried.
- Exit code or spawn error.
- stderr/stdout tail.
- Whether the output file was missing or wrong.

Do not invoke the full Klive compiler registry for this probe. A direct process call keeps validation independent from project state and avoids temporary list/SLD assumptions.

---

## 11. Renderer Implementation

Add dialog:

```text
src/renderer/appIde/dialogs/
  SjasmplusIntegrationDialog.tsx
  SjasmplusIntegrationDialog.module.scss
```

Register ID:

```ts
export const SJASMPLUS_INTEGRATION_DIALOG = 6;
```

Update `ideDialogRegistry` result type and entries.

Dialog layout guidance:

- Follow `.docs/dialog-pattern.md`.
- Use the existing `Modal` component.
- Use stable dimensions and wrap long filesystem paths safely.
- Use familiar controls: radio/segmented scope selector, buttons for folder/file picking, dropdown for release choice, progress state for download/validation.
- Keep the dialog usable without internet by making local selection and PATH suggestions first-class paths, not hidden fallbacks behind release loading.

---

## 12. Backward Compatibility

Keep the existing `sjasmp-reset` interactive command.

The GUI should use the same settings keys and resolver that the compiler reads. Do not duplicate separate "GUI settings" that the compiler does not read.

Compatibility behavior:

- Existing users with only `sjasmp.root` continue to build.
- New GUI setup writes both `sjasmp.root` and `sjasmp.executablePath`.
- If project settings define SJASMPLUS, they override user settings.
- If validation fails, existing settings remain unchanged.

---

## 13. Testing Plan

Focused tests:

- Dialog registry includes `SJASMPLUS_INTEGRATION_DIALOG`.
- `IDE > Integrations` submenu contains `SJASMPLUS...`.
- SJASMPLUS dialog:
  - Defaults to user settings.
  - Disables project scope when no Klive project is loaded.
  - Shows effective user/project setting source.
  - Shows local-file/folder selection path.
  - Shows PATH suggestions when the service reports them.
  - Handles release-list loading, success, empty-compatible-assets, prerelease toggle, and error states.
  - Exposes `Test again` after a candidate path exists.
  - Calls apply only after successful validation.
- Main service:
  - Asset platform detection.
  - Executable path resolution with explicit path and folder fallback.
  - PATH suggestion detection.
  - Probe accepts a valid folder/executable.
  - Validation reports stdout/stderr on failure.
  - Version metadata is stored when available.
  - Settings are written to user or project scope correctly.
  - Failed validation does not mutate settings.

Manual checks:

- macOS: select existing `sjasmplus` executable, validate, save user settings, build a SJASMPLUS sample.
- No internet: release list fails, local selection still works.
- PATH detection: installed `sjasmplus` is offered as a suggestion and only saved after user confirmation and validation.
- Project scope: save project setting, confirm it overrides user setting.
- Failure: select a non-executable or incompatible binary and confirm the dialog reports a clear error without changing settings.
- Download path: download a compatible release into a chosen folder, confirm versioned folder layout, validate, save, and build.

Commands after implementation:

```sh
npm test -- --project jsdom <focused dialog/menu tests>
npm run build:check
npm run lint:renderer
npx electron-vite build --config build/electron.vite.config.ts
```

---

## 14. Implementation Slices

### Slice 1: Menu and Dialog Shell

- Add `SJASMPLUS_INTEGRATION_DIALOG`.
- Add `IDE > Integrations > SJASMPLUS...`.
- Add `SjasmplusIntegrationDialog`.
- Show current effective settings and scope.
- Add registry/menu smoke tests.

### Slice 2: Local Path Setup

- Add `SJASMP_EXECUTABLE_PATH` and `SJASMP_VERSION`.
- Add executable resolver.
- Update SJASMPLUS compiler command resolution.
- Add folder/file selection.
- Add validation probe.
- Add `Test again`.
- Save user/project settings after successful validation.
- Keep release download out of this slice.

This removes the largest pain immediately, even offline.

### Slice 3: PATH Suggestions

- Detect `sjasmplus` from `PATH`.
- Probe suggestions before presenting them.
- Let the user choose a suggestion and validate again before saving.

### Slice 4: Online Release Discovery

- Add release-list API.
- Add platform/architecture asset filtering.
- Add prerelease toggle.
- Add UI states for loading/error/no-compatible-assets.
- Show suggested release and advanced asset chooser.

### Slice 5: Download And Install

- Add streaming download.
- Add extraction/direct-executable install.
- Install into versioned folders.
- Add progress reporting if practical.
- Probe downloaded executable.
- Save settings after successful validation.

### Slice 6: Polish And Documentation

- Add docs page/update existing docs for SJASMPLUS GUI integration.
- Mention that `sjasmp-reset` remains available.
- Consider adding an `Open SJASMPLUS Integration` interactive command if useful.

