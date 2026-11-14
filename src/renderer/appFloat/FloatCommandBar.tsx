import { useMemo } from "react";
import type { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";
import { useMainApi } from "@renderer/core/MainApi";
import { AppServicesOverride, useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DocumentHubServiceProvider } from "@renderer/appIde/services/DocumentServiceProvider";
import { getFileTypeEntry } from "@renderer/appIde/project/project-node";
import { DocumentCommandBar } from "@renderer/features/documents/DocumentCommandBar";
import { EMPTY_ARRAY } from "@renderer/utils/stablerefs";
import { createIdeForwardingCommandService } from "./ideForwardingCommandService";

type Props = {
  hub: IDocumentHubService;
};

/**
 * The command bar of the floating window's document, the same one its tab strip shows in the IDE
 * (`DocumentCommandBar`: the build root's Compile/Inject/Run/Debug, a NEX's or a tape's launch
 * buttons, a script's Run/Stop). Its commands run in the IDE.
 */
export const FloatCommandBar = ({ hub }: Props) => {
  const { store } = useRendererContext();
  const { ideCommandsService } = useAppServices();
  const mainApi = useMainApi();
  const buildRoots = useSelector((s) => s.project?.buildRoots ?? EMPTY_ARRAY);
  // --- The hub's active document can change (a rename); follow its version
  useSelector((s) => s.ideView?.documentHubState?.[hub.hubId]);

  const services = useMemo(
    () => ({ ideCommandsService: createIdeForwardingCommandService(ideCommandsService, mainApi) }),
    [ideCommandsService, mainApi]
  );

  const node = hub.getActiveDocument()?.node;
  if (!node) return null;
  const selectedIsBuildRoot = node.projectPath ? buildRoots.indexOf(node.projectPath) >= 0 : false;
  const editorInfo = getFileTypeEntry(node.fullPath ?? node.name, store);
  if (!selectedIsBuildRoot && !editorInfo?.documentTabRenderer) return null;

  return (
    <DocumentHubServiceProvider value={hub}>
      <AppServicesOverride services={services}>
        <DocumentCommandBar
          activeFullPath={node.fullPath}
          editorInfo={editorInfo}
          selectedIsBuildRoot={selectedIsBuildRoot}
        />
      </AppServicesOverride>
    </DocumentHubServiceProvider>
  );
};
