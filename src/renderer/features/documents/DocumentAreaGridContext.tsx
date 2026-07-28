import { createContext, useContext, type ReactNode } from "react";
import { type DocumentAreaGridApi } from "./DocumentAreaGrid";

const DocumentAreaGridApiContext = createContext<DocumentAreaGridApi | undefined>(undefined);

type DocumentAreaGridApiProviderProps = {
  api: DocumentAreaGridApi;
  children?: ReactNode;
};

export function DocumentAreaGridApiProvider({
  api,
  children
}: DocumentAreaGridApiProviderProps) {
  return (
    <DocumentAreaGridApiContext.Provider value={api}>
      {children}
    </DocumentAreaGridApiContext.Provider>
  );
}

export function useDocumentAreaGridApi(): DocumentAreaGridApi | undefined {
  return useContext(DocumentAreaGridApiContext);
}
