import { createContext, useContext } from "react";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { useSelector } from "@renderer/core/RendererProvider";

const DocumentHubServiceContext = createContext<IDocumentHubService | undefined>(undefined);

export function useDocumentHubService (): IDocumentHubService {
  const service = useContext(DocumentHubServiceContext);
  if (!service) {
    throw new Error("useDocumentHubService must be used within a DocumentHubServiceProvider.");
  }
  return service;
}

export function useDocumentHubServiceVersion(hub?: IDocumentHubService): number {
  const contextHub = useContext(DocumentHubServiceContext);
  const resolvedHub = hub ?? contextHub;
  const version = useSelector((state) => state.ideView?.documentHubState?.[resolvedHub?.hubId]);
  if (!resolvedHub) {
    throw new Error("useDocumentHubServiceVersion must be used within a DocumentHubServiceProvider or receive a hub.");
  }
  return version;
}

type Props = {
  value: IDocumentHubService;
  children?: React.ReactNode;
};

export function DocumentHubServiceProvider ({ value, children }: Props) {
  return (
    <DocumentHubServiceContext.Provider value={value}>
      {children}
    </DocumentHubServiceContext.Provider>
  );
}
