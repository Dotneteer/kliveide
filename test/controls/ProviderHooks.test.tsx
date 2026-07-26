import React, { act } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@renderer/appEmu/MachineService", () => ({
  createMachineService: () => ({})
}));

vi.mock("@renderer/core/UiServices", () => ({
  createUiService: () => ({})
}));

vi.mock("@renderer/core/ValidationService", () => ({
  createValidationService: () => ({})
}));

vi.mock("@renderer/appIde/services/IdeCommandService", () => ({
  createInteractiveCommandsService: () => ({
    setAppServices: vi.fn()
  })
}));

vi.mock("@renderer/appIde/services/OuputPaneService", () => ({
  createOutputPaneService: () => ({})
}));

vi.mock("@renderer/appIde/services/ProjectService", () => ({
  createProjectService: () => ({})
}));

vi.mock("@renderer/appIde/services/ScriptService", () => ({
  createScriptService: () => ({})
}));

import RendererProvider from "@renderer/core/RendererProvider";
import {
  AppServicesProvider,
  useAppServices
} from "@renderer/appIde/services/AppServicesProvider";
import {
  DocumentHubServiceProvider,
  useDocumentHubService,
  useDocumentHubServiceVersion
} from "@renderer/appIde/services/DocumentServiceProvider";
import { IDocumentHubService } from "@renderer/abstractions/IDocumentHubService";
import { incDocHubServiceVersionAction } from "@common/state/actions";
import { createMockStore, MockMessenger } from "../react-test-utils";

function renderWithRendererProvider(ui: React.ReactElement) {
  const store = createMockStore();
  const messenger = new MockMessenger();
  return {
    store,
    ...render(
      <RendererProvider store={store} messenger={messenger} messageSource="ide">
        {ui}
      </RendererProvider>
    )
  };
}

function createDocumentHub(hubId: number): IDocumentHubService {
  return { hubId } as IDocumentHubService;
}

describe("AppServicesProvider — Step 2: service context", () => {
  it("throws a clear error when useAppServices is used without its provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Subject() {
      useAppServices();
      return null;
    }

    expect(() => render(<Subject />)).toThrow(/AppServicesProvider/);
    consoleError.mockRestore();
  });

  it("keeps one service instance across provider re-renders", () => {
    const seenServices: unknown[] = [];

    function Subject({ value }: { value: number }) {
      seenServices.push(useAppServices());
      return <span>{value}</span>;
    }

    const { rerender, store } = renderWithRendererProvider(
      <AppServicesProvider>
        <Subject value={1} />
      </AppServicesProvider>
    );

    rerender(
      <RendererProvider store={store} messenger={new MockMessenger()} messageSource="ide">
        <AppServicesProvider>
          <Subject value={2} />
        </AppServicesProvider>
      </RendererProvider>
    );

    expect(seenServices[0]).toBe(seenServices[1]);
  });
});

describe("DocumentServiceProvider — Step 2: document hub context", () => {
  it("throws a clear error when useDocumentHubService is used without its provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Subject() {
      useDocumentHubService();
      return null;
    }

    expect(() => render(<Subject />)).toThrow(/DocumentHubServiceProvider/);
    consoleError.mockRestore();
  });

  it("throws a clear error when useDocumentHubServiceVersion has no hub", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    function Subject() {
      useDocumentHubServiceVersion();
      return null;
    }

    expect(() => renderWithRendererProvider(<Subject />)).toThrow(/DocumentHubServiceProvider/);
    consoleError.mockRestore();
  });

  it("tracks the version of an explicitly supplied document hub", async () => {
    function Subject({ hub }: { hub: IDocumentHubService }) {
      const version = useDocumentHubServiceVersion(hub);
      return <span>{version ?? "missing"}</span>;
    }

    const hub = createDocumentHub(42);
    const { store, getByText } = renderWithRendererProvider(<Subject hub={hub} />);

    expect(getByText("missing")).toBeTruthy();

    await act(async () => {
      store.dispatch(incDocHubServiceVersionAction(42), "ide");
    });

    expect(getByText("1")).toBeTruthy();
  });

  it("uses the provider hub when no explicit hub is supplied", async () => {
    function Subject() {
      const hub = useDocumentHubService();
      const version = useDocumentHubServiceVersion();
      return <span>{`${hub.hubId}:${version ?? "missing"}`}</span>;
    }

    const hub = createDocumentHub(7);
    const { store, getByText } = renderWithRendererProvider(
      <DocumentHubServiceProvider value={hub}>
        <Subject />
      </DocumentHubServiceProvider>
    );

    expect(getByText("7:missing")).toBeTruthy();

    await act(async () => {
      store.dispatch(incDocHubServiceVersionAction(7), "ide");
    });

    expect(getByText("7:1")).toBeTruthy();
  });
});
