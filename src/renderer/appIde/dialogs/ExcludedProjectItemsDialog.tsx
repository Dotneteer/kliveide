import * as path from "path";
import * as fs from "fs";

import styles from "./ExcludedProjectItemsDialog.module.scss";
import { ModalApi, Modal } from "@controls/Modal";
import { useEffect, useRef, useState } from "react";
import classnames from "@renderer/utils/classnames";
import { useDispatch, useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Label } from "@renderer/controls/Labels";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import { TabButton } from "@renderer/controls/TabButton";
import { TooltipFactory } from "@renderer/controls/Tooltip";
import { setExcludedProjectItemsAction } from "@common/state/actions";
import { reportMessagingError } from "@renderer/reportError";

type Props = {
  onClose: () => void;
};

export const ExcludedProjectItemsDialog = ({ onClose }: Props) => {
  const { messenger, store } = useRendererContext();

  // --- Saves the current project
  const saveProject = async () => {
    await new Promise(r => setTimeout(r, 100));
    const response = await messenger.sendMessage({ type: "MainSaveProject" });
    if (response.type === "ErrorResponse") {
      reportMessagingError(`MainSaveProject request failed: ${response.message}`);
    }
  };

  const [ globalExcludes, setGlobalExcludes ] = useState([]);
  useEffect(() => {
    messenger.sendMessage({
      type: "MainGloballyExcludedProjectItems"
    }).then(response => {
      if (response.type == "TextContents") {
        setGlobalExcludes(response.contents.split(path.delimiter));
      }
    });
  },[ /* once */ ]);

  const project = store.getState().project;
  const [excludedItems, setExcludedItems] = useState(project?.excludedItems);
  const projectName = useSelector(s => path.basename(s.project?.folderPath ?? "Unnamed"));

  const disp = useDispatch();

  return (
    <Modal
      title='Excluded Items'
      isOpen={true}
      fullScreen={false}
      width={500}
      primaryLabel='OK'
      primaryEnabled={true}
      initialFocus='none'
      onPrimaryClicked={async () => {
        disp(setExcludedProjectItemsAction(excludedItems));
        await saveProject();
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label={`${projectName} Excludes:`}>
        <div className={styles.listWrapper}>
          <VirtualizedListView
            items={excludedItems}
            approxSize={30}
            fixItemHeight={false}
            itemRenderer={idx => (<>
              <ExcludedItem
                root={project?.folderPath}
                value={excludedItems[idx]}
                onRemove={_ => setExcludedItems(
                  excludedItems.filter((_, i) => i !== idx))}/>
            </>)}
          />
        </div>
      </DialogRow>
      <DialogRow label='Global Excludes:'>
        <div className={styles.listWrapper}>
          <VirtualizedListView
            items={globalExcludes}
            approxSize={30}
            fixItemHeight={false}
            itemRenderer={idx => (<>
              <ExcludedItem
                root={project?.folderPath}
                value={globalExcludes[idx]}/>
            </>)}
          />
        </div>
      </DialogRow>
    </Modal>
  );
};

type ItemProps = {
  root: string,
  value: string,
  onRemove?: (value:string) => void,
};

const ExcludedItem = ({root, value, onRemove = undefined}: ItemProps) => {
  const ref = useRef(null);
  const [mouseOver, setMouseOver] = useState(false);
  const [offset, setOffset] = useState({x:0, y:0});

  const disabled = !onRemove;
  const missing = !fs.existsSync(path.join(root, value.replace('/', path.sep)));

  return (
    <div
      className={classnames(styles.listItem, {
        [styles.disabled]: disabled
      })}
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}>
        { missing && <Label text="!" width={12} /> }
        <div className={styles.listItemTitle}>
          <span
            ref={ref}
            onMouseOver={e => {
              const rc = (e.target as HTMLElement)?.getBoundingClientRect();
              setOffset({
                x: (rc ? e.clientX - .5 * (rc.left + rc.right) : 0),
                ...offset, // y: (rc ? e.clientY - rc.bottom : 0)
              });
            }}>
              {value}
          </span>
        </div>
        <TabButton
          iconName="close"
          disabled={disabled}
          hide={disabled || !mouseOver}
          clicked={() => onRemove(value)}/>

        <TooltipFactory refElement={ref.current}
          placement='top'
          offsetX={offset.x}
          offsetY={offset.y}
          isShown={mouseOver}>
            {value}
        </TooltipFactory>

    </div>
  );
};
