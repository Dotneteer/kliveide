import { useT } from "@common/i18n/useT";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import type { ProjectDocumentState } from "@renderer/abstractions/ProjectDocumentState";
import { Icon } from "@renderer/controls/Icon";
import { openStaticMemoryDump } from "@renderer/features/memory/StaticMemoryDump";

import styles from "./ScreenFileError.module.scss";

/*
 * A file a screen viewer cannot show (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, §1): why, in the
 * loader's words (the file's size and the sizes allowed), and Show bytes, so it can still be looked at.
 */
export const ScreenFileError = ({
  document,
  bytes,
  message
}: {
  document?: ProjectDocumentState;
  bytes?: Uint8Array;
  message?: string;
}) => {
  const t = useT();
  const documentHubService = useDocumentHubService();
  const name = document?.name ?? "screen";
  return (
    <div className={styles.root}>
      <div className={styles.card} role="alert">
        <h3 className={styles.title}>
          <Icon iconName="triangle-alert" width={16} height={16} fill="--status-warning" />
          {t("panels.next.screenFile.errorTitle")}
        </h3>
        <p className={styles.message}>{message}</p>
        {bytes && (
          <div>
            <button
              type="button"
              className={styles.button}
              onClick={() =>
                void openStaticMemoryDump(
                  documentHubService,
                  `screenFile${document?.id ?? name}`,
                  t("panels.next.dumpTitle.dump", { source: document?.path ?? name }),
                  bytes
                )
              }
            >
              <Icon iconName="binary" width={14} height={14} fill="currentColor" />
              {t("panels.next.screenFile.showBytes")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
