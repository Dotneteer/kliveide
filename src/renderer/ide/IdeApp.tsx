import FullPanel from "../common/FullPanel";

function IdeApp() {
  return (
    <FullPanel
      direction="vertical"
      gap="20px"
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <h1>Klive IDE</h1>
    </FullPanel>
  );
}

export default IdeApp
