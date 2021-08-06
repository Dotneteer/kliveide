import { ITreeView } from "../../common-ui/ITreeNode";
import { ideToEmuMessenger } from "../IdeToEmuMessenger";
import { ProjectNode } from "./ProjectNode";
import {
  DirectoryContent,
  GetFolderContentsResponse,
} from "../../../shared/messaging/message-types";
import { TreeNode } from "../../common-ui/TreeNode";
import { TreeView } from "../../common-ui/TreeView";

/**
 * This class implements the project services
 */
class ProjectServices {
  private _projectTree: ITreeView<ProjectNode> | null = null;

  /**
   * Sets the current project tree
   * @param tree Project tree to use
   */
  setProjectTree(tree: ITreeView<ProjectNode>): void {
    this._projectTree = tree;
  }

  /**
   * Gets the current project tree
   * @returns Project tree, if set; otherwise, null
   */
  getProjectTree(): ITreeView<ProjectNode> | null {
    return this._projectTree;
  }

  /**
   * Sets the project folder to the specified one
   * @param name
   */
  async setProjectFolder(name: string): Promise<void> {
    const response =
      await ideToEmuMessenger.sendMessage<GetFolderContentsResponse>({
        type: "GetFolderContents",
        folder: name,
      });
    const tree = new TreeView(this.createTreeFrom(response.contents));
    this.setProjectTree(tree);
  }

  /**
   * Creates a tree view from the specified contents
   */
  private createTreeFrom(contents: DirectoryContent): TreeNode<ProjectNode> {
    const root = new TreeNode<ProjectNode>({
      name: contents.name,
      isFolder: true,
      fullPath: contents.name,
      children: [],
    });
    contents.folders
      .sort((a, b) => {
        return a.name > b.name ? 1 : a.name < b.name ? 1 : 0;
      })
      .forEach((f) => {
        const folderNode = this.createTreeFrom(f);
        folderNode.isExpanded = false;
        root.appendChild(folderNode);
      });
    contents.files
      .sort()
      .forEach((f) => {
        root.appendChild(new TreeNode<ProjectNode>({
          name: f,
          isFolder: false,
          fullPath: `${contents.name}/${f}`,
          children: [],
        }));
      });
    return root;
  }
}

/**
 * The singleton instance of project services
 */
export const projectServices = new ProjectServices();
