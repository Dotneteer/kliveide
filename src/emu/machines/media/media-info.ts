// --- Information about a particular media file and its contents
export type MediaInfo = {
  id: string;
  mediaFile?: string;
  mediaContents?: any;
  /**
   * For write-protectable media (floppy disks), whether the medium is write-protected.
   *
   * This is kept next to the contents on purpose. Write protection is applied to a machine as a
   * machine property, and machine properties do not survive a machine change - so a machine type
   * or model switch used to silently turn a write-protected disk back into a writable one. Storing
   * it here lets the controller re-apply it whenever it re-attaches the medium.
   */
  writeProtected?: boolean;
};

// --- The media store keeps information about the media files
class MediaStore {
  private readonly _store: MediaInfo[] = [];

  constructor () {
    this._store = [];
  }

  /**
   * Adds a new media file to the store, merging into any existing entry for the same id.
   *
   * Merging matters because the pieces of one medium arrive in separate calls (the write-protection
   * flag is set before the disk contents, for instance), and a plain replace would drop whichever
   * piece was recorded first. Pass an explicit `undefined` for a field to clear it.
   * @param mediaInfo Media information to add
   */
  public addMedia (mediaInfo: MediaInfo): void {
    const index = this._store.findIndex(m => m.id === mediaInfo.id);
    if (index >= 0) {
      this._store[index] = { ...this._store[index], ...mediaInfo };
    } else {
      this._store.push({ ...mediaInfo });
    }
  }

  /**
   * Gets the media information for the specified media
   * @param id Media identifier
   */
  public getMedia (id: string): MediaInfo | undefined {
    return this._store.find(m => m.id === id);
  }
}

// --- The singleton instance of the media store
export const mediaStore = new MediaStore();
