import { useId, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import styles from "./MemoryMap.module.scss";

/*
 * The frame toolbar's controls (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` §4.1): segmented
 * controls, switches, and the Go to and Find boxes. One strip of fixed-size controls that wraps,
 * never shrinks ("A Toolbar Of Fixed-Size Controls Wraps; It Never Shrinks").
 */

/** A run of buttons of which one is pressed */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: { value: T; text: string; title?: string; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  return (
    <span className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={styles.segment}
          aria-pressed={value === option.value}
          title={option.title}
          disabled={option.disabled}
          onClick={() => onChange(option.value)}
        >
          {option.text}
        </button>
      ))}
    </span>
  );
}

/** A labelled check box */
export const Check = ({
  label,
  title,
  value,
  onChange
}: {
  label: string;
  title?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className={styles.check} title={title}>
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

/** A labelled group of controls in the toolbar */
export const ToolGroup = ({ label, children }: { label?: string; children: ReactNode }) => (
  <span className={styles.group}>
    {label && <span className={styles.toolLabel}>{label}</span>}
    {children}
  </span>
);

/**
 * The Go to box. Enter sends the text to `onGo`, which answers whether it went somewhere; a refusal
 * marks the box until the text changes, and its reason is the box's tooltip.
 */
export const GoToBox = ({
  label,
  placeholder,
  title,
  suggestions,
  onGo,
  onFocusChange
}: {
  /** The box's name, when it is not "Go to" (a tape block's "List at") */
  label?: string;
  placeholder: string;
  title: string;
  /** Label names for the text so far (a datalist) */
  suggestions?: (text: string) => string[];
  onGo: (text: string) => string | undefined;
  /** The box has focus: the views stop refreshing while the user types (today's AddressInput rule) */
  onFocusChange?: (focused: boolean) => void;
}) => {
  const t = useT();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();
  const listId = useId();
  const options = suggestions?.(text) ?? [];
  return (
    <label className={classnames(styles.box, { [styles.boxError]: !!error })} title={error ?? title}>
      <span className={styles.boxLabel}>{label ?? t("panels.memoryMap.goTo")}</span>
      <input
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        list={options.length ? listId : undefined}
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onChange={(e) => {
          setText(e.target.value);
          setError(undefined);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            const failure = onGo(text);
            setError(failure);
            if (!failure) {
              setText("");
              (e.target as HTMLInputElement).blur();
            }
          } else if (e.key === "Escape") {
            setText("");
            setError(undefined);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      )}
    </label>
  );
};

/**
 * The Find box: the pattern, the `n / m` count and the previous and next buttons. Enter or F3 goes
 * to the next match, Shift+Enter or Shift+F3 to the previous one.
 */
export const FindBox = ({
  placeholder,
  title,
  text,
  count,
  index,
  invalid,
  onTextChange,
  onSearch,
  onStep,
  onFocusChange,
  trailing
}: {
  placeholder: string;
  title: string;
  text: string;
  count: number | undefined;
  index: number;
  invalid?: boolean;
  onTextChange: (text: string) => void;
  onSearch: () => void;
  onStep: (delta: 1 | -1) => void;
  onFocusChange?: (focused: boolean) => void;
  trailing?: ReactNode;
}) => {
  const t = useT();
  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter" || e.key === "F3") {
      e.preventDefault();
      if (count === undefined) onSearch();
      else onStep(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      onTextChange("");
      (e.target as HTMLInputElement).blur();
    }
  };
  return (
    <label className={classnames(styles.box, { [styles.boxError]: invalid })} title={title}>
      <span className={styles.boxLabel}>{t("panels.memoryMap.find")}</span>
      <input
        value={text}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        onFocus={() => onFocusChange?.(true)}
        onBlur={() => onFocusChange?.(false)}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className={styles.findCount} aria-live="polite">
        {count === undefined
          ? ""
          : count === 0
            ? t("panels.memoryMap.findNone")
            : t("panels.memoryMap.findCount", { index: index + 1, count })}
      </span>
      <button
        type="button"
        className={styles.findNav}
        title={t("panels.memoryMap.findPrevious")}
        disabled={!count}
        onClick={() => onStep(-1)}
      >
        ▲
      </button>
      <button
        type="button"
        className={styles.findNav}
        title={t("panels.memoryMap.findNext")}
        disabled={!count}
        onClick={() => onStep(1)}
      >
        ▼
      </button>
      {trailing}
    </label>
  );
};
