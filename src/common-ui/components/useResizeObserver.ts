import { useEffect, useRef } from "react";

/**
 * Parameters of the hook
 */
type ResizeObserverHookParams = {
  callback: ResizeObserverCallback;
  element: React.RefObject<Element>;
};

/**
 * Hook that handles the size change of a particular DOM element/component
 * @param param0
 */
export const useResizeObserver = ({
  callback,
  element,
}: ResizeObserverHookParams) => {
  const current = element?.current;

  const observer = useRef<ResizeObserver>();

  useEffect(() => {
    // --- We are already observing old element
    if (observer?.current && current) {
      observer.current.unobserve(current);
    }
    observer.current = new ResizeObserver(callback);
    observe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const observe = () => {
    if (element && element.current && observer.current) {
      observer.current.observe(element.current);
    }
  };
};
