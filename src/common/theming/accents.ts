/**
 * The accent registry — ids and display labels.
 *
 * This lives in `common/` because both processes need it: the renderer builds colour ramps from
 * these ids (`renderer/theming/tokens/palette.ts`), and the main process builds the View -> Accent
 * menu from the labels (`main/app-menu.ts`). The colour values themselves stay in the renderer,
 * since the main process has no use for them.
 *
 * The accent is a user setting orthogonal to the light/dark tone: any accent pairs with either
 * theme. See §5 of .plans/UI_MODERNIZATION_PLAN.md.
 */

export const ACCENT_IDS = [
  "sinclairBlue",
  "spectrumMagenta",
  "ember",
  "ultraviolet",
  "deepTeal",
  "phosphorGreen"
] as const;

export type AccentId = (typeof ACCENT_IDS)[number];

export const DEFAULT_ACCENT: AccentId = "sinclairBlue";

/** Menu order: the default first, then the rest as offered in the plan. */
export const ACCENT_MENU_ITEMS: { id: AccentId; label: string }[] = [
  { id: "sinclairBlue", label: "Sinclair Blue" },
  { id: "spectrumMagenta", label: "Spectrum Magenta" },
  { id: "ember", label: "Ember" },
  { id: "ultraviolet", label: "Ultraviolet" },
  { id: "deepTeal", label: "Deep Teal" },
  { id: "phosphorGreen", label: "Phosphor Green" }
];

export function isAccentId(value: unknown): value is AccentId {
  return typeof value === "string" && (ACCENT_IDS as readonly string[]).includes(value);
}
