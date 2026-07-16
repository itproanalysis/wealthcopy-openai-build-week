import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("OpenAI server configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses the bounded Luna client defaults", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "");
    const { getOpenAIClient, getOpenAIModel } = await import("./openai");

    const client = getOpenAIClient();

    expect(client.timeout).toBe(10_000);
    expect(client.maxRetries).toBe(0);
    expect(getOpenAIModel()).toBe("gpt-5.6-luna");
  });

  it("preserves an explicit model override", async () => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "  gpt-5.6-terra  ");
    const { getOpenAIModel } = await import("./openai");

    expect(getOpenAIModel()).toBe("gpt-5.6-terra");
  });

  it("fails closed when the server key is absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const { getOpenAIClient, MissingOpenAIKeyError } = await import("./openai");

    expect(() => getOpenAIClient()).toThrow(MissingOpenAIKeyError);
  });
});
