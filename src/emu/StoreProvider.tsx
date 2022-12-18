import { Action } from "@state/Action";
import { AppState } from "@state/AppState";
import { Dispatch, Store } from "@state/redux-light";
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { emuStore } from "./emu-store";

/**
 * This object provides the React context of the application state store, which we pass the root component, and thus
 * all nested components may use it. 
 */
const StoreContext = createContext<Store>(emuStore);

/**
 * This React hook makes the current state store information available within any component logic using the hook.
 */
export function useStore(): Store<AppState> {
    return useContext(StoreContext);
}

/**
 * This React hook makes the current dispatcher function available within any component logic using the hook.
 */
export function useDispatch(): Dispatch<Action> {
    const store = useStore();
    return store.dispatch
}

/**
 * This React hook makes the a mapped state value available within any component logic using the hook.
 */
export function useSelector<Selected>(stateMapper: (state: AppState) => Selected): Selected {
    const store = useStore();
    const storeState = store.getState()
    const [state, setState] = useState(storeState ? stateMapper(store.getState()) : undefined);

    useEffect(() => {
      const unsubscribe = store.subscribe(() => {
        const storeState = store.getState();
        if (!storeState) return;

        setState(stateMapper(storeState));
      });

      return () => unsubscribe();
    }, [store])

    return state;
}

type Props = {
    children: ReactNode
};

const StoreProvider = ({ children }: Props) => {
    const store = useStore();

    return (
        <StoreContext.Provider value={store}>
            {children}
        </StoreContext.Provider>
    );
}

export default StoreProvider;