import { createContext, useContext } from "react";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";

const DocumentHubServiceContext = createContext<IDocumentHubService>(undefined);

export function useDocumentHubService (): IDocumentHubService {
  return useContext(DocumentHubServiceContext)!;
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
