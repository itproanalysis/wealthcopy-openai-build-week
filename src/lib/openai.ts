import "server-only";

import OpenAI from "openai";

const DEFAULT_OPENAI_MODEL = "gpt-5.6";

let client: OpenAI | undefined;

export class MissingOpenAIKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured.");
    this.name = "MissingOpenAIKeyError";
  }
}

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new MissingOpenAIKeyError();
  }

  client ??= new OpenAI({
    apiKey,
    maxRetries: 1,
    timeout: 90_000,
  });
  return client;
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}
