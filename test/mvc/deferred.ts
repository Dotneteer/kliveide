export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

/**
 * A promise a test settles by hand.
 *
 * Holding a port open is the only way to observe an in-flight view model — the
 * "Running smoke test..." label, a disabled Apply button — which a test that
 * merely awaits a resolved mock can never see.
 */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// --- Lets pending microtasks run, for the rare assertion that has to observe
// --- state between two awaits rather than after a settled promise.
export function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}
