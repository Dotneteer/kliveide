import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import { labelRecord } from "@common/i18n/labels";
import { AnnotationFileBanner, type AnnotationFileStatus } from "@renderer/appIde/annotations/AnnotationFileBanner";
import { createAnnotationSidecar, loadAnnotationSidecar } from "@renderer/appIde/annotations/annotationSidecar";
import { seedAnnotationSession } from "@renderer/appIde/annotations/annotationSession";
import { annotationMachineFor, bankSpaceForAnnotationMachine } from "@common/annotations/bankSpace";
import { useMemo, useEffect, useState } from "react";

import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import type { GenericFileContext } from "../helpers/GenericFilePanel";

import { GenericFilePanel } from "../helpers/GenericFilePanel";
import { ExpandableRow } from "@renderer/controls/layout/ExpandableRow";
import { LabeledText } from "@renderer/controls/layout/LabeledText";
import { LabeledFlag } from "@renderer/controls/layout/LabeledFlag";
import { Row } from "@renderer/controls/layout/Row";
import { Text } from "@renderer/controls/layout/Text";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ScreenCanvas } from "@renderer/controls/Next/ScreenCanvas";
import {
  BankBrowser,
  BankChip,
  BankFacts,
  BankRowText
} from "@renderer/controls/bankBrowser/BankBrowser";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { SPECTRUM_48_COLORS } from "@emu/machines/spectrum-colors";
import { createScrPixelData } from "../Next/ScrFileViewerPanel";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { spectrumBankDumpId, spectrumBankDumpTitle } from "./spectrumBankDocument";
import { parseSpectrumSnapshot } from "@common/spectrum/snapshot/parseSpectrumSnapshot";
import {
  describeSnapshotMapping,
  mapSpectrumSnapshotToKlive
} from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import {
  isPagedSnapshotMachine,
  isPlus3SnapshotMachine,
  snapshotMachineName
} from "@common/spectrum/snapshot/spectrumSnapshot";
import {
  buildSpectrumAddressSpace,
  decode1ffd,
  decode7ffd,
  decodeAy,
  spectrumAddressLocation,
  spectrumBankItems,
  spectrumPagedRanges,
  spectrumScreenBank,
  type SpectrumBankItem,
  type SpectrumBankView,
  type SpectrumSnapshotFileInfo
} from "./spectrumSnapshotView";

/*
 * The ZX Spectrum snapshot viewer for `.sna`, `.z80` and `.szx` files
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.8, decision D6): what the file holds and whether (and as
 * what) Klive can load it, the screen, the Z80, ULA, paging and AY state, the 64K at PC as a memory
 * dump or disassembly, every RAM bank in a bank browser, and the format's own header fields.
 *
 * Built only from the shared viewer primitives - no stylesheet of its own, no colour.
 */

/* --- M2: `ch`, not px */
const LABEL_WIDTH = "14ch";
const REG_LABEL_WIDTH = "5ch";
const REG_VALUE_WIDTH = "14ch";

export type SpectrumSnapshotViewState = {
  scrollPosition?: number;
  summaryExpanded?: boolean;
  cpuExpanded?: boolean;
  ulaExpanded?: boolean;
  pagingExpanded?: boolean;
  ayExpanded?: boolean;
  fileExpanded?: boolean;
  selectedBank?: number;
  bankFilter?: string;
  bankView?: Record<number, SpectrumBankView>;
};

type ViewContext = GenericFileContext<SpectrumSnapshotFileInfo, SpectrumSnapshotViewState>;

/**
 * Parses a snapshot for the viewer. A file Klive cannot *load* still parses: the mapping's errors
 * are shown, not reported as a broken file. A `.z80` that is not a snapshot (a PASTA/80 temp file,
 * see `registry.ts`) is reported, not thrown.
 * @param name The file name (its extension picks the format)
 */
export function loadSpectrumSnapshotFileContents(
  name: string,
  contents: Uint8Array
): { fileInfo?: SpectrumSnapshotFileInfo; error?: string } {
  try {
    const snapshot = parseSpectrumSnapshot(name, contents);
    return { fileInfo: { snapshot, mapping: mapSpectrumSnapshotToKlive(snapshot) } };
  } catch (err) {
    return {
      error: translate("panels.spectrum.error.invalid", {
        reason: err instanceof Error ? err.message : String(err)
      })
    };
  }
}

const SpectrumSnapshotViewerPanel = ({
  document,
  contents,
  viewState
}: DocumentProps<SpectrumSnapshotViewState>) => {
  const fullPath = document.node?.fullPath ?? document.path ?? document.id;
  return (
    <GenericFilePanel<SpectrumSnapshotFileInfo, SpectrumSnapshotViewState>
      document={document}
      contents={contents}
      viewState={viewState}
      apiLoaded={() => {}}
      fileLoader={(bytes) => loadSpectrumSnapshotFileContents(fullPath, bytes)}
      validRenderer={(ctx) => (
        <SnapshotView
          ctx={ctx}
          documentSource={document.node?.projectPath ?? document.id}
          fullPath={fullPath}
        />
      )}
    />
  );
};

export const createSpectrumSnapshotViewerPanel = ({ document, contents, viewState }: DocumentProps) => (
  <SpectrumSnapshotViewerPanel
    document={document}
    contents={contents}
    viewState={viewState}
    apiLoaded={() => {}}
  />
);

type ViewProps = { ctx: ViewContext; documentSource: string; fullPath: string };

/**
 * A module-level component, so it may hold state (see `GenericFilePanel`'s renderer note). The RZX
 * viewer shows a recording's first snapshot with it (`RzxViewerPanel.tsx`).
 */
export const SnapshotView = ({ ctx, documentSource, fullPath }: ViewProps) => {
  const info = ctx.fileInfo;
  if (!info) return null;
  return (
    <>
      <SummarySection ctx={ctx} info={info} />
      <CpuSection ctx={ctx} info={info} />
      <UlaSection ctx={ctx} info={info} />
      <PagingSection ctx={ctx} info={info} documentSource={documentSource} />
      {info.snapshot.ay && <AySection ctx={ctx} info={info} />}
      <BanksSection ctx={ctx} info={info} fullPath={fullPath} />
      <FileSection ctx={ctx} info={info} />
    </>
  );
};

type SectionProps = { ctx: ViewContext; info: SpectrumSnapshotFileInfo };

const SummarySection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const { snapshot, mapping } = info;
  const loadable = mapping.errors.length === 0;
  const screen = snapshot.ram.get(spectrumScreenBank(snapshot));
  return (
    <ExpandableRow
      heading={t("panels.helpers.heading.snapshot")}
      initialExpanded={ctx.viewState?.summaryExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.summaryExpanded = exp))}
    >
      <Row>
        <LabeledText
          label={t("panels.spectrum.label.format")}
          labelWidth={LABEL_WIDTH}
          value={`.${snapshot.format} ${snapshot.formatVersion}`}
        />
      </Row>
      <Row>
        <LabeledText
          label={t("panels.helpers.label.machine")}
          labelWidth={LABEL_WIDTH}
          value={describeSnapshotMapping(snapshot, mapping)}
        />
      </Row>
      <Row>
        <LabeledFlag label={t("panels.helpers.label.loadable")} labelWidth={LABEL_WIDTH} value={loadable} />
      </Row>
      {mapping.errors.map((error, index) => (
        <Row key={`error${index}`}>
          <Text text={error} variant="error" />
        </Row>
      ))}
      {[...snapshot.warnings, ...mapping.warnings].map((warning, index) => (
        <Row key={`warning${index}`}>
          <Text text={warning} variant="warning" />
        </Row>
      ))}
      {screen && (
        <Row>
          <ScreenCanvas
            data={screen}
            palette={SPECTRUM_48_COLORS}
            zoomFactor={2}
            screenWidth={256}
            screenHeight={192}
            createPixelData={createScrPixelData}
          />
        </Row>
      )}
    </ExpandableRow>
  );
};

const Register = ({ label, value }: { label: string; value: number }) => (
  <LabeledText
    label={label}
    labelWidth={REG_LABEL_WIDTH}
    value={`$${toHexa4(value)} (${value})`}
    valueWidth={REG_VALUE_WIDTH}
  />
);

const Byte = ({ label, value }: { label: string; value: string }) => (
  <LabeledText label={label} labelWidth={REG_LABEL_WIDTH} value={value} valueWidth={REG_VALUE_WIDTH} />
);

const CpuSection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const cpu = info.snapshot.cpu;
  return (
    <ExpandableRow
      heading={t("panels.helpers.heading.z80Registers")}
      initialExpanded={ctx.viewState?.cpuExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.cpuExpanded = exp))}
    >
      <Row>
        <Register label="AF:" value={cpu.af} />
        <Register label="BC:" value={cpu.bc} />
        <Register label="DE:" value={cpu.de} />
        <Register label="HL:" value={cpu.hl} />
        <Register label="PC:" value={cpu.pc} />
      </Row>
      <Row>
        <Register label="AF':" value={cpu.af_} />
        <Register label="BC':" value={cpu.bc_} />
        <Register label="DE':" value={cpu.de_} />
        <Register label="HL':" value={cpu.hl_} />
        <Register label="SP:" value={cpu.sp} />
      </Row>
      <Row>
        <Register label="IX:" value={cpu.ix} />
        <Register label="IY:" value={cpu.iy} />
        <Byte label="I:" value={`$${toHexa2(cpu.i)}`} />
        <Byte label="R:" value={`$${toHexa2(cpu.r)}`} />
        <Byte label="IM:" value={`${cpu.im}`} />
      </Row>
      <Row>
        <LabeledFlag label="IFF1:" labelWidth={REG_LABEL_WIDTH} value={cpu.iff1} />
        <LabeledFlag label="IFF2:" labelWidth={REG_LABEL_WIDTH} value={cpu.iff2} />
        {cpu.halted !== undefined && (
          <LabeledFlag label="HALT:" labelWidth={REG_LABEL_WIDTH} value={cpu.halted} />
        )}
        {cpu.memptr !== undefined && <Register label="WZ:" value={cpu.memptr} />}
      </Row>
      {cpu.suppressInterrupt && (
        <Row>
          <Text text={t("panels.spectrum.suppressInterrupt")} />
        </Row>
      )}
    </ExpandableRow>
  );
};

const UlaSection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const { snapshot } = info;
  const ula = snapshot.ula;
  return (
    <ExpandableRow
      heading="ULA"
      initialExpanded={ctx.viewState?.ulaExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.ulaExpanded = exp))}
    >
      <Row>
        <LabeledText label="Border:" labelWidth={LABEL_WIDTH} value={`${ula.border}`} />
      </Row>
      <Row>
        <LabeledText
          label="Frame T-state:"
          labelWidth={LABEL_WIDTH}
          value={ula.frameTact !== undefined ? `${ula.frameTact}` : t("panels.spectrum.frameTactNone")}
        />
      </Row>
      {ula.lastFe !== undefined && (
        <Row>
          <LabeledText label="Last $FE:" labelWidth={LABEL_WIDTH} value={`$${toHexa2(ula.lastFe)}`} />
        </Row>
      )}
      <Row>
        <LabeledText
          label={t("panels.spectrum.label.screen")}
          labelWidth={LABEL_WIDTH}
          value={t("panels.spectrum.bank", { bank: spectrumScreenBank(snapshot) })}
        />
      </Row>
    </ExpandableRow>
  );
};

const PagingSection = ({ ctx, info, documentSource }: SectionProps & { documentSource: string }) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { snapshot } = info;
  const pc = snapshot.cpu.pc;
  const space = useMemo(() => buildSpectrumAddressSpace(snapshot), [snapshot]);
  const location = spectrumAddressLocation(snapshot, pc);
  const paged = isPagedSnapshotMachine(snapshot.machine);
  const p7 = decode7ffd(snapshot.paging?.port7ffd ?? 0);
  const p1 =
    isPlus3SnapshotMachine(snapshot.machine) && snapshot.paging?.port1ffd !== undefined
      ? decode1ffd(snapshot.paging.port1ffd)
      : undefined;

  const openAtPc = (viewMode: "memory" | "disassembly") =>
    openStaticMemoryDump(
      documentHubService,
      `spectrumSnapshot${documentSource}`,
      t("panels.helpers.addressSpaceTitle", { source: documentSource }),
      space,
      { disassemblyEnabled: true, disassOffset: 0, viewMode, topAddress: pc }
    );

  return (
    <ExpandableRow
      heading={t("panels.spectrum.pagingHeading")}
      headingAction={
        <>
          <SmallIconButton
            iconName="memory-icon"
            title={t("panels.helpers.memoryAtPc")}
            clicked={() => openAtPc("memory")}
          />
          <SmallIconButton
            iconName="disassembly-icon"
            title={t("panels.helpers.disassemblyAtPc")}
            clicked={() => openAtPc("disassembly")}
          />
        </>
      }
      initialExpanded={ctx.viewState?.pagingExpanded ?? true}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.pagingExpanded = exp))}
    >
      {paged && (
        <Row>
          <LabeledText
            label="Port $7FFD:"
            labelWidth={LABEL_WIDTH}
            value={t(
              p7.shadowScreen
                ? p7.locked
                  ? "panels.spectrum.port7ffdShadowLocked"
                  : "panels.spectrum.port7ffdShadow"
                : p7.locked
                  ? "panels.spectrum.port7ffdNormalLocked"
                  : "panels.spectrum.port7ffdNormal",
              { value: `$${toHexa2(snapshot.paging?.port7ffd ?? 0)}`, bank: p7.bank, rom: p7.rom }
            )}
          />
        </Row>
      )}
      {p1 && (
        <Row>
          <LabeledText
            label="Port $1FFD:"
            labelWidth={LABEL_WIDTH}
            value={
              p1.specialPaging
                ? t(p1.motorOn ? "panels.spectrum.port1ffdSpecialOn" : "panels.spectrum.port1ffdSpecialOff", {
                    value: `$${toHexa2(snapshot.paging!.port1ffd!)}`,
                    config: p1.config
                  })
                : t(p1.motorOn ? "panels.spectrum.port1ffdNormalOn" : "panels.spectrum.port1ffdNormalOff", {
                    value: `$${toHexa2(snapshot.paging!.port1ffd!)}`
                  })
            }
          />
        </Row>
      )}
      <Row>
        <LabeledText
          label="PC:"
          labelWidth={LABEL_WIDTH}
          value={
            location.bank !== undefined
              ? t("panels.spectrum.pcInBank", {
                  pc: `$${toHexa4(pc)}`,
                  bank: location.bank,
                  offset: `$${toHexa4(location.offset)}`
                })
              : t("panels.spectrum.pcInRom", {
                  pc: `$${toHexa4(pc)}`,
                  rom: location.rom ?? 0,
                  offset: `$${toHexa4(location.offset)}`
                })
          }
        />
      </Row>
      {spectrumPagedRanges(snapshot).map((range) => (
        <Row key={range.start}>
          <LabeledText
            label={`$${toHexa4(range.start)}-$${toHexa4(range.end)}:`}
            labelWidth={LABEL_WIDTH}
            value={
              range.bank !== undefined
                ? t("panels.spectrum.bank", { bank: range.bank })
                : t("panels.spectrum.romNotInSnapshot", { rom: range.rom ?? 0 })
            }
          />
        </Row>
      ))}
    </ExpandableRow>
  );
};

const AySection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const ay = info.snapshot.ay!;
  const state = decodeAy(ay.regs);
  return (
    <ExpandableRow
      heading="AY-3-8912"
      initialExpanded={ctx.viewState?.ayExpanded ?? false}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.ayExpanded = exp))}
    >
      <Row>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((r) => (
          <Byte key={r} label={`R${r}:`} value={`$${toHexa2(ay.regs[r])}`} />
        ))}
      </Row>
      <Row>
        {[8, 9, 10, 11, 12, 13, 14, 15].map((r) => (
          <Byte key={r} label={`R${r}:`} value={`$${toHexa2(ay.regs[r])}`} />
        ))}
      </Row>
      <Row>
        <LabeledText label={t("panels.spectrum.ay.selected")} labelWidth={LABEL_WIDTH} value={`R${ay.selected}`} />
      </Row>
      {["A", "B", "C"].map((ch, i) => (
        <Row key={ch}>
          <LabeledText
            label={t("panels.spectrum.ay.channel", { channel: ch })}
            labelWidth={LABEL_WIDTH}
            value={t(
              state.mixer[i].tone
                ? state.mixer[i].noise
                  ? "panels.spectrum.ay.toneNoiseOn"
                  : "panels.spectrum.ay.toneNoiseOff"
                : state.mixer[i].noise
                  ? "panels.spectrum.ay.toneOffNoiseOn"
                  : "panels.spectrum.ay.toneOffNoiseOff",
              {
                period: state.tone[i],
                volume:
                  state.volume[i] === "envelope" ? t("panels.spectrum.ay.envelope") : String(state.volume[i])
              }
            )}
          />
        </Row>
      ))}
      <Row>
        <LabeledText
          label={t("panels.spectrum.ay.noiseEnv")}
          labelWidth={LABEL_WIDTH}
          value={t("panels.spectrum.ay.noiseEnvValue", {
            noise: state.noise,
            period: state.envelopePeriod,
            shape: `$${toHexa2(state.envelopeShape)}`
          })}
        />
      </Row>
      {ay.on48k && (
        <Row>
          <Text text={t("panels.spectrum.ay.on48k")} />
        </Row>
      )}
    </ExpandableRow>
  );
};

const VIEW_NAMES: Readonly<Record<SpectrumBankView, string>> = labelRecord({
  memory: "panels.helpers.view.memory",
  disassembly: "panels.helpers.view.disassembly"
});
const VIEWS: SpectrumBankView[] = ["memory", "disassembly"];

/** Every RAM bank in the shared bank browser; a bank pops out as its own document */
const BanksSection = ({ ctx, info, fullPath }: SectionProps & { fullPath: string }) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const { navigationHistoryService, projectService } = useAppServices();
  /*
   * The snapshot's annotations (`<snapshot>.dis`, `.plans/REVERSE_ENGINEERING_ANNOTATIONS_PLAN.md`
   * §4.6): a popped-out bank is annotated when the file exists, and the banner creates it, as the
   * NEX viewer's does. Loading the snapshot into the machine (`zx-snapshot`) makes the same file the
   * active annotation set.
   */
  const annotationMachine = useMemo(
    () => annotationMachineFor(mapSpectrumSnapshotToKlive(info.snapshot).machineId),
    [info]
  );
  const annotationPath = `${fullPath}.dis`;
  const [annotationStatus, setAnnotationStatus] = useState<AnnotationFileStatus>("loading");
  const [annotationDetails, setAnnotationDetails] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    void loadAnnotationSidecar(projectService, { fullPath: annotationPath }).then((state) => {
      if (cancelled) return;
      setAnnotationStatus(state.status);
      setAnnotationDetails(state.message);
      if (state.status === "loaded" && state.annotations) {
        seedAnnotationSession(annotationPath, state.annotations);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [annotationPath, projectService]);
  const createAnnotations = async () => {
    if (!annotationMachine) return;
    try {
      const state = await createAnnotationSidecar(
        projectService,
        { fullPath: annotationPath },
        {
          machine: annotationMachine,
          nexPath: fullPath,
          loadedBanks: [...info.snapshot.ram.keys()],
          getDefaultOffsetIndex: (bank) =>
            bankSpaceForAnnotationMachine(annotationMachine)?.defaultOffsetIndex(bank) ?? 3
        }
      );
      setAnnotationStatus(state.status);
      setAnnotationDetails(state.message);
      if (state.annotations) seedAnnotationSession(annotationPath, state.annotations);
    } catch (err) {
      setAnnotationStatus("error");
      setAnnotationDetails(err instanceof Error ? err.message : String(err));
    }
  };
  const annotated = annotationStatus === "loaded" && !!annotationMachine;
  const projectFolder = useSelector((s) => s.project?.folderPath);
  const bankView = ctx.viewState?.bankView;
  const items = useMemo(() => spectrumBankItems(info.snapshot, bankView), [info, bankView]);
  const filter = ctx.viewState?.bankFilter ?? "all";
  const visible = filter === "paged" ? items.filter((i) => i.pagedAt !== undefined) : items;

  const popOut = async (item: SpectrumBankItem, view: SpectrumBankView) => {
    ctx.changeViewState((vs) => {
      vs.bankView = { ...vs.bankView, [item.bank]: view };
    });
    // --- Recorded, so Go Back returns here (and Go Forward reopens the bank, even once closed)
    await navigationHistoryService.recordJump("spectrumBank", () =>
      openStaticMemoryDump(
        documentHubService,
        spectrumBankDumpId(fullPath, item.bank),
        spectrumBankDumpTitle(fullPath, item.bank, projectFolder),
        item.bytes,
        {
          disassemblyEnabled: true,
          disassOffset: item.listedAt,
          viewMode: view,
          ...(annotated
            ? { annotationPath, annotationBank: item.bank, annotationMachine }
            : {})
        }
      )
    );
  };

  return (
    <>
    {annotationMachine && (
      <AnnotationFileBanner
        status={annotationStatus}
        details={annotationDetails}
        onCreate={() => void createAnnotations()}
      />
    )}
    <BankBrowser<SpectrumBankItem, SpectrumBankView>
      visibleItems={visible}
      selectedKey={ctx.viewState?.selectedBank === undefined ? undefined : `${ctx.viewState.selectedBank}`}
      heading={t("panels.spectrum.banksHeading")}
      summary={t("panels.helpers.banksSummary", {
        banks: items.length,
        kb: items.length * 16,
        paged: items.filter((i) => i.pagedAt !== undefined).length
      })}
      filters={[
        { value: "all", text: t("panels.spectrum.filter.allBanks") },
        { value: "paged", text: t("panels.helpers.filter.pagedIn") }
      ]}
      filter={filter}
      views={VIEWS}
      viewNames={VIEW_NAMES}
      formatNumber={(item) => `${item.bank}`}
      onSelect={(item) => ctx.changeViewState((vs) => (vs.selectedBank = item.bank))}
      onFilterChange={(f) => ctx.changeViewState((vs) => (vs.bankFilter = f))}
      onPopOut={(item, view) => void popOut(item, view)}
      renderRow={(item) => (
        <>
          <Marks item={item} />
          {item.pagedAt !== undefined && (
            <BankChip alt title={t("panels.helpers.pagedInAt", { address: `$${toHexa4(item.pagedAt)}` })}>
              {`$${toHexa4(item.pagedAt)}`}
            </BankChip>
          )}
          {item.screen && (
            <BankChip title={t("panels.helpers.screenChipTitle")}>{t("panels.helpers.screenChip")}</BankChip>
          )}
          <BankRowText>{item.empty ? t("panels.helpers.empty") : ""}</BankRowText>
        </>
      )}
      renderDetailsMarks={(item) => <Marks item={item} />}
      renderDetails={(item) => (
        <BankFacts>
          <dt>{t("panels.helpers.fact.pagedIn")}</dt>
          <dd>
            {item.pagedAt !== undefined
              ? t("panels.helpers.fact.pagedInAt", { address: `$${toHexa4(item.pagedAt)}` })
              : t("panels.helpers.fact.no")}
          </dd>
          <dt>{t("panels.helpers.fact.listedAt")}</dt>
          <dd>{`$${toHexa4(item.listedAt)}`}</dd>
          <dt>{t("panels.helpers.fact.lastView")}</dt>
          <dd>{VIEW_NAMES[item.lastView]}</dd>
          {item.empty && (
            <>
              <dt>{t("panels.helpers.fact.contents")}</dt>
              <dd>{t("panels.spectrum.allValue", { value: `$${toHexa2(item.bytes[0])}` })}</dd>
            </>
          )}
        </BankFacts>
      )}
      hint={t("panels.helpers.popOutHint.bank")}
    />
    </>
  );
};

/** The PC and SP chips */
const Marks = ({ item }: { item: SpectrumBankItem }) => {
  const t = useT();
  return (
    <>
      {item.pc !== undefined && (
        <BankChip title={t("panels.helpers.pcChip")}>{`PC $${toHexa4(item.pc)}`}</BankChip>
      )}
      {item.sp !== undefined && (
        <BankChip alt title={t("panels.helpers.spChip")}>{`SP $${toHexa4(item.sp)}`}</BankChip>
      )}
    </>
  );
};

const FileSection = ({ ctx, info }: SectionProps) => {
  const t = useT();
  const { snapshot } = info;
  const p = snapshot.peripherals;
  return (
    <ExpandableRow
      heading={t("panels.spectrum.fileHeading", { format: snapshot.format })}
      initialExpanded={ctx.viewState?.fileExpanded ?? false}
      onExpanded={(exp) => ctx.changeViewState((vs) => (vs.fileExpanded = exp))}
    >
      <Row>
        <LabeledText
          label={t("panels.helpers.label.machine")}
          labelWidth={LABEL_WIDTH}
          value={snapshotMachineName(snapshot.machine)}
        />
      </Row>
      {snapshot.header.map((item, index) => (
        <Row key={`h${index}`}>
          <LabeledText label={`${item.label}:`} labelWidth="26ch" value={item.value} />
        </Row>
      ))}
      {p.tape && (
        <Row>
          <LabeledText
            label={t("panels.helpers.media.tape")}
            labelWidth={LABEL_WIDTH}
            value={
              p.tape.embedded
                ? t("panels.spectrum.tapeEmbedded", {
                    extension: p.tape.extension ?? "",
                    count: p.tape.embedded.length,
                    block: p.tape.currentBlock
                  })
                : t("panels.spectrum.tapeFile", { file: p.tape.fileName ?? "", block: p.tape.currentBlock })
            }
          />
        </Row>
      )}
      {p.plus3 && (
        <Row>
          <LabeledText
            label={t("panels.spectrum.plus3Drives")}
            labelWidth={LABEL_WIDTH}
            value={t(p.plus3.motorOn ? "panels.spectrum.drivesMotorOn" : "panels.spectrum.drivesMotorOff", {
              drives: p.plus3.drives
            })}
          />
        </Row>
      )}
      {p.plus3?.disks.map((disk, index) => (
        <Row key={`d${index}`}>
          <LabeledText
            label={t("panels.spectrum.drive", { drive: disk.drive ? "B" : "A" })}
            labelWidth={LABEL_WIDTH}
            value={disk.fileName ?? t("panels.spectrum.embeddedImage")}
          />
        </Row>
      ))}
      {snapshot.chunks?.map((chunk, index) => (
        <Row key={`c${index}`}>
          <LabeledText
            label={index === 0 ? t("panels.spectrum.chunks") : ""}
            labelWidth={LABEL_WIDTH}
            value={t(chunk.known ? "panels.spectrum.chunk" : "panels.spectrum.chunkNotRead", {
              id: chunk.id,
              count: chunk.size
            })}
          />
        </Row>
      ))}
    </ExpandableRow>
  );
};
