/**
 * ZX Spectrum 128K / +2E / +3E test harness - the public surface. Import from here in tests:
 *
 *   import { createSp128Session } from "../harness/sp128";
 *
 * See README.md.
 */
export {
  createHarnessSpectrumMachine,
  createSp128Session,
  Sp128TestSession,
  trdosRomFromEnvironment,
  type Sp128SessionModel,
  type Sp128SessionOptions
} from "./session";
