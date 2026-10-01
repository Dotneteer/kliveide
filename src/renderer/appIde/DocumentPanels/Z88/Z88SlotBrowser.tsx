import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankGroupLabel,
  BankRowText
} from "@renderer/controls/bankBrowser/BankBrowser";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  filterZ88Banks,
  formatZ88Mirrors,
  z88SlotFilters,
  type Z88BankItem,
  type Z88BankView,
  type Z88SlotFilter,
  type Z88ViewedCard
} from "./z88SnapshotView";

/*
 * The `.z88` viewer's slots: every bank of every card in one list, grouped by card, with the selected
 * bank's details beside it (`.plans/Z88_SLOT_BROWSER_PLAN.md` §4.3). The list, keyboard and pop-out
 * are the shared `BankBrowser` shell; this adds what a snapshot knows about a bank - where it is paged
 * in, its mirrors, PC and SP, and OZvm's breakpoints. No annotations and no Sprites view.
 *
 * Like `NexBankBrowser`, it decides nothing about files or documents: the viewer hands it the items
 * and callbacks.
 */

export const Z88_VIEW_NAMES: Record<Z88BankView, string> = {
  memory: "Memory",
  disassembly: "Disassembly"
};

const VIEWS: Z88BankView[] = ["memory", "disassembly"];

type Props = {
  items: Z88BankItem[];
  cards: Z88ViewedCard[];
  selectedBank?: number;
  filter: Z88SlotFilter;
  onSelect: (bank: number) => void;
  onFilterChange: (filter: Z88SlotFilter) => void;
  onPopOut: (bank: number, view: Z88BankView) => void;
};

export const Z88SlotBrowser = ({
  items,
  cards,
  selectedBank,
  filter,
  onSelect,
  onFilterChange,
  onPopOut
}: Props) => {
  const cardByKey = new Map(cards.map((card) => [card.key, card]));
  const totalKb = Math.round(items.reduce((sum, item) => sum + item.size, 0) / 1024);
  const pagedIn = items.filter((item) => item.placements.length > 0).length;

  return (
    <BankBrowser<Z88BankItem, Z88BankView>
      visibleItems={filterZ88Banks(items, filter)}
      selectedKey={selectedBank === undefined ? undefined : `${selectedBank}`}
      heading="Slots"
      summary={`${items.length} bank${items.length === 1 ? "" : "s"} · ${totalKb} KB · ${pagedIn} paged in`}
      filters={z88SlotFilters(cards)}
      filter={filter}
      views={VIEWS}
      viewNames={Z88_VIEW_NAMES}
      onSelect={(item) => onSelect(item.bank)}
      onFilterChange={onFilterChange}
      onPopOut={(item, view) => onPopOut(item.bank, view)}
      groupOf={(item) => {
        const card = cardByKey.get(item.cardKey);
        return card
          ? {
              key: card.key,
              label: (
                <BankGroupLabel
                  title={card.title}
                  meta={`${card.typeName}, ${card.sizeK}K · ${
                    card.loadable ? `loads as ${card.klive}` : card.klive
                  }`}
                />
              )
            }
          : undefined;
      }}
      renderRow={(item) => (
        <>
          <Marks item={item} />
          {item.placements.map((placement) => (
            <BankChip
              key={placement.name}
              alt
              title={`Paged in at $${toHexa4(placement.start)}-$${toHexa4(placement.end)}`}
            >
              {placement.name}
            </BankChip>
          ))}
          {item.breakpoints.length > 0 && (
            <BankChip title="Breakpoints saved in the snapshot by OZvm">
              {`BP ${item.breakpoints.length}`}
            </BankChip>
          )}
          <BankRowText>
            {item.half ? `${item.half} half` : item.empty ? "empty" : ""}
          </BankRowText>
        </>
      )}
      renderDetailsMarks={(item) => <Marks item={item} />}
      renderDetails={(item) => <Details item={item} card={cardByKey.get(item.cardKey)} />}
      hint="Pop out a bank from its row's icon, by double-clicking the row, or with Enter."
    />
  );
};

/** The PC and SP chips. */
const Marks = ({ item }: { item: Z88BankItem }) => (
  <>
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

const Details = ({ item, card }: { item: Z88BankItem; card?: Z88ViewedCard }) => (
  <>
    <BankFacts>
      <dt>Card</dt>
      <dd>{card ? `${card.title}${item.half ? `, ${item.half} half` : ""}` : "?"}</dd>
      <dt>Size</dt>
      <dd>{item.size >= 1024 ? `${Math.round(item.size / 1024)} KB` : `${item.size} B`}</dd>
      <dt>Paged in</dt>
      <dd>
        {item.placements.length === 0
          ? "no"
          : item.placements
              .map((p) => `${p.name}: $${toHexa4(p.start)}-$${toHexa4(p.end)}`)
              .join(", ")}
      </dd>
      <dt>Mirrors</dt>
      <dd>{formatZ88Mirrors(item.mirrors)}</dd>
      <dt>Listed at</dt>
      <dd>{`$${toHexa4(item.listedAt)}`}</dd>
      <dt>Last view</dt>
      <dd>{Z88_VIEW_NAMES[item.lastView]}</dd>
      {item.empty && (
        <>
          <dt>Contents</dt>
          <dd>{item.erasedValue === 0 ? "All zero" : `Erased (all $${toHexa2(item.erasedValue)})`}</dd>
        </>
      )}
    </BankFacts>

    {item.breakpoints.length > 0 && (
      <BankDetailsSection title={`OZvm breakpoints (${item.breakpoints.length})`}>
        <BankFacts>
          {item.breakpoints.map((bp, index) => (
            <Breakpoint key={index} bank={item.bank} offset={bp.offset} display={bp.display} />
          ))}
        </BankFacts>
      </BankDetailsSection>
    )}
  </>
);

const Breakpoint = ({ bank, offset, display }: { bank: number; offset: number; display: boolean }) => (
  <>
    <dt>{`$${toHexa2(bank)}:$${toHexa4(offset)}`}</dt>
    <dd>{display ? "display only" : "stops"}</dd>
  </>
);
