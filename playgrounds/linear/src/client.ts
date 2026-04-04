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

/**
 * Set the Linear API key in localStorage.
 * NOTE: localStorage is used for this playground/demo app as it runs entirely
 * client-side. For production apps, consider using secure HTTP-only cookies
 * or a backend proxy to avoid exposing API keys in the browser.
 */
export function setApiKey(key: string): void {
  // nosemgrep: javascript.browser.security.insecure-localstorage.insecure-localstorage
  localStorage.setItem("linear_api_key", key);
}

export function clearApiKey(): void {
  localStorage.removeItem("linear_api_key");
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}
