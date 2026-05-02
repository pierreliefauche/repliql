import { conduit } from '@repliql/conduit/tab'
import { fastCacheExchange } from '@repliql/repliql'
import { proxySharedExchange, proxySharedService } from '@repliql/shared-exchange'
import { createClient, fetchExchange } from 'urql'

const LINEAR_API_URL = 'https://api.linear.app/graphql'

const { sharedWorker } = conduit({
  loadWorker: () =>
    new Worker(new URL('./dedicated.worker/index.ts', import.meta.url), {
      type: 'module',
      name: 'linear-sqlite',
    }),
  loadSharedWorker: () =>
    new SharedWorker(new URL('./shared.worker/index.ts', import.meta.url), {
      type: 'module',
      name: 'linear-repliql',
    }),
})

const sharedService = proxySharedService({ endpoint: sharedWorker.port })
const sharedExchange = proxySharedExchange({ sharedService })

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
    exchanges: [
      fastCacheExchange({
        eviction: {
          strategy: 'lru',
          size: 100,
        },
      }),
      sharedExchange,
      fetchExchange,
    ],
    preferGetMethod: false,
    fetchOptions: () => ({
      headers: {
        'Content-Type': 'application/json',
        Authorization: token,
      },
    }),
  })
}
