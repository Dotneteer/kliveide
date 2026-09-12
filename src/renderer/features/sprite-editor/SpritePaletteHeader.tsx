import styles from "./SpriteEditor.module.scss";
import classnames from "classnames";
import { memo } from "react";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { SpritePaletteSource } from "./useSpritePalette";

type Props = {
  source: SpritePaletteSource;
  shownBank: 0 | 1;
  liveBank: 0 | 1 | undefined;
  onPinBank: (bank: 0 | 1) => void;
};

const BANK_NAMES = ["First", "Second"] as const;

/**
 * Says which palette the editor is drawing with, and lets the user look at the other bank.
 *
 * The vocabulary is the sidebar's, deliberately: **the fill is the bank you are looking at, the
 * ring is the bank the machine is drawing with.** The two coincide by default, so the ring is
 * invisible until the view is pinned away from the hardware - which is exactly when it has
 * something to say. Reusing the meaning rather than inventing a second one is the point; a user who
 * has learned the sidebar control already knows this one.
 */
export const SpritePaletteHeader = memo(({ source, shownBank, liveBank, onPinBank }: Props) => {
  const ref = useTooltipRef<HTMLSpanElement>();

  if (source === "default") {
    return (
      <div className={styles.paletteHeader}>
        <span ref={ref} className={styles.paletteFallback}>
          No machine &mdash; default ramp
        </span>
        <TooltipFactory
          refElement={ref.current}
          placement="bottom"
          content={
            "The sprite palette is read from the running machine (Next Reg $43, bit 3).\n" +
            "With no Next machine running, the editor falls back to the index ramp 0-255,\n" +
            "which cannot express the Next's low blue bit - so it has no pure white and no pure blue."
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.paletteHeader}>
      <span className={styles.paletteLabel}>Sprite palette</span>
      <span className={styles.bankSwitch} role="group" aria-label="Sprite palette bank">
        {([0, 1] as const).map((bank) => (
          <BankButton
            key={bank}
            bank={bank}
            isShown={shownBank === bank}
            isLive={liveBank === bank}
            clicked={() => onPinBank(bank)}
          />
        ))}
      </span>
    </div>
  );
});

type BankButtonProps = {
  bank: 0 | 1;
  isShown: boolean;
  isLive: boolean;
  clicked: () => void;
};

const BankButton = ({ bank, isShown, isLive, clicked }: BankButtonProps) => {
  const ref = useTooltipRef<HTMLButtonElement>();
  return (
    <>
      <button
        ref={ref}
        type="button"
        className={classnames(styles.bankButton, {
          [styles.bankShown]: isShown,
          [styles.bankLive]: isLive
        })}
        aria-pressed={isShown}
        aria-label={`${BANK_NAMES[bank]} sprite palette${isLive ? " (live)" : ""}`}
        onClick={clicked}
      >
        {bank + 1}
      </button>
      <TooltipFactory
        refElement={ref.current}
        placement="bottom"
        content={
          `${BANK_NAMES[bank]} sprite palette\n` +
          (isLive ? "Live - the machine is drawing with this bank\n" : "") +
          "Reg $43, bit 3"
        }
      />
    </>
  );
};
