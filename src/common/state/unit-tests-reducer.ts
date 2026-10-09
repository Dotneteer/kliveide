import type { Action } from "./Action";
import type { UnitTestsState } from "./AppState";
import type { UnitTestEvent } from "@common/unit-tests/unitTestTypes";

/**
 * The unit-test results (`.plans/Z80_UNIT_TESTS_PLAN.md` §4.3): the main process dispatches a run's
 * events, every window sees them. A run clears the results of the tests it runs only, so a filtered
 * run keeps the others' last results.
 */
export function unitTestsReducer(
  state: UnitTestsState = { results: {}, version: 0 },
  { type, payload }: Action
): UnitTestsState {
  switch (type) {
    case "UNIT_TESTS_RUN_STARTED": {
      const ids: string[] = payload?.ids ?? [];
      const results = { ...state.results };
      for (const id of ids) delete results[id];
      return {
        results,
        running: true,
        runIds: ids,
        startedAt: payload?.startedAt,
        problems: [],
        version: state.version + 1
      };
    }

    case "UNIT_TEST_EVENT": {
      const event = payload?.event as UnitTestEvent | undefined;
      if (!event) return state;
      switch (event.kind) {
        case "started":
          return { ...state, runningTest: event.id, version: state.version + 1 };
        case "result":
          return {
            ...state,
            results: { ...state.results, [event.result.id]: event.result },
            runningTest: undefined,
            version: state.version + 1
          };
        case "problem":
          return { ...state, problems: [...(state.problems ?? []), event.message], version: state.version + 1 };
        case "finished":
          return { ...state, summary: event.summary, version: state.version + 1 };
        default:
          return state;
      }
    }

    case "UNIT_TESTS_RUN_ENDED":
      return {
        ...state,
        running: false,
        runningTest: undefined,
        finishedAt: payload?.finishedAt,
        problems: payload?.problem ? [...(state.problems ?? []), payload.problem] : state.problems,
        version: state.version + 1
      };

    case "UNIT_TESTS_CLEAR":
      return { results: {}, version: state.version + 1 };

    default:
      return state;
  }
}
