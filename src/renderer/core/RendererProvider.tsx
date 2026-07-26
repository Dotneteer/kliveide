import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { MessageSource } from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { Action } from "@state/Action";
import { AppState } from "@state/AppState";
import { Dispatch, Store } from "@state/redux-light";
import { get } from "lodash";
import { createContext, ReactNode, useContext, useEffect, useMemo, useReducer, useRef } from "react";

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
const RendererContext = createContext<RendererAppContext | undefined>(undefined);

/**
 * This React hook makes the current renderer context available within any component logic using the hook.
 */
export function useRendererContext(): RendererAppContext {
  const context = useContext(RendererContext);
  if (!context) {
    throw new Error("useRendererContext must be used within a RendererProvider.");
  }
  return context;
}

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useStore(): Store<AppState> {
  return useRendererContext().store;
}

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useMessenger(): MessengerBase {
  return useRendererContext().messenger;
}

/**
 * This React hook makes the current message source information available within any component logic using the hook.
 */
export function useMessageSource(): MessageSource {
  return useRendererContext().messageSource;
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
  const [, forceRender] = useReducer((version: number) => version + 1, 0);
  const mapperRef = useRef(stateMapper);
  const selectedRef = useRef<Selected | undefined>(undefined);
  const hasSelectedValueRef = useRef(false);

  mapperRef.current = stateMapper;

  const selected = stateMapper(store.getState());
  if (!hasSelectedValueRef.current || !shallowEqual(selectedRef.current, selected)) {
    selectedRef.current = selected;
    hasSelectedValueRef.current = true;
  }

  useEffect(() => {
    const updateSelectedValue = () => {
      const storeState = store.getState();
      if (!storeState) return;
      const nextState = mapperRef.current(storeState);
      if (!shallowEqual(selectedRef.current, nextState)) {
        selectedRef.current = nextState;
        hasSelectedValueRef.current = true;
        forceRender();
      }
    };

    updateSelectedValue();
    const unsubscribe = store.subscribe(updateSelectedValue);
    return () => unsubscribe();
  }, [store]);

  return selectedRef.current as Selected;
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
  const settingsDef = KliveGlobalSettings[settingId];
  return useSelector((state) => {
    if (!settingsDef) return null;
    return get(state?.globalSettings ?? {}, settingId, settingsDef.defaultValue);
  });
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
