import { fastCacheExchange } from '@repliql/repliql'
import { proxySharedExchange } from '@repliql/shared-exchange/tab'
import { createClient, fetchExchange, mapExchange } from 'urql'

import { sharedServices } from './sharedServices'

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
    exchanges: [
      fastCacheExchange({
        eviction: {
          strategy: 'lru',
          size: 100,
        },
      }),
      proxySharedExchange({ sharedExchange: sharedServices.sharedExchange }),
      mapExchange({
        onOperation(op) {
          op.context.fetchOptions = () => ({
            headers: {
              'Content-Type': 'application/json',
              Authorization: token,
            },
          })
        },
      }),
      fetchExchange,
    ],
    preferGetMethod: false,
  })
}
