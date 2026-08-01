import { type DocumentAreaGridApi } from "./DocumentAreaGrid";

let documentAreaCommandTarget: DocumentAreaGridApi | undefined;

export function setDocumentAreaCommandTarget(api: DocumentAreaGridApi): () => void {
  documentAreaCommandTarget = api;
  return () => {
    if (documentAreaCommandTarget === api) {
      documentAreaCommandTarget = undefined;
    }
  };
}

export function getDocumentAreaCommandTarget(): DocumentAreaGridApi | undefined {
  return documentAreaCommandTarget;
}
