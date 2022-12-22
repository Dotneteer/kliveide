/**
 * This interface describes the behavior of an object that provides TZX tape content
 */
export interface ITapeSaver {
    /**
     * This method sets the name of the file according to the Spectrum SAVE HEADER information
     * @param name Name to set
     */
    setName(name: string): void;

    /**
     * Appends the TZX block to the tape file
     * @param block Tape block to save
     */
    saveTapeBlock(block: TzxStandardSpeedBlock): void;
}
