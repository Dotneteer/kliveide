import styles from "./ExcludedProjectItemsDialog.module.scss";
import { Modal } from "@controls/Modal";
import { useEffect, useState } from "react";
import classnames from "classnames";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import { TabButton } from "@renderer/controls/TabButton";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { setExcludedProjectItemsAction } from "@common/state/actions";
import { saveProject } from "../utils/save-project";
import {
  ExcludedItemInfo,
  getExcludedProjectItemsFromGlobalSettings,
  excludedItemsFromProject
} from "../utils/excluded-items-utils";
import { getNodeFile } from "../project/project-node";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";

type Props = {
  onClose: () => void;
};

export const ExcludedProjectItemsDialog = ({ onClose }: Props) => {
  const { messenger, store } = useRendererContext();

  const [globalExcludes, setGlobalExcludes] = useState([]);
  useEffect(
    () => {
      getExcludedProjectItemsFromGlobalSettings(messenger).then(setGlobalExcludes);
    },
    [
      /* once */
    ]
  );

  const project = store.getState().project;
  const [excludedItems, setExcludedItems] = useState(excludedItemsFromProject(project));
  const projectName = useSelector((s) => getNodeFile(s.project?.folderPath ?? "Unnamed"));

  const disp = useDispatch();

  return (
    <Modal
      title="Excluded Items"
      isOpen={true}
      fullScreen={false}
      width={500}
      primaryLabel="OK"
      primaryEnabled={true}
      initialFocus="none"
      onPrimaryClicked={async () => {
        disp(setExcludedProjectItemsAction(excludedItems.map((t) => t.id)));
        await saveProject(messenger);
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label={`${projectName} Excludes:`}>
        <div className={styles.listWrapper}>
          <VirtualizedList
            items={excludedItems}
            renderItem={(idx) => (
              <>
                <ExcludedItem
                  itemInfo={excludedItems[idx]}
                  onRemove={() => setExcludedItems(excludedItems.filter((_, i) => i !== idx))}
                />
              </>
            )}
          />
        </div>
      </DialogRow>
      <DialogRow label="Global Excludes:">
        <div className={styles.listWrapper}>
          <VirtualizedList
            items={globalExcludes}
            renderItem={(idx) => <ExcludedItem itemInfo={globalExcludes[idx]} />}
          />
        </div>
      </DialogRow>
    </Modal>
  );
};

type ItemProps = {
  itemInfo: ExcludedItemInfo;
  onRemove?: () => void;
};

const ExcludedItem = ({ itemInfo, onRemove = undefined }: ItemProps) => {
  const ref = useTooltipRef();
  const [mouseOver, setMouseOver] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const disabled = !onRemove;

  return (
    <div
      className={classnames(styles.listItem, {
        [styles.disabled]: disabled
      })}
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
    >
      <div className={styles.listItemTitle}>
        <span
          ref={ref}
          onMouseOver={(e) => {
            const rc = (e.target as HTMLElement)?.getBoundingClientRect();
            setOffset({
              x: rc ? e.clientX - 0.5 * (rc.left + rc.right) : 0,
              ...offset // y: (rc ? e.clientY - rc.bottom : 0)
            });
          }}
        >
          {itemInfo.value}
        </span>
      </div>
      <TabButton
        iconName="close"
        disabled={disabled}
        hide={disabled || !mouseOver}
        clicked={() => onRemove()}
      />

      <TooltipFactory
        refElement={ref.current}
        placement="top"
        offsetX={offset.x}
        offsetY={offset.y}
        isShown={mouseOver}
        content={itemInfo.id}
      />
    </div>
  );
};
