/**
 * Represents an abstract side bar header
 */
export interface ISideBarHeader {
  /**
   * The DIV element that represents the header
   */
   readonly element: HTMLDivElement;
  }

/**
 * Represents an abstract side bar panel
 */
export interface ISideBarPanel {
  /**
   * The title of the side bar panel
   */
  readonly title: string;

  /**
   * The DIV element that represents the contents of the panel
   */
  readonly element: HTMLDivElement;

  /**
   * Sets the expanded flag of the side bar panel
   * @param expanded 
   */
  setExpanded(expanded: boolean): void;
}

/**
 * This interface represents a component that hosts side bar headers and panels
 */
export interface ISideBarPanelHost {
  /**
   * Registers the header of a side bar panel
   * @param id 
   */
  registerHeader(id: number, header: ISideBarHeader): void;

  /**
   * Signs that a child panel is available for the host
   * @param id Child identifier
   * @param panel The panel interface
   */
  registerPanel(id: number, panel: ISideBarPanel): void;

  /**
   * Signs that a child panel in not available any more for the host
   * @param id Child identifier
   */
  unregisterPanel(id: number): void;
}
