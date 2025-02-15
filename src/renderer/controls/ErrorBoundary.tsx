import React, { ErrorInfo, ReactNode } from "react";

// --- The properties of the ErrorBoundary component
interface Props {
  // --- Child nodes within the boundary
  children: ReactNode;

  // --- The location of the error
  location?: string;
}

// --- This type represents the current state of the error boundary
type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * This React component serves as an error boundary; it catches any errors within
 * the nested components
 */
export class ErrorBoundary extends React.Component<Props, State> {
  // --- We start with "no error" state
  state: State = {
    hasError: false,
    error: null
  };

  /**
   * This method implements the Error Boundaries for the React application.
   * It is invoked if errors occur during the rendering phase of any lifecycle
   * methods or children components.
   *
   * DO NOT DELETE this method! Though it is not referenced directly from the code,
   * it is a required part of the React component lifecycle.
   */
  static getDerivedStateFromError(error: Error): State {
    // --- Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  /**
   * Display any error in the console
   * @param error Error object
   * @param errorInfo Extra information about the error
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo, this.props.location);
  }

    /**
   * Whenever the `restoreOnChangeOf` property of this component instance
   * changes, we reset the state to "no error".
   * @param prevProps Previous property values
   * @param prevState Previous state
   * @param snapshot Optional snapshot (not used in this component)
   */
  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<State>, snapshot?: any) {
    if (prevProps !== this.props) {
      this.setState({
        hasError: false,
      });
    }
  }

  /**
   * Display an error message if an error occurred during rendering.
   */
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}
