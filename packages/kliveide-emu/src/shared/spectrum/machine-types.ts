/**
 * Gets the numeric ID of a particular machine type name
 * @param name Machine type name
 */
export function getMachinTypeFromName(name: string): number {
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
