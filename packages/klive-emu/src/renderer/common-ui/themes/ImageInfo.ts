/**
 * Represents information about an image in the registry.
 */
export type ImageInfo = {
  /**
   * The name (alias) of the icon.
   */
  name: string;

  /**
   * Image type
   */
  type: "png",

  /**
   * Base64 image data
   */
  data: string;
};
