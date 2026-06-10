import styles from "./Toolbar.module.scss";
import { getLocalIcons } from "../../src/icons";

export type ToolbarColor = "default" | "green" | "blue" | "orange" | "red";

type Props = {
  iconName: string;
  title?: string;
  fill?: ToolbarColor;
  selected?: boolean;
  enable?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const icons = getLocalIcons();

export function ToolbarButtonReact({
  iconName,
  title,
  fill = "default",
  selected = false,
  enable = true,
  onClick
}: Props) {
  return (
    <button
      className={`${styles.button} ${styles[fill]} ${selected ? styles.selected : ""}`}
      type="button"
      title={title}
      aria-label={title ?? iconName}
      aria-pressed={selected}
      disabled={!enable}
      onClick={(event) => {
        if (enable) {
          onClick?.(event);
        }
      }}
    >
      <RawIcon iconName={iconName} />
    </button>
  );
}

function RawIcon({ iconName }: { iconName: string }) {
  const icon = icons[iconName];

  if (!icon) {
    return <span className={styles.fallbackIcon}>{iconName.slice(0, 1).toUpperCase()}</span>;
  }

  return <span className={styles.icon} aria-hidden="true" dangerouslySetInnerHTML={{ __html: icon }} />;
}
