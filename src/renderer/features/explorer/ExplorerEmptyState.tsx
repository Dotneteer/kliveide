import { useT } from "@common/i18n/useT";
import { Button } from "@controls/Button";
import { VStack } from "@renderer/controls/layout/Panels";
import styles from "./ExplorerPanel.module.scss";

type ExplorerEmptyStateProps = {
  dimmed: boolean;
  onCreateProject: () => void;
  onOpenFolder: () => Promise<void>;
};

export const ExplorerEmptyState = ({
  dimmed,
  onCreateProject,
  onOpenFolder
}: ExplorerEmptyStateProps) => {
  const t = useT();
  return (
  <VStack>
    <div className={styles.noFolder}>{t("explorer.empty.noFolder")}</div>
    <Button
      text={t("explorer.empty.openFolder")}
      disabled={dimmed}
      spaceLeft={16}
      spaceRight={16}
      clicked={async () => await onOpenFolder()}
    />
    <div className={styles.noFolder}>{t("explorer.empty.or")}</div>
    <Button
      text={t("explorer.empty.createProject")}
      disabled={dimmed}
      spaceLeft={16}
      spaceRight={16}
      clicked={onCreateProject}
    />
  </VStack>
  );
};
