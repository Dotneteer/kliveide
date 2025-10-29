import { styledTextComponentRenderer } from "./StyledText/StyledText";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";

export default {
  namespace: "XMLUIExtensions",
  components: [styledTextComponentRenderer, sharedAppStateComponentRenderer],
};
