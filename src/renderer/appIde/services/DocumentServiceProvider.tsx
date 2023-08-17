import { useRendererContext } from "@renderer/core/RendererProvider";
import { createContext, useContext, useRef } from "react";
import { IDocumentService, createDocumentService } from "./DocumentService";

const DocumentServiceContext = createContext<IDocumentService>(undefined);

export function useDocumentService (): IDocumentService {
  return useContext(DocumentServiceContext)!;
}

type Props = {
  children?: React.ReactNode;
};

export function DocumentServiceProvider ({ children }: Props) {
  const { store } = useRendererContext();
  const documentServiceRef = useRef<IDocumentService>(
    createDocumentService(store)
  );

  return (
    <DocumentServiceContext.Provider value={documentServiceRef.current}>
      {children}
    </DocumentServiceContext.Provider>
  );
}
