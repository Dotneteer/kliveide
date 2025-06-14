import React from "react";

/**
 * This hook memoizes the specified value. It uses a shallow comparison with the previously
 * stored value when checking for changes. So, while a shallow comparison shows equality,
 * it returns with the memoized value.
 * @param value Value to memoize
 */
export function useShallowCompareMemoize<T extends Record<any, any> | undefined>(value: T) {
  const ref = React.useRef<T>(value);
  const signalRef = React.useRef<number>(0);

  if (!shallowCompare(value, ref.current)) {
    ref.current = value;
    signalRef.current++;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useMemo(() => ref.current, [signalRef.current]);
}

type Comparable = Record<string, any> | any[] | null | undefined;
const shallowCompare = (obj1: Comparable, obj2: Comparable) => {
  return shallowEqual(obj1, obj2);
};

function shallowEqual<T extends Comparable>(a: T, b: T): boolean {
  const aIsArr = Array.isArray(a);
  const bIsArr = Array.isArray(b);

  if (typeof a === "string" || typeof b === "string") {
    return a === b;
  }

  if (aIsArr !== bIsArr) {
    return false;
  }

  if (aIsArr && bIsArr) {
    return shallowEqualArrays(a, b);
  }

  return shallowEqualObjects(a, b);
}

function shallowEqualArrays(arrA: validArrayValue, arrB: validArrayValue): boolean {
  if (arrA === arrB) {
    return true;
  }

  if (!arrA || !arrB) {
    return false;
  }

  const len = arrA.length;

  if (arrB.length !== len) {
    return false;
  }

  for (let i = 0; i < len; i++) {
    if (arrA[i] !== arrB[i]) {
      return false;
    }
  }

  return true;
}

type validObjectValue = Record<string | symbol, any> | null | undefined;
type validArrayValue = any[] | null | undefined;

function shallowEqualObjects(objA: validObjectValue, objB: validObjectValue): boolean {
  if (objA === objB) {
    return true;
  }

  if (!objA || !objB) {
    return false;
  }

  const aKeys = Reflect.ownKeys(objA);
  const bKeys = Reflect.ownKeys(objB);
  const len = aKeys.length;

  if (bKeys.length !== len) {
    return false;
  }

  for (let i = 0; i < len; i++) {
    const key = aKeys[i];

    if (objA[key] !== objB[key] || !Object.prototype.hasOwnProperty.call(objB, key)) {
      return false;
    }
  }

  return true;
}
