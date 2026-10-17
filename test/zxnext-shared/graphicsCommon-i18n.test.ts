import { afterEach, describe, expect, it } from "vitest";

import { setLanguage } from "@common/i18n/i18n";
import { GRAPHICS_PRESETS } from "@common/reverse/graphicsDecode";
import { findGraphicCandidates } from "@common/reverse/graphicsCandidates";
import { layer2Diagnostics } from "@common/zxnext/layer2/layer2Diagnostics";
import { tilemapMode, decodeMap } from "@common/zxnext/tilemap/tilemapDecode";
import { tilemapDiagnostics } from "@common/zxnext/tilemap/tilemapDiagnostics";
import {
  BLEND_SOURCE_NAMES,
  describeBlend,
  describeLayerDebug,
  PRIORITY_NAMES,
  WHY_TEXT
} from "@common/zxnext/layers/layerMix";
import { describeLayerView, parseLayersCommand } from "@common/zxnext/layers/layerView";
import { l2regs } from "./layer2Fixtures";
import { emptyBanks, regs } from "./tilemapFixtures";

/*
 * The shared graphics texts in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md` steps 11-13): every
 * text is pseudo text, and the ones computed before the switch follow it (keys at definition, text at
 * display, D7). Hardware names (`SLU`, `ULA`, `$12 = $13`) are the deliberate exceptions.
 */
const isPseudo = (text: string | undefined) => !!text && /^\[.*~+\]$/s.test(text);

afterEach(() => setLanguage("en"));

describe("the shared graphics texts in the pseudo-locale", () => {
  it("translates the diagnostics computed before the switch", () => {
    const l2 = layer2Diagnostics({ regs: l2regs({ enabled: false, activeBank: 110 }) });
    const r = regs({ enabled: false, control: 0x02, defMsb: 0x1c });
    const mode = tilemapMode(r);
    const tm = tilemapDiagnostics(mode, r, decodeMap(mode, r, emptyBanks()));
    expect(l2.length).toBeGreaterThan(0);
    expect(tm.length).toBeGreaterThan(0);

    setLanguage("qps");
    for (const d of [...l2, ...tm]) {
      expect(isPseudo(d.chip), d.chip).toBe(true);
      expect(isPseudo(d.sentence), d.sentence).toBe(true);
    }
  });

  it("translates the tables, the candidates and the layer messages", () => {
    const bytes = new Uint8Array(0x100);
    bytes[0x60] = 0x18;
    const candidates = findGraphicCandidates({ bytes, base: 0xff00 });
    expect(candidates.map((c) => c.kind)).toEqual(["udg"]);
    setLanguage("qps");
    for (const preset of GRAPHICS_PRESETS) expect(isPseudo(preset.label), preset.label).toBe(true);
    for (const c of candidates) expect(isPseudo(c.description), c.description).toBe(true);
    for (const why of WHY_TEXT) expect(isPseudo(why), why).toBe(true);
    expect(isPseudo(PRIORITY_NAMES[6])).toBe(true);
    expect(PRIORITY_NAMES[0]).toBe("SLU");
    expect(isPseudo(BLEND_SOURCE_NAMES[1])).toBe(true);
    expect(BLEND_SOURCE_NAMES[0]).toBe("ULA");
    expect(isPseudo(describeBlend(6, 0))).toBe(true);
    expect(isPseudo(describeLayerDebug({ hidden: 3, solo: 0, showTransparent: true }))).toBe(true);
    for (const line of describeLayerView(undefined)) expect(isPseudo(line), line).toBe(true);
    expect(isPseudo(parseLayersCommand("copper") as string)).toBe(true);
  });
});
