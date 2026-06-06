import { helloComponentRenderer } from "./Hello/Hello";
import { sharedAppStateComponentRenderer } from "./SharedAppState/SharedAppState";

export default {
  namespace: "XMLUIExtensions",
  components: [
    helloComponentRenderer,
    sharedAppStateComponentRenderer,
  ]
};
