import { MessageSource } from "@/common/messaging/messages-core";
import { MessengerBase } from "@/common/messaging/MessengerBase";
import { Action } from "@/common/state/Action";
import { AppState } from "@/common/state/AppState";
import { Dispatch, Store } from "@/common/state/redux-light";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

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
export function useRendererContext (): RendererAppContext {
  return useContext(RendererContext);
}

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useStore (): Store<AppState> {
  return useContext(RendererContext)?.store;
}

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useMessenger (): MessengerBase {
  return useContext(RendererContext)?.messenger;
}

/**
 * This React hook makes the current message source information available within any component logic using the hook.
 */
export function useMessageSource (): MessageSource {
  return useContext(RendererContext)?.messageSource;
}

/**
 * This React hook makes the current dispatcher function available within any component logic using the hook.
 */
export function useDispatch (): Dispatch<Action> {
  const { store, messageSource } = useRendererContext();

  const dispatcher = ((action: Action, _: MessageSource) => {
    return store.dispatch(action, messageSource);
  }) as Dispatch<Action>;
  return useMemo(() => dispatcher, [store, messageSource]);
}

/**
 * This React hook makes the a mapped state value available within any component logic using the hook.
 */
export function useSelector<Selected> (
  stateMapper: (state: AppState) => Selected
): Selected {
  const store = useStore();
  const storeState = store.getState();
  const [state, setState] = useState(
    storeState ? stateMapper(store.getState()) : undefined
  );

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const storeState = store.getState();
      if (!storeState) return;

      setState(stateMapper(storeState));
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

const RendererProvider = ({
  store,
  messenger,
  messageSource,
  children
}: Props) => (
  <RendererContext.Provider value={{ store, messenger, messageSource }}>
    {children}
  </RendererContext.Provider>
);

export default RendererProvider;
