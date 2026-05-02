import { conduit } from '@repliql/conduit/shared'
import {
  type DriverBridgeRemote,
  replayCreateCallbackFunction,
} from '@repliql/kysely-driver-bridge/shared'
import { expose } from 'comlink'

console.log('[shared worker] Initiating conduit')

const { wrapDedicatedWorker, onConnectTab, events } = conduit()

console.log('[shared worker] Did init conduit, will wrap dedicated worker')

const remoteBridge = wrapDedicatedWorker<DriverBridgeRemote>()
const createCallbackFunction = replayCreateCallbackFunction({ events })

console.log('[shared worker] Did wrap dedicated worker into bridge, will init Kysely')

console.log('[shared worker] Creating callback function')

createCallbackFunction('tellme', (...args) => {
  console.log('[shared worker] Callback function called', ...args)
})

console.log('[shared worker] Created callback function')

onConnectTab(port => {
  expose(remoteBridge, port)
})
