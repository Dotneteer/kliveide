import { ITreeNode, ITreeView } from "@/core/tree-node";
import { ILiteEvent } from "@/emu/utils/lite-event";
import { ProjectNode } from "../project/project-node";

export type IProjectService = {
  setProjectTree: (tree: ITreeView<ProjectNode>) => void;
  getProjectTree: () => ITreeView<ProjectNode> | undefined;
  signItemAdded: (node: ITreeNode<ProjectNode>) => void;
  signItemRenamed: (oldName: string, node: ITreeNode<ProjectNode>) => void;
  signItemDeleted: (node: ITreeNode<ProjectNode>) => void;
  readonly projectOpened: ILiteEvent<void>;
  readonly projectClosed: ILiteEvent<void>;
  readonly itemAdded: ILiteEvent<ITreeNode<ProjectNode>>;
  readonly itemRenamed: ILiteEvent<{oldName: string, node: ITreeNode<ProjectNode>}>;
  readonly itemDeleted: ILiteEvent<ITreeNode<ProjectNode>>;
  getNodeForFile(file: string): ITreeNode<ProjectNode> | undefined;
};
