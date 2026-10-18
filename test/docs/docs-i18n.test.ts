/**
 * The website translation tool's page check (scripts/docs-i18n.cjs): a translated Get Started
 * page must keep its English original's structure - the code, the screenshots, the headings,
 * the links - and merge rewrites links into translated areas only.
 */
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { pageProblems, localizeLinks } = require("../../scripts/docs-i18n.cjs");

const EN = `---
description: "Start the machine."
---

# Meet the emulator

Press **Start**. See [the guide](/en/guides/emulator/keyboard/) and [next](/en/get-started/load-from-tape/).

<Shot src="get-started/emulator-off.webp" alt="The emulator" markers={["toolbar", "screen"]} width={620} />

\`\`\`z80klive fixture="x"
ld a,1 ; one
\`\`\`
`;

const DE = `---
description: "Die Maschine starten."
---

# Der Emulator

Drücke **Starten**. Siehe [die Anleitung](/en/guides/emulator/keyboard/) und [weiter](/en/get-started/load-from-tape/).

<Shot src="get-started/emulator-off.webp" alt="Der Emulator" markers={["toolbar", "screen"]} width={620} />

\`\`\`z80klive fixture="x"
ld a,1 ; one
\`\`\`
`;

describe("website translation checks", () => {
  it("accepts a translation that keeps the structure", () => {
    expect(pageProblems(EN, localizeLinks(DE, "de"), "de")).toEqual([]);
  });

  it("rewrites links into translated areas only", () => {
    const out = localizeLinks(DE, "de");
    expect(out).toContain("(/de/get-started/load-from-tape/)");
    expect(out).toContain("(/en/guides/emulator/keyboard/)");
  });

  it("rejects a changed code block", () => {
    const bad = DE.replace("; one", "; eins");
    expect(pageProblems(EN, localizeLinks(bad, "de"), "de")).toContain("code blocks differ from the English page");
  });

  it("rejects changed screenshot markers", () => {
    const bad = DE.replace('["toolbar", "screen"]', '["screen"]');
    expect(pageProblems(EN, localizeLinks(bad, "de"), "de")).toContain("<Shot> images or markers differ from the English page");
  });

  it("rejects a missing heading and a dropped link", () => {
    const bad = DE.replace("# Der Emulator\n", "").replace(" und [weiter](/en/get-started/load-from-tape/)", "");
    const problems = pageProblems(EN, localizeLinks(bad, "de"), "de");
    expect(problems).toContain("heading levels differ from the English page");
    expect(problems).toContain("links differ from the English page");
  });
});
