import * as React from "react";
import { connect } from "react-redux";
import { getVersion } from "../../version";
import { AppState } from "../../shared/state/AppState";
import { Root, Gap, Section, Label} from "../common/StatusbarStyles";

interface Props {}

/**
 * Represents the statusbar of the emulator
 */
class Statusbar extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  render() {
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
}

export default connect((state: AppState) => {
  return {};
}, null)(Statusbar);
