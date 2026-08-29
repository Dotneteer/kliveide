# Hotfix 0.57.2: Issue #1264 New Project Problem

Branch: `codex/hotfix-0.57.2-issue-1264`
Base release tag: `v0.57.1`
Target version: `0.57.2`
Issue: https://github.com/Dotneteer/kliveide/issues/1264

## Issue Summary

Klive IDE 0.57.1 on Windows 11 reports two New Project dialog problems:

- Changing the `Machine Type` dropdown appears to reset the visible selection to `ZX Spectrum 48k`, although the clicked machine seems to be used internally.
- The project template dropdown appears to show the same kind of visible-selection problem.
- The user also reports that there is no `128k` + `SJASMPLUS` project template.
- Follow-up manual testing found that the new 128K SJASMPLUS sample still ran through the 48K mode because SJASMPLUS compiler output always reported `Spectrum48`.

## Execution Plan

1. Create the hotfix branch from the `v0.57.1` release tag and bump the app version to `0.57.2`.
2. Perform a pre-fix manual check:
   - Start the app from this hotfix branch.
   - Open `File > New Project`.
   - Change `Machine Type` through several options and observe whether the visible dropdown label matches the chosen item.
   - Change `Project Template` through several options and observe whether the visible dropdown label matches the chosen item.
   - Check whether a ZX Spectrum 128K SJASMPLUS template is available.
3. Inspect the New Project dialog implementation and the project template metadata.
4. Add or adjust focused automated tests around the failing behavior where practical.
5. Implement the smallest fix that keeps the selected machine/template visible and persists the intended choice.
6. Add the missing ZX Spectrum 128K SJASMPLUS template if confirmed absent from the 0.57.1 release branch.
7. Run focused tests for the touched area, then run:
   - `npm run build:check`
   - `npm run lint:renderer` if renderer React code was touched
   - `npx electron-vite build --config build/electron.vite.config.ts`
8. Perform a post-fix manual check:
   - Repeat the New Project dialog checks from step 2.
   - Create projects with non-default machine/template selections and confirm the generated project matches the visible selections.
   - Confirm the ZX Spectrum 128K SJASMPLUS template appears and creates the expected files.
9. Commit the hotfix branch and push it.
10. Open a PR from `codex/hotfix-0.57.2-issue-1264` for the `0.57.2` hotfix.
11. After the hotfix PR is merged/released, merge the same fix back to `master` and run the relevant checks there.

## Progress

- [x] Hotfix branch created from `v0.57.1`.
- [x] Version bumped to `0.57.2`.
- [x] Plan saved on the hotfix branch.
- [x] Pre-fix manual check completed.
- [x] Fix implemented, including SJASMPLUS model-type inference and the 128K SJASMPLUS sample.
- [x] Automated checks completed.
- [x] Post-fix manual check completed.
- [x] Hotfix commit created and pushed.
- [ ] PR opened.
- [ ] Fix merged back to `master`.
