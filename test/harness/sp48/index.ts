/**
 * ZX Spectrum 48K test harness - the public surface. Import from here in tests:
 *
 *   import { createSp48Session } from "../harness/sp48";
 *
 * See README.md.
 */
export { createSp48Session, Sp48TestSession, type RunLimit, type Sp48Program } from "./session";
