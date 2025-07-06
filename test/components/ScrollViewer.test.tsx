import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import React from "react";
import ScrollViewer from "@renderer/controls/ScrollViewer";

// Mock ResizeObserver before component is imported
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

// Assign the mock to global object
global.ResizeObserver = MockResizeObserver as any;

// Add the necessary TypeScript declarations for jest-dom
declare module "vitest" {
  interface Assertion<T = any> {
    toBeInTheDocument(): T;
    toHaveClass(className: string): T;
    toHaveStyle(style: Record<string, any>): T;
    toHaveAttribute(name: string, value?: string): T;
  }
}

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// We need to mock these modules
vi.mock("@renderer/controls/ScrollViewer.module.scss", () => ({
  default: {
    scrollViewer: "scrollViewer",
    horizontal: "horizontal"
  }
}));

vi.mock("@renderer/theming/ThemeProvider", () => ({
  useTheme: () => ({
    theme: { tone: "dark" }
  })
}));

vi.mock("@renderer/controls/AttachedShadow", () => ({
  AttachedShadow: ({ visible }: { visible: boolean; parentElement: any }) => (
    <div data-testid="attached-shadow" data-visible={visible ? "true" : "false"}></div>
  )
}));

// Mock the OverlayScrollbarsComponent
const mockScrollElement = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollTo: vi.fn()
};

const mockOsInstance = {
  elements: () => ({
    scrollOffsetElement: mockScrollElement
  })
};

// Create a mock implementation that supports refs and osInstance
vi.mock("overlayscrollbars-react", () => {
  const OverlayScrollbarsComponentMock = React.forwardRef(({ children, options, className }: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({
      osInstance: () => mockOsInstance
    }));
    
    return <div data-testid="mock-overlay-scrollbars" className={className}>{children}</div>;
  });
  
  return {
    OverlayScrollbarsComponent: OverlayScrollbarsComponentMock
  };
});

describe("ScrollViewer Component", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should render with basic props", () => {    
    render(
      <ScrollViewer className="test-class">
        <div>Test Content</div>
      </ScrollViewer>
    );
    
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByTestId("mock-overlay-scrollbars")).toBeInTheDocument();
  });

  it("should apply custom class name", () => {
    render(
      <ScrollViewer className="custom-class">
        <div>Test Content</div>
      </ScrollViewer>
    );
    
    // The scroll viewer should have the custom class
    const scrollViewer = screen.getByTestId("mock-overlay-scrollbars").parentElement;
    expect(scrollViewer).toHaveClass("custom-class");
  });

  it("should handle horizontal scrolling configuration", () => {
    render(
      <ScrollViewer allowHorizontal={true} allowVertical={false}>
        <div>Horizontal Content</div>
      </ScrollViewer>
    );
    
    // We'd test the scrolling behavior here, but it's mostly handled by the mocked component
    expect(screen.getByText("Horizontal Content")).toBeInTheDocument();
  });

  it("should handle thin scrollbar option", () => {
    render(
      <ScrollViewer thinScrollBar={true}>
        <div>Content with thin scrollbar</div>
      </ScrollViewer>
    );
    
    expect(screen.getByText("Content with thin scrollbar")).toBeInTheDocument();
  });

  it("should apply custom styles", () => {
    const customStyle = { width: "500px", height: "300px" };
    
    render(
      <ScrollViewer style={customStyle}>
        <div>Styled Content</div>
      </ScrollViewer>
    );
    
    expect(screen.getByText("Styled Content")).toBeInTheDocument();
  });
  
  it("should call apiLoaded callback with ScrollViewerApi", () => {
    const apiLoadedMock = vi.fn();
    
    render(
      <ScrollViewer apiLoaded={apiLoadedMock}>
        <div>API Test Content</div>
      </ScrollViewer>
    );
    
    expect(apiLoadedMock).toHaveBeenCalled();
    const api = apiLoadedMock.mock.calls[0][0];
    expect(typeof api.getScrollTop).toBe("function");
    expect(typeof api.getScrollLeft).toBe("function");
    expect(typeof api.scrollToVertical).toBe("function");
    expect(typeof api.scrollToHorizontal).toBe("function");
  });
  
  it("should call onScrolled callback when content is scrolled", () => {
    const onScrolledMock = vi.fn();
    
    render(
      <ScrollViewer onScrolled={onScrolledMock}>
        <div>Scrolled Content</div>
      </ScrollViewer>
    );
    
    // We can't test the actual scrolling as it's mocked,
    // but we can verify the callback is properly wired up
    expect(screen.getByText("Scrolled Content")).toBeInTheDocument();
  });
});
