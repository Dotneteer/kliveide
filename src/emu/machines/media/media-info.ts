// --- Information about a particular media file and its contents
export type MediaInfo = {
  id: string;
  mediaFile?: string;
  mediaContents?: any;
};

// --- The media store keeps information about the media files
class MediaStore {
  private readonly _store: MediaInfo[] = [];

  constructor () {
    this._store = [];
  }

  /**
   * Adds a new media file to the store
   * @param mediaInfo Media information to add
   */
  public addMedia (mediaInfo: MediaInfo): void {
    const index= this._store.findIndex(m => m.id === mediaInfo.id);
    if (index >= 0) {
      this._store[index] = mediaInfo;
    } else {
      this._store.push(mediaInfo);
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
