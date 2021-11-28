import * as React from "react";
import { useSelector } from "react-redux";

import { getVersion } from "../version";
import { AppState } from "@state/AppState";
import { Icon } from "@components/Icon";
import { Section, Label, StatusbarRoot } from "@components/StatusbarStyles";
import { getNodeFile } from "@abstractions/project-node";
import { Column } from "@components/Panels";

/**
 * Represents the statusbar of the emulator
 */
export default function Statusbar() {
  return (
    <StatusbarRoot>
      <CompilerStatus />
      <Column />
      <EditorStatus />
      <Section>
        <Label>Klive {getVersion()}</Label>
      </Section>
    </StatusbarRoot>
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
    ? "settings-gear"
    : errorCount > 0
    ? "warning"
    : "check";
  return (
    <Section key="1">
      <Icon iconName="combine" style={{ marginRight: 8 }} />
      {filename && (
        <Icon iconName={icon} xclass={inProgress ? "rotating" : ""} />
      )}
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
