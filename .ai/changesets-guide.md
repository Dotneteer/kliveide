# Changesets — a guide for AI assistants

The rules are in `AGENTS.md` ("Changesets"); the format is in `.changes/README.md`. This file is
the judgement that goes with them.

## When a commit gets a changeset

| Situation | Changeset? |
|---|---|
| The user asks for a commit, and it fixes a bug or adds/changes something users can see | **yes** |
| The commit finishes a plan (its last open phase/step, or the whole plan at once) | **yes**, describing the plan's result as a whole |
| The commit completes only some steps or phases of a longer plan | **no** — say in one line that it is deferred to the commit that completes the plan |
| A later commit on the same branch extends or corrects the same change | **edit** the existing changeset, do not add a second one |
| Refactor, tests, build, CI, docs-site or plan-only work with no user-visible effect | **ask** (offer `internal` or none) |
| Unclear whether this completes the plan or only a step of it | **ask** |
| Unclear whether it is a `fix` or a `feature` (it changes the kind: patch vs minor) | **ask** |

"Ask" means: before committing, put the choice to the user — the options you see (for example
*feature*, *fix*, *internal*, *no changeset*) with your recommendation first — and wait for the
answer. Do not commit and ask afterwards.

A plan counts as complete when every phase it lists is done (its status line says so, or the
user says so). When a plan is completed over several commits, the changeset written at the end
should read as if the whole feature landed at once; the intermediate commits are invisible to
users.

## Showing it

Every time you create or edit a changeset, show the user, in your message:

````markdown
Changeset `.changes/<file>.md` — **minor** (feature, #1468)

```markdown
<the whole file>
```
````

`npm run change` prints exactly this; after a hand edit run `npm run change -- --show <file>`.
The kind is what the change does to the version: **minor** for a feature (and for a breaking
change while Klive is 0.x), **patch** for a fix, *none* for `internal` and `known-issue`.

## Writing the entry

Write in the CHANGELOG's voice — look at a recent section of `CHANGELOG.md` first.

- **Features** start with a bold lead-in naming the feature, then say what the user can now do:
  `**Copper and DMA regions in \`.NEX\` annotations:** mark a range of a popped-out bank as ...`
- **Fixes** name the area, then describe what was wrong as a full sentence in the past tense, and,
  when it is not obvious, what happens now:
  `Assembler: a bare \`.dma wr3\` followed by another line failed with "An expression expected".`
- Write for users, not for reviewers: no file names, function names or test names unless the user
  types them (a pragma, a command, a setting). "The NEX is now named after the project folder" —
  not "fixed `getNexName()` in `nexExport.ts`".
- One change per changeset. Two unrelated fixes in one commit get two files.
- Wrap at about 100 columns, as the CHANGELOG does. Keep each inline code span on one line.
- `issues:` takes GitHub issue or PR numbers; they render as `(#1417)`.
- `highlight:` is for changes worth a line at the top of the release notes; `key: true` for fixes
  users have been waiting for. The author edits Highlights in the release PR anyway, so propose,
  don't agonize.

## Things that go wrong

- Editing `CHANGELOG.md` directly. `## Unreleased` no longer exists; `release:prepare` refuses a
  CHANGELOG that has one.
- A changeset for every commit of a multi-commit plan — the CHANGELOG then lists the plan's
  steps instead of its result.
- Forgetting to show the changeset and its kind to the user.
