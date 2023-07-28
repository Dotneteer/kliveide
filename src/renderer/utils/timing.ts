/**
 * Delays with the specified time
 * @param milliseconds Time in milliseconds
 */
export async function delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}