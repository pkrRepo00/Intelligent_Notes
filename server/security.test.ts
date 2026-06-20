import { describe, it, expect } from "vitest";
import { validateSafeUrl } from "./security";

describe("validateSafeUrl", () => {
  it("should allow valid https URLs", () => {
    expect(validateSafeUrl("https://api.openai.com/v1")).toBe("https://api.openai.com/v1");
  });

  it("should allow valid http URLs (like local AI)", () => {
    expect(validateSafeUrl("http://127.0.0.1:11434")).toBe("http://127.0.0.1:11434/");
    expect(validateSafeUrl("http://localhost:11434")).toBe("http://localhost:11434/");
  });

  it("should throw on invalid protocols", () => {
    expect(() => validateSafeUrl("file:///etc/passwd")).toThrow("Forbidden protocol: file:");
    expect(() => validateSafeUrl("ftp://example.com/file")).toThrow("Forbidden protocol: ftp:");
    expect(() => validateSafeUrl("gopher://example.com/file")).toThrow("Forbidden protocol: gopher:");
  });

  it("should throw on metadata IP", () => {
    expect(() => validateSafeUrl("http://169.254.169.254/latest/meta-data/")).toThrow("Access to metadata endpoint is forbidden");
    expect(() => validateSafeUrl("https://169.254.169.254/")).toThrow("Access to metadata endpoint is forbidden");
  });

  it("should throw on invalid URL format", () => {
    expect(() => validateSafeUrl("not-a-url")).toThrow("Invalid URL");
  });

  it("should throw on missing or invalid types", () => {
    expect(() => validateSafeUrl("")).toThrow("Invalid URL input type");
    // @ts-expect-error testing invalid type
    expect(() => validateSafeUrl(null)).toThrow("Invalid URL input type");
  });
});
