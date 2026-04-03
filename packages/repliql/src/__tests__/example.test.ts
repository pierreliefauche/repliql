/**
 * Example tests for @repliql/core using Bun's native test runner
 */

import { describe, it, expect } from "bun:test";
import { greet, VERSION } from "../index";

describe("RepliQL Core", () => {
  it("should export greet function", () => {
    expect(typeof greet).toBe("function");
  });

  it("should greet with default name", () => {
    const result = greet();
    expect(result).toBe("Hello from RepliQL! 🚀");
  });

  it("should greet with custom name", () => {
    const result = greet("Custom");
    expect(result).toBe("Hello from Custom! 🚀");
  });

  it("should have version info", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION).toBe("0.0.1");
  });

  it("should handle async operations", async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
