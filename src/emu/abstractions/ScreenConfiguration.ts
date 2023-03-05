/**
 * This interface defines the data that can be used to render a Spectrum model's screen
 */
export type ScreenConfiguration = {
  /**
   * Number of lines used for vertical synch
   */
  verticalSyncLines: number;

  /**
   * The number of top border lines that are not visible
   * when rendering the screen
   */
  nonVisibleBorderTopLines: number;

  /**
   * The number of border lines before the display
   */
  borderTopLines: number;

  /**
   * Number of display lines
   */
  displayLines: number;

  /**
   * The number of border lines after the display
   */
  borderBottomLines: number;

  /**
   * The number of bottom border lines that are not visible
   * when rendering the screen
   */
  nonVisibleBorderBottomLines: number;

  /**
   * Horizontal blanking time (HSync+blanking).
   * Given in Z80 clock cycles.
   */
  horizontalBlankingTime: number;

  /**
   * The time of displaying left part of the border.
   * Given in Z80 clock cycles.
   */
  borderLeftTime: number;

  /**
   * The time of displaying a pixel row.
   * Given in Z80 clock cycles.
   */
  displayLineTime: number;

  /**
   * The time of displaying right part of the border.
   * Given in Z80 clock cycles.
   */
  borderRightTime: number;

  /**
   * The time used to render the nonvisible right part of the border.
   * Given in Z80 clock cycles.
   */
  nonVisibleBorderRightTime: number;

  /**
   * The time the data of a particular pixel should be prefetched
   * before displaying it.
   * Given in Z80 clock cycles.
   */
  pixelDataPrefetchTime: number;

  /**
   * The time the data of a particular pixel attribute should be prefetched
   * before displaying it.
   * Given in Z80 clock cycles.
   */
  attributeDataPrefetchTime: number;

  /**
   * Gets the contention values to be used with the device
   */
  contentionValues: number[];
};
