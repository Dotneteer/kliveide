import { describe, expect, it } from "vitest";

import { SJASMPLUS_INTEGRATION_DIALOG } from "@common/messaging/dialog-ids";
import { publicDialogIds } from "@renderer/appIde/commands/DialogCommands";

describe("publicDialogIds", () => {
  it("exposes the SJASMPLUS integration dialog to IDE commands", () => {
    expect(publicDialogIds.sjasmplusIntegration).toEqual({
      source: "ide",
      dialogId: SJASMPLUS_INTEGRATION_DIALOG
    });
  });
});
