import { createClient, fetchExchange } from 'urql'

const LINEAR_API_URL = 'https://api.linear.app/graphql'

export function getApiToken(): string | null {
  return localStorage.getItem('linear-api-token')
}

export function setApiToken(token: string) {
  localStorage.setItem('linear-api-token', token)
}

export function clearApiToken() {
  localStorage.removeItem('linear-api-token')
}

export function createLinearClient(token: string) {
  return createClient({
    url: LINEAR_API_URL,
    exchanges: [fetchExchange],
    fetchOptions: () => ({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    }),
  })
}
