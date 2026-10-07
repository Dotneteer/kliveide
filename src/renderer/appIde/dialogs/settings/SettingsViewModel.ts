/*
 * What the Settings dialog shows, derived from its state (`.plans/MENU_REDESIGN_PLAN.md` §4).
 */
import {
  SETTINGS_PAGES,
  SETTINGS_ROWS,
  type SettingsPageId,
  type SettingsRow,
  isSettingsRowApplicable,
  isSettingsRowLocked,
  readSettingsRowValue,
  settingsRowMatches,
  settingsRowOptions
} from "@common/settings/settings-pages";
import { machineRegistry } from "@common/machines/machine-registry";
import type { SettingsState } from "./SettingsModel";

export type SettingsOptionVm = { value: string; label: string };

export type SettingsButtonVm = { label: string; enabled: boolean; index: number };

export type SettingsRowVm = {
  id: string;
  title: string;
  description?: string;
  /** "Was: <menu path>", shown while searching */
  replaces?: string;
  editor: SettingsRow["editor"];
  /** A switch's state */
  checked: boolean;
  /** A select's or accent's value, as the option key */
  value: string;
  options: SettingsOptionVm[];
  /** A file row's shown value */
  displayValue?: string;
  buttons: SettingsButtonVm[];
  enabled: boolean;
};

export type SettingsGroupVm = { title: string; rows: SettingsRowVm[] };

export type SettingsSectionVm = { pageId: SettingsPageId; title: string; groups: SettingsGroupVm[] };

export type SettingsNavVm = { id: SettingsPageId; title: string; selected: boolean; matches?: number };

export type SettingsVm = {
  nav: SettingsNavVm[];
  query: string;
  searching: boolean;
  sections: SettingsSectionVm[];
  /** Shown when nothing is listed */
  emptyMessage?: string;
  /** A note above the Machine page */
  machineNote?: string;
  error?: string;
  /** The page has rows a reset can change */
  resetEnabled: boolean;
};

/** The key a select uses for an option value */
export const optionKey = (value: unknown): string => String(value);

/** The file name of a path, for a file row */
export function formatFileValue(path: unknown, emptyText: string): string {
  const text = typeof path === "string" ? path.trim() : "";
  if (!text) return emptyText;
  const parts = text.split(/[\\/]/);
  return parts[parts.length - 1] || text;
}

function emptyFileText(row: SettingsRow): string {
  switch (row.id) {
    case "sp48Rom":
      return "Built-in ROM";
    case "keyMapping":
      return "None";
    default:
      return "Not set";
  }
}

export function rowViewModel(row: SettingsRow, state: SettingsState): SettingsRowVm {
  const appState = state.env.appState;
  const value = readSettingsRowValue(row, appState);
  const locked = isSettingsRowLocked(row, appState);
  const busy = state.busyRowId === row.id;
  const hasValue = typeof value === "string" ? !!value.trim() : value !== undefined && value !== null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    replaces: state.query && row.replaces ? `Was: ${row.replaces}` : undefined,
    editor: row.editor,
    checked: !!value,
    value: optionKey(value),
    options: settingsRowOptions(row, state.env.platform).map((o) => ({
      value: optionKey(o.value),
      label: o.label
    })),
    displayValue: row.editor === "file" ? formatFileValue(value, emptyFileText(row)) : undefined,
    buttons: (row.buttons ?? []).map((b, index) => ({
      label: b.label,
      index,
      enabled: !locked && !busy && (!b.needsValue || hasValue)
    })),
    enabled: !locked && !busy
  };
}

function groupsOf(rows: SettingsRowVm[], source: SettingsRow[]): SettingsGroupVm[] {
  const groups: SettingsGroupVm[] = [];
  rows.forEach((vm, i) => {
    const title = source[i].group;
    const last = groups[groups.length - 1];
    if (last?.title === title) last.rows.push(vm);
    else groups.push({ title, rows: [vm] });
  });
  return groups;
}

/** The rows of a page that apply now, in order */
export function applicableRows(page: SettingsPageId, state: SettingsState): SettingsRow[] {
  return SETTINGS_ROWS.filter((r) => r.page === page && isSettingsRowApplicable(r, state.env.appState));
}

export function selectViewModel(state: SettingsState): SettingsVm {
  const searching = !!state.query.trim();
  const sections: SettingsSectionVm[] = [];
  const nav: SettingsNavVm[] = [];
  for (const page of SETTINGS_PAGES) {
    const rows = applicableRows(page.id, state).filter((r) => !searching || settingsRowMatches(r, state.query));
    nav.push({
      id: page.id,
      title: page.title,
      selected: !searching && page.id === state.page,
      matches: searching ? rows.length : undefined
    });
    if (searching ? rows.length > 0 : page.id === state.page) {
      sections.push({
        pageId: page.id,
        title: page.title,
        groups: groupsOf(
          rows.map((r) => rowViewModel(r, state)),
          rows
        )
      });
    }
  }

  const machineId = state.env.appState?.emulatorState?.machineId;
  const machineName = machineRegistry.find((m) => m.machineId === machineId)?.displayName;
  const pageRows = applicableRows(state.page, state);
  const emptyMessage = searching
    ? sections.length
      ? undefined
      : `No setting matches "${state.query.trim()}".`
    : pageRows.length
      ? undefined
      : state.page === "machine"
        ? `The ${machineName ?? "running machine"} has no options of its own.`
        : "Nothing to set here.";

  return {
    nav,
    query: state.query,
    searching,
    sections,
    emptyMessage,
    machineNote:
      !searching && state.page === "machine" && machineName
        ? `The options of the running machine, the ${machineName}.`
        : undefined,
    error: state.error,
    resetEnabled:
      !searching &&
      pageRows.some((r) => r.source && r.editor !== "file" && !isSettingsRowLocked(r, state.env.appState))
  };
}
