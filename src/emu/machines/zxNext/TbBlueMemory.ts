type MemoryReaderFn = (addr: number) => number;
type MemoryWriterFn = (addr: number, value: number) => void;

/**
 * Memory information about a 8K page
 */
export type MemoryPageInfo = {
  offset: number;
  bank8k?: number;
  contended?: boolean;
  readerFn?: MemoryReaderFn;
  writerFn?: MemoryWriterFn;
};

/**
 * This class implements a handler for TbBlue memory
 */
export class TbBlueMemory {
  pageInfo: MemoryPageInfo[];
  maxPages: number;
  memory: Uint8Array;

  /**
   * Initializes the memory
   * @param totalMemInKb Total memory size in KB
   */
  constructor(totalMemInKb = 2048) {
    switch (totalMemInKb) {
      case 2048:
        this.maxPages = 224;
        break;
      case 1536:
        this.maxPages = 160;
        break;
      case 1024:
        this.maxPages = 96;
        break;
      case 512:
        this.maxPages = 32;
        break;
      default:
        throw new Error(`Invalid memory size: ${totalMemInKb}KB`);      
    }

    // --- Set up memory data (with no pageinfo yet)
    this.pageInfo = [];
    this.memory = new Uint8Array(totalMemInKb * 1024);
  }

  /**
   * Sets the page information for the specified 8K memory page
   * @param pageIndex Page index
   * @param offset Memory offset for the page
   * @param bank8k 8K bank number
   * @param contended Contended memory?
   * @param readerFn Optional memory reader function
   * @param writerFn Optional memory writer function (if not specified, the memory is read-only)
   */
    setPageInfo (
      pageIndex: number,
      offset: number,
      bank8k: number,
      contended: boolean,
      readerFn?: MemoryReaderFn,
      writerFn?: MemoryWriterFn
    ) {
      if (pageIndex < 0 || pageIndex > 7) {
        throw new Error(`Invalid page index ${pageIndex}`);
      }
      this.pageInfo[pageIndex] = {
        offset,
        bank8k,
        contended,
        readerFn,
        writerFn
      };
    }
}
