import classnames from "classnames";
import { Icon } from "@renderer/controls/Icon";
import { ContextMenuItem } from "@renderer/controls/ContextMenu";
import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankRowText
} from "@renderer/controls/bankBrowser/BankBrowser";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  BANK_BREAKPOINT_KIND_ICONS,
  bankBreakpointMark,
  describeBankBreakpoints,
  type BankBreakpointSummary
} from "./nexBankGutter";
import { flattenBankComment } from "@renderer/appIde/annotations/annotationEdits";
import {
  contentMixPercent,
  formatMixPercent,
  NEX_REGION_TYPES,
  mixLegendTypes,
  type NexBankContentMix,
  type NexBankLabel
} from "./nexBankSummary";
import type { AnnotationRegionType } from "@renderer/appIde/annotations/programAnnotations";
import styles from "./NexBankBrowser.module.scss";

/*
 * The NEX viewer's banks: a list on one side and the selected bank's details on the other.
 *
 * It replaced one expandable panel per bank, whose content — the first 64 bytes of the bank — said
 * almost nothing about it. The list is for finding a bank; the details say what the annotation file
 * knows about it; either pops the bank out into its own document, which is where its bytes are read.
 *
 * The component decides nothing about files or documents: the viewer hands it one summary per bank and
 * callbacks for what the user asks to do. The list, details frame, keyboard and pop-out are the shared
 * `BankBrowser` shell; this file adds what only a NEX has - breakpoints, the content mix, comments and
 * labels from the annotation file, and the Sprites view.
 */

export type NexBankView = "memory" | "disassembly" | "sprites";

export type NexBankBrowserItem = {
  bank: number;
  size: number;
  empty: boolean;
  annotated: boolean;
  /** The bank has an entry in the annotation file, so it can take a comment. */
  hasAnnotation: boolean;
  pc?: number;
  sp?: number;
  breakpoints?: BankBreakpointSummary;
  comment?: string;
  /** The address byte 0 of the bank is listed at. */
  listedAt: number;
  /** The view a pop-out opens in. */
  lastView: NexBankView;
  /** Sprite format the annotation file records, when it records one. */
  spriteFormat?: "8bit" | "4bit";
  /** Bytes per region type; absent when there is no annotation file to hold regions. */
  mix?: NexBankContentMix;
  labels: NexBankLabel[];
};

export type NexBankFilter = "all" | "nonEmpty" | "annotated";

type Props = {
  items: NexBankBrowserItem[];
  selectedBank?: number;
  filter: NexBankFilter;
  /** Whether the Sprites view is available — it needs the annotation file. */
  spritesAvailable: boolean;
  onSelect: (bank: number) => void;
  onFilterChange: (filter: NexBankFilter) => void;
  onPopOut: (bank: number, view: NexBankView) => void;
  onEditComment: (bank: number) => void;
  onClearComment: (bank: number) => void;
};

export const VIEW_NAMES: Record<NexBankView, string> = {
  memory: "Memory",
  disassembly: "Disassembly",
  sprites: "Sprites"
};

const REGION_NAMES: Record<AnnotationRegionType, string> = {
  disassemble: "Code",
  bytes: "Bytes",
  words: "Words",
  copper: "Copper",
  dma: "DMA",
  text: "Text",
  graphic: "Graphics",
  skip: "Skip"
};

const LABELS_SHOWN = 16;

const FILTERS: { value: NexBankFilter; text: string }[] = [
  { value: "all", text: "All" },
  { value: "nonEmpty", text: "Non-empty" },
  { value: "annotated", text: "Annotated" }
];

export function filterBanks(
  items: NexBankBrowserItem[],
  filter: NexBankFilter
): NexBankBrowserItem[] {
  switch (filter) {
    case "nonEmpty":
      return items.filter((item) => !item.empty);
    case "annotated":
      return items.filter((item) => item.annotated);
    default:
      return items;
  }
}

export const NexBankBrowser = ({
  items,
  selectedBank,
  filter,
  spritesAvailable,
  onSelect,
  onFilterChange,
  onPopOut,
  onEditComment,
  onClearComment
}: Props) => {
  const visible = filterBanks(items, filter).map(toShellItem);
  const totalKb = Math.round(items.reduce((sum, item) => sum + item.size, 0) / 1024);
  const withBreakpoints = items.filter((item) => item.breakpoints?.total).length;
  const views: NexBankView[] = spritesAvailable
    ? ["memory", "disassembly", "sprites"]
    : ["memory", "disassembly"];

  return (
    <BankBrowser<NexShellItem, NexBankView>
      visibleItems={visible}
      selectedKey={selectedBank === undefined ? undefined : `${selectedBank}`}
      heading="Banks"
      summary={
        <>
          {`${items.length} bank${items.length === 1 ? "" : "s"} · ${totalKb} KB`}
          {withBreakpoints > 0 && ` · ${withBreakpoints} with breakpoints`}
        </>
      }
      filters={FILTERS}
      filter={filter}
      views={views}
      viewNames={VIEW_NAMES}
      onSelect={(item) => onSelect(item.bank)}
      onFilterChange={(value) => onFilterChange(value as NexBankFilter)}
      onPopOut={(item, view) => onPopOut(item.bank, view)}
      renderRow={(item) => (
        <>
          <BankMarks item={item} />
          <BankRowText title={item.comment}>
            {item.comment ? flattenBankComment(item.comment) : item.empty ? "empty" : ""}
          </BankRowText>
          {item.mix && <MixBar mix={item.mix} className={styles.rowBar} />}
        </>
      )}
      renderDetailsMarks={(item) => <BankMarks item={item} withBreakpoints={false} />}
      renderDetails={(item) => <BankDetails item={item} onEditComment={onEditComment} />}
      renderRowMenuItems={(item, close) => (
        <>
          <ContextMenuItem
            text="Bank Comment..."
            disabled={!item.hasAnnotation}
            clicked={() => {
              close();
              onEditComment(item.bank);
            }}
          />
          <ContextMenuItem
            text="Clear Bank Comment"
            disabled={!item.comment}
            clicked={() => {
              close();
              onClearComment(item.bank);
            }}
          />
        </>
      )}
      hint="Pop out a bank from its row's icon, by double-clicking the row, or with Enter."
    />
  );
};

type NexShellItem = NexBankBrowserItem & { key: string };

const toShellItem = (item: NexBankBrowserItem): NexShellItem => ({ ...item, key: `${item.bank}` });

// ─── Rows ────────────────────────────────────────────────────────────────────

/**
 * The `BP` chip: a solid label that says what it is, then the gutter's type glyph and count for each
 * kind. A bare number said nothing until hovered.
 */
const BreakpointChip = ({ summary }: { summary?: BankBreakpointSummary }) => {
  const mark = bankBreakpointMark(summary);
  if (!mark) return null;
  return (
    <span
      className={classnames(styles.bpChip, { [styles.bpChipOff]: mark.off })}
      title={mark.title}
      role="img"
      aria-label={mark.title}
    >
      <span className={styles.bpLabel}>BP</span>
      <span className={styles.bpCounts}>
        {mark.counts.map(({ kind, count }) => (
          <span key={kind} className={styles.bpCount}>
            <Icon
              iconName={BANK_BREAKPOINT_KIND_ICONS[kind]}
              width={12}
              height={12}
              fill="currentColor"
            />
            {count}
          </span>
        ))}
      </span>
    </span>
  );
};

/** The breakpoint chip, and the PC and SP marks. */
const BankMarks = ({
  item,
  withBreakpoints = true
}: {
  item: NexBankBrowserItem;
  withBreakpoints?: boolean;
}) => {
  return (
    <>
      {withBreakpoints && <BreakpointChip summary={item.breakpoints} />}
      {item.pc !== undefined && (
        <BankChip title="The program counter points into this bank">
          {`PC $${toHexa4(item.pc)}`}
        </BankChip>
      )}
      {item.sp !== undefined && (
        <BankChip alt title="The stack pointer points into this bank">
          {`SP $${toHexa4(item.sp)}`}
        </BankChip>
      )}
    </>
  );
};

const MixBar = ({ mix, className }: { mix: NexBankContentMix; className?: string }) => (
  <span
    className={classnames(styles.mixBar, className)}
    role="img"
    aria-label={mixLegendTypes(mix).map(
      (t) => `${REGION_NAMES[t]} ${formatMixPercent(mix, t)}`
    ).join(", ")}
    title={mixLegendTypes(mix).map((t) => `${REGION_NAMES[t]} ${formatMixPercent(mix, t)}`).join(
      " · "
    )}
  >
    {NEX_REGION_TYPES.map((type) => (
      <span
        key={type}
        className={styles[`mix_${type}`]}
        style={{ width: `${contentMixPercent(mix, type)}%` }}
      />
    ))}
  </span>
);

// ─── Details ─────────────────────────────────────────────────────────────────

const BankDetails = ({
  item,
  onEditComment
}: {
  item: NexBankBrowserItem;
  onEditComment: (bank: number) => void;
}) => {
  const shownLabels = item.labels.slice(0, LABELS_SHOWN);

  return (
    <>
      <BankFacts>
        <dt>Size</dt>
        <dd>{item.size >= 1024 ? `${Math.round(item.size / 1024)} KB` : `${item.size} B`}</dd>
        {item.breakpoints && item.breakpoints.total > 0 && (
          <>
            <dt>Breakpoints</dt>
            <dd className={styles.bpKinds}>
              {describeBankBreakpoints(item.breakpoints).map(({ kind, text }) => (
                <span key={kind} className={styles.bpKind}>
                  <Icon
                    iconName={BANK_BREAKPOINT_KIND_ICONS[kind]}
                    width={13}
                    height={13}
                    fill="--color-breakpoint-binary"
                  />
                  {text}
                </span>
              ))}
            </dd>
          </>
        )}
        <dt>Listed at</dt>
        <dd>{`$${toHexa4(item.listedAt)}`}</dd>
        <dt>Last view</dt>
        <dd>{VIEW_NAMES[item.lastView]}</dd>
        {item.spriteFormat && (
          <>
            <dt>Sprites</dt>
            <dd>{item.spriteFormat === "4bit" ? "4-bit" : "8-bit"}</dd>
          </>
        )}
        {item.empty && (
          <>
            <dt>Contents</dt>
            <dd>All zero</dd>
          </>
        )}
      </BankFacts>

      <BankDetailsSection title="Content mix">
        {item.mix ? (
          <>
            <MixBar mix={item.mix} className={styles.detailsBar} />
            <div className={styles.legend}>
              {mixLegendTypes(item.mix).map((type) => (
                <span key={type}>
                  <span className={classnames(styles.swatch, styles[`mix_${type}`])} />
                  {`${REGION_NAMES[type]} ${formatMixPercent(item.mix!, type)}`}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.muted}>
            Regions are recorded in the annotation file, which this NEX does not have yet.
          </div>
        )}
      </BankDetailsSection>

      <BankDetailsSection title="Comment">
        {item.comment ? (
          <>
            <div className={styles.comment}>{item.comment}</div>
            <div>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => onEditComment(item.bank)}
              >
                Edit comment...
              </button>
            </div>
          </>
        ) : item.hasAnnotation ? (
          <div>
            <span className={styles.muted}>No comment. </span>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => onEditComment(item.bank)}
            >
              Add comment...
            </button>
          </div>
        ) : (
          <div className={styles.muted}>
            Comments are kept in the annotation file, which this NEX does not have yet.
          </div>
        )}
      </BankDetailsSection>

      {item.labels.length > 0 && (
        <BankDetailsSection title={`Labels (${item.labels.length})`}>
          <div className={styles.labels}>
            {shownLabels.map((label) => (
              <span
                key={`${label.scope}:${label.name}`}
                title={`${label.scope === "global" ? "Global" : "Bank"} label`}
              >
                <span className={styles.labelName}>{label.name}</span>
                {` $${toHexa4(label.address)}`}
              </span>
            ))}
            {item.labels.length > shownLabels.length && (
              <span
                className={styles.muted}
              >{`+${item.labels.length - shownLabels.length} more`}</span>
            )}
          </div>
        </BankDetailsSection>
      )}
    </>
  );
};
