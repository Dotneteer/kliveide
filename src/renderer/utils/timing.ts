/**
 * Delays with the specified time
 * @param milliseconds Time in milliseconds
 */
export async function delay (milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

/**
 * Postpones an action with the specified time
 * @param action Action to daley
 * @param ms Milliseconds to delay
 * @param isOver Optional marker function indicating if action is over, so it should not be invoked.
 */
export async function delayAction (
  action: () => Promise<void>,
  onDelay: () => any,
  ms: number = 200
) {
  let inProgress = true;
  try {
    (async () => {
      await delay(ms);
      if (inProgress) onDelay()
    })();
    await action();
  } finally {
    inProgress = false;
  } 
}
