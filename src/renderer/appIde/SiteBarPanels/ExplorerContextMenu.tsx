import { AppServices } from "@renderer/abstractions/AppServices";
import { FileTypeEditor } from "@renderer/abstractions/FileTypePattern";
import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { ITreeNode } from "@abstractions/ITreeNode";
import { ProjectNode } from "@abstractions/ProjectNode";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuState
} from "@controls/ContextMenu";

type ExplorerContextMenuProps = {
  appServices: AppServices;
  contextInfo?: FileTypeEditor;
  isKliveProject: boolean;
  isWindows: boolean;
  onClickOutside: () => void;
  onCollapseAll: () => void;
  onConceal: () => void;
  onDelete: () => void;
  onExclude: () => Promise<void>;
  onExpandAll: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => Promise<void>;
  onRename: () => void;
  onReveal: () => void;
  onToggleBuildRoot: () => Promise<void>;
  selectedContextNode?: ITreeNode<ProjectNode> | null;
  selectedContextNodeIsFolder: boolean;
  selectedNodeIsBuildRoot: boolean;
  selectedNodeIsProjectFile: boolean;
  selectedNodeIsRoot: boolean;
  state: ContextMenuState;
  store: Store<AppState>;
};

export function ExplorerContextMenu({
  appServices,
  contextInfo,
  isKliveProject,
  isWindows,
  onClickOutside,
  onCollapseAll,
  onConceal,
  onDelete,
  onExclude,
  onExpandAll,
  onNewFile,
  onNewFolder,
  onRefresh,
  onRename,
  onReveal,
  onToggleBuildRoot,
  selectedContextNode,
  selectedContextNodeIsFolder,
  selectedNodeIsBuildRoot,
  selectedNodeIsProjectFile,
  selectedNodeIsRoot,
  state,
  store
}: ExplorerContextMenuProps) {
  return (
    <ContextMenu state={state} onClickOutside={onClickOutside}>
      {selectedNodeIsRoot && (
        <>
          <ContextMenuItem text="Refresh" clicked={async () => runAsync(onRefresh)} />
        </>
      )}
      {selectedContextNodeIsFolder && (
        <>
          <ContextMenuItem text="New file..." clicked={() => run(onNewFile)} />
          <ContextMenuItem text="New folder..." clicked={() => run(onNewFolder)} />
          <ContextMenuSeparator />
          <ContextMenuItem text="Expand all" clicked={() => run(onExpandAll)} />
          <ContextMenuItem text="Collapse all" clicked={() => run(onCollapseAll)} />
          <ContextMenuSeparator />
        </>
      )}
      <ContextMenuItem
        text={`Reveal in ${isWindows ? "File Explorer" : "Finder"}`}
        disabled={!selectedContextNode?.data.fullPath}
        clicked={() => run(onReveal)}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        text="Rename..."
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot}
        clicked={() => run(onRename)}
      />
      <ContextMenuItem
        text="Exclude"
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot || !isKliveProject}
        clicked={async () => runAsync(onExclude)}
      />
      <ContextMenuItem
        dangerous={true}
        text="Delete"
        disabled={selectedNodeIsProjectFile || selectedNodeIsRoot}
        clicked={() => run(onDelete)}
      />
      {selectedContextNode?.data.canBeBuildRoot && (
        <>
          <ContextMenuSeparator />
          <ContextMenuItem
            text={selectedNodeIsBuildRoot ? "Demote from Build Root" : "Promote to Build Root"}
            clicked={async () => runAsync(onToggleBuildRoot)}
            disabled={!isKliveProject}
          />
        </>
      )}
      {contextInfo?.contextMenuInfo && (
        <>
          <ContextMenuSeparator />
          {contextInfo.contextMenuInfo(appServices).map((item, index) => {
            return item.separator ? (
              <ContextMenuSeparator key={index} />
            ) : (
              <ContextMenuItem
                key={index}
                dangerous={item.dangerous}
                text={item.text}
                disabled={item.disabled?.(store, selectedContextNode?.data?.fullPath)}
                clicked={() => item?.clicked?.(selectedContextNode?.data?.fullPath)}
              />
            );
          })}
        </>
      )}
    </ContextMenu>
  );

  function run(action: () => void): void {
    onConceal();
    action();
  }

  async function runAsync(action: () => Promise<void>): Promise<void> {
    onConceal();
    await action();
  }
}
