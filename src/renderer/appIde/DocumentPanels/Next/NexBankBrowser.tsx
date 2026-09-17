import classnames from "classnames";
import { KeyboardEvent, MouseEvent, useRef } from "react";
import { Icon } from "@renderer/controls/Icon";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  BANK_BREAKPOINT_KIND_ICONS,
  bankBreakpointMark,
  describeBankBreakpoints,
  type BankBreakpointSummary
} from "./nexBankGutter";
import { flattenBankComment } from "./nexAnnotationEdits";
import {
  contentMixPercent,
  NEX_REGION_TYPES,
  type NexBankContentMix,
  type NexBankLabel
} from "./nexBankSummary";
import type { NexAnnotationRegionType } from "./nexAnnotations";
import styles from "./NexBankBrowser.module.scss";

/*
 * The NEX viewer's banks: a list on one side and the selected bank's details on the other.
 *
 * It replaced one expandable panel per bank, whose content — the first 64 bytes of the bank — said
 * almost nothing about it. The list is for finding a bank; the details say what the annotation file
 * knows about it; either pops the bank out into its own document, which is where its bytes are read.
 *
 * The component decides nothing about files or documents: the viewer hands it one summary per bank and
 * callbacks for what the user asks to do.
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

const REGION_NAMES: Record<NexAnnotationRegionType, string> = {
  disassemble: "Code",
  bytes: "Bytes",
  words: "Words",
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
  const visible = filterBanks(items, filter);
  const selected = visible.find((item) => item.bank === selectedBank) ?? visible[0] ?? undefined;
  const listRef = useRef<HTMLDivElement | null>(null);
  const [rowMenuState, rowMenuApi] = useContextMenuState();
  const rowMenuBank = useRef<NexBankBrowserItem>();

  const totalKb = Math.round(items.reduce((sum, item) => sum + item.size, 0) / 1024);
  const withBreakpoints = items.filter((item) => item.breakpoints?.total).length;

  const focusRow = (bank: number) =>
    listRef.current?.querySelector<HTMLElement>(`[data-bank="${bank}"]`)?.focus();

  const listKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!selected || visible.length === 0) return;
    const index = visible.indexOf(selected);
    const moves: Record<string, number> = {
      ArrowDown: 1,
      ArrowUp: -1,
      PageDown: 8,
      PageUp: -8,
      Home: -visible.length,
      End: visible.length
    };
    const move = moves[event.key];
    if (move !== undefined) {
      event.preventDefault();
      event.stopPropagation();
      const next = visible[Math.max(0, Math.min(visible.length - 1, index + move))];
      onSelect(next.bank);
      requestAnimationFrame(() => focusRow(next.bank));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      onPopOut(selected.bank, selected.lastView);
    }
  };

  const openRowMenu = (item: NexBankBrowserItem, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    onSelect(item.bank);
    rowMenuBank.current = item;
    rowMenuApi.show(event);
  };

  return (
    <section className={styles.browser} aria-label="Banks">
      <div className={styles.heading}>
        <span className={styles.title}>Banks</span>
        <span className={styles.summary}>
          {`${items.length} bank${items.length === 1 ? "" : "s"} · ${totalKb} KB`}
          {withBreakpoints > 0 && ` · ${withBreakpoints} with breakpoints`}
        </span>
        <span className={styles.filters} role="group" aria-label="Show banks">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={styles.filter}
              aria-pressed={filter === option.value}
              onClick={() => onFilterChange(option.value)}
            >
              {option.text}
            </button>
          ))}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className={styles.none}>No bank matches this filter.</div>
      ) : (
        <div className={styles.body}>
          <div
            ref={listRef}
            className={styles.list}
            role="listbox"
            aria-label="Bank list"
            onKeyDown={listKeyDown}
          >
            {visible.map((item) => (
              <BankRow
                key={item.bank}
                item={item}
                selected={item === selected}
                onSelect={onSelect}
                onPopOut={onPopOut}
                onContextMenu={openRowMenu}
              />
            ))}
          </div>
          {selected && (
            <BankDetails
              item={selected}
              spritesAvailable={spritesAvailable}
              onPopOut={onPopOut}
              onEditComment={onEditComment}
            />
          )}
        </div>
      )}

      <ContextMenu state={rowMenuState} onClickOutside={rowMenuApi.conceal}>
        <ContextMenuItem
          text={`Pop Out in ${VIEW_NAMES[rowMenuBank.current?.lastView ?? "disassembly"]}`}
          clicked={() => {
            rowMenuApi.conceal();
            const item = rowMenuBank.current;
            if (item) onPopOut(item.bank, item.lastView);
          }}
        />
        <ContextMenuSeparator />
        <ContextMenuItem
          text="Bank Comment..."
          disabled={!rowMenuBank.current?.hasAnnotation}
          clicked={() => {
            rowMenuApi.conceal();
            if (rowMenuBank.current) onEditComment(rowMenuBank.current.bank);
          }}
        />
        <ContextMenuItem
          text="Clear Bank Comment"
          disabled={!rowMenuBank.current?.comment}
          clicked={() => {
            rowMenuApi.conceal();
            if (rowMenuBank.current) onClearComment(rowMenuBank.current.bank);
          }}
        />
      </ContextMenu>
    </section>
  );
};

// ─── Rows ────────────────────────────────────────────────────────────────────

const BankRow = ({
  item,
  selected,
  onSelect,
  onPopOut,
  onContextMenu
}: {
  item: NexBankBrowserItem;
  selected: boolean;
  onSelect: (bank: number) => void;
  onPopOut: (bank: number, view: NexBankView) => void;
  onContextMenu: (item: NexBankBrowserItem, event: MouseEvent<HTMLElement>) => void;
}) => (
  <div
    role="option"
    aria-selected={selected}
    tabIndex={selected ? 0 : -1}
    data-bank={item.bank}
    className={classnames(styles.row, { [styles.rowSelected]: selected })}
    title={`Double-click or Enter to pop out in ${VIEW_NAMES[item.lastView]}`}
    onClick={() => onSelect(item.bank)}
    onDoubleClick={() => onPopOut(item.bank, item.lastView)}
    onContextMenu={(event) => onContextMenu(item, event)}
  >
    <span className={styles.bankNumber}>{`$${toHexa2(item.bank)}`}</span>
    <BankMarks item={item} />
    <span className={styles.rowComment} title={item.comment}>
      {item.comment ? flattenBankComment(item.comment) : item.empty ? "empty" : ""}
    </span>
    {item.mix && <MixBar mix={item.mix} className={styles.rowBar} />}
    <button
      type="button"
      className={styles.rowPopOut}
      title={`Pop out Bank $${toHexa2(item.bank)} (${VIEW_NAMES[item.lastView]})`}
      aria-label={`Pop out Bank $${toHexa2(item.bank)}`}
      onClick={(event) => {
        event.stopPropagation();
        onPopOut(item.bank, item.lastView);
      }}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <Icon
        iconName="square-arrow-out-up-right"
        width={14}
        height={14}
        fill="--color-command-icon"
      />
    </button>
  </div>
);

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
        <span className={styles.chip} title="The program counter points into this bank">
          {`PC $${toHexa4(item.pc)}`}
        </span>
      )}
      {item.sp !== undefined && (
        <span
          className={classnames(styles.chip, styles.chipAlt)}
          title="The stack pointer points into this bank"
        >
          {`SP $${toHexa4(item.sp)}`}
        </span>
      )}
    </>
  );
};

const MixBar = ({ mix, className }: { mix: NexBankContentMix; className?: string }) => (
  <span
    className={classnames(styles.mixBar, className)}
    role="img"
    aria-label={NEX_REGION_TYPES.map(
      (t) => `${REGION_NAMES[t]} ${contentMixPercent(mix, t)}%`
    ).join(", ")}
    title={NEX_REGION_TYPES.map((t) => `${REGION_NAMES[t]} ${contentMixPercent(mix, t)}%`).join(
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
  spritesAvailable,
  onPopOut,
  onEditComment
}: {
  item: NexBankBrowserItem;
  spritesAvailable: boolean;
  onPopOut: (bank: number, view: NexBankView) => void;
  onEditComment: (bank: number) => void;
}) => {
  const [menuState, menuApi] = useContextMenuState();
  const moreRef = useRef<HTMLButtonElement | null>(null);
  const views: NexBankView[] = spritesAvailable
    ? ["memory", "disassembly", "sprites"]
    : ["memory", "disassembly"];
  const shownLabels = item.labels.slice(0, LABELS_SHOWN);

  return (
    <aside className={styles.details} aria-label={`Bank $${toHexa2(item.bank)} details`}>
      <div className={styles.detailsHead}>
        <span className={styles.detailsTitle}>
          <span className={styles.bankNumber}>{`Bank $${toHexa2(item.bank)}`}</span>
          <span className={styles.decimal}>{`(${item.bank})`}</span>
          <BankMarks item={item} withBreakpoints={false} />
        </span>
        <span className={styles.split}>
          <button
            type="button"
            className={styles.splitMain}
            title="Open this bank as its own document"
            aria-label={`Pop out in ${VIEW_NAMES[item.lastView]}`}
            onClick={() => onPopOut(item.bank, item.lastView)}
          >
            <Icon
              iconName="square-arrow-out-up-right"
              width={14}
              height={14}
              fill="--text-on-accent"
            />
            Pop out
            <span className={styles.splitView}>{`· ${VIEW_NAMES[item.lastView]}`}</span>
          </button>
          <button
            ref={moreRef}
            type="button"
            className={styles.splitMore}
            aria-haspopup="menu"
            aria-label="Pop out in another view"
            title="Pop out in another view"
            onClick={() => menuApi.showAt(moreRef.current)}
          >
            <Icon iconName="chevron-down" width={14} height={14} fill="--text-on-accent" />
          </button>
        </span>
        <ContextMenu state={menuState} onClickOutside={menuApi.conceal} placement="bottom-end">
          {views.map((view) => (
            <ContextMenuItem
              key={view}
              text={`Pop Out in ${VIEW_NAMES[view]}`}
              selected={item.lastView === view}
              trailing={item.lastView === view ? "last used" : undefined}
              clicked={() => {
                menuApi.conceal();
                onPopOut(item.bank, view);
              }}
            />
          ))}
        </ContextMenu>
      </div>

      <dl className={styles.facts}>
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
      </dl>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Content mix</div>
        {item.mix ? (
          <>
            <MixBar mix={item.mix} className={styles.detailsBar} />
            <div className={styles.legend}>
              {NEX_REGION_TYPES.map((type) => (
                <span key={type}>
                  <span className={classnames(styles.swatch, styles[`mix_${type}`])} />
                  {`${REGION_NAMES[type]} ${contentMixPercent(item.mix!, type)}%`}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.muted}>
            Regions are recorded in the annotation file, which this NEX does not have yet.
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Comment</div>
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
      </div>

      {item.labels.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>{`Labels (${item.labels.length})`}</div>
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
        </div>
      )}

      <div className={styles.hint}>
        Pop out a bank from its row's icon, by double-clicking the row, or with Enter.
      </div>
    </aside>
  );
};
