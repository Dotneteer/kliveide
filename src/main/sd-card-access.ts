/**
 * Serializes access to the SD card (.cim) image.
 *
 * The image is reachable through two very different paths that can be in flight at the same time:
 *
 * - Sector-level reads/writes issued by the running machine's emulated SD card, which go through
 *   the cached `CimHandler` singleton.
 * - Whole-file operations such as copying a file into the FAT32 image or resetting the image to
 *   its factory contents, which invalidate that cached handler and open their own file handles.
 *
 * Without serialization these overlap: a long file copy invalidates the cached handler and then
 * yields on I/O, and any sector access arriving during that window lazily re-creates a *second*,
 * independent handler on the same file. Two uncoordinated writers then mutate the same FAT32
 * image - corrupting it.
 *
 * Every operation that touches the image must therefore run inside `withSdCardAccess`. Operations
 * run in the order they were requested, and a failing operation never blocks later ones.
 *
 * NOTE: this is not re-entrant. An operation running inside `withSdCardAccess` must not call
 * another function that also acquires it, or it will deadlock.
 */
let sdCardAccessChain: Promise<unknown> = Promise.resolve();

/**
 * Runs the given operation with exclusive access to the SD card image.
 * @param operation The operation to run once any previous SD card operation has finished
 * @returns The operation's result
 */
export function withSdCardAccess<T>(operation: () => Promise<T> | T): Promise<T> {
  // --- Chain onto the previous operation regardless of whether it succeeded, so one failure
  // --- cannot wedge the queue permanently.
  const result = sdCardAccessChain.then(operation, operation);

  // --- Keep the chain itself always-resolving; callers observe their own result/error above.
  sdCardAccessChain = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}
