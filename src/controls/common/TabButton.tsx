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
    clicked?: () => void;
}

export function TabButton({
    hide,
    fill = "--color-command-icon",
    rotate = 0,
    iconName,
    useSpace = false,
    title,
    clicked,
  }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [keyDown, setKeyDown] = useState(null);

    useEffect(() => {
        setKeyDown(false);
    }, [ref.current])
    return (
      <>
        <div
          ref={ref}
          className={classnames(styles.component, keyDown ? styles.keyDown : "")}
          onMouseDown={() => setKeyDown(true)}
          onMouseLeave={() => setKeyDown(false)}
          onClick={() => {
              clicked?.();
              setKeyDown(false);
          }} >
            { title && <TooltipFactory 
                  refElement={ref.current}
                  placement="bottom"
                  offsetX={-8}
                  offsetY={32}>
                 {title}            
                </TooltipFactory>
            }

              {hide && <div className={styles.placeholder}></div>}
              {!hide && <Icon
                iconName={iconName}
                fill={fill}
                width={20}
                height={20}
                rotate={rotate}
              />}
        </div>
        {useSpace && <TabButtonSeparator />}
      </>
    );
  }

  export const TabButtonSeparator = () => <div style={{paddingRight: 8}}/>