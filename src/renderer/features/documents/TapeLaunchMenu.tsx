import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { TabButton, TabButtonSeparator, TabButtonSpace } from "@renderer/controls/TabButton";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useEffect, useState } from "react";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { analyzeHt1080zFile } from "@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zTapeView";
import { SETTING_EMU_FAST_LOAD } from "@common/settings/setting-const";
import { MI_HT1080Z } from "@common/machines/constants";
import { detectCasFormat, type CasFormat } from "@emu/machines/casFormat";

import type { AppServices } from "@renderer/abstractions/AppServices";
import type { ContextMenuInfo } from "@renderer/abstractions/ContextMenuIfo";

import {
  casFormatLoadGuard,
  casTapeLoadGuard,
  htTapeLoadGuard,
  programLoadGuard,
  tapeLoadGuard
} from "@renderer/appIde/commands/TapeLoadCommand";

/*
 * **Load and run** / **Insert** / **Load and debug** for a `.tap` or `.tzx` file: the Explorer's
 * context menu entries and the buttons in the tape viewer's tab bar (`.plans/TAPE_VIEWER_PLAN.md`
 * §4.6). All of them run the `tape-load` command, as the `.nex` entries run `nex-run`, so the
 * Explorer, the viewer and a script do the same thing.
 *
 * On any machine but the ZX Spectrum 48K, 128K and +2/+3 every one of them is disabled
 * (`tapeLoadGuard`, §7 Q1). The buttons keep their tooltip and say why; a context menu entry has no
 * tooltip, so it is only greyed out. The machine is never switched automatically.
 */

const LAUNCH_OPTIONS = {
  run: " -r",
  insert: "",
  debug: " -d",
  // --- An HT-1080Z machine-code tape only: debug, stopping at its start address
  entry: " -e"
} as const;

type TapeLaunchMode = keyof typeof LAUNCH_OPTIONS;

/** The command text for loading `path` in `mode`; the path is quoted, as it may hold spaces */
export function tapeLoadCommandText(path: string, mode: TapeLaunchMode): string {
  return `tape-load "${path}"${LAUNCH_OPTIONS[mode]}`;
}

/**
 * The Explorer's entries for a `.tap` or `.tzx` file.
 * @param services The app services
 */
export function getTapeLaunchContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  return launchMenuInfo(services, tapeLoadGuard);
}

/**
 * The Explorer's entries for a ZX80/ZX81 program file (`.p`, `.81`, `.o`, `.80`): the same `tape-load`
 * command, enabled on a ZX80 or ZX81 (`.plans/ZX8081_WASM_PLAN.md` §9.1).
 * @param services The app services
 */
export function getProgramLaunchContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  return launchMenuInfo(services, programLoadGuard);
}

/**
 * The Explorer's entries for an HT-1080Z tape (`.cas`, `.cmd`): the same `tape-load` command,
 * enabled on the HT-1080Z (`.plans/HT1080Z_PLAN.md` §9, §11).
 * @param services The app services
 */
export function getHtTapeLaunchContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  return htTapeLaunchMenuInfo(services, htTapeLoadGuard);
}

/**
 * The Explorer's entries for a `.cas`, the HT-1080Z's and the Videoton TVC's tape alike: Run, Insert
 * and Debug on either machine, and the start-address stop on the HT-1080Z only
 * @param services The app services
 */
export function getCasTapeLaunchContextMenuInfo(services: AppServices): ContextMenuInfo[] {
  return htTapeLaunchMenuInfo(services, casTapeLoadGuard);
}

function htTapeLaunchMenuInfo(services: AppServices, guard: LoadGuard): ContextMenuInfo[] {
  // --- A menu cannot read the file, so the entry is offered for every HT tape; `tape-load -e` says
  // --- why a BASIC one has no start address
  return [
    ...launchMenuInfo(services, guard),
    {
      text: t("documents.tape.menu.entry"),
      disabled: (store) => !!htTapeLoadGuard(store.getState()),
      clicked: async (item: string) => {
        await services.ideCommandsService.executeCommand(tapeLoadCommandText(item, "entry"));
      }
    }
  ];
}

type LoadGuard = (state: { emulatorState?: { machineId?: string } }) => string | undefined;

function launchMenuInfo(services: AppServices, guard: LoadGuard): ContextMenuInfo[] {
  const { ideCommandsService } = services;
  const refused = (store: Parameters<NonNullable<ContextMenuInfo["disabled"]>>[0]) =>
    !!guard(store.getState());
  const launch = async (item: string, mode: TapeLaunchMode) => {
    await ideCommandsService.executeCommand(tapeLoadCommandText(item, mode));
  };

  return [
    {
      text: t("documents.tape.menu.run"),
      disabled: refused,
      clicked: async (item: string) => await launch(item, "run")
    },
    {
      text: t("documents.tape.menu.insert"),
      disabled: refused,
      clicked: async (item: string) => await launch(item, "insert")
    },
    {
      text: t("documents.tape.menu.debug"),
      disabled: refused,
      clicked: async (item: string) => await launch(item, "debug")
    }
  ];
}

type Props = {
  path: string;
  guard: LoadGuard;
  /** Offer "debug from the start address": the file is an HT-1080Z machine-code tape */
  withEntry?: boolean;
};

/** The three actions in a tape (or ZX80/ZX81 program) document's tab bar */
const TapeLaunchCommandBar = ({ path, guard, withEntry }: Props) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const refusal = guard({ emulatorState: { machineId } });
  const fastLoadArg = fastLoad === false ? "off" : "on";

  const launch = async (mode: TapeLaunchMode) => {
    await ideCommandsService.executeCommand(tapeLoadCommandText(path, mode));
  };

  return (
    <>
      <TabButtonSeparator />
      <TabButton
        iconName="play"
        title={
          refusal
            ? t("documents.tape.button.runRefused", { reason: refusal })
            : t("documents.tape.button.run", { fastLoad: fastLoadArg })
        }
        disabled={!!refusal}
        clicked={async () => await launch("run")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="cassette-tape"
        title={refusal ? t("documents.tape.button.insertRefused", { reason: refusal }) : t("documents.tape.button.insert")}
        disabled={!!refusal}
        clicked={async () => await launch("insert")}
      />
      <TabButtonSpace />
      <TabButton
        iconName="debug"
        title={
          refusal
            ? t("documents.tape.button.debugRefused", { reason: refusal })
            : t("documents.tape.button.debug", { fastLoad: fastLoadArg })
        }
        disabled={!!refusal}
        clicked={async () => await launch("debug")}
      />
      {withEntry && (
        <>
          <TabButtonSpace />
          <TabButton
            iconName="debug-with-bp"
            title={
              refusal
                ? t("documents.tape.button.entryRefused", { reason: refusal })
                : t("documents.tape.button.entry", { fastLoad: fastLoadArg })
            }
            disabled={!!refusal}
            clicked={async () => await launch("entry")}
          />
        </>
      )}
    </>
  );
};

/**
 * An HT-1080Z tape's bar: the three actions, and - for a machine-code tape, which names its start
 * address - "debug, stopping there", as a `.nex` document's bar has. Whether the file is one is read
 * from it: a `.cmd` always is, a `.cas` when it holds a SYSTEM program.
 *
 * A `.cas` is the Videoton TVC's tape too, in its own format: the bytes say whose tape it is
 * (`detectCasFormat`), and the actions are enabled on that machine only. A TVC tape names no start
 * address.
 */
const HtTapeLaunchCommandBar = ({ path }: { path: string }) => {
  const mainApi = useMainApi();
  const [withEntry, setWithEntry] = useState(false);
  const [casFormat, setCasFormat] = useState<CasFormat | undefined>();
  const isCas = /\.cas$/i.test(path);
  useEffect(() => {
    let cancelled = false;
    mainApi
      .readBinaryFile(path)
      .then((bytes) => {
        if (cancelled) return;
        const format = isCas ? detectCasFormat(bytes) : undefined;
        setCasFormat(format);
        setWithEntry(format !== "tvc" && analyzeHt1080zFile(bytes, path).analysis?.entry !== undefined);
      })
      .catch(() => {
        if (cancelled) return;
        setCasFormat(undefined);
        setWithEntry(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mainApi, path, isCas]);
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  return (
    <TapeLaunchCommandBar
      path={path}
      guard={isCas ? casFormatLoadGuard(casFormat) : htTapeLoadGuard}
      withEntry={withEntry && machineId === MI_HT1080Z}
    />
  );
};

export const tapeLaunchCommandBarRenderer = (path: string) => (
  <TapeLaunchCommandBar path={path} guard={tapeLoadGuard} />
);

export const programLaunchCommandBarRenderer = (path: string) => (
  <TapeLaunchCommandBar path={path} guard={programLoadGuard} />
);

export const htTapeLaunchCommandBarRenderer = (path: string) => <HtTapeLaunchCommandBar path={path} />;
