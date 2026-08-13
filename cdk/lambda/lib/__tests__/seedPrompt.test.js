const { seedPrompt } = require("../seedPrompt");

describe("seedPrompt", () => {
  const defaultPrompt = "This is the default prompt.";

  it("returns defaultPrompt when value is null", () => {
    expect(seedPrompt(null, defaultPrompt)).toBe(defaultPrompt);
  });

  it("returns defaultPrompt when value is undefined", () => {
    expect(seedPrompt(undefined, defaultPrompt)).toBe(defaultPrompt);
  });

  it("returns defaultPrompt when value is an empty string", () => {
    expect(seedPrompt("", defaultPrompt)).toBe(defaultPrompt);
  });

  it("returns defaultPrompt when value is whitespace-only", () => {
    expect(seedPrompt("   ", defaultPrompt)).toBe(defaultPrompt);
    expect(seedPrompt("\t\n", defaultPrompt)).toBe(defaultPrompt);
  });

  it("returns value unchanged when it has non-whitespace content", () => {
    const customPrompt = "You are a helpful patient.";
    expect(seedPrompt(customPrompt, defaultPrompt)).toBe(customPrompt);
  });

  it("returns value unchanged even if it has leading/trailing whitespace", () => {
    const customPrompt = "  Some prompt with spaces  ";
    expect(seedPrompt(customPrompt, defaultPrompt)).toBe(customPrompt);
  });
});
