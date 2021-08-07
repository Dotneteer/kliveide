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

const TITLE = "Project Files";

type State = {
  itemsCount: number;
  selected?: ITreeNode<ProjectNode>;
  selectedIndex: number;
};

/**
 * Project files panel
 */
export default class ProjectFilesPanel extends SideBarPanelBase<
  SideBarProps<{}>,
  State
> {
  private _listApi: VirtualizedListApi;

  title = TITLE;

  constructor(props: SideBarProps<{}>) {
    super(props);
    this.state = {
      itemsCount: 0,
      selectedIndex: -1,
    };
  }

  async componentDidMount(): Promise<void> {
    await projectServices.setProjectFolder("C:/Temp/z88-native");
    this.setState({
      itemsCount: this.itemsCount,
    });
  }

  /**
   * Gets the number of items in the list
   */
  get itemsCount(): number {
    const tree = projectServices.getProjectTree();
    return tree && tree.rootNode ? tree.rootNode.viewItemCount : 0;
  }

  render() {
    let slice: ITreeNode<ProjectNode>[];
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
        onClick={() => this.collapseExpand(index, item)}
      >
        <div
          style={{
            width: 22 + 12 * item.level + (item.nodeData.isFolder ? 0 : 12),
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
}

/**
 * Descriptor for the sample side bar panel
 */
export class ProjectFilesPanelDescriptor extends SideBarPanelDescriptorBase {
  constructor() {
    super(TITLE);
  }

  /**
   * Creates a node that represents the contents of a side bar panel
   */
  createContentElement(): React.ReactNode {
    return <ProjectFilesPanel descriptor={this} />;
  }
}
