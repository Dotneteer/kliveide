export type GeneratedTapeFile = {
  name: string;
  contents: Uint8Array;
};

export type GeneratedTapeSaveStatus =
  | {
      kind: "saved";
      defaultName: string;
      fileName: string;
    }
  | {
      kind: "cancelled";
      defaultName: string;
    }
  | {
      kind: "failed";
      defaultName: string;
      error: string;
    };

export type GeneratedTapeSaveFunction = (
  defaultName: string,
  contents: Uint8Array
) => Promise<{ fileName?: string }>;

export function createGeneratedTapeSaveQueue(
  saveGeneratedTapeFile: GeneratedTapeSaveFunction,
  onStatus: (status: GeneratedTapeSaveStatus) => void = () => undefined
) {
  let saveChain = Promise.resolve();

  return {
    enqueue(file: GeneratedTapeFile): Promise<void> {
      saveChain = saveChain.then(() => saveOneFile(file));
      return saveChain;
    }
  };

  async function saveOneFile(file: GeneratedTapeFile): Promise<void> {
    try {
      const result = await saveGeneratedTapeFile(file.name, file.contents);
      if (result.fileName) {
        onStatus({
          kind: "saved",
          defaultName: file.name,
          fileName: result.fileName
        });
      } else {
        onStatus({
          kind: "cancelled",
          defaultName: file.name
        });
      }
    } catch (err) {
      onStatus({
        kind: "failed",
        defaultName: file.name,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
}
