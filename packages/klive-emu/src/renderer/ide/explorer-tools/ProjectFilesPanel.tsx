import * as React from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common-ui/VirtualizedList";
import { ITreeNode } from "../../common-ui/ITreeNode";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../SideBarPanelBase";
import { ProjectNode } from "./ProjectNode";
import { projectServices } from "./ProjectServices";
import { CSSProperties } from "react";
import { SvgIcon } from "../../common-ui/SvgIcon";
import { ideStore } from "../ideStore";
import { AppState, ProjectState } from "../../../shared/state/AppState";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import { MenuItem } from "../../../shared/command/commands";
import { contextMenuService } from "../context-menu/ContextMenuService";
import { modalDialogService } from "../../common-ui/modal-service";
import { newFolderDialog, NEW_FOLDER_DIALOG_ID } from "./NewFolderDialog";
import { Store } from "redux";
import {
  CreateFolderResponse,
  GetFolderContentsResponse,
} from "../../../shared/messaging/message-types";
import { NewFileData } from "../../../shared/messaging/dto";

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
  private _onProjectChange: (state: ProjectState) => Promise<void>;

  constructor(props: SideBarProps<{}>) {
    super(props);
    this.state = {
      itemsCount: 0,
      selectedIndex: -1,
      isLoading: false,
    };
    this._onProjectChange = (state) => this.onProjectChange(state);
  }

  async componentDidMount(): Promise<void> {
    this.setState({
      itemsCount: this.itemsCount,
    });
    ideStore.projectChanged.on(this._onProjectChange);
  }

  componentWillUnmount(): void {
    ideStore.projectChanged.off(this._onProjectChange);
  }

  /**
   * Gets the number of items in the list
   */
  get itemsCount(): number {
    const tree = projectServices.getProjectTree();
    return tree && tree.rootNode ? tree.rootNode.viewItemCount : 0;
  }

  /**
   * Respond to project state changes
   */
  async onProjectChange(state: ProjectState): Promise<void> {
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
        projectServices.setProjectContents(state.directoryContents);
        this.setState({
          isLoading: false,
          itemsCount: this.itemsCount,
        });
      }
    }
  }

  render() {
    let slice: ITreeNode<ProjectNode>[];
    if (this.state.itemsCount > 0) {
      return (
        <VirtualizedList
          itemHeight={22}
          numItems={this.state.itemsCount}
          integralPosition={false}
          renderItem={(
            index: number,
            style: CSSProperties,
            startIndex: number,
            endIndex: number
          ) => {
            if (index === startIndex) {
              slice = this.getListItemRange(startIndex, endIndex);
            }
            return this.renderItem(index, style, slice[index - startIndex]);
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
                  await ideToEmuMessenger.sendMessage({
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
    return (
      <div
        key={index}
        className="listlike"
        style={{ ...style, ...itemStyle }}
        onContextMenu={(ev) => this.onContextMenu(ev, index, item)}
        onClick={() => this.collapseExpand(index, item)}
      >
        <div
          style={{
            width: 22 + 12 * item.level + (item.nodeData.isFolder ? 0 : 16),
          }}
        ></div>
        {item.nodeData.isFolder && (
          <SvgIcon
            iconName="chevron-right"
            width={16}
            height={16}
            rotate={item.isExpanded ? 90 : 0}
          />
        )}
        <SvgIcon
          iconName={
            item.nodeData.isFolder
              ? item.isExpanded
                ? "folder-opened"
                : "folder"
              : "file-code"
          }
          width={16}
          height={16}
          style={{ marginLeft: 4, marginRight: 4 }}
          fill={
            item.nodeData.isFolder
              ? "--explorer-folder-color"
              : "--explorer-file-color"
          }
        />
        <span>{item.nodeData.name}</span>
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
    const tree = projectServices.getProjectTree();
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
    const tree = projectServices.getProjectTree();
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
      this._listApi.ensureVisible(newIndex);
      this.setState({
        selectedIndex: newIndex,
        selected: tree.getViewNodeByIndex(newIndex),
      });
      this._listApi.forceRefresh();
    }
  }

  async onContextMenu(
    ev: React.MouseEvent,
    index: number,
    item: ITreeNode<ProjectNode>
  ): Promise<void> {
    if (item.nodeData.isFolder) {
      // --- Create menu items
      const menuItems: MenuItem[] = [
        {
          id: "newFolder",
          text: "New Folder...",
          execute: async () => {
            console.log("New folder");
            await this.newFolder(item, !index);
          },
        },
        {
          id: "newFile",
          text: "New File...",
          execute: () => {
            console.log("New file");
          },
        },
      ];
      const rect = (ev.target as HTMLElement).getBoundingClientRect();
      await contextMenuService.openMenu(
        menuItems,
        rect.y + 22,
        rect.x,
        ev.target as HTMLElement
      );
    }
  }

  async newFolder(
    node: ITreeNode<ProjectNode>,
    isRoot: boolean
  ): Promise<void> {
    const folderData = (await modalDialogService.showModalDialog(
      ideStore as Store,
      NEW_FOLDER_DIALOG_ID,
      {
        root: node.nodeData.fullPath,
      }
    )) as NewFileData;
    if (folderData) {
      const resp = await ideToEmuMessenger.sendMessage<CreateFolderResponse>({
        type: "CreateFolder",
        name: `${folderData.root}/${folderData.name}`,
      });
      if (!resp.error) {
        const contents = (
          await ideToEmuMessenger.sendMessage<GetFolderContentsResponse>({
            type: "GetFolderContents",
            name: node.nodeData.fullPath,
          })
        ).contents;
        if (isRoot) {
          await projectServices.setProjectContents(contents);
        } else {
          const updated = projectServices.createTreeFrom(contents);
          console.log(updated);
          node.nodeData = { ...updated.nodeData, name: node.nodeData.name };
          console.log(node);
          node.calculateViewItemCount();
        }
        this.setState({ itemsCount: this.itemsCount });
        this._listApi.forceRefresh();
      }
    }
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
    const projectState = ideStore.getState().project;
    return projectState?.projectName
      ? `${projectState.projectName}${projectState?.hasVm ? "" : " (No VM)"}`
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
