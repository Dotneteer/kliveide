import { describe, expect, it } from "vitest";
import { documentPanelRegistry } from "@renderer/registry";
import { NEX_VIEWER, TAP_VIEWER, Z88_SNAPSHOT_VIEWER } from "@state/common-ids";
import { fileDocumentNavigationAdapter } from "@renderer/appIde/navigation/fileDocumentNavigationAdapter";

/*
 * A viewer that pops banks out into documents must be a navigation entry itself, or the history
 * records only the bank and Go Back has nowhere to return to. The `.z88` viewer shipped its Slots
 * browser without one, and `nav-back` after a pop-out answered "No location to go back to."
 */
describe("Viewers with bank pop-outs are navigation entries", () => {
  it.each([
    ["the NEX viewer", NEX_VIEWER],
    ["the .z88 snapshot viewer", Z88_SNAPSHOT_VIEWER],
    ["the .tap/.tzx viewer", TAP_VIEWER]
  ])("%s", (_name, id) => {
    const panel = documentPanelRegistry.find((p) => p.id === id);
    expect(panel?.navigation).toBe(fileDocumentNavigationAdapter);
  });
});
