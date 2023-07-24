/**
 * Represents the import object
 */
export const importObject = {
  imports: {
    trace: (arg: number) => console.log(arg),
    opCodeFetched: () => {},
    standardOpExecuted: () => {},
    extendedOpExecuted: () => {},
    indexedOpExecuted: () => {},
    bitOpExecuted: () => {},
    indexedBitOpExecuted: () => {},
    intExecuted: () => {},
    nmiExecuted: () => {},
    halted: () => {},
    memoryRead: () => {},
    memoryWritten: () => {},
    ioRead: () => {},
    ioWritten: () => {}
  }
};
