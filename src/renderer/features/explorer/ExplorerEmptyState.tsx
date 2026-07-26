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
}: ExplorerEmptyStateProps) => (
  <VStack>
    <div className={styles.noFolder}>You have not yet opened a folder.</div>
    <Button
      text="Open Folder"
      disabled={dimmed}
      spaceLeft={16}
      spaceRight={16}
      clicked={async () => await onOpenFolder()}
    />
    <div className={styles.noFolder}>or</div>
    <Button
      text="Create a Klive Project"
      disabled={dimmed}
      spaceLeft={16}
      spaceRight={16}
      clicked={onCreateProject}
    />
  </VStack>
);
