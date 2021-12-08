import * as React from "react";
import { CSSProperties } from "react";

import {
  dispatch,
  getContextMenuService,
  getDocumentService,
  getModalDialogService,
  getProjectService,
  getState,
  getStore,
} from "@core/service-registry";
import {
  VirtualizedList,
  VirtualizedListApi,
} from "@components/VirtualizedList";
import { ITreeNode, ProjectNode } from "@abstractions/project-node";
import { Icon } from "@components/Icon";
import { AppState, ProjectState } from "@state/AppState";
import { ConfirmDialogResponse } from "@core/messaging/message-types";
import { TreeNode } from "@components/TreeNode";
import { IProjectService } from "@abstractions/project-service";
import { sendFromIdeToEmu } from "@core/messaging/message-sending";
import {
  addBuildRootAction,
  removeBuildRootAction,
  setBuildRootsAction,
} from "@state/builder-reducer";
import { MenuItem } from "@abstractions/command-definitions";
import { SideBarPanelDescriptorBase } from "../../common-ui/services/SideBarService";
import {
  SideBarPanelBase,
  SideBarProps,
} from "../../common-ui/components/SideBarPanelBase";
import { openNewDocument } from "../document-area/document-utils";
import { NEW_FILE_DIALOG_ID } from "./NewFileDialog";
import { NEW_FOLDER_DIALOG_ID } from "./NewFolderDialog";
import { NewFileData } from "./NewFileData";
import { RENAME_FILE_DIALOG_ID } from "./RenameFileDialog";
import { RENAME_FOLDER_DIALOG_ID } from "./RenameFolderDialog";
import {
  addBreakpointAction,
  removeBreakpointAction,
} from "@core/state/debugger-reducer";

type State = {
  itemsCount: number;
  selected?: ITreeNode<ProjectNode>;
  selectedIndex: number;
  isLoading: boolean;
};

/**
 * Project files panel
 */
export default class ProjectFilesPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  private _listApi: VirtualizedListApi;
  private _projectService: IProjectService;
  private _lastProjectState: ProjectState | null = null;
  private _onProjectChange: (state: ProjectState) => Promise<void>;

  constructor(props: SideBarProps<{}>) {
    super(props);
    this.state = {
      itemsCount: 0,
      selectedIndex: -1,
      isLoading: false,
    };
    this._projectService = getProjectService();
    this._onProjectChange = (state) => this.onProjectChange(state);
  }

  async componentDidMount(): Promise<void> {
    this.setState({
      itemsCount: this.itemsCount,
    });
    getStore().projectChanged.on(this._onProjectChange);
  }

  componentWillUnmount(): void {
    getStore().projectChanged.off(this._onProjectChange);
  }

  /**
   * Gets the number of items in the list
   */
  get itemsCount(): number {
    const tree = this._projectService.getProjectTree();
    return tree && tree.rootNode ? tree.rootNode.viewItemCount : 0;
  }

  /**
   * Respond to project state changes
   */
  async onProjectChange(state: ProjectState): Promise<void> {
    if (this._lastProjectState) {
      if (
        this._lastProjectState.isLoading === state.isLoading &&
        this._lastProjectState.path === state.path &&
        this._lastProjectState.hasVm === state.hasVm
      ) {
        // --- Just the context of the project has changed
        this._lastProjectState = state;
        return;
      }
    }

    // --- The UI should update itself according to the state change
    if (state.isLoading) {
      this.setState({
        isLoading: true,
        itemsCount: 0,
      });
    } else {
      if (!state.path) {
        this.setState({
          isLoading: false,
          itemsCount: 0,
        });
      } else {
        this._projectService.setProjectContents(state.directoryContents);
        this.setState({
          isLoading: false,
          itemsCount: this.itemsCount,
        });
      }
    }
    this._lastProjectState = state;
    this._listApi?.forceRefresh();
  }

  render() {
    let slice: ITreeNode<ProjectNode>[];
    if (this.state.itemsCount > 0) {
      return (
        <VirtualizedList
          itemHeight={22}
          itemsCount={this.state.itemsCount}
          renderItem={(index: number, style: CSSProperties) => {
            if (this._listApi) {
              const vp = this._listApi?.getViewPort();
              if (index === vp?.startIndex) {
                slice = this.getListItemRange(vp.startIndex, vp.endIndex);
              }
              if (!slice) {
                return null;
              }
              return this.renderItem(
                index,
                style,
                slice[index - vp.startIndex]
              );
            } else {
              slice = this.getListItemRange(index, index);
              return this.renderItem(index, style, slice[0]);
            }
          }}
          registerApi={(api) => (this._listApi = api)}
          handleKeys={(e) => this.handleKeys(e)}
          onFocus={() => {
            this.signFocus(true);
            this._listApi.forceRefresh();
          }}
          onBlur={() => {
            this.signFocus(false);
            this._listApi.forceRefresh();
          }}
        />
      );
    } else {
      const panelStyle: CSSProperties = {
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        flexShrink: 1,
        width: "100%",
        height: "100%",
        fontSize: "0.8em",
        color: "var(--information-color)",
        paddingLeft: 20,
        paddingRight: 20,
      };
      const buttonStyle: CSSProperties = {
        backgroundColor: "var(--selected-background-color)",
        color: "var(--menu-text-color)",
        width: "100%",
        border: "none",
        marginTop: 13,
        padding: 8,
        cursor: "pointer",
      };
      return (
        <div style={panelStyle}>
          {!this.state.isLoading && (
            <>
              <span style={{ marginTop: 13 }}>
                You have not yet opened a folder.
              </span>
              <button
                style={buttonStyle}
                onClick={async () => {
                  await sendFromIdeToEmu({
                    type: "OpenProjectFolder",
                  });
                }}
              >
                Open Folder
              </button>
            </>
          )}
        </div>
      );
    }
  }

  renderItem(
    index: number,
    style: CSSProperties,
    item: ITreeNode<ProjectNode>
  ) {
    const itemStyle: CSSProperties = {
      display: "flex",
      alignItems: "center",
      width: "100%",
      height: 22,
      fontSize: "0.8em",
      paddingRight: 16,
      cursor: "pointer",
      background:
        item === this.state.selected
          ? this.state.focused
            ? "var(--selected-background-color)"
            : "var(--list-selected-background-color)"
          : undefined,
      border:
        item === this.state.selected
          ? this.state.focused
            ? "1px solid var(--selected-border-color)"
            : "1px solid transparent"
          : "1px solid transparent",
    };
    const filename = item.nodeData.fullPath.substr(
      getState().project.path.length
    );
    const isBuildRoot = getState().builder.roots.includes(filename);
    return (
      <div
        key={index}
        className="listlike"
        style={{ ...style, ...itemStyle }}
        onContextMenu={(ev) => this.onContextMenu(ev, index, item, isBuildRoot)}
        onClick={() => this.openDocument(index, item, true)}
        onDoubleClick={() => this.openDocument(index, item)}
      >
        <div
          style={{
            width: 22 + 12 * item.level + (item.nodeData.isFolder ? 0 : 16),
            flexShrink: 0,
            flexGrow: 0,
          }}
        ></div>
        {item.nodeData.isFolder && (
          <Icon
            iconName="chevron-right"
            width={16}
            height={16}
            rotate={item.isExpanded ? 90 : 0}
            style={{ flexShrink: 0, flexGrow: 0 }}
          />
        )}
        <Icon
          iconName={
            item.nodeData.isFolder
              ? item.isExpanded
                ? "@folder-open"
                : "@folder"
              : "@file-code"
          }
          width={16}
          height={16}
          style={{ marginLeft: 4, marginRight: 4, flexShrink: 0, flexGrow: 0 }}
          fill={
            item.nodeData.isFolder
              ? "--explorer-folder-color"
              : "--explorer-file-color"
          }
        />
        <div
          style={{
            marginLeft: 4,
            width: "100%",
            flexShrink: 1,
            flexGrow: 1,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
        >
          {item.nodeData.name}
        </div>
        {isBuildRoot && (
          <Icon
            iconName="combine"
            width={16}
            height={16}
            fill="var(--console-ansi-bright-green)"
            style={{ flexShrink: 0, flexGrow: 0 }}
          />
        )}
      </div>
    );
  }

  /**
   * Retrieves the items slice of the specified range.
   */
  getListItemRange(
    start: number,
    end: number,
    topHidden?: number
  ): ITreeNode<ProjectNode>[] {
    const tree = this._projectService.getProjectTree();
    const offset = topHidden || 0;
    if (!tree) {
      return [];
    }
    return tree.getViewNodeRange(start + offset, end + offset);
  }

  /**
   * Collapse or expand the specified item
   * @param index Item index
   * @param item Node
   */
  collapseExpand(index: number, item: ITreeNode<ProjectNode>): void {
    item.isExpanded = !item.isExpanded;
    this.setState({
      itemsCount: this.itemsCount,
      selected: item,
      selectedIndex: index,
    });
    this._listApi.forceRefresh();
  }

  /**
   * Allow moving in the project explorer with keys
   */
  handleKeys(e: React.KeyboardEvent): void {
    const tree = this._projectService.getProjectTree();
    let newIndex = -1;
    switch (e.code) {
      case "ArrowUp":
        if (this.state.selectedIndex <= 0) return;
        newIndex = this.state.selectedIndex - 1;
        break;

      case "ArrowDown": {
        if (this.state.selectedIndex >= this.state.itemsCount - 1) return;
        newIndex = this.state.selectedIndex + 1;
        break;
      }
      case "Home": {
        newIndex = 0;
        break;
      }
      case "End": {
        newIndex = this.state.itemsCount - 1;
        break;
      }
      case "Space":
      case "Enter":
        if (!this.state.selected) return;
        this.collapseExpand(this.state.selectedIndex, this.state.selected);
        break;
      default:
        return;
    }
    if (newIndex >= 0) {
      this._listApi.ensureVisible(newIndex, "top");
      this.setState({
        selectedIndex: newIndex,
        selected: tree.getViewNodeByIndex(newIndex),
      });
      this._listApi.forceRefresh();
    }
  }

  async openDocument(
    index: number,
    item: ITreeNode<ProjectNode>,
    isTemporary: boolean = false
  ): Promise<void> {
    if (item.nodeData.isFolder) {
      this.collapseExpand(index, item);
    } else {
      this.setState({
        selected: item,
        selectedIndex: index,
      });
      this._listApi.forceRefresh();

      // --- Test if the specified document is already open
      const id = item.nodeData.fullPath;
      const documentService = getDocumentService();
      const document = documentService.getDocumentById(id);
      if (document) {
        if (!isTemporary) {
          document.temporary = false;
          document.initialFocus = true;
        }
        await documentService.setActiveDocument(document);
        return;
      }

      // --- Create a new document
      openNewDocument(item.nodeData.fullPath, item, isTemporary, !isTemporary);
    }
  }

  /**
   * Handles the context menu click of the specified item
   * @param ev Event information
   * @param index Item index
   * @param item Item data
   */
  async onContextMenu(
    ev: React.MouseEvent,
    index: number,
    item: ITreeNode<ProjectNode>,
    isBuildRoot: boolean
  ): Promise<void> {
    let menuItems: MenuItem[];
    if (item.nodeData.isFolder) {
      // --- Create menu items
      menuItems = [
        {
          id: "newFolder",
          text: "New Folder...",
          execute: async () => {
            await this.newFolder(item, index);
          },
        },
        {
          id: "newFile",
          text: "New File...",
          execute: async () => {
            await this.newFile(item, index);
          },
        },
        "separator",
        {
          id: "copyPath",
          text: "Copy Path",
          execute: async () => {
            await navigator.clipboard.writeText(
              item.nodeData.fullPath.replace(/\\/g, "/")
            );
          },
        },
        "separator",
        {
          id: "renameFolder",
          text: "Rename",
          execute: async () => await this.renameFileOrFolder(item, index, true),
        },
        {
          id: "deleteFolder",
          text: "Delete",
          enabled: index !== 0,
          execute: async () => await this.deleteFolder(item),
        },
      ];
    } else {
      menuItems = [
        {
          id: "copyPath",
          text: "Copy Path",
          execute: async () => {
            await navigator.clipboard.writeText(
              item.nodeData.fullPath.replace(/\\/g, "/")
            );
          },
        },
        "separator",
        {
          id: "renameFile",
          text: "Rename",
          execute: async () => await this.renameFileOrFolder(item, index),
        },
        {
          id: "deleteFile",
          text: "Delete",
          execute: async () => await this.deleteFile(item),
        },
      ];
      const editor = await getDocumentService().getCodeEditorLanguage(
        item.nodeData.fullPath
      );
      const languageInfo = getDocumentService().getCustomLanguage(editor);
      if (languageInfo?.allowBuildRoot) {
        menuItems.push("separator");
        if (isBuildRoot) {
          menuItems.push({
            id: "removeBuildRoot",
            text: "Remove Build root",
            execute: async () => {
              dispatch(
                removeBuildRootAction(
                  item.nodeData.fullPath.substr(getState().project.path.length)
                )
              );
              this._listApi.forceRefresh();
              getDocumentService().fireChanges();
            },
          });
        } else {
          menuItems.push({
            id: "markBuildRoot",
            text: "Mark as Build root",
            execute: async () => {
              dispatch(
                addBuildRootAction(
                  item.nodeData.fullPath.substr(getState().project.path.length)
                )
              );
              this._listApi.forceRefresh();
              getDocumentService().fireChanges();
            },
          });
        }
      }
    }

    const rect = (ev.target as HTMLElement).getBoundingClientRect();
    await getContextMenuService().openMenu(
      menuItems,
      rect.y + 22,
      ev.clientX,
      ev.target as HTMLElement
    );
  }

  /**
   * Creates a new folder in the specified folder node
   * @param node Folder node
   * @param index Node index
   */
  async newFolder(node: ITreeNode<ProjectNode>, index: number): Promise<void> {
    // --- Get the name of the new folder
    const folderData = (await getModalDialogService().showModalDialog(
      NEW_FOLDER_DIALOG_ID,
      {
        root: node.nodeData.fullPath,
      }
    )) as NewFileData;

    if (!folderData?.name) {
      // --- No folder to create
      return;
    }

    // --- Create the new folder
    const newName = folderData.name;
    const newFullPath = `${folderData.root}/${newName}`;
    const resp = await this._projectService.createFolder(newFullPath);

    if (resp) {
      // --- Creation failed. The main process has already displayed a message
      return;
    }

    // --- Insert the new node into the tree
    let newPosition = 0;
    const childCount = node.childCount;
    for (let i = 0; i < childCount; i++, newPosition++) {
      const child = node.getChild(i);
      if (!child.nodeData.isFolder || newName < child.nodeData.name) break;
    }
    const newTreeNode = new TreeNode<ProjectNode>({
      isFolder: true,
      name: newName,
      fullPath: newFullPath,
    });
    node.insertChildAt(newPosition, newTreeNode);
    node.isExpanded = true;

    // --- Refresh the view
    const selectedIndex = index + newPosition + 1;
    this.setState({
      selectedIndex,
      selected: newTreeNode,
      itemsCount: this.itemsCount,
    });
    this._listApi.focus();
    this._listApi.ensureVisible(selectedIndex, "top");
    this._listApi.forceRefresh();
  }

  /**
   * Creates a new file in the specified folder node
   * @param node Folder node
   * @param index Node index
   */
  async newFile(node: ITreeNode<ProjectNode>, index: number): Promise<void> {
    // --- Get the name of the new folder
    const fileData = (await getModalDialogService().showModalDialog(
      NEW_FILE_DIALOG_ID,
      {
        root: node.nodeData.fullPath,
      }
    )) as NewFileData;

    if (!fileData?.name) {
      // --- No folder to create
      return;
    }

    // --- Create the new file
    const newName = fileData.name;
    const newFullPath = `${fileData.root}/${newName}`;
    const resp = await this._projectService.createFile(newFullPath);

    if (resp) {
      // --- Creation failed. The main process has already displayed a message
      return;
    }

    // --- Insert the new node into the tree
    let newPosition = 0;
    const childCount = node.childCount;
    for (let i = 0; i < childCount; i++, newPosition++) {
      const child = node.getChild(i);
      if (child.nodeData.isFolder) continue;
      if (newName < child.nodeData.name) break;
    }
    const newTreeNode = new TreeNode<ProjectNode>({
      isFolder: false,
      name: newName,
      fullPath: newFullPath,
    });
    node.insertChildAt(newPosition, newTreeNode);
    node.isExpanded = true;

    // --- Refresh the view
    const selectedIndex = index + newPosition + 1;
    this.setState({
      selectedIndex,
      selected: newTreeNode,
      itemsCount: this.itemsCount,
    });
    this._listApi.focus();
    this._listApi.ensureVisible(selectedIndex, "top");
    this._listApi.forceRefresh();

    // --- Emulate clicking the item
    this.openDocument(selectedIndex, newTreeNode);
  }

  /**
   * Deletes the specified file
   * @param node File node
   */
  async deleteFile(node: ITreeNode<ProjectNode>): Promise<void> {
    // --- Confirm delete
    const result = await sendFromIdeToEmu<ConfirmDialogResponse>({
      type: "ConfirmDialog",
      title: "Confirm delete",
      question: `Are you sure you want to delete the ${node.nodeData.fullPath} file?`,
    });
    if (!result.confirmed) {
      // --- Delete aborted
      return;
    }

    // --- Delete the file
    const projPathLen = getState().project.path.length;
    const oldRelName = node.nodeData.fullPath.substr(projPathLen);
    const resp = await this._projectService.deleteFile(node.nodeData.fullPath);
    if (resp) {
      // --- Delete failed
      return;
    }

    // --- Delete build roots
    const buildRoots = getState().builder.roots.slice(0);
    const newRoots: string[] = [];
    for (const root of buildRoots) {
      if (root !== oldRelName) {
        newRoots.push(root);
      }
    }
    dispatch(setBuildRootsAction(newRoots));

    // --- Delete breakpoints
    const brps = getState().debugger?.breakpoints.slice(0) ?? [];
    for (const brp of brps) {
      if (brp.type === "source" && brp.resource === oldRelName) {
        dispatch(removeBreakpointAction(brp));
      }
    }

    // --- Refresh the view
    node.parentNode.removeChild(node);
    this.setState({
      itemsCount: this.itemsCount,
    });
    this._listApi.focus();
    this._listApi.forceRefresh();
  }

  /**
   * Deletes the specified file
   * @param node File node
   */
  async deleteFolder(node: ITreeNode<ProjectNode>): Promise<void> {
    // --- Confirm delete
    const result = await sendFromIdeToEmu<ConfirmDialogResponse>({
      type: "ConfirmDialog",
      title: "Confirm delete",
      question: `Are you sure you want to delete the ${node.nodeData.fullPath} folder?`,
    });
    if (!result.confirmed) {
      // --- Delete aborted
      return;
    }

    // --- Delete the folder
    const projPathLen = getState().project.path.length;
    const oldRelName = node.nodeData.fullPath.substr(projPathLen);
    const resp = await this._projectService.deleteFolder(
      node.nodeData.fullPath
    );
    if (resp) {
      // --- Delete failed
      return;
    }

    // --- Delete build roots
    const buildRoots = getState().builder.roots.slice(0);
    const newRoots: string[] = [];
    for (const root of buildRoots) {
      if (!root.startsWith(oldRelName)) {
        newRoots.push(root);
      }
    }
    dispatch(setBuildRootsAction(newRoots));

    // --- Delete breakpoints
    const brps = getState().debugger?.breakpoints.slice(0) ?? [];
    for (const brp of brps) {
      if (brp.type === "source" && brp.resource.startsWith(oldRelName)) {
        dispatch(removeBreakpointAction(brp));
      }
    }

    // --- Refresh the view
    node.parentNode.removeChild(node);
    this.setState({
      itemsCount: this.itemsCount,
    });
    this._listApi.focus();
    this._listApi.forceRefresh();
  }

  /**
   * Renames the specified file
   * @param node File node
   * @param index Node index
   */
  async renameFileOrFolder(
    node: ITreeNode<ProjectNode>,
    index: number,
    isFolder: boolean = false
  ): Promise<void> {
    // --- Process the old name
    const projPathLen = getState().project.path.length;
    const oldPath = node.nodeData.fullPath.substr(
      0,
      node.nodeData.fullPath.length - node.nodeData.name.length - 1
    );
    const oldRelName = node.nodeData.fullPath.substr(projPathLen);

    // --- Get the new name
    const fileData = (await getModalDialogService().showModalDialog(
      isFolder ? RENAME_FOLDER_DIALOG_ID : RENAME_FILE_DIALOG_ID,
      {
        root: oldPath,
        name: node.nodeData.name,
        newName: node.nodeData.name,
      }
    )) as NewFileData;

    if (!fileData) {
      // --- No file to rename
      return;
    }

    // --- Rename the file
    const newFullName = `${oldPath}/${fileData.name}`;
    const resp = isFolder
      ? await this._projectService.renameFolder(
          node.nodeData.fullPath,
          newFullName
        )
      : await this._projectService.renameFile(
          node.nodeData.fullPath,
          newFullName
        );
    if (resp) {
      // --- Rename failed
      return;
    }

    // --- Rename folder children
    this._projectService.renameProjectNode(
      node,
      node.nodeData.fullPath,
      newFullName,
      isFolder
    );

    // --- Rename build roots
    const newRelName = node.nodeData.fullPath.substr(projPathLen);
    const buildRoots = getState().builder.roots.slice(0);
    const newRoots: string[] = [];
    for (const root of buildRoots) {
      if (isFolder && root.startsWith(oldRelName)) {
        newRoots.push(newRelName + root.substr(oldRelName.length));
      } else if (!isFolder && root === oldRelName) {
        newRoots.push(newRelName);
      } else {
        newRoots.push(root);
      }
    }
    dispatch(setBuildRootsAction(newRoots));

    // --- Rename breakpoints
    const brps = getState().debugger?.breakpoints.slice(0) ?? [];
    for (const brp of brps) {
      if (brp.type === "source") {
        if (isFolder && brp.resource.startsWith(oldRelName)) {
          dispatch(removeBreakpointAction(brp));
          brp.resource = newRelName + brp.resource.substr(oldRelName.length);
          dispatch(addBreakpointAction(brp));
        } else if (!isFolder && brp.resource === oldRelName) {
        }
      }
    }

    // --- Refresh the view
    node.nodeData.name = fileData.name;
    node.nodeData.fullPath = newFullName;
    this.setState({
      itemsCount: this.itemsCount,
      selectedIndex: index,
      selected: node,
    });
    this._listApi.focus();
    this._listApi.forceRefresh();
  }
}

/**
 * Descriptor for the sample side bar panel
 */
export class ProjectFilesPanelDescriptor extends SideBarPanelDescriptorBase {
  private _lastProjectState: ProjectState = null;
  private _shouldRefresh = false;

  /**
   * Panel title
   */
  get title(): string {
    const projectState = getState().project;
    return projectState?.projectName
      ? `${projectState.projectName}${projectState?.hasVm ? "" : " 🚫"}`
      : "No project opened";
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <ProjectFilesPanel descriptor={this} />;
  }

  /**
   * Respond to state changes
   * @param state
   */
  async onStateChange(state: AppState): Promise<void> {
    if (this._lastProjectState !== state.project) {
      this._lastProjectState = state.project;
      this.expanded = true;
      this._shouldRefresh = true;
      return;
    }
    this._shouldRefresh = false;
  }

  /**
   * Should update the panel header?
   */
  async shouldUpdatePanelHeader(): Promise<boolean> {
    return this._shouldRefresh;
  }
}
