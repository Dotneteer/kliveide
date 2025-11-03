

export const enum SpectrumModelType {
  Spectrum48 = 1,
  Spectrum128 = 2,
  SpectrumP3 = 3,
  Next = 4
}

/**
 * The type of the Spectrum model
 */
export const SpectrumModelTypes: Record<number, string> = {
  1: "Spectrum48",
  2: "Spectrum128",
  3: "SpectrumP3",
  4: "Next"
}

/**
 * Finds the Spectrum model type by its name.
 * @param name The name of the Spectrum model.
 * @returns The corresponding model type number, or undefined if not found.
 */
export function findModelTypeByName(name: string): number | undefined {
  const modelType = Object.entries(SpectrumModelTypes).find(([_, modelName]) => modelName.toLowerCase() === name.toLowerCase());
  return modelType ? parseInt(modelType[0], 10) : undefined;
} 