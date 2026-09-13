/**
 * What an unimplemented file viewer says.
 *
 * Seven `.nex`-family viewers (`.SNA`, `.SHC`, `.SHR`, `.SLR`, `.SL2`, `.VID`, `.NXI`) are headers
 * over nothing: opening one gave a title bar above an empty rectangle, with no indication that the
 * viewer does not exist yet rather than that the file failed to load.
 *
 * The words live here rather than in each panel because these seven are the app's strongest
 * candidate for an eighth being written by copying a seventh — which is exactly how the NEX
 * annotation dialog family drifted into three spellings of the same thing. One constant, and the
 * eighth inherits the wording for free.
 */
export const NOT_IMPLEMENTED_MESSAGE = "Not implemented yet";
