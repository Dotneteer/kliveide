import { ITreeView } from "../../common/ITreeNode";
import { ProjectNode } from "./ProjectNode";

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
}

/**
 * The singleton instance of project services
 */
export const projectServices = new ProjectServices();
