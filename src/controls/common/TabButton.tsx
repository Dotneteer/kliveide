import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import classnames from "@/utils/classnames";
import styles from "./TabButton.module.scss";
import { TooltipFactory } from "./Tooltip";

type Props = {
  hide?: boolean;
  fill?: string;
  rotate?: number;
  iconName: string;
  useSpace?: boolean;
  title?: string;
  disabled?: boolean;
  clicked?: () => void;
};

export function TabButton ({
  hide,
  fill = "--color-command-icon",
  rotate = 0,
  iconName,
  useSpace = false,
  title,
  disabled,
  clicked
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [keyDown, setKeyDown] = useState(null);
  const toolTipLines = (title ?? "").split("\n");

  useEffect(() => {
    setKeyDown(false);
  }, [ref.current]);
  return (
    <>
      <div
        ref={ref}
        className={classnames(
          styles.component,
          keyDown ? styles.keyDown : "",
          disabled ? styles.disabled : ""
        )}
        onMouseDown={() => setKeyDown(true)}
        onMouseLeave={() => setKeyDown(false)}
        onClick={() => {
          if (!disabled) {
            clicked?.();
            setKeyDown(false);
          }
        }}
      >
        {title && (
          <TooltipFactory
            refElement={ref.current}
            placement='bottom'
            offsetX={-8}
            offsetY={32}
          >
            {toolTipLines.map((l, idx) => (
              <div key={idx}>{l}</div>
            ))}
          </TooltipFactory>
        )}

        {hide && <div className={styles.placeholder}></div>}
        {!hide && (
          <Icon
            iconName={iconName}
            fill={disabled ? "--color-command-icon-disabled" : fill}
            width={20}
            height={20}
            rotate={rotate}
          />
        )}
      </div>
      {useSpace && <TabButtonSeparator />}
    </>
  );
}

export const TabButtonSeparator = () => <div style={{ paddingRight: 8 }} />;
