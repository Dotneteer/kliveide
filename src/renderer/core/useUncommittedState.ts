import { MutableRefObject, useRef, useState } from "react";

export function useUncommittedState<T = any> (
  initial?: T
): [T, MutableRefObject<T>, (next: T) => void] {
  const [state, setState] = useState<T>(initial);
  const usage = useRef<T>(initial);

  return [
    state,
    usage,
    (next: T) => {
      usage.current = next;
      setState(next);
    }
  ];
}
