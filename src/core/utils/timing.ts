/**
 * Delay for the specified amount of milliseconds
 * @param milliseconds Amount of milliseconds to delay
 */
export function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (milliseconds < 0) {
      milliseconds = 0;
    }
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}
