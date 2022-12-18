/**
 * This type describes a document that can have a designer (code editor) associated with it
 */
export type DocumentInfo = {
    /**
     * Unique ID of the document
     */
    id: string;

    /**
     * The document name to display
     */
    name: string;

    /**
     * Optional path of the document, provided it is associated with a project explorer file
     */
    path?: string;

    /**
     * Type of the document (determines the designer or code editor to handle it)
     */
    type: string;

    /**
     * Optional programming language of the document
     */
    language?: string;
}

export type DocumentState = DocumentInfo & {
    /**
     * Signs if the document is opened as temporary (the same slot can be used for another document)
     */
    isTemporary?: boolean;

    /**
     * Document state depending on the document type
     */
    stateValue?: any;
}

/**
 * This interface the functions managing documents within the IDE
 */
export interface IDocumentService {
    /**
     * Opens the specified document
     * @param document Document to open
     */
    openDocument(document: DocumentInfo): void;

    /**
     * Sets the specified document as the active one
     * @param id The ID of the active document
     */
    setActiveDocument(id: string): void;

    /**
     * Sets the specified document permanent
     * @param id The ID of the document to set permanent
     */
    setPermanent(id: string): void;

    /**
     * Closes the specified document
     * @param id 
     */
    closeDocument(id: string): void;

    /**
     * Closes all open documents
     */
    closeAllDocuments(): void;
}

/**
 * This type defines the services the IDE provides
 */
export type IdeServices = {
    documentService: IDocumentService;
}