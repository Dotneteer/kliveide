import { FullPanel, SplitPanel } from "../common";

function EmulatorApp() {
  return (
    <FullPanel
      direction="vertical"
      gap="20px"
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1>Klive Emulator</h1>
      <SplitPanel primaryLocation="top" splitterSize={20}>
        <FullPanel backgroundColor="red"></FullPanel>
        <FullPanel backgroundColor="green"></FullPanel>
      </SplitPanel>
    </FullPanel>
  );
}

export default EmulatorApp;
