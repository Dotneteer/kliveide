# Get Started fixture programs

The programs the Get Started pages ask the reader to type (`docs/content/en/get-started/`). They are:

- the source the screenshot recipes open (`scripts/doc-shots/recipes/get-started*.cjs`), and
- built by `test/docs/get-started-fixtures.test.ts`, so a tutorial whose code stops assembling
  fails CI rather than a reader (R5 of `.plans/DOCS_SITE_MODERNIZATION_PLAN.md`).

| Folder | Page | Language |
|---|---|---|
| `border-colours/` | Your first assembly program, Debug your program | Klive Z80 assembly (48K) |
| `bouncing-ball/` | Your first BASIC program | Klive BASIC (48K) |
| `next-sprite/` | Your first ZX Spectrum Next program | Klive Z80 assembly (Next) |

Each folder holds the `code/` file that replaces the project template's, so the file names match
what the reader sees in the Project Explorer. When you change a program here, change the code block
on its page too: the page shows the program, the fixture is the copy that is tested.
