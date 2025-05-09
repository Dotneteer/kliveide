import { KliveGlobalSettings } from "@common/settings/setting-definitions";
import { MessageSource } from "@messaging/messages-core";
import { MessengerBase } from "@messaging/MessengerBase";
import { Action } from "@state/Action";
import { AppState } from "@state/AppState";
import { Dispatch, Store } from "@state/redux-light";
import { get } from "lodash";
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

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

  const dispatcher = ((action: Action, _: MessageSource) => {
    return store.dispatch(action, messageSource);
  }) as Dispatch<Action>;
  return useMemo(() => dispatcher, [store, messageSource]);
}

/**
 * This React hook makes the a mapped state value available within any component logic using the hook.
 */
export function useSelector<Selected>(stateMapper: (state: AppState) => Selected): Selected {
  const store = useStore();
  const storeState = store.getState();
  const [state, setState] = useState(storeState ? stateMapper(store.getState()) : undefined);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const storeState = store.getState();
      if (!storeState) return;
      const mappedState = stateMapper(storeState);
      if (typeof mappedState === "object" && mappedState != undefined) {
        if (Array.isArray(mappedState)) {
          setState(mappedState.slice(0) as any);
        } else {
          setState({ ...mappedState });
        }
      } else {
        setState(mappedState);
      }
    });

    return () => unsubscribe();
  }, [store, storeState]);

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

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const mappedState = get(
        store.getState()?.globalSettings ?? {},
        settingId,
        settingsDef.defaultValue
      );
      if (typeof mappedState === "object" && mappedState != undefined) {
        if (Array.isArray(mappedState)) {
          setState(mappedState.slice(0) as any);
        } else {
          setState({ ...mappedState });
        }
      } else {
        setState(mappedState);
      }
    });

    return () => unsubscribe();
  }, [store, storeState]);

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
