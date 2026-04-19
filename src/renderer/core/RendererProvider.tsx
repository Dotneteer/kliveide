import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { MessageSource } from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { Action } from "@state/Action";
import { AppState } from "@state/AppState";
import { Dispatch, Store } from "@state/redux-light";
import { get } from "lodash";
import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Shallow equality helper — avoids spurious re-renders in useSelector
// ---------------------------------------------------------------------------
function shallowEqual (a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

// The renderer app's context
type RendererAppContext = {
  store: Store<AppState>;
  messenger: MessengerBase;
  messageSource: MessageSource;
};

// This object provides the React context of the application state store, which we pass the root component, and thus
// all nested components may use it.
const RendererContext = createContext<RendererAppContext>(undefined);

/**
 * This React hook makes the current renderer context available within any component logic using the hook.
 */
export function useRendererContext(): RendererAppContext {
  return useContext(RendererContext);
}

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useStore(): Store<AppState> {
  return useContext(RendererContext)?.store;
}

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useMessenger(): MessengerBase {
  return useContext(RendererContext)?.messenger;
}

/**
 * This React hook makes the current message source information available within any component logic using the hook.
 */
export function useMessageSource(): MessageSource {
  return useContext(RendererContext)?.messageSource;
}

/**
 * This React hook makes the current dispatcher function available within any component logic using the hook.
 */
export function useDispatch(): Dispatch<Action> {
  const { store, messageSource } = useRendererContext();
  return useMemo(
    () => ((action: Action) => store.dispatch(action, messageSource)) as Dispatch<Action>,
    [store, messageSource]
  );
}

/**
 * This React hook makes the a mapped state value available within any component logic using the hook.
 */
export function useSelector<Selected>(stateMapper: (state: AppState) => Selected): Selected {
  const store = useStore();
  const [state, setState] = useState<Selected>(() => {
    const s = store.getState();
    return s ? stateMapper(s) : undefined;
  });
  const prevRef = useRef(state);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const storeState = store.getState();
      if (!storeState) return;
      const nextState = stateMapper(storeState);
      if (!shallowEqual(prevRef.current, nextState)) {
        prevRef.current = nextState;
        setState(nextState);
      }
    });
    return () => unsubscribe();
  }, [store]);

  return state;
}

export function getGlobalSetting(store: Store<AppState>, settingId: string): any {
  const settingsDef = KliveGlobalSettings[settingId];
  if (!settingsDef) {
    return null;
  }
  return get(store.getState()?.globalSettings ?? {}, settingId, settingsDef.defaultValue);
}

/**
 * This React hook makes the a mapped state value available within any component logic using the hook.
 */
export function useGlobalSetting(settingId: string): any {
  const store = useStore();
  const settingsDef = KliveGlobalSettings[settingId];
  if (!settingsDef) {
    return null;
  }

  const storeState = get(
    store.getState()?.globalSettings ?? {},
    settingId,
    settingsDef.defaultValue
  );
  const [state, setState] = useState(storeState);

  const prevSettingRef = useRef(storeState);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const nextState = get(
        store.getState()?.globalSettings ?? {},
        settingId,
        settingsDef.defaultValue
      );
      if (!shallowEqual(prevSettingRef.current, nextState)) {
        prevSettingRef.current = nextState;
        setState(nextState);
      }
    });
    return () => unsubscribe();
  }, [store]);

  return state;
}

// --- RendererContext properties
type Props = {
  store: Store<AppState>;
  messenger: MessengerBase;
  messageSource: MessageSource;
  children: ReactNode;
};

const RendererProvider = ({ store, messenger, messageSource, children }: Props) => (
  <RendererContext.Provider value={{ store, messenger, messageSource }}>
    {children}
  </RendererContext.Provider>
);

export default RendererProvider;
