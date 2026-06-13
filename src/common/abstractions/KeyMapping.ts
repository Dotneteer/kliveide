/**
 * Defines mappings between the physical keyboard and virtual machine keyboard.
 */
export type KeyMapping = Record<string, KeySet>;

/**
 * Defines a set of virtual machine keys assigned to a physical key.
 */
export type KeySet =
  | string
  | [string]
  | [string, string]
  | [string, string, string];

export type KeyMappingSet = {
  mapping: KeyMapping;
  merge: boolean;
};
