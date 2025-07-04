import { beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Setup and teardown
beforeEach(() => {
  cleanup();
});
