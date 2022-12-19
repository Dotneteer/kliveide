import { activateDocumentAction, closeDocumentAction, createDocumentAction } from "@state/actions";
import { AppState } from "@state/AppState";
import { Store } from "@state/redux-light";
import { DocumentInfo, DocumentState, IDocumentService } from "./abstractions";

/**
 * This class provides the default implementation of the document service
 */
class DocumentService implements IDocumentService {
    constructor(private readonly store: Store<AppState>) {
    }
    setActiveDocument(id: string): void {
        // TODO: Implement this method
    }
    setPermanent(id: string): void {
        // TODO: Implement this method
    }
    openDocument(document: DocumentInfo): void {
        const state = this.store.getState();
        const dispatch = this.store.dispatch;
        const docs = state?.ideView?.openDocuments ?? [];
        const existingIndex = docs.findIndex(d => d.id === document.id);
        if (existingIndex >= 0) {
            // --- A similar document exists with the same ID
            const existingDoc = docs[existingIndex];
            if (existingDoc !== document) {
                throw new Error(`Duplicated document with ID '${document.id}'`);
            }

            dispatch(activateDocumentAction(document.id));
            return;
        }

        dispatch(createDocumentAction({
            ...document,
            isTemporary: true,
        } as DocumentState, 
            docs.length))
    }

    closeDocument(id: string): void {
        this.store.dispatch(closeDocumentAction(id));
    }
    
    closeAllDocuments(): void {
        throw new Error("Method not implemented.");
    }
}

/**
 * Creates a document service instance
 * @param dispatch Dispatch function to use
 * @returns Document service instance
 */
export function createDocumentService(store: Store) {
    return new DocumentService(store);
};