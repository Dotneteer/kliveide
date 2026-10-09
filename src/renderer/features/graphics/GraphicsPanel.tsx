import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { NavigationLocator } from "@renderer/abstractions/NavigationLocation";
import { FullPanel } from "@renderer/controls/layout/Panels";
import { PanelHeader, PanelHeaderGroup } from "@renderer/controls/data";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { Text } from "@renderer/controls/layout/Text";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useMainApi } from "@renderer/core/MainApi";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { useEmuStateListener } from "@renderer/appIde/useStateRefresh";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { useMemoryMachineSetup } from "@renderer/features/memory/useMemoryMachineSetup";
import { PF_CODE, PF_READ } from "@common/profile/profileTypes";
import { bankSpaceFor, type SlotPaging } from "@common/annotations/bankSpace";
import {
  DEFAULT_GRAPHICS_LOOK,
  GRAPHICS_PRESETS,
  type GraphicsLook
} from "@common/reverse/graphicsDecode";
import { bankGraphicLength } from "@renderer/appIde/annotations/programAnnotations";
import { withNamedGraphic } from "@renderer/appIde/annotations/annotationEdits";
import { updateAnnotationSession } from "@renderer/appIde/annotations/annotationSession";
import { useActiveAnnotations } from "@renderer/appIde/annotations/activeAnnotationSet";
import { liveRowTarget } from "@renderer/appIde/annotations/liveListingPort";
import { ensureAnnotatedBank } from "@renderer/appIde/annotations/liveAnnotationEditing";
import { getRomPartition } from "@renderer/appIde/annotations/romAnnotations";
import { machineConfigOf } from "@renderer/appIde/annotations/useMachineBankSpace";
import { addressSymbolsForState } from "@renderer/appIde/annotations/useAddressSymbols";
import { activeSetForEditing } from "@renderer/appIde/reverse/detectionEnvironment";
import { GraphicsView, type ByteSpan, type GraphicMark } from "./GraphicsView";
import { GraphicsToolbar } from "./GraphicsToolbar";
import { NameGraphicDialog, NAME_GRAPHIC_DIALOG_TITLE } from "./NameGraphicDialog";
import { graphicOfSpan } from "./graphicMarks";
import { findGraphicCandidates } from "@common/reverse/graphicsCandidates";
import { onGraphicsReveal } from "./graphicsReveal";
import { encodePng, graphicsRgba } from "./graphicsPng";

/*
 * The live *Graphics* document (`$graphics`, `.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.3): the
 * graphics finder over the paused machine. It reads the 64K view or one bank or ROM page through
 * `getMemoryContents`, refreshing on pause like the Memory panel — and not while the user drags a
 * selection (G-T2). With coverage, the bytes the CPU never read can be dimmed (§5.4).
 */

type GraphicsPanelViewState = {
  look?: Partial<GraphicsLook>;
  /** `"64k"`, or the partition shown. */
  source?: string;
  top?: number;
};

type Snapshot = { bytes: Uint8Array; base: number; slots: SlotPaging };

const SOURCE_64K = "64k";

const GraphicsPanel = ({ document, viewState }: DocumentProps<GraphicsPanelViewState>) => {
  const emuApi = useEmuApi();
  const mainApi = useMainApi();
  const { store } = useRendererContext();
  const documentHubService = useDocumentHubService();
  const { ideCommandsService, projectService } = useAppServices();
  const dialogs = useDialogs();
  const emu = useSelector((state) => state.emulatorState);
  const machineId = emu?.machineId;
  const machineSetup = useMemoryMachineSetup(machineId, emuApi);
  const { annotations: activeAnnotations } = useActiveAnnotations(projectService);

  const [state, setState] = useState<GraphicsPanelViewState>(viewState ?? {});
  const look = useMemo<GraphicsLook>(() => ({ ...DEFAULT_GRAPHICS_LOOK, ...state.look }), [state.look]);
  const source = state.source ?? SOURCE_64K;
  const partition = source === SOURCE_64K ? undefined : parseInt(source, 10);
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [profile, setProfile] = useState<Uint8Array>();
  const [jump, setJump] = useState<{ offset: number; version: number }>();
  const interacting = useRef(false);
  const pendingAddress = useRef<number | undefined>(undefined);

  const changeState = useCallback((patch: Partial<GraphicsPanelViewState>) => setState((s) => ({ ...s, ...patch })), []);
  const changeLook = useCallback(
    (patch: Partial<GraphicsLook>) => setState((s) => ({ ...s, look: { ...s.look, ...patch } })),
    []
  );

  useEffect(() => {
    if (document?.id) documentHubService.setDocumentViewState(document.id, state);
  }, [document?.id, documentHubService, state]);

  const refresh = useCallback(async () => {
    if (interacting.current) return;
    const full = await emuApi.getMemoryContents();
    let bytes = full.memory;
    let base = 0;
    if (partition !== undefined) {
      bytes = (await emuApi.getMemoryContents(partition)).memory;
      const slot = full.slotPartitions?.findIndex((p) => p === partition) ?? -1;
      base = slot >= 0 ? slot * 0x2000 : 0;
    }
    setSnapshot({ bytes, base, slots: full.slotPartitions });
    const view = await emuApi.getProfileView(partition).catch(() => undefined);
    setProfile(view?.flags && view.flags.some((f) => f !== 0) ? view.flags : undefined);
  }, [emuApi, partition]);

  useEmuStateListener(emuApi, refresh);
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const goTo = useCallback(
    (address: number) => {
      const base = snapshot?.base ?? 0;
      setJump((current) => ({ offset: (address & 0xffff) - base, version: (current?.version ?? 0) + 1 }));
    },
    [snapshot?.base]
  );

  // --- `gfx` and the navigation history reveal through here
  useEffect(
    () =>
      onGraphicsReveal((request) => {
        if (request.partition !== undefined) changeState({ source: String(request.partition) });
        if (request.look) changeLook(request.look);
        if (request.address !== undefined) {
          pendingAddress.current = request.address;
          goTo(request.address);
        }
      }),
    [changeLook, changeState, goTo]
  );
  const revealRef = useRef<(locator: NavigationLocator) => void>(() => {});
  revealRef.current = (locator) => {
    if (locator.kind === "address") goTo(locator.address);
  };
  useEffect(() => {
    if (!document?.id) return undefined;
    documentHubService.setDocumentApi(document.id, {
      revealAddress: (address: number) => revealRef.current({ kind: "address", address }),
      getNavigationLocator: () => ({ kind: "address", address: state.top ?? 0, viewMode: "graphics" }),
      revealLocator: (locator) => revealRef.current(locator)
    });
    return () => documentHubService.setDocumentApi(document.id, undefined);
  }, [document?.id, documentHubService, state.top]);

  const bankSpace = useMemo(
    () => bankSpaceFor(machineId, machineConfigOf(machineId, emu?.modelId, emu?.config)),
    [emu?.config, emu?.modelId, machineId]
  );

  // --- The named graphics of the active set, where their banks are paged now (64K view only)
  const named = useMemo<GraphicMark[] | undefined>(() => {
    if (partition !== undefined || !bankSpace || !activeAnnotations || !snapshot) return undefined;
    const marks: GraphicMark[] = [];
    for (const [key, bank] of Object.entries(activeAnnotations.banks)) {
      for (const graphic of bank.graphics ?? []) {
        const address = bankSpace.addressesOf({ bank: Number(key), offset: graphic.offset }, snapshot.slots)[0];
        if (address === undefined) continue;
        marks.push({ start: address, end: address + bankGraphicLength(graphic) - 1, label: graphic.label });
      }
    }
    return marks;
  }, [activeAnnotations, bankSpace, partition, snapshot]);

  const labelAt = useCallback(
    (offset: number) => {
      if (!snapshot) return undefined;
      const routine = addressSymbolsForState(store.getState()).symbols.routineAt((snapshot.base + offset) & 0xffff, snapshot.slots);
      return routine ? (routine.offset ? `${routine.name}+${routine.offset}` : routine.name) : undefined;
    },
    [snapshot, store]
  );
  const unread = useCallback((offset: number) => !!profile && (profile[offset] & (PF_READ | PF_CODE)) === 0, [profile]);

  const nameGraphic = useCallback(
    async (span: ByteSpan) => {
      if (!snapshot || !bankSpace) return;
      const address = (snapshot.base + span.start) & 0xffff;
      const live = liveRowTarget(address, {
        bankSpace,
        slots: snapshot.slots,
        activeSet: activeSetForEditing(),
        romPartition: getRomPartition
      });
      if (!("annotationPath" in live)) {
        window.alert(live.disabledReason);
        return;
      }
      const result = await dialogs.open(
        NameGraphicDialog,
        { initial: { ...graphicOfSpan(span, look), offset: live.offset }, baseAddress: live.disassOffset },
        { title: NAME_GRAPHIC_DIALOG_TITLE, width: 520 }
      );
      if (!result) return;
      const annotations = await ensureAnnotatedBank(live, projectService);
      if (!annotations) return;
      const named = withNamedGraphic(annotations, live.bank, result);
      if ("error" in named) {
        window.alert(named.error);
        return;
      }
      updateAnnotationSession(live.annotationPath, named.annotations, projectService);
    },
    [bankSpace, dialogs, look, projectService, snapshot]
  );

  const savePng = useCallback(
    async (span: ByteSpan, atZoom: boolean) => {
      if (!snapshot) return;
      const path = await mainApi.showSaveFileDialog({
        title: "Save as PNG",
        defaultPath: `graphic-${toHexa4((snapshot.base + span.start) & 0xffff)}.png`,
        filters: [{ name: "PNG image", extensions: ["png"] }],
        settingsId: "graphicsPng"
      });
      if (!path) return;
      const scale = atZoom ? look.zoom : 1;
      const { width, height, rgba } = graphicsRgba(snapshot.bytes, look, span, look.columns || 8, scale);
      await mainApi.saveBinaryFile(path, await encodePng(width, height, rgba));
    },
    [look, mainApi, snapshot]
  );

  const candidates = useMemo(
    () =>
      snapshot
        ? findGraphicCandidates({ bytes: snapshot.bytes, base: snapshot.base, flags: profile, z80n: bankSpace?.extendedSet })
        : undefined,
    [bankSpace?.extendedSet, profile, snapshot]
  );

  const sourceOptions = useMemo<DropdownOption[]>(
    () => [{ value: SOURCE_64K, label: "64K view" }, ...machineSetup.segmentOptions],
    [machineSetup.segmentOptions]
  );

  return (
    <FullPanel fontFamily="--monospace-font" fontSize="--panel-font-size">
      <PanelHeader>
        <PanelHeaderGroup>
          <Text text="Show" />
          <LabelSeparator />
          <Dropdown
            ariaLabel="Memory to show"
            options={sourceOptions}
            initialValue={source}
            width={140}
            onOpenChange={(open) => {
              interacting.current = open;
            }}
            onChanged={(value) => changeState({ source: value })}
          />
        </PanelHeaderGroup>
        <GraphicsToolbar
          look={look}
          dimAvailable={!!profile}
          onLookChange={changeLook}
          onGoTo={goTo}
          onPreset={(id) => {
            const preset = GRAPHICS_PRESETS.find((p) => p.id === id);
            if (!preset) return;
            changeLook(preset.look);
            if (preset.address !== undefined && partition === undefined) goTo(preset.address);
          }}
        />
      </PanelHeader>
      {snapshot ? (
        <GraphicsView
          bytes={snapshot.bytes}
          baseAddress={snapshot.base}
          look={look}
          onLookChange={changeLook}
          jump={jump}
          initialTopOffset={state.top ?? 0}
          onTopOffsetChange={(top) => changeState({ top })}
          unread={profile ? unread : undefined}
          named={named}
          labelAt={labelAt}
          candidates={candidates}
          onInteractingChange={(value) => {
            interacting.current = value;
            if (!value) void refresh();
          }}
          menu={{
            onShowIn: (view, offset) =>
              void ideCommandsService.executeCommand(
                `${view === "memory" ? "show-memory" : "show-disass"} $${toHexa4((snapshot.base + offset) & 0xffff)}`
              ),
            onNameGraphic: (span) => void nameGraphic(span),
            onSavePng: (span, atZoom) => void savePng(span, atZoom),
            onExportSource: async (span) => {
              const from = (snapshot.base + span.start) & 0xffff;
              const to = (snapshot.base + span.end) & 0xffff;
              const path = await mainApi.showSaveFileDialog({
                title: "Export as source",
                defaultPath: `graphic-${toHexa4(from)}.kz80.asm`,
                filters: [{ name: "Klive Z80 assembly", extensions: ["kz80.asm", "asm"] }],
                settingsId: "asmExport"
              });
              if (path) void ideCommandsService.executeCommand(`export-asm "${path}" $${toHexa4(from)} $${toHexa4(to)}`);
            }
          }}
        />
      ) : null}
    </FullPanel>
  );
};

export const createGraphicsPanel = ({ document, viewState }: DocumentProps) => (
  <GraphicsPanel document={document} viewState={viewState} />
);
