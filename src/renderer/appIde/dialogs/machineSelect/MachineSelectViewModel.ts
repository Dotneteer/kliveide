/*
 * Everything the Select Machine view shows, derived from the state and the registry. Pure: no React.
 */
import type { MachineInfo } from "@common/machines/info-types";
import { favoriteKey } from "@common/machines/machine-favorites";
import { HardwareSpec, getHardwareSpec } from "@common/machines/hardware-specs";
import { t as translate } from "@common/i18n/i18n";
import type { TFunction } from "@common/i18n/useT";
import {
  FAVORITES_SECTION,
  MachineSelectState,
  isDirty,
  parseKey
} from "./MachineSelectModel";

/** One selectable model of the registry */
export type CatalogueEntry = {
  key: string;
  machineId: string;
  modelId?: string;
  name: string;
  machineName: string;
  spec?: HardwareSpec;
  /** Lower-case text the filter matches against */
  haystack: string;
};

export type ModelRowVm = {
  key: string;
  name: string;
  selected: boolean;
  running: boolean;
  favorite: boolean;
};

export type FavoriteRowVm = {
  key: string;
  name: string;
  selected: boolean;
  running: boolean;
  separatorAfter: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canToggleSeparator: boolean;
};

export type SectionVm =
  | { kind: "favorites"; id: string; title: string; open: boolean; rows: FavoriteRowVm[] }
  | {
      kind: "machine";
      id: string;
      title: string;
      open: boolean;
      /** Shows a dot on a closed section that holds the running model */
      containsRunning: boolean;
      rows: ModelRowVm[];
    }
  /** A machine type with a single model: selected directly, no accordion */
  | { kind: "leaf"; id: string; title: string; row: ModelRowVm };

export type SheetRowVm = { label: string; value: string; note?: string };
export type SheetGroupVm = { id: string; title: string; rows: SheetRowVm[] };

export type ScreenVm = {
  kind: "crt" | "lcd";
  width: number;
  height: number;
  rasterWidth: number;
  rasterHeight: number;
  caption: string;
};

export type SheetVm = {
  key: string;
  name: string;
  machineName: string;
  idLabel: string;
  running: boolean;
  favorite: boolean;
  chips: string[];
  screen?: ScreenVm;
  groups: SheetGroupVm[];
};

export type MachineSelectVm = {
  sections: SectionVm[];
  filterActive: boolean;
  noMatch: boolean;
  sheet?: SheetVm;
  dirty: boolean;
  saveEnabled: boolean;
  switchEnabled: boolean;
  switchLabel: string;
};

/** Every model of the registry, in registry order */
export function buildCatalogue(registry: readonly MachineInfo[]): CatalogueEntry[] {
  return registry.flatMap((machine) => {
    const models = machine.models?.length
      ? machine.models.map((m) => ({ modelId: m.modelId as string | undefined, name: m.displayName }))
      : [{ modelId: undefined as string | undefined, name: machine.displayName }];
    return models.map(({ modelId, name }) => {
      const spec = getHardwareSpec(machine, modelId);
      const haystack = [
        name,
        machine.displayName,
        spec?.cpu,
        spec && formatKb(spec.ramKb),
        spec?.standard,
        ...(spec?.media ?? []),
        ...(spec?.rom.map((r) => r.id) ?? [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return {
        key: favoriteKey({ machineId: machine.machineId, modelId }),
        machineId: machine.machineId,
        modelId,
        name,
        machineName: machine.displayName,
        spec,
        haystack
      };
    });
  });
}

/** Every whitespace-separated word of the filter must match */
export function matchesFilter(entry: CatalogueEntry, filter: string): boolean {
  const words = filter.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return words.every((w) => entry.haystack.includes(w));
}

export function selectViewModel(
  state: MachineSelectState,
  catalogue: readonly CatalogueEntry[],
  t: TFunction = translate
): MachineSelectVm {
  const byKey = new Map(catalogue.map((e) => [e.key, e]));
  const favoriteKeys = new Set(state.favorites.map(favoriteKey));
  const filterActive = state.filter.trim() !== "";
  const sections: SectionVm[] = [];

  const modelRow = (e: CatalogueEntry): ModelRowVm => ({
    key: e.key,
    name: e.name,
    selected: e.key === state.selectedKey,
    running: e.key === state.runningKey,
    favorite: favoriteKeys.has(e.key)
  });

  if (!filterActive) {
    const rows: FavoriteRowVm[] = [];
    state.favorites.forEach((f, i) => {
      const key = favoriteKey(f);
      const entry = byKey.get(key);
      if (!entry) return;
      const last = i === state.favorites.length - 1;
      rows.push({
        key,
        name: entry.name,
        selected: key === state.selectedKey,
        running: key === state.runningKey,
        separatorAfter: !!f.separatorAfter && !last,
        canMoveUp: i > 0,
        canMoveDown: !last,
        canToggleSeparator: !last
      });
    });
    sections.push({
      kind: "favorites",
      id: FAVORITES_SECTION,
      title: t("dialog.machineSelect.favorites"),
      open: state.openSections.includes(FAVORITES_SECTION),
      rows
    });
  }

  // --- One section per machine, in registry order
  const machineIds = [...new Set(catalogue.map((e) => e.machineId))];
  for (const machineId of machineIds) {
    const models = catalogue.filter((e) => e.machineId === machineId);
    const shown = filterActive ? models.filter((e) => matchesFilter(e, state.filter)) : models;
    if (!shown.length) continue;
    if (models.length === 1) {
      sections.push({ kind: "leaf", id: machineId, title: models[0].machineName, row: modelRow(models[0]) });
      continue;
    }
    sections.push({
      kind: "machine",
      id: machineId,
      title: models[0].machineName,
      open: filterActive || state.openSections.includes(machineId),
      containsRunning: shown.some((e) => e.key === state.runningKey),
      rows: shown.map(modelRow)
    });
  }

  const selected = state.selectedKey ? byKey.get(state.selectedKey) : undefined;
  const dirty = isDirty(state);
  const canSwitch = !!selected && selected.key !== state.runningKey;
  return {
    sections,
    filterActive,
    noMatch: filterActive && !sections.length,
    sheet: selected ? selectSheet(selected, state, favoriteKeys, t) : undefined,
    dirty,
    saveEnabled: dirty,
    switchEnabled: canSwitch,
    switchLabel: canSwitch
      ? t("dialog.machineSelect.switchTo", { name: selected!.name })
      : t("dialog.machineSelect.switch")
  };
}

function selectSheet(
  entry: CatalogueEntry,
  state: MachineSelectState,
  favoriteKeys: Set<string>,
  t: TFunction
): SheetVm {
  const { machineId, modelId } = parseKey(entry.key);

  const base: SheetVm = {
    key: entry.key,
    name: entry.name,
    machineName: entry.machineName,
    idLabel: modelId ? `${machineId} / ${modelId}` : machineId,
    running: entry.key === state.runningKey,
    favorite: favoriteKeys.has(entry.key),
    chips: [],
    groups: []
  };
  const spec = entry.spec;
  if (!spec) return base;

  const unit = spec.timing.unit;
  const d = spec.display;
  const rom = spec.rom.map((r) => `${r.id} (${formatKb(r.kb)}${r.role ? `, ${r.role}` : ""})`);
  return {
    ...base,
    chips: [spec.cpu, `${formatKb(spec.ramKb)} RAM`, spec.standard, ...spec.mediaChips],
    screen: {
      kind: d.kind,
      width: d.width,
      height: d.height,
      rasterWidth: d.rasterWidth,
      rasterHeight: d.rasterHeight,
      caption:
        d.kind === "lcd"
          ? `${d.width} × ${d.height} LCD`
          : d.rasterLabel
            ? `${d.rasterWidth} × ${d.rasterHeight} ${d.rasterLabel}`
            : t("dialog.machineSelect.screen.withBorder", {
                size: `${d.rasterWidth} × ${d.rasterHeight}`
              })
    },
    groups: [
      {
        id: "processor",
        title: t("dialog.machineSelect.group.processor"),
        rows: [
          { label: "CPU", value: spec.cpu },
          { label: t("dialog.machineSelect.row.clock"), value: `${formatNumber(spec.clockHz)} Hz`, note: `${formatMhz(spec.clockHz)} MHz` },
          ...(spec.turbo ? [{ label: t("dialog.machineSelect.row.turbo"), value: spec.turbo }] : []),
          { label: t("dialog.machineSelect.row.clockMultiplier"), value: spec.clockMultiplier ? "1× – 24×" : "—" }
        ]
      },
      {
        id: "memory",
        title: t("dialog.machineSelect.group.memory"),
        rows: [
          ...(rom.length ? rom.map((value, i) => ({ label: i ? "" : rom.length > 1 ? "ROMs" : "ROM", value })) : []),
          { label: "RAM", value: formatKb(spec.ramKb) },
          ...(spec.bankCount
            ? [{ label: t("dialog.machineSelect.row.banks"), value: spec.bankKb ? `${spec.bankCount} × ${formatKb(spec.bankKb)}` : String(spec.bankCount) }]
            : []),
          ...(spec.addressSpace ? [{ label: t("dialog.machineSelect.row.addressSpace"), value: spec.addressSpace }] : [])
        ]
      },
      {
        id: "display",
        title: t("dialog.machineSelect.group.display"),
        rows: [
          { label: t("dialog.machineSelect.row.resolution"), value: `${d.width} × ${d.height} px` },
          { label: t("dialog.machineSelect.row.colours"), value: d.colours },
          ...(d.attributes ? [{ label: t("dialog.machineSelect.row.attributes"), value: d.attributes }] : []),
          ...(d.text ? [{ label: t("dialog.machineSelect.row.text"), value: d.text }] : []),
          ...(d.layers ? [{ label: t("dialog.machineSelect.row.layers"), value: d.layers }] : []),
          ...(d.videoChip ? [{ label: t("dialog.machineSelect.row.videoChip"), value: d.videoChip }] : []),
          ...(d.otherSizes ? [{ label: t("dialog.machineSelect.row.otherSizes"), value: d.otherSizes }] : [])
        ]
      },
      {
        id: "timing",
        title: t("dialog.machineSelect.group.timing"),
        rows: [
          { label: t("dialog.machineSelect.row.standard"), value: spec.standard },
          { label: t("dialog.machineSelect.row.perLine", { unit }), value: formatOptional(spec.timing.perLine) },
          { label: t("dialog.machineSelect.row.linesPerFrame"), value: formatOptional(spec.timing.linesPerFrame) },
          { label: t("dialog.machineSelect.row.perFrame", { unit }), value: formatOptional(spec.timing.perFrame) },
          {
            label: t("dialog.machineSelect.row.frameRate"),
            value: spec.timing.frameHz
              ? `${formatHz(spec.timing.frameHz)} Hz`
              : t("dialog.machineSelect.row.frameRateEither"),
            note: spec.timing.displayHz
              ? t("dialog.machineSelect.row.lcdRefresh", { rate: formatHz(spec.timing.displayHz) })
              : undefined
          },
          ...(spec.timing.note ? [{ label: "", value: spec.timing.note }] : [])
        ]
      },
      {
        id: "sound",
        title: t("dialog.machineSelect.group.sound"),
        rows: spec.sound.length
          ? spec.sound.map((s, i) => ({ label: i ? "" : t("dialog.machineSelect.row.devices"), value: s }))
          : [{ label: t("dialog.machineSelect.row.devices"), value: t("dialog.machineSelect.row.noDevices") }]
      },
      {
        id: "io",
        title: t("dialog.machineSelect.group.io"),
        rows: [
          ...spec.media.map((m, i) => ({ label: i ? "" : t("dialog.machineSelect.row.media"), value: m })),
          ...spec.input.map((r) => ({ label: r.label, value: r.value }))
        ]
      }
    ]
  };
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatOptional(n: number | undefined): string {
  return n === undefined ? "—" : formatNumber(n);
}

/** 3546900 → "3.5469"; 985248 → "0.985248" */
export function formatMhz(hz: number): string {
  return (hz / 1e6).toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/** 50.0801… → "50.08"; 200 → "200" */
export function formatHz(hz: number): string {
  return hz.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** 16 → "16K"; 1792 → "1,792K"; 2048 → "2 MB" */
export function formatKb(kb: number): string {
  if (kb >= 1024 && kb % 1024 === 0) return `${kb / 1024} MB`;
  return `${formatNumber(kb)}K`;
}
