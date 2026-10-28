/**
 * Videoton TVC test harness - the public surface. Import from here in tests:
 *
 *   import { createTvcSession } from "../harness/tvc";
 *
 * See README.md.
 */
export {
  createTvcSession,
  REPO_ROOT,
  TVC12_KEY_WAIT,
  TVC12_KEY_WAIT_END,
  TVC22_KEY_WAIT,
  TVC22_KEY_WAIT_END,
  TvcTestSession,
  type RunLimit,
  type TvcCrtcState,
  type TvcSessionOptions
} from "./session";
