/**
 * Defines mappings between the physical keyboard and virtual machine keyboard
 */
export type KeyMapping = Record<string, KeySet>;

/**
 * Defines a set of virtual machine keys that can be assigned to a virtual key
 */
type KeySet =
  | string
  | [string]
  | [string, string]
  | [string, string, string];

