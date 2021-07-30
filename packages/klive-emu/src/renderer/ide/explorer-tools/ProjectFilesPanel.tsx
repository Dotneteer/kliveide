import * as React from "react";
import VirtualizedList, {
  VirtualizedListApi,
} from "../../common/VirtualizedList";
import { ITreeNode } from "../../common/ITreeNode";
import { SideBarPanelDescriptorBase } from "../side-bar/SideBarService";
import { SideBarPanelBase, SideBarProps } from "../SideBarPanelBase";
import { ProjectNode } from "./ProjectNode";
import { projectServices } from "./ProjectServices";
import { CSSProperties } from "react";
import { SvgIcon } from "../../common/SvgIcon";

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

  componentDidMount(): void {
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
          ? "var(--selected-background-color)"
          : "transparent",
      border: item === this.state.selected
        ? "1px solid var(--selected-border-color)"
        : "1px solid transparent",
    };
    const topDepth = projectServices.getProjectTree().depth;
    return (
      <div
        key={index}
        className="listlike"
        style={{ ...style, ...itemStyle }}
        onClick={() => this.collapseExpand(index, item)}
      >
        <div style={{ width: 22 + 16 * (topDepth - item.depth) }}></div>
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
    switch (e.code) {
      case "ArrowUp": {
        if (this.state.selectedIndex <= 0) return;
        const newIndex = this.state.selectedIndex - 1;
        const newNode = tree.getViewNodeByIndex(newIndex);
        this.setState({
          selectedIndex: newIndex,
          selected: newNode,
        });
        break;
      }
      case "ArrowDown": {
        if (this.state.selectedIndex >= this.state.itemsCount - 1) return;
        const newIndex = this.state.selectedIndex + 1;
        const newNode = tree.getViewNodeByIndex(newIndex);
        this.setState({
          selectedIndex: newIndex,
          selected: newNode,
        });
        break;
      }
      case "Home": {
        const newNode = tree.getViewNodeByIndex(0);
        this.setState({
          selectedIndex: 0,
          selected: newNode,
        });
        break;
      }
      case "End": {
        const newIndex = this.state.itemsCount - 1;
        const newNode = tree.getViewNodeByIndex(newIndex);
        this.setState({
          selectedIndex: newIndex,
          selected: newNode,
        });
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
    this._listApi.forceRefresh();
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
