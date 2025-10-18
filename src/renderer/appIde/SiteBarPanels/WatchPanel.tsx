import type { WatchInfo } from "@common/state/AppState";

import { LabelSeparator, Label } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useState, useEffect } from "react";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import { Icon } from "@renderer/controls/Icon";
import styles from "./WatchPanel.module.scss";

const WatchPanel = () => {
  const [watches, setWatches] = useState<WatchInfo[]>([]);
  const watchExpressions = useSelector((s) => s.watchExpressions || []);

  // --- Update the local state when Redux state changes
  useEffect(() => {
    setWatches([...watchExpressions]);
  }, [watchExpressions]);

  return (
    <div className={styles.watchPanel}>
      {watches.length === 0 && <div className={styles.center}>No watch expressions defined</div>}
      {watches.length > 0 && (
        <VirtualizedList
          items={watches}
          renderItem={(idx) => {
            try {
              const watch = watches[idx];
              return (
                <div className={styles.watchItem}>
                  <LabelSeparator width={4} />
                  <Icon iconName="eyeglass" width={16} height={16} fill="--color-secondary-label" />
                  <LabelSeparator width={8} />
                  <Label text={watch.symbol} width="auto" />
                </div>
              );
            } catch (e) {
              return <div key={idx} />;
            }
          }}
        />
      )}
    </div>
  );
};

export const watchPanelRenderer = () => <WatchPanel />;
