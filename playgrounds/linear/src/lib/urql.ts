import { proxySharedExchange } from '@repliql/shared-exchange'
import { createClient, fetchExchange } from 'urql'

const LINEAR_API_URL = 'https://api.linear.app/graphql'

const worker = new SharedWorker(new URL('../worker.ts', import.meta.url), {
  type: 'module',
  name: 'shared-service',
})
const sharedExchange = proxySharedExchange({ endpoint: worker.port })

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
    exchanges: [sharedExchange, fetchExchange],
    preferGetMethod: false,
    fetchOptions: () => ({
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    }),
  })
}
