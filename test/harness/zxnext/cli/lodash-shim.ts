/*
 * Vite's SSR module runner refuses named imports from CommonJS `lodash` (`import { isInteger } from
 * "lodash"` in src/main/fat32/CimFileManager.ts). vite-host.cjs aliases the bare `lodash` specifier
 * here; this file imports the CommonJS build under a different specifier and re-exports what the
 * sources the visual tests load actually use.
 */
import lodash from "lodash/lodash.js";

export default lodash;
export const { get, set, split, isInteger, isPlainObject, cloneDeep, isEqual, debounce, throttle } = lodash;
