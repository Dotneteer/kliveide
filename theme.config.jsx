import { Logo } from "./src/renderer/controls/Logo";
import ClickableImage from './page-components/ClickableImage';

export default {
  logo: <div style={{display: "flex", alignItems: "center"}}><Logo />
  <span style={{marginLeft: 12, fontWeight: "bold", fontSize: "2em"}}>Klive IDE</span>
  </div>,
  
  logoLink: "https://dotneteer.github.io/kliveide",
  editLink: false,
  feedback: {
    content: null
  },
  components: {
    ClickableImage
  },
  project: {
    link: "https://github.com/dotneteer/kliveide"
  },
  sidebar: {
    autoCollape: true,
    defaultMenuCollapseLevel: 1
  },
  footer: {
    text: (
      <div>
      <span>
        <strong>Klive IDE</strong> is an open-source project (MIT) developed by <em>Istvan Novak</em> (2016-2023).
      </span>
      </div>
    )
  }
};
