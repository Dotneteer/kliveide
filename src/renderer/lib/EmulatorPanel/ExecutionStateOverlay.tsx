import styles from "./ExecutionStateOverlay.module.scss";

type Props = {
  text: string | null;
  clicked?: () => void;
};

export const ExecutionStateOverlay = ({ text, clicked }: Props) => {
  if (!text) {
    return null;
  }

  return (
    <div className={styles.stateOverlay}>
      <div
        className={styles.overlay}
        title="Hide overlay (click the screen to show it again)"
        onClick={(event) => {
          event.stopPropagation();
          clicked?.();
        }}
      >
        {text}
      </div>
    </div>
  );
};
