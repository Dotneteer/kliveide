import { ILiteEvent } from "@emu/utils/lite-event";
import { IDocumentService } from "./IDocumentService"

/**
 * This type represents the functionality of a document hub, which manages all open project documents
 * through document service instances.
 */
export type IDocumentHubService = {
  /**
   * Instantiates a new document service and registers it with the hub. The new document service 
   * will be the active one.
   */  
  createDocumentService(): IDocumentService

  /**
   * Gets the active document service. Many project document related events are executed with the
   * active document service.
   */
  getActiveDocumentService(): IDocumentService | undefined;

  /**
   * Sets the specified document service as the active one.
   * @param instance The document service instance to activate
   */
  setActiveDocumentService(instance: IDocumentService): void;

  /**
   * This event is fired when the active document service has been changed.
   */
  get activeDocumentServiceChanged(): ILiteEvent<void>;

  /**
   * Closes (and removes) the specified document service instance
   * @param instance 
   */
  closeDocumentService(instance: IDocumentService): void;

}