import {
  BankBrowser,
  BankChip,
  BankDetailsSection,
  BankFacts,
  BankGroupLabel,
  BankRowText
} from "@renderer/controls/bankBrowser/BankBrowser";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import { labelRecord } from "@common/i18n/labels";
import { useT } from "@common/i18n/useT";
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

export const Z88_VIEW_NAMES: Readonly<Record<Z88BankView, string>> = labelRecord({
  memory: "panels.helpers.view.memory",
  disassembly: "panels.helpers.view.disassembly"
});

/** A hybrid card's half, worded: the half values are data ("RAM", "flash") */
function halfText(t: ReturnType<typeof useT>, half: Z88BankItem["half"]): string {
  return half === "RAM" ? t("panels.z88.half.ram") : t("panels.z88.half.flash");
}

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
  const t = useT();
  const cardByKey = new Map(cards.map((card) => [card.key, card]));
  const totalKb = Math.round(items.reduce((sum, item) => sum + item.size, 0) / 1024);
  const pagedIn = items.filter((item) => item.placements.length > 0).length;

  return (
    <BankBrowser<Z88BankItem, Z88BankView>
      visibleItems={filterZ88Banks(items, filter)}
      selectedKey={selectedBank === undefined ? undefined : `${selectedBank}`}
      heading={t("panels.z88.slotsHeading")}
      summary={t("panels.helpers.banksSummary", {
        banks: items.length,
        kb: totalKb,
        paged: pagedIn
      })}
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
                  meta={
                    card.loadable
                      ? t("panels.z88.cardMetaLoads", {
                          type: card.typeName,
                          kb: card.sizeK,
                          klive: card.klive
                        })
                      : t("panels.z88.cardMeta", {
                          type: card.typeName,
                          kb: card.sizeK,
                          reason: card.klive
                        })
                  }
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
              title={t("panels.helpers.pagedInAt", {
                address: `$${toHexa4(placement.start)}-$${toHexa4(placement.end)}`
              })}
            >
              {placement.name}
            </BankChip>
          ))}
          {item.breakpoints.length > 0 && (
            <BankChip title={t("panels.z88.bpChipTitle")}>
              {`BP ${item.breakpoints.length}`}
            </BankChip>
          )}
          <BankRowText>
            {item.half ? halfText(t, item.half) : item.empty ? t("panels.helpers.empty") : ""}
          </BankRowText>
        </>
      )}
      renderDetailsMarks={(item) => <Marks item={item} />}
      renderDetails={(item) => <Details item={item} card={cardByKey.get(item.cardKey)} />}
      hint={t("panels.helpers.popOutHint.bank")}
    />
  );
};

/** The PC and SP chips. */
const Marks = ({ item }: { item: Z88BankItem }) => {
  const t = useT();
  return (
    <>
      {item.pc !== undefined && (
        <BankChip title={t("panels.helpers.pcChip")}>{`PC $${toHexa4(item.pc)}`}</BankChip>
      )}
      {item.sp !== undefined && (
        <BankChip alt title={t("panels.helpers.spChip")}>
          {`SP $${toHexa4(item.sp)}`}
        </BankChip>
      )}
    </>
  );
};

const Details = ({ item, card }: { item: Z88BankItem; card?: Z88ViewedCard }) => {
  const t = useT();
  return (
    <>
      <BankFacts>
        <dt>{t("panels.z88.fact.card")}</dt>
        <dd>
          {card
            ? item.half
              ? t("panels.z88.cardWithHalf", { card: card.title, half: halfText(t, item.half) })
              : card.title
            : "?"}
        </dd>
        <dt>{t("panels.tape.fact.size")}</dt>
        <dd>{item.size >= 1024 ? `${Math.round(item.size / 1024)} KB` : `${item.size} B`}</dd>
        <dt>{t("panels.helpers.fact.pagedIn")}</dt>
        <dd>
          {item.placements.length === 0
            ? t("panels.helpers.fact.no")
            : item.placements
                .map((p) => `${p.name}: $${toHexa4(p.start)}-$${toHexa4(p.end)}`)
                .join(", ")}
        </dd>
        <dt>{t("panels.z88.fact.mirrors")}</dt>
        <dd>{formatZ88Mirrors(item.mirrors)}</dd>
        <dt>{t("panels.helpers.fact.listedAt")}</dt>
        <dd>{`$${toHexa4(item.listedAt)}`}</dd>
        <dt>{t("panels.helpers.fact.lastView")}</dt>
        <dd>{Z88_VIEW_NAMES[item.lastView]}</dd>
        {item.empty && (
          <>
            <dt>{t("panels.helpers.fact.contents")}</dt>
            <dd>
              {item.erasedValue === 0
                ? t("panels.z88.allZero")
                : t("panels.z88.erased", { value: `$${toHexa2(item.erasedValue)}` })}
            </dd>
          </>
        )}
      </BankFacts>

      {item.breakpoints.length > 0 && (
        <BankDetailsSection
          title={t("panels.z88.ozvmBreakpoints", { count: item.breakpoints.length })}
        >
          <BankFacts>
            {item.breakpoints.map((bp, index) => (
              <Breakpoint key={index} bank={item.bank} offset={bp.offset} display={bp.display} />
            ))}
          </BankFacts>
        </BankDetailsSection>
      )}
    </>
  );
};

const Breakpoint = ({
  bank,
  offset,
  display
}: {
  bank: number;
  offset: number;
  display: boolean;
}) => {
  const t = useT();
  return (
    <>
      <dt>{`$${toHexa2(bank)}:$${toHexa4(offset)}`}</dt>
      <dd>{display ? t("panels.z88.bpDisplay") : t("panels.z88.bpStops")}</dd>
    </>
  );
};
