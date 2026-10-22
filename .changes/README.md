# Changesets

Every user-visible change is recorded here as one small Markdown file, a **changeset**. Nobody
edits `CHANGELOG.md` during development: the release (`npm run release:prepare`) turns the pending
changesets into the next CHANGELOG section, works out the version from them, and deletes them.

The design is `.plans/RELEASE_AUTOMATION_PLAN.md`; the release procedure is
`.ai/release-guide.md`; how to write a good entry is `.ai/changesets-guide.md`.

## Creating one

```bash
npm run change
```

asks for each field. Without questions (scripts, AI assistants):

```bash
npm run change -- --type fix --issue 1417 --text "Assembler: a bare \`.dma wr3\` followed by another line failed."
```

Options: `--type`, `--issue` (repeatable, or comma-separated), `--text`, `--highlight "<one line>"`,
`--key` / `--key "<one line>"` (fixes only), `--bump major|minor|patch`, `--slug <file-name words>`.
The command prints the file's path, its **kind** (minor, patch or none) and its content.
`npm run change -- --show .changes/<file>.md` prints the same for an existing file, for example after
editing it by hand. Editing a changeset by hand is fine; `npm run change:check` validates it.

## The format

```markdown
---
type: feature          # feature | fix | breaking | known-issue | internal
issues: [1417]         # optional; appended as "(#1417)" unless the text already names it
bump: minor            # optional; only to force a higher bump than the type implies
highlight: "**Thing**, in one line."   # optional; proposed for the release's Highlights
key: true              # optional, fixes only: true moves the entry into "Key fixes";
                       # a quoted string puts that summary in Key fixes, the entry stays in Fixes
---

**Copper and DMA regions in `.NEX` annotations:** mark a range of a popped-out bank as a Copper
list or a zxnDMA program, and the listing shows it as `.copper` / `.dma` pragmas.
```

The body is the CHANGELOG entry without the leading `- `; continuation lines are indented for you.
A body that already starts with `- ` is taken as a ready-made list of entries. No headings, and no
inline code span split across two lines.

| type | kind (version bump) | CHANGELOG section |
|---|---|---|
| `feature` | minor | Features |
| `fix` | patch | Fixes (or Key fixes with `key`) |
| `breaking` | minor while Klive is 0.x, major after 1.0 | Breaking changes |
| `known-issue` | none | Known issues |
| `internal` | none | none — satisfies the PR check for a change users cannot see |

The release's version is the highest kind among the pending changesets applied to the last release.
Sections appear in the order Highlights, Key fixes, Breaking changes, Features, Fixes, Known issues;
within one, entries follow the order the changesets were added to git.

## Commands

| Command | |
|---|---|
| `npm run change` | create one |
| `npm run change:check` | validate all (part of `npm run build:check`) |
| `npm run change:status` | list them with their kinds, and the next version |
| `npm run change:preview` | the CHANGELOG section the next release would get |

## The PR check

`.github/workflows/changeset-check.yml` fails a PR that changes files outside `docs/`, `.plans/`,
`.ai/`, `.docs/`, `.github/`, `test/`, `_input/` (reference material) and root `*.md` files
without adding or editing a changeset.
Dependabot PRs, release PRs (`release/v*`) and PRs with the `no-changeset` label pass.
