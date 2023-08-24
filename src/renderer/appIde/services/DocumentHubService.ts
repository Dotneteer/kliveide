import { AppState } from "@common/state/AppState";
import { Store } from "@common/state/redux-light";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { IDocumentService } from "@renderer/abstractions/IDocumentService";
import { createDocumentService } from "./DocumentService";
import { incDocServiceVersionAction } from "@common/state/actions";

/**
 * This class implements the document hub service
 */
class DocumentHubService implements IDocumentHubService {
  private _docServices: IDocumentService[] = [];
  private _activations: IDocumentService[] = [];
  private _active: IDocumentService | undefined;

  /**
   * Instantiates the document hub service
   * @param store Application state store
   */
  constructor (private readonly store: Store<AppState>) {}

  /**
   * Gets the available document service instances
   */
  getDocumentServiceInstances(): IDocumentService[] {
    return this._docServices.slice(0);
  }

  /**
   * Instantiates a new document service and registers it with the hub. The new document service
   * will be the active one.
   */
  createDocumentService (): IDocumentService {
    const newDocService = createDocumentService(this.store);
    this._docServices.push(newDocService);
    this.setActiveDocumentService(newDocService);
    return newDocService;
  }

  /**
   * Gets the active document service. Many project document related events are executed with the
   * active document service.
   */
  getActiveDocumentService (): IDocumentService | undefined {
    return this._active;
  }

  /**
   * Sets the specified document service as the active one.
   * @param instance The document service instance to activate
   */
  setActiveDocumentService (instance: IDocumentService): void {
    if (this._active === instance) return;
    if (this._docServices.indexOf(instance) < 0) {
      throw new Error("Cannot find document service instance");
    }
    this._active = instance;
    this._activations = this._activations.filter(d => d !== instance);
    this._activations.push(instance);
    this.store.dispatch(incDocServiceVersionAction());
  }

  /**
   * Closes (and removes) the specified document service instance
   * @param instance
   */
  closeDocumentService (instance: IDocumentService): void {
    if (this._docServices.indexOf(instance) < 0) {
      throw new Error("Cannot find document service instance");
    }
    this._docServices = this._docServices.filter(d => d !== instance);
    this._activations = this._activations.filter(d => d !== instance);
    if (this._activations.length === 0) {
      this._active = null;
      this.store.dispatch(incDocServiceVersionAction());
    } else {
      this.setActiveDocumentService(this._activations.pop());
    }
  }
}

export const createDocumentHubService = (store: Store<AppState>) =>
  new DocumentHubService(store);
