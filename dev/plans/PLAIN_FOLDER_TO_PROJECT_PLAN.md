# Plain Folder to Klive Project Plan

**Status: done (2026-11-16).** All phases are implemented; §7 is the as-built record, including what was not checked and what is left to the next translation round. Fixes issue #1641 and adds a way to turn a folder made
with another tool into a Klive project, plus a Get Started article that explains how Klive handles
projects.

## 1. The problem (issue #1641)

A Boriel BASIC folder created with another IDE has no `klive.project`. Opening it shows **Promote to
Build Root** disabled; switching to another folder and back makes it available.

Root cause, confirmed in the code:

| Step | Where | What happens |
|---|---|---|
| Open | `openFolderByPath`, `src/main/projects.ts` | No valid `klive.project` (`kliveVersion` and `machineType`), so `openFolderAction(folder, false)`: `isKliveProject` is false. |
| Menu | `ExplorerContextMenu.tsx` | **Promote to Build Root** is shown for `.bas`/`.zxbas` (`zxBasLanguageProvider.allowBuildRoot`) but `disabled={!isKliveProject}`. Correct for a plain folder. |
| Silent write | `saveKliveProject`, `src/main/projects.ts` | Checks only `folderPath`, not `isKliveProject`. Any `saveProject()` (e.g. `useDocumentWorkspacePersistence` once the workspace loads, watches, breakpoints, settings) writes a full `klive.project` into the plain folder. **The bug.** |
| Reopen | `openFolderByPath` | Finds the file Klive wrote and treats the folder as a project. |

So a plain folder is in an ambiguous state: treated as "not a project" but changed into one behind
the user's back. The fix makes the user choose.

## 2. What exists today

| Part | Where | Notes |
|---|---|---|
| Folder open | `openFolderByPath` (`src/main/projects.ts`) | Called from `openFolder` (File › Open Folder, the Explorer's **Open Folder** via `mainApi.openFolder()`), the File › Open Recent items (`menus/file-menu.ts`), `RendererToMainProcessor.openFolder` (IDE startup reopen in `useIdeStartup.ts`, `OpenFolderCommand`, the New Project dialog and `NewProjectCommand` after creation), and automation (`automation-controller.ts`, `handlers/project.ts`). |
| Project creation | `createKliveProject` (`src/main/projects.ts`) | Copies `public/project-templates/<machine>/<template>/` with `copyFolderSync` (skips `__$*` files, **overwrites silently**), reads `__$klive.project` as a merge file, writes `klive.project`. Refuses an existing folder. |
| New Project dialog | `src/renderer/appIde/dialogs/newProject/` | MVC (Model/Controller/View/Ports/Intents/ViewModel): machine, model, template, folder, name. |
| Build-root candidates | `project-node.ts` (`canBeBuildRoot`) | Computed in the renderer from `fileTypeRegistry` and `customLanguagesRegistry`. |
| Templates | `src/public/project-templates/` | `sp48` and `zxnext` have `default`, `zx-basic`, `z88-dk`, (`sjasmplus`, `pasta-80` for sp48); each has `build.ksx`, `code/` or a main file, and `__$klive.project`. |
| App settings | `src/main/settings.ts` | `folders`, `recentProjects`, ... - where Klive remembers per-user facts. |
| CLI hint | `src/cli/project.ts:79` | Tells the user to use Explorer › Promote to Build Root. |

## 3. Behaviour (the specification)

### 3.1 Plain folders are never changed silently

`saveKliveProject` does nothing unless `project.isKliveProject` is true. Nothing else writes into a
plain folder without the user asking (New File, Rename and so on still do, because the user asked).

Consequence: a plain folder no longer remembers its open documents, breakpoints and watches between
sessions (they only ever survived because of the silent write). See Q4.

### 3.2 The offer when a plain folder opens

When a folder without a valid `klive.project` is opened **interactively** (File › Open Folder, the
Explorer's **Open Folder**, File › Open Recent, the IDE's `open` command) or **reopened at startup**
as the last folder (Q2, revised), the IDE shows the
**Make this folder a Klive project?** dialog after the folder is open and the Explorer is populated.

It is not shown:

- by automation and the CLI (they get the plain folder, as now);
- after New Project (the folder is already a project);
- for a folder the user already answered **Keep as a plain folder** (remembered per folder in app
  settings, `plainFolders: string[]`, never in the folder itself; Q3).

### 3.3 The dialog

One dialog, MVC like `newProject/` (read `dev/ai/ui-mvc-guide.md`), reusing the New Project model's
machine/model/template parts rather than copying them.

| Field | Behaviour |
|---|---|
| Choice | **Keep as a plain folder** / **Make it a Klive project**. The rest is enabled only for the second. |
| Machine, model | Default: the machine and model running now. Only machine types with templates are offered (Q7). |
| Template | Required (Q7): the machine's templates, no "None". `zx-basic` when the folder holds `.bas`/`.zxbas` files and the machine has it (Q5), otherwise `default`, otherwise the first. |
| Build root | **The template's build root**, then the folder's build-root candidates (same rule as `canBeBuildRoot`). The pick overrides the template's `builder.roots`. |
| Conflicts | Shown only when the chosen template would write a file that exists: one row per file with a checkbox **Overwrite**, unticked by default. Unticked files are skipped. `klive.project` itself never appears (it does not exist, by definition). |

Buttons: **OK** and **Cancel**. Cancel leaves the folder open as a plain folder and does *not*
remember it (the offer comes back next time). **Keep as a plain folder** + OK remembers it.

### 3.4 Converting

1. Main computes the template's file list (`copyFolderSync`'s rules: skip `__$*`) and returns the
   conflicts before anything is written (a dry run), so the dialog can show them.
2. On OK, main copies the template files except the conflicting ones the user did not tick, merges
   `__$klive.project`, sets machine/model/config and the chosen build root, writes `klive.project`.
   Done in one call; on an error nothing further is written and the error is shown.
3. The folder is reopened through `openFolderByPath` so every part of the load (machine switch,
   build file, watchers, state) runs exactly as for a project. Nothing is dirty at this point; if
   `saveAllIdeRenderersBeforeQuit` still refuses, the conversion stands and the user is told to reopen.
4. The folder is removed from `plainFolders` if it was there.

### 3.5 Converting later

- **Make Klive Project...** on the Explorer root's context menu, shown only for a plain folder, and
  **File › Make Klive Project...**. Both open the same dialog with **Make it a Klive project**
  selected.
- A disabled **Promote to Build Root** in a plain folder gets a tooltip saying the folder is not a
  Klive project and naming **Make Klive Project...** (Q6).
- `src/cli/project.ts`'s hint names the new command as well.

### 3.6 Text and changeset

- Every new text through `t()` with English entries and translator context in
  `src/common/i18n/locales/en/` (`dev/ai/i18n-guide.md`), then `npm run i18n:keys`.
- One `feature` changeset with `--issue 1641`, written when the plan completes (not per phase).

## 4. Get Started article: "How Klive handles projects"

A new page, `docs/content/en/get-started/how-projects-work.mdx`, titled **How Klive handles projects**.
Position: right after **Meet the IDE** (Q1, decided), as chapter 5 (§7, P5); `meet-the-ide.mdx`'s "You will create a project on the
next page" moves to the new page's end.

Follows the page standard in `dev/ai/docs-site.md` (front-matter `description`, short lead, task
sections, *Related*). Outline:

1. **A folder and a project.** A Klive project is a folder with a `klive.project` file; anything else
   is a plain folder. Klive opens both.
2. **What a project adds.** A short table: plain folder vs project (build root and build bar,
   `build.ksx`, saved machine and model, breakpoints and watches, Exclude, unit tests, `SavedFiles`).
   Every row checked against the code, not from memory.
3. **Creating a project.** File › New Project..., templates in one sentence each, link to the guides.
4. **Opening a folder from another tool.** The dialog of §3.3: keep or convert, the template choice,
   the build root, the overwrite list; converting later with **Make Klive Project...**.
5. **The files Klive maintains.** `klive.project` (do not edit while open), `build.ksx`.
6. **Related:** Creating a project, Project templates, Project Explorer, Build system.

Rules that apply:

- **R4/screenshots:** one or two shots generated by a recipe (`dev/scripts/doc-shots/`, read
  `dev/ai/doc-screenshots-guide.md`): the conversion dialog with a fixture plain folder of `.bas`
  files. Add the image to `dev/plans/docs-assets.golden.txt`.
- **R2/translation:** Get Started is translated. The page goes to every site language through
  `npm run doc:i18n:todo -- <lang>` / `doc:i18n:merge`, never by hand; the `_meta.ts` titles too.
- **R6:** the page describes the dialog, so it is published with the release that ships it.
- Route goldens (`docs/goldens/`) are updated for the new route; `doc:check:prose` must pass.

Guides to update in the same change:

- `guides/projects/creating-projects.mdx` ("A folder without a valid `klive.project` file opens too,
  but as a plain folder": now say what Klive offers), a section on converting a folder.
- `guides/projects/project-explorer.mdx`: the new root menu item, and Promote to Build Root's tooltip.
- `guides/projects/project-templates.mdx`: templates applied to an existing folder and the overwrite list.

## 5. Phases

| Phase | Content | Tests |
|---|---|---|
| P1 (done) | §3.1: `saveKliveProject` guard. | Unit test: no file written for a plain folder; written for a project. |
| P2 (done) | Main: `convertFolderToProject` (dry run + apply) refactored out of `createKliveProject` so both share template copying and the merge; `copyFolderSync` gains a skip list; MainApi messages. | Unit tests on a temp folder: conflicts reported, unticked files kept, ticked overwritten, `__$*` skipped, build root written, `createKliveProject` output unchanged. |
| P3 (done) | Dialog (MVC), `plainFolders` setting, the interactive-open trigger (§3.2), reopen after converting. | Model/controller tests without rendering; a check that automation does not show it and the startup reopen does (Q2). |
| P4 (done) | §3.5: Explorer root item, File menu item, tooltip, CLI hint. | Context-menu test. |
| P5 (done) | Docs: §4 article, guide updates, recipe, translations, goldens. | `npm run doc:build && npm run doc:check`. |
| P6 (done) | Changeset, `npm run build:check`, `npm run lint:renderer`, `npm run test:fast`; check by hand with a real Boriel folder (the reporter's case). | |

## 6. Decisions (settled by the project author, 2026-11-16)

- **Q1** The article goes right after **Meet the IDE**: it explains what the reader creates next.
- **Q2** (revised after review, 2026-11-16) The startup reopen of a plain folder shows the dialog,
  like an open from the menu. The first build left it out ("the user opened it last time"); the
  author wants the same behaviour however the folder opens. A folder kept plain is still not asked
  about (Q3).
- **Q3** "Keep as a plain folder" is remembered per folder in app settings (`plainFolders`), never in
  the folder.
- **Q4** Plain folders do not remember open documents, breakpoints and watches between sessions;
  accepted. They only ever survived through the silent write.
- **Q5** `zx-basic` is preselected when the folder holds `.bas`/`.zxbas` files and the machine has
  that template; otherwise the machine's `default` template (Q7).
- **Q6** A disabled **Promote to Build Root** in a plain folder gets a tooltip naming
  **Make Klive Project...**; the item itself stays disabled.
- **Q7** (added after review, 2026-11-16) **A template is required; there is no "None".** The first
  build offered "None (project file only)" as the default, which made a project without `build.ksx`:
  its build bar reported "no build file" and it had no Build menu. Found when an HT-1080Z folder
  converted on "None" came out without `build.ksx`. The template list holds only the machine's
  templates, machine types without templates (the C64) are not offered, and
  `convertFolderToProject` refuses a request without `templateId`. A folder's own `build.ksx` is
  still kept unless its conflict box is ticked.

## 7. As built

**P1.** `saveKliveProject` returns early unless `project.isKliveProject`; an invalid `klive.project`
in a plain folder is left as it is. Tests: `test/main/save-klive-project.test.ts`.

**P2.**

- `src/main/project-template.ts` (fs and path only): `listTemplateFiles`, `findTemplateConflicts`,
  `copyTemplate(template, target, overwrite | "all")`, `readTemplateMerge`. `__$*` entries are skipped
  at every level. A conflict is `canOverwrite: false` when a folder sits where the template has a
  file, or a file where it needs a folder; such a file is never written, not even with `"all"`.
  `copyFolderSync`/`copyFileSync` are gone; `createKliveProject` uses `copyTemplate(..., "all")` and
  shares `writeNewProjectFile` with the conversion.
- `src/main/projects.ts`: `getProjectConversionConflicts(folder, machineId, templateId?)` and
  `convertFolderToProject(options)`. Everything is validated before anything is written: the folder
  must be the open one (the project file is built from the IDE's state, which belongs to it) and not
  a project; a template is given (Q7) and exists; template and machine names may not leave the templates folder;
  the build root must be a relative path inside the folder naming an existing file or one the
  template writes. A chosen build root replaces the template's. An invalid `klive.project` already in
  the folder is replaced. The function does not reopen the folder: the dialog (P3) calls
  `openFolder(folder)` afterwards.
- Types shared with the renderer: `src/common/structs/project-conversion.ts`. MainApi:
  `getProjectConversionConflicts`, `convertFolderToProject`.
- Tests: `test/main/project-template.test.ts`, `test/main/projects-convert.test.ts`; the existing
  `projects-create.test.ts` pins `createKliveProject`'s output.
- Seen, not changed: `createKliveProject` builds the new project file from the IDE's current state,
  so a project created while another project is open inherits that project's excluded items,
  project settings and workspace settings. Out of scope here; worth its own issue.

**P3.**

- Main: `openFolderByPath(folder, { offerConversion })`. The picker (`openFolder`), File › Open Recent,
  the `open` command (`MainApi.openFolder(folder, true)`) and the IDE's startup reopen
  (`useIdeStartup.ts`, Q2 revised) pass it; New Project,
  automation and the CLI do not. A plain folder that loaded without an error and is not in
  `appSettings.plainFolders` gets `displayDialog(MAKE_PROJECT_DIALOG, { folder, offer: true })`, not
  awaited. `src/main/plain-folders.ts` keeps the list (resolved, forward slashes, case-insensitive
  off Linux); `convertFolderToProject` forgets the folder; `MainApi.rememberPlainFolder` adds it.
- The dialog: `src/renderer/appIde/dialogs/makeProject/` (MVC, `MAKE_PROJECT_DIALOG = 12`), reusing
  New Project's machine/model rules (`machineTypeOptionsOf`, `modelOptionsOf` now take `Pick`s).
  Only the machine types with templates are offered (Q7; the same lookup as New Project's), and the
  dialog moves off a running machine without any. The build-root candidates
  come from the Explorer's tree (`buildRootCandidates.ts`, the `canBeBuildRoot` rule) once it is the
  folder's; root files first, the first one preselected (the folder's own program, not the
  template's sample). `DEFAULT_BUILD_ROOT` is a non-empty sentinel: Radix `Select` throws on an empty
  item value; `NO_TEMPLATE` is `""`, never an item, only "not known yet", and OK stays disabled while
  it is selected. The template's conflicts reload whenever the template or the machine
  changes (`LatestRun`); a failed lookup leaves nothing tickable, which is safe because only ticked
  files are replaced. Keep remembers the folder; Cancel does not. Make converts, reopens the folder
  with `openFolder(folder, false)`, waits for tree, workspace and build roots, and opens the build
  root; every step has a 30 s budget and a failure keeps the dialog open.
- Tests: `test/dialogs/makeProject/` (model, view model, controller, view, candidates),
  `test/main/open-folder-by-path.test.ts` (the offer), `test/main/plain-folders.test.ts`.

**P4.** File › **Make Klive Project...** (`make_project`, enabled only while a plain folder is open),
the Explorer root's **Make Klive Project...** (plain folders only), `ContextMenuItem.title` (a native
tooltip that a disabled row keeps) on Promote to Build Root in a plain folder, and the CLI's "No
Klive project" error names the menu item. Tests: `app-menu-structure`, `ExplorerContextMenu`,
`AppShellStartup` (the dialog id), `IPCCommands` (`open` offers).

**P5.**

- `get-started/how-projects-work.mdx` is **chapter 5**: the Get Started index numbers its cards and
  every figure carries its chapter, so chapters 5-10 became 6-11 and their figures moved up by one
  (in English). Meet the IDE now leads to the new page.
- Guides: `creating-projects.mdx` (a "Make a folder a Klive project" section in `<Steps>`),
  `project-explorer.mdx` (the root item, the tooltip), `project-templates.mdx` (a template on an
  existing folder); `reference/commands.mdx` (`open`).
- Screenshot: the Get Started recipe's `projects` section (`GS_ONLY=projects`) opens a plain BASIC
  folder under `~/KliveProjects` and photographs the dialog (`get-started/make-project.webp`, three
  markers); English only so far. Goldens: the route and the two image files.
- **Translations are left to the next translation round** (AGENTS.md: no translations in a feature
  change; R2), for the app's new texts and for the docs: `doc:i18n:todo` lists eight Get Started
  pages per language (the new one, the index, Meet the IDE and the five renumbered pages). Until then
  each translated site keeps its old numbering, without the new page, and shows its "out of date"
  notice on the changed ones. The localized screenshots of the new page come with them
  (`--lang all`).

**P6.** Changeset `dev/changes/make-folder-klive-project-opening-67f7.md` (feature, #1641). Checked
in the running app (a scratch Playwright script on the doc-shots harness, not committed): the offer
after `open`, `zx-basic` and `main.bas` preselected, a conflicting `build.ksx` listed unticked and
kept, `klive.project` written with machine and build root, the folder reopened as a project with
`main.bas` its build root; Keep writes nothing, is remembered and stops the offer; Promote is
disabled with its tooltip; the root item opens the dialog. **Not checked in the app:** the File
menu item and Open Recent (unit-tested only: a scripted instance's application menu is unreliable),
Windows and Linux, and building a converted Boriel folder (no Boriel kit in the check).
