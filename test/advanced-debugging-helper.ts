import { setAdvancedDebuggingAction } from "@state/actions";

/**
 * Turns the advanced-debugging feature switch on in a store (`@common/features/advancedDebugging`).
 *
 * The switch lives in the store, which starts without it, so a test that exercises the G4/G5
 * group - the execution history, reverse debugging, trace export, debug recordings - turns it on
 * first, as the main process does at startup unless `features.advancedDebugging` is turned off.
 */
export function withAdvancedDebugging<T extends { dispatch: (action: any, source?: any) => void }>(store: T): T {
  store.dispatch(setAdvancedDebuggingAction(true));
  return store;
}
