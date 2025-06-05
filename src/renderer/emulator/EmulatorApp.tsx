import { FullPanel, SplitPanel } from "../common";

function EmulatorApp() {
  return (
    <FullPanel
      direction="vertical"
      gap="20px"
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: "20px",
      }}
    >
      <h1>Klive Emulator - Enhanced Cursor Demo</h1>
        <SplitPanel 
          primaryLocation="top" 
          splitterSize={20}
          initialPrimarySize="30%"
          minPrimarySize="100px"
          maxPrimarySize="400px"
          minSecondarySize="150px"
        >
          <FullPanel 
            backgroundColor="red"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "18px",
              fontWeight: "bold"
            }}
          >
            Primary Panel (Top)
            <br />
            Min: 100px, Max: 400px
            <br />
            <small>Try dragging the splitter!</small>
          </FullPanel>
          <FullPanel 
            backgroundColor="green"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: "18px",
              fontWeight: "bold"
            }}
          >
            Secondary Panel (Bottom)
            <br />
            Min: 150px
            <br />
            <small>Spatial cursor logic active!</small>
          </FullPanel>
        </SplitPanel>
    </FullPanel>
  );
}

export default EmulatorApp;
