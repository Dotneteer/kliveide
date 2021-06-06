import * as React from "react";
import { getVersion } from "../../version";
import { Root, Gap, Section, Label } from "../common/StatusbarStyles";

/**
 * Represents the statusbar of the emulator
 */
export default function Statusbar() {
  return (
    <Root>
      <Section key="1">
        <Label>Ide Statusbar</Label>
      </Section>
      <Gap />
      <Section>
        <Label>Klive {getVersion()}</Label>
      </Section>
    </Root>
  );
}
