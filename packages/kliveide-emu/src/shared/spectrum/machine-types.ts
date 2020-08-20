/**
 * Gets the numeric ID of a particular machine type name
 * @param name Machine type name
 */
export function getMachineTypeIdFromName(name: string): number {
  switch (name.toLowerCase()) {
    case "128":
      return 1;
    case "p3":
      return 2;
    case "next":
      return 3;
    default:
      return 0;
  }
}

export function getMachineTypeNameFromId(id: number): string {
  switch (id) {
    case 1:
      return "ZX Spectrum 128K";
    case 2:
      return "ZX Spectrum +3E";
    case 3:
      return "ZX Spectrum Next";
    default:
      return "ZX Spectrum 48K";
  }
}
