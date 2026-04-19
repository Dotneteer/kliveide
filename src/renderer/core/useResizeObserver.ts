import { useEffect, useRef } from "react";

/**
 * This hook invokes a callback when the size of the specified DOM element changes.
 * @param element A DOM element to watch for size changes
 * @param callback The callback function to invoke on size changes
 */
export const useResizeObserver = (
  element: React.MutableRefObject<Element | undefined | null>,
  callback: ResizeObserverCallback
) => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const el = element?.current;
    if (!el) return;
    const observer = new ResizeObserver((...args) => callbackRef.current(...args));
    observer.observe(el);
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element?.current]);
};

  