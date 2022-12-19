import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import classnames from "@/utils/classnames";
import styles from "./TabButton.module.scss";

type Props = {
    active?: boolean;
    hide?: boolean;
    iconName: string;
    clicked?: () => void;
}

export function TabButton({
    active,
    hide,
    iconName,
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
        className={classnames(styles.component, keyDown ? styles.keyDown : "")}
        onMouseDown={() => setKeyDown(true)}
        onMouseLeave={() => setKeyDown(false)}
        onClick={() => {
            clicked?.();
            setKeyDown(false);
        }} >
            {hide && <div className={styles.placeholder}></div>}
            {!hide && <Icon
              iconName={iconName}
              fill={active ? "--color-tabbutton-fill-active" : "--color-tabbutton-fill-inactive"}
              width={20}
              height={20}
            />}
      </div>
    );
  }