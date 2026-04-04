/**
 * URQL Client Configuration for Linear GraphQL API
 */

import { Client, cacheExchange, fetchExchange } from "@urql/core";

const LINEAR_API_URL = "https://api.linear.app/graphql";

// Get API key from localStorage or environment
function getApiKey(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("linear_api_key");
  }
  return null;
}

export const client = new Client({
  url: LINEAR_API_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    const apiKey = getApiKey();
    return {
      headers: {
        Authorization: apiKey ? `Bearer ${apiKey}` : "",
        "Content-Type": "application/json",
      },
    };
  },
});

export function setApiKey(key: string): void {
  localStorage.setItem("linear_api_key", key);
}

export function clearApiKey(): void {
  localStorage.removeItem("linear_api_key");
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}
