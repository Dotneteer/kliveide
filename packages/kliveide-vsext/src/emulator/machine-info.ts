/**
 * Represents information about machine types
 */
export interface MachineInfo {
  readonly paging: {
    readonly supportsPaging: boolean;
    readonly roms: number;
    readonly banks: number;
  };
}

/**
 * Information about machine types
 */
export const machineTypes: { [key: string]: MachineInfo } = {
  "48": {
    paging: {
      supportsPaging: false,
      roms: 0,
      banks: 0,
    },
  },
  "128": {
    paging: {
      supportsPaging: true,
      roms: 2,
      banks: 8,
    },
  },
  "p3": {
    paging: {
      supportsPaging: true,
      roms: 4,
      banks: 8,
    },
  },
  "next": {
    paging: {
      supportsPaging: true,
      roms: 2,
      banks: 8,
    },
  },
};
