import { createContext, useContext, useRef } from "react";
import { IDocumentService } from "@renderer/abstractions/IDocumentService";

const DocumentServiceContext = createContext<IDocumentService>(undefined);

export function useDocumentService (): IDocumentService {
  return useContext(DocumentServiceContext)!;
}

type Props = {
  value: IDocumentService;
  children?: React.ReactNode;
};

export function DocumentServiceProvider ({ value, children }: Props) {
  return (
    <DocumentServiceContext.Provider value={value}>
      {children}
    </DocumentServiceContext.Provider>
  );
}
