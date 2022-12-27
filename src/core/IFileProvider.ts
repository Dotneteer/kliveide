/**
 * This interface defines a provider that allows the emulator or IDE to reach files from 
 * the main process
 */
export interface IFileProvider {
    /**
     * Read an text file from the specified path with the given encoding
     * @param path Absolute path, or one relative to the dist/assets (public) folder
     * @param encoding Text encoding ("utf8", by default)
     * @returns The contents of a file as a string
     */
    readTextFile(path: string, encoding?: string): Promise<string>;

    /**
     * Read a binary file from the specified path
     * @param path Absolute path, or one relative to the dist/assets (public) folder
     * @returns The contents of a file as an Uint8Array instance
     */
    readBinaryFile(path: string): Promise<Uint8Array>;

    /**
     * Writes a text file to the specified path
     * @param path Absolute path, or one relative to the user's home folder
     * @param contents File contents to write
     * @param encoding Text encoding ("utf8", by default)
     */
    writeTextFile(path: string, contents: string, encoding?: string): Promise<void>;

    /**
     * Writes a binary file to the specified path
     * @param path Absolute path, or one relative to the user's home folder
     * @param contents File contents to write
     */
    writeBinaryFile(path: string, contents: Uint8Array): Promise<void>;
}