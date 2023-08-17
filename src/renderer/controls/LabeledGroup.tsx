import { useRef, useState } from "react";
import styles from "./LabeledGroup.module.scss";
import { TooltipFactory } from "./Tooltip";
import classNames from "../utils/classnames";
type Props = {
  label: string;
  title?: string;
  values: string[];
  marked?: string;
  selected?: string;
  setterFn?: (val: string) => void;
  clicked?: (val: string) => void;
};

export const LabeledGroup = ({
  label,
  title,
  values,
  marked,
  selected,
  setterFn,
  clicked
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [currentValue, setCurrentValue] = useState(selected);
  return (
    <>
      <div ref={ref} className={styles.labeledGroup}>
        <span className={styles.headerLabel}>{label}</span>
        {values.map(v => (
          <OptionValue
            label={v}
            isSelected={v === currentValue}
            isMarked={v === marked}
            clicked={() => {
              setCurrentValue(v);
            }}
          />
        ))}
      </div>
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement='right'
          offsetX={-8}
          offsetY={32}
        >
          {title}
        </TooltipFactory>
      )}
    </>
  );
};

type OptionValueProp = {
  label: string;
  isMarked: boolean;
  isSelected: boolean;
  clicked?: () => void;
};

const OptionValue = ({
  label,
  isMarked,
  isSelected,
  clicked
}: OptionValueProp) => {
  return (
    <div
      className={classNames(styles.label, {
        [styles.isMarked]: isMarked,
        [styles.isSelected]: isSelected
      })}
      onClick={() => clicked?.()}
    >
      {label}
    </div>
  );
};
