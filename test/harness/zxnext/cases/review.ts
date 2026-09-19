import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import type { LoadedCase } from "./case";
import type { CaseResult } from "./run-case";

/** What an AI (or human) reviewer writes next to `review.md`. */
export type Verdict = {
  verdict: "pass" | "fail" | "unsure";
  reviewer: string;
  /** What the reviewer saw, in its own words, before comparing (guards against confirmation). */
  observations: string[];
  discrepancies: Array<{ image: string; region: string; description: string }>;
  reviewedImages: string[];
  reviewedAt: string;
};

export const VERDICT_FILE = "verdict.json";

const statusMark: Record<string, string> = { pass: "PASS", fail: "FAIL", xfail: "XFAIL (known)", xpass: "XPASS (known failure now passes!)" };

/**
 * Writes `review.md`: everything a reviewer needs to judge the case from the images, and the
 * contract for the verdict it must write back.
 *
 * The rubric puts *describe* before *compare* on purpose. A reviewer handed the expectation first
 * tends to find it; one that first writes down what is on screen can be checked against its own
 * description.
 */
export function writeReviewPrompt(loaded: LoadedCase, result: CaseResult): string {
  const rel = (p: string) => relative(result.outDir, p);
  const lines: string[] = [];
  lines.push(`# Visual review: ${result.id} - ${result.title}`, "");
  lines.push(`Case folder: \`${loaded.dir}\``, `Run folder: \`${result.outDir}\``, "");
  lines.push("## Images to review", "");
  for (const img of result.images) lines.push(`- \`${img}\``);
  lines.push(
    "",
    "Frames are native resolution: 720x288, one PNG pixel per emulator pixel. The Next doubles",
    "horizontal resolution, so a 256x192 ULA paper area is 512x192 here (x 96-607, y 48-239).",
    ""
  );
  lines.push("## Rubric", "");
  lines.push(
    "1. **Describe first.** Before reading the expectation, open each image and write down what you see:",
    "   regions, colours, band/edge positions (use the `rows-*.json` files for exact rows and columns).",
    "2. **Compare** your description with the expectation below.",
    "3. **Look beyond the probes.** Probes check only the regions they name. Look for anything else:",
    "   stray pixels, wrong areas, tearing, off-by-one edges, a band in the wrong order.",
    "4. **Decide** `pass`, `fail` or `unsure`, and say why. Name the image, region (coordinates) and",
    "   what is wrong for every discrepancy.",
    ""
  );
  lines.push("## Expectation (expect.md)", "", loaded.expectMd.trim(), "");
  lines.push("## Automated oracle results", "");
  for (const c of result.checks) {
    const who = [c.oracle, c.name].filter(Boolean).join(" / ");
    lines.push(`- **${statusMark[c.status]}** ${who}: ${c.detail}${c.knownReason ? ` _(known: ${c.knownReason})_` : ""}`);
  }
  lines.push(`- golden: ${result.golden.state}${result.golden.changes.length ? ` - ${result.golden.changes.join("; ")}` : ""}`);
  lines.push("", "Test-only loader state that differs from a real `.nexload`:");
  for (const d of result.directLoadDifferences) lines.push(`- ${d}`);
  lines.push("", "## Verdict", "");
  lines.push(
    `Write \`${join(result.outDir, VERDICT_FILE)}\` as JSON:`,
    "",
    "```json",
    JSON.stringify(
      {
        verdict: "pass | fail | unsure",
        reviewer: "claude-code",
        observations: ["what the images show, written before comparing"],
        discrepancies: [{ image: "wasm/frame-00050.png", region: "x 96-607, y 72-95", description: "..." }],
        reviewedImages: result.images.map(rel),
        reviewedAt: "ISO timestamp"
      },
      null,
      2
    ),
    "```",
    "",
    "The verdict is about the **picture against the hardware expectation**, not about the probes: a case",
    "whose probes pass can still fail review, and a known (XFAIL) emulator bug is still a `fail`."
  );
  const path = join(result.outDir, "review.md");
  writeFileSync(path, lines.join("\n") + "\n");
  return path;
}

export function readVerdict(outDir: string): Verdict | undefined {
  const p = join(outDir, VERDICT_FILE);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as Verdict) : undefined;
}
