import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Make vi available globally as jest
(globalThis as typeof globalThis & { jest: typeof vi }).jest = vi;

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
