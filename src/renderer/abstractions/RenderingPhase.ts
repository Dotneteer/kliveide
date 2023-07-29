/**
 * This enumeration defines the different phases of ULA rendering.
 */
export enum RenderingPhase {
  /**
   * The ULA does not do any rendering.
   */
  None = 0,

  /**
   * The ULA sets the border color to display the current pixel.
   */
  Border,

  /**
   * The ULA sets the border color to display the current pixel. It prepares to display the first pixel in the row
   * by pre-fetching the corresponding byte from the display memory.
   */
  BorderFetchPixel,

  /**
   * The ULA sets the border color to display the current pixel. It has already fetched the byte of eight pixels to
   * display, and it prepares to display the first pixel in the row by pre-fetching the corresponding attribute
   * byte from the display memory.
   */
  BorderFetchAttr,

  /**
   * The ULA displays the subsequent two pixels of Byte1 sequentially during a single Z80 clock cycle.
   */
  DisplayB1,

  /**
   * The ULA displays the subsequent two pixels of Byte2 sequentially during a single Z80 clock cycle.
   */
  DisplayB2,

  /**
   * The ULA displays the subsequent two pixels of Byte1 sequentially during a single Z80 clock cycle. It prepares
   * to display the pixels of the next byte in the row by pre-fetching the corresponding byte from the display
   * memory.
   */
  DisplayB1FetchB2,

  /**
   * The ULA displays the subsequent two pixels of Byte1 sequentially during a single Z80 clock cycle. It prepares
   * to display the pixels of the next byte in the row by pre-fetching the corresponding attribute from the display
   * memory.
   */
  DisplayB1FetchA2,

  /**
   * The ULA displays the subsequent two pixels of Byte2 sequentially during a single Z80 clock cycle. It prepares
   * to display the pixels of the next byte in the row by pre-fetching the corresponding byte from the display
   * memory.
   */
  DisplayB2FetchB1,

  /**
   * The ULA displays the subsequent two pixels of Byte2 sequentially during a single Z80 clock cycle. It prepares
   * to display the pixels of the next byte in the row by pre-fetching the corresponding attribute from the display
   * memory.
   */
  DisplayB2FetchA1
}
