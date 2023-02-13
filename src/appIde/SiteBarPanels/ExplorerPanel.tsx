import { useRendererContext } from "@/core/RendererProvider";
import { ITreeView } from "@/core/tree-node";
import { MainGetDirectoryContentResponse } from "@messaging/any-to-main";
import { useEffect, useState } from "react";
import { buildProjectTree, ProjectNode, ProjectNodeWithChildren } from "../project/project-node";

const ExplorerPanel = () => {
  const { messenger } = useRendererContext();
  const [tree, setTree] = useState<ITreeView<ProjectNode>>(null)
  useEffect(() => {
    (async() => {
      const dir = (await messenger.sendMessage({
        type: "MainGetDirectoryContent",
        directory: "RiderProjects"
      }) as MainGetDirectoryContentResponse).contents;
      const projectTree = buildProjectTree(dir); 
      setTree(projectTree)
      console.log(projectTree);
    })();
  }, [messenger])

  return <div>Explorer Panel {tree ? tree.rootNode.children.length : "<node>"}</div>;
};

export const explorerPanelRenderer = () => <ExplorerPanel />;
