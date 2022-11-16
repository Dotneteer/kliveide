import { Action } from "./Action";

/**
 * A store is an object that holds the application's state tree.
 */
export interface Store<S = any, A extends Action = Action> {
    /**
     * Resets the store's state to the specified one
     * @param state 
     */
    resetTo(state: S): void,

    /**
     * Dispatches an action. This is the only way to trigger a state change
     */
    dispatch: Dispatch<A>,

    /**
     * Reads the state tree managed by the store
     */
    getState(): S;

    /**
     * Adds a change listener. It will be called any time an action is dispatched, and some part of the state tree 
     * may potentially have changed.
     * @param listener A callback to be invoked on every dispatch.
     * @returns A function to remove this change listener.
     */
    subscribe(listener: () => void): Unsubscribe;
}

/**
 * A reducer is a function that accepts an accumulation and a value and returns a new accumulation. They are used
 * to reduce a collection of values down to a single value.
 *
 * @template S The type of state consumed and produced by this reducer.
 * @template A The type of actions the reducer can potentially respond to.
 */
export type Reducer<S = any, A extends Action = Action> = (
    state: S,
    action: A
) => S
  
/**
 * A dispatch function is a function that accepts an action or an async action; it then may or may not dispatch 
 * dispatch one or more actions to the store.
 * 
 * @template A The type of things which may be dispatched
 */
export type Dispatch<A extends Action = Action> = <T extends A>(action: T, forward?: boolean) => T;

/**
 * Function to remove listener added by `Store.subscribe()`.
 */
export type Unsubscribe = () => void;

/**
 * Function to forward an action
 */
export type ActionForwarder<A extends Action = Action> = (action: A) => Promise<void>;

/**
 * Creates a Redux store that holds the state tree.
 * 
 */
export function createStore<S = any, A extends Action = Action>(
    reducer: Reducer<S, A>,
    initialState: S,
    forwarder?: ActionForwarder
): Store<S, A> {

    let currentReducer = reducer
    let currentState = initialState;
    let currentListeners: (() => void)[] | null = [];
    let nextListeners = currentListeners;
    let isDispatching = false;

    const store: Store<S, A> = {
        resetTo,
        dispatch: dispatch as Dispatch<A>,
        getState,
        subscribe
    };
    return store;

    function resetTo(state: S) {
        currentState = state;
    }

    function dispatch(action: A, forward: boolean = true): A {
        if (typeof action !== "object" || Array.isArray(action)) {
            throw new Error("Actions must be plain objects.");
        }
      
        if (typeof action.type === "undefined") {
            throw new Error("Actions may not have an undefined 'type' property.");
        }
      
        if (isDispatching) {
            throw new Error("Reducers may not dispatch actions.");
        }
      
        try {
            isDispatching = true;
            currentState = currentReducer(currentState, action);
            if (forward && forwarder) {
                (async() => await forwarder(action))()
            }
        } finally {
            isDispatching = false;
        }
      
        const listeners = (currentListeners = nextListeners)
        for (let i = 0; i < listeners.length; i++) {
            const listener = listeners[i];
            listener();
        }
        return action;
    }

    function getState(): S {
        if (isDispatching) {
            throw new Error("You may not call store.getState() while the reducer is executing.");
        }

        return currentState as S
    }

    function subscribe(listener: () => void): Unsubscribe {
        if (typeof listener !== "function") {
            throw new Error(
              `Expected the listener to be a function. Instead, received: '${typeof listener}'`
            );
        }
      
        if (isDispatching) {
            throw new Error("You may not call store.subscribe() while the reducer is executing.")
        }
      
        let isSubscribed = true
        ensureCanMutateNextListeners()
        nextListeners.push(listener)
      
        return function unsubscribe() {
            if (!isSubscribed) {
                return
            }
      
            if (isDispatching) {
                throw new Error("You may not unsubscribe from a store listener while the reducer is executing.");
            }
      
            isSubscribed = false
      
            ensureCanMutateNextListeners()
            const index = nextListeners.indexOf(listener)
            nextListeners.splice(index, 1)
            currentListeners = null
        }
    }

   /**
    * This makes a shallow copy of currentListeners so we can use nextListeners as a temporary list while
    * dispatching. This prevents any bugs around consumers calling subscribe/unsubscribe in the middle of a
    * dispatch.
    */
    function ensureCanMutateNextListeners() {
        if (nextListeners === currentListeners) {
            nextListeners = currentListeners.slice()
        }
    }
}