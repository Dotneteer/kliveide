import { createContext, useContext, useRef } from "react";
import { IDocumentService } from "@renderer/abstractions/IDocumentService";
import { useAppServices } from "./AppServicesProvider";

const DocumentServiceContext = createContext<IDocumentService>(undefined);

export function useDocumentService (): IDocumentService {
  return useContext(DocumentServiceContext)!;
}

type Props = {
  children?: React.ReactNode;
};

export function DocumentServiceProvider ({ children }: Props) {
  const { documentHubService } = useAppServices();
  const documentServiceRef = useRef<IDocumentService>(
    documentHubService.getActiveDocumentService()
  );

  return (
    <DocumentServiceContext.Provider value={documentServiceRef.current}>
      {children}
    </DocumentServiceContext.Provider>
  );
}
