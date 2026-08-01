import { createContext, useContext, type ReactNode } from "react";
import { type DocumentAreaGridApi } from "./DocumentAreaGrid";
import { type DocumentAreaId } from "./documentAreaLayout";

const DocumentAreaGridApiContext = createContext<DocumentAreaGridApi | undefined>(undefined);
const DocumentAreaIdContext = createContext<DocumentAreaId | undefined>(undefined);
const ActiveDocumentAreaIdContext = createContext<DocumentAreaId | undefined>(undefined);

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

type DocumentAreaIdProviderProps = {
  areaId: DocumentAreaId;
  children?: ReactNode;
};

export function DocumentAreaIdProvider({
  areaId,
  children
}: DocumentAreaIdProviderProps) {
  return (
    <DocumentAreaIdContext.Provider value={areaId}>
      {children}
    </DocumentAreaIdContext.Provider>
  );
}

export function useDocumentAreaId(): DocumentAreaId | undefined {
  return useContext(DocumentAreaIdContext);
}

type ActiveDocumentAreaIdProviderProps = {
  activeAreaId: DocumentAreaId;
  children?: ReactNode;
};

export function ActiveDocumentAreaIdProvider({
  activeAreaId,
  children
}: ActiveDocumentAreaIdProviderProps) {
  return (
    <ActiveDocumentAreaIdContext.Provider value={activeAreaId}>
      {children}
    </ActiveDocumentAreaIdContext.Provider>
  );
}

export function useActiveDocumentAreaId(): DocumentAreaId | undefined {
  return useContext(ActiveDocumentAreaIdContext);
}
