import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { TooltipFactory } from "./Tooltip";
import classnames from "@/utils/classnames";
import styles from "./IconButton.module.scss";

type Props = {
    iconName: string;
    size?: number;
    title?: string;
    fill?: string;
    enable?: boolean;
    selected?: boolean;
    clicked?: () => void;
}

/**
 * Represents the statusbar of the emulator
 */
export function IconButton({
    iconName,
    size = 24,
    title,
    fill,
    enable = true,
    selected,
    clicked,
  }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [keyDown, setKeyDown] = useState(null);

    useEffect(() => {
        setKeyDown(false);
    }, [ref.current])
    return (
      <div
        ref={ref}
        className={classnames(styles.component, enable ? styles.enabled : "")}
        onMouseDown={() => setKeyDown(true)}
        onMouseLeave={() => setKeyDown(false)}
        onClick={() => {
          if (enable) clicked?.();
          setKeyDown(false);
        }}
      >
        <div
            className={classnames(
              styles.iconWrapper, 
              keyDown && enable ? styles.keyDown : "",
              selected ? styles.selected : "")}>
            <TooltipFactory 
              refElement={ref.current}
              placement="bottom"
              offsetX={-8}
              offsetY={32}>
               {title}            
            </TooltipFactory>
            <Icon
              iconName={iconName}
              fill={enable ?? true ? fill : "--bgcolor-toolbarbutton-disabled"}
              width={size}
              height={size}
            />
        </div>
      </div>
    );
  }