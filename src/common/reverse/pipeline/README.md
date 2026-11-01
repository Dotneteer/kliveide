# The ROM annotation pipeline

Deterministic tools around the AI's part of annotating a ROM: a **preprocessor** that turns the ROM, its
profile and its sidecar into routine cards and facts, and a **postprocessor** that compiles the AI's
`.ann` files into the sidecar. The plan, its decisions (D1-D11) and its phases are
`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md`; read it before changing anything here.

- `image/`: the image model (`binaryImage.ts`), the CPU flag (`cpu.ts`, D2) and the ROM-page adapter
  (`romImage.ts`).
- `listing.ts`: a bank listed through Klive's disassembler, with the image's CPU.
- `annFormat.ts`: the `.ann` grammar (its header comment is the reference), parse and write.
- `postprocess/`: `sidecarToAnn.ts` (export), `compile.ts` (the overlay onto a base sidecar),
  `regionKinds.ts`, `newSidecar.ts`. Every shipped sidecar must survive sidecar -> `.ann` -> sidecar byte for
  byte (`test/rom-pipeline/compile.test.ts`); a format change that breaks it loses data.
- `preprocess/`: `effects.ts` (each instruction's registers, memory, ports, stack), `decode.ts` (the
  code regions and hidden entries), `routines.ts` (entries, routines, call graph, D10 kinds),
  `registers.ts` (the register facts), `analyse.ts` (the stages in order) and `cards.ts` (the outputs).
- `profile/romPageProfile.ts`: a run cut into one page's profile. The recipes that make runs need cores,
  so they are test code: `test/rom-annotations/profileRecipes.ts`.
- `preprocess/proposals.ts`: region proposals from the walk, the run and the detectors (P4).
- `align/`: `carry.ts` (the signature re-anchoring, also behind `rom:annotations:carry`), `alignPages.ts`
  (instruction alignment, stretches, RAM map, routine status) and `carryPage.ts` (P6).
- `postprocess/textPass.ts`, `lint.ts`, `report.ts`: the text pass, the lint with the D10 checks, and the
  problem and feedback reports (P7).
- `conventions/`: the plug-in shape, the registry, and the Enterprise plug-in (P5). A plug-in names the
  source of every fact it adds (D4), and gets a `PROVENANCE.md` entry.

Rules:

- **Pure code only.** No `fs`, `process` or core instantiation here: `scripts/rom-pipeline.cjs` does the
  I/O, and the unit tests in `test/rom-pipeline/` run these functions directly.
- **The CPU comes from the image**, never from a ROM kind or a machine inside a stage.
- **Only the ROM's bytes, Klive's own runs and Klive's own data** are analysed (the provenance rule, D4;
  `.ai/rom-annotations/README.md`).
- Import from the file that owns a function; there is no barrel file.
