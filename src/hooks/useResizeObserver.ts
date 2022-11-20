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
    const current = element?.current;
    const observer = useRef<ResizeObserver>();
  
    useEffect(() => {
      // --- We are already observing old element
      if (observer?.current && current) {
        observer.current.unobserve(current);
      }
      observer.current = new ResizeObserver(callback);
      if (element && element.current && observer.current) {
        observer.current.observe(element.current);
      }
    }, [callback, current, element]);
  };
  
  