import styles from "./LabeledGroup.module.scss";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import classNames from "classnames";
type Props = {
  label: string;
  title?: string;
  values: number[];
  marked?: number;
  selected?: number;
  setterFn?: (val: number) => void;
  clicked?: (val: number) => void;
};

export const LabeledGroup = ({ label, title, values, marked, selected, clicked }: Props) => {
  const ref = useTooltipRef();
  return (
    <>
      <div ref={ref} className={styles.labeledGroup}>
        <span className={styles.headerLabel}>{label}</span>
        {values.map((v) => (
          <OptionValue
            key={v}
            label={v}
            isSelected={v === selected}
            isMarked={v === marked}
            clicked={() => {
              clicked?.(v);
            }}
          />
        ))}
      </div>
      {title && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={-8}
          offsetY={32}
          content={title}
        />
      )}
    </>
  );
};

type OptionValueProp = {
  label: number;
  isMarked: boolean;
  isSelected: boolean;
  clicked?: () => void;
};

const OptionValue = ({ label, isMarked, isSelected, clicked }: OptionValueProp) => {
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
