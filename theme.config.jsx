import { Logo } from "./src/renderer/controls/Logo";

export default {
  logo: <div style={{display: "flex", alignItems: "center"}}><Logo />
  <span style={{marginLeft: 12, fontWeight: "bold", fontSize: "2em"}}>Klive IDE</span>
  </div>,
  
  logoLink: "https://dotneteer.github.io/kliveide",
  editLink: {
    text: null
  },
  feedback: {
    content: null
  },
  project: {
    link: "https://github.com/dotneteer/kliveide"
  }
  // ... other theme options
};
