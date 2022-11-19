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
    primaryPosition = "left",
    primaryVisible = true,
    initialPrimarySize = "50%",
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
    const primarySize = secondaryVisible ? resolveSize(initialPrimarySize) : "100%";
    return (
        <div className={[styles.component, containerClass].join(" ")}>
            {primaryVisible && <div className={primaryClass} style={{[primaryDim]: primarySize}}>
                {primaryPanel}
            </div>}
            {secondaryVisible && <div className={styles.secondary}>{secondaryPanel}</div>}
    </div>)

    function resolveSize(size: string | number) {
        return typeof size === "string" ? size : `${size}px`;
    }
}