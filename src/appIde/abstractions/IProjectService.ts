import { ITreeNode } from "@/core/tree-node";
import { ILiteEvent } from "@/emu/utils/lite-event";
import { ProjectNode } from "../project/project-node";

export type IProjectService = {
  signItemAdded: (node: ITreeNode<ProjectNode>) => void;
  signItemRenamed: (oldName: string, node: ITreeNode<ProjectNode>) => void;
  signItemDeleted: (node: ITreeNode<ProjectNode>) => void;
  readonly projectOpened: ILiteEvent<void>;
  readonly projectClosed: ILiteEvent<void>;
  readonly itemAdded: ILiteEvent<ITreeNode<ProjectNode>>;
  readonly itemRenamed: ILiteEvent<{oldName: string, node: ITreeNode<ProjectNode>}>;
  readonly itemDeleted: ILiteEvent<ITreeNode<ProjectNode>>;
};
