import styles from "./SplitPanel.module.scss";

export type Props = {
    primaryPanel?: JSX.Element;
    primaryPosition?: "left" | "right" | "top" | "bottom";
    primaryVisible?: boolean
    initialPrimarySize?: number | string;
    minPrimarySize?: number;
    secondaryPanel?: JSX.Element;
    secondaryVisible?: boolean;
    minSecondarySize?: number;
}

export const SplitPanel = ({
    primaryPanel,
    primaryPosition = "bottom",
    primaryVisible = true,
    initialPrimarySize = 180,
    minPrimarySize = 20,
    secondaryPanel,
    secondaryVisible = true,
    minSecondarySize = 20
}: Props) => {
    const containerClass = styles[primaryPosition];
    const primaryClass = primaryPosition === "left" || primaryPosition === "right"
        ? styles.vertical
        : styles.horizontal;
    const primaryDim = primaryPosition === "left" || primaryPosition === "right"
        ? "width" : "height";
    return <div className={[styles.component, containerClass].join(" ")}>
        <div className={primaryClass} style={{[primaryDim]: resolveSize(initialPrimarySize)}}>{primaryPanel}</div>
        <div className={styles.secondary}>{secondaryPanel}</div>
    </div>

    function resolveSize(size: string | number) {
        return typeof size === "string" ? size : `${size}px`;
    }
}