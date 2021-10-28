import { AppState } from "@state/AppState";
import * as React from "react";
import { useSelector } from "react-redux";
import { getVersion } from "../../version";
import { Icon } from "../../emu-ide/components/Icon";
import { Gap, Section, Label } from "../../emu-ide/components/StatusbarStyles";
import styles from "styled-components";
import { getNodeFile } from "../../core/abstractions/project-node";

/**
 * Represents the statusbar of the emulator
 */
export default function Statusbar() {
  return (
    <Root>
      <CompilerStatus />
      <Gap />
      <EditorStatus />
      <Section>
        <Label>Klive {getVersion()}</Label>
      </Section>
    </Root>
  );
}

/**
 * Represents the status of the compiler
 * @returns
 */
function CompilerStatus() {
  const inProgress = useSelector(
    (state: AppState) => state?.compilation?.inProgress
  );
  const result = useSelector((state: AppState) => state?.compilation?.result);
  const filename = useSelector(
    (state: AppState) => state?.compilation?.filename
  );
  const errorCount = result?.errors?.length ?? 0;
  const icon = inProgress
    ? "circle-filled"
    : errorCount > 0
    ? "warning"
    : "check";
  return (
    <Section key="1">
      <Icon iconName="combine" style={{ marginRight: 8 }} />
      {filename && <Icon iconName={icon} />}
      {filename && (
        <Label>
          ({getNodeFile(filename)}
          {errorCount > 0
            ? `, ${errorCount} ${errorCount === 1 ? "error" : "errors"}`
            : ""}
          )
        </Label>
      )}
    </Section>
  );
}

function EditorStatus() {
  const displayStatus = useSelector(
    (state: AppState) => state?.editor?.displayed ?? false
  );
  const line = useSelector((state: AppState) => state?.editor?.line ?? -1);
  const column = useSelector((state: AppState) => state?.editor?.column ?? -1);
  return (
    <>
      {displayStatus && (
        <Section key="2">
          <Label>{`Ln ${line}, Col ${column}`}</Label>
        </Section>
      )}
    </>
  );
}

const Root = styles.div`
  display: flex;
  flex-shrink: 0;
  flex-grow: 0;
  height: 28px;
  width: 100%;
  padding: 0px 8px;
  background-color: var(--statusbar-background-color);
  box-sizing: border-box;
  align-content: start;
  align-items: center;
  justify-items: start;
  font-size: 0.8em;
`;
