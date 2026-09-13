// --- Describes a system variable
export type SysVar = {
  // --- System variable address
  address: number;
  name: string;
  type: SysVarType;
  length?: number;
  description?: string;
  byteDescriptions?: string[];
  flagDescriptions?: string[];
};

// --- Type of the system variable
export enum SysVarType {
  Byte,
  Flags,
  Word,
  Array
}
