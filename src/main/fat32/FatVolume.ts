import { FileEntry, O_RDONLY } from "@abstractions/Fat32Types";
import { CimFile } from "./CimFileManager";
import { FatFile, FileContent } from "./FatFile";
import { FatPartition } from "./FatPartition";

export class FatVolume extends FatPartition {
  private _vwd: FatFile = new FatFile();
  private static _cwv: FatVolume;

  constructor(public readonly cimFile: CimFile) {
    super(cimFile);
    this.begin();
  }

  /**
   * Get file's user settable attributes.
   * @param path path to file.
   * @return user settable file attributes for success else -1.
   */
  getAttrib(_path: string): number {
    throw new Error("Method not implemented.");
  }

  /**
   * Set file's user settable attributes.
   * @param path path to file.
   * @param bits bit-wise or of selected attributes: FS_ATTRIB_READ_ONLY,
   * FS_ATTRIB_HIDDEN, FS_ATTRIB_SYSTEM, FS_ATTRIB_ARCHIVE.
   * @return true for success or false for failure.
   */
  setAttrib(_path: string, _attrib: number): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Initialize a FatVolume object.
   * @param setCwv Set current working volume if true.
   * @param part partition to initialize.
   * @param volStart Start sector of volume if part is zero.
   * @return true for success or false for failure.
   */
  begin(setCwv = true, part = 1, volStart = 0): boolean {
    if (!this.init(part, volStart)) {
      return false;
    }
    if (!this.getChdir()) {
      return false;
    }
    if (setCwv || !FatVolume._cwv) {
      FatVolume._cwv = this;
    }
    return true;
  }

  /**
   * Set volume working directory to root.
   * @return true for success or false for failure.
   */
  getChdir(): boolean {
    this._vwd.close();
    return this._vwd.openRoot(this);
  }

  /**
   * Set volume working directory.
   * @param _path Path for volume working directory.
   * @return true for success or false for failure.
   */
  setChdir(_path: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Test for the existence of a file.
   * @param _path Path of the file to be tested for.
   * @return true if the file exists else false.
   */
  exists(_path: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * List the directory contents of the volume root directory.
   * @param _path Path to the directory to list.
   * @param _flags The inclusive OR of
   *   LS_DATE - %Print file modification date
   *   LS_SIZE - %Print file size.
   *   LS_R - Recursive list of subdirectories.
   * @return true for success or false for failure.
   */
  ls(_path = "", _flags = 0): FileEntry[] {
    throw new Error("Method not implemented.");
  }

  /**
   * Make a subdirectory in the volume root directory.
   * @param path A path with a valid name for the subdirectory.
   * @param pFlag Create missing parent directories if true.
   * @return true for success or false for failure.
   */
  mkdir(path: string, pFlag = true): boolean {
    const sub = new FatFile(this.cimFile);
    sub.openRoot(this);
    sub.close();
    return sub.mkdir(this.vwd(), path, pFlag);
  }

  /**
   * Open a file
   * @param _path Location of file to be opened.
   * @param _oflag Open flags.
   * @return A FileContent object.
   */
  open(_path: string, _oflag = O_RDONLY): FileContent {
    throw new Error("Method not implemented.");
  }

  /**
   * Remove a file from the volume root directory.
   * @param _path A path with a valid name for the file.
   * @return true for success or false for failure.
   */
  remove(_path: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Rename a file or subdirectory.
   * @param oldPath Path name to the file or subdirectory to be renamed.
   * @param newPath New path name of the file or subdirectory. The newPath object must not
   * exist before the rename call.
   * @return true for success or false for failure.
   *
   * The file to be renamed must not be open.  The directory entry may be
   * moved and file system corruption could occur if the file is accessed by
   * a file object that was opened before the rename() call.
   */
  rename(oldPath: string, newPath: string): boolean {
    const file = new FatFile();
    return file.open(this.vwd(), oldPath, O_RDONLY) && file.rename(this.vwd(), newPath);
  }

  /**
   * Remove a subdirectory from the volume's working directory.
   * @param _path A path with a valid name for the subdirectory.
   * @return true for success or false for failure.
   *
   * The subdirectory file will be removed only if it is empty.
   */
  rmdir(_path: string): boolean {
    throw new Error("Method not implemented.");
  }

  /**
   * Truncate a file to a specified length.
   * The current file position will be at the new EOF.
   * @param _path A path with a valid name for the file.
   * @param _length The desired length for the file.
   *
   * @return true for success or false for failure.
   */
  truncate(_path: string, _length: number): boolean {
    throw new Error("Method not implemented.");
  }

  private vwd(): FatFile {
    return this._vwd;
  }
}
