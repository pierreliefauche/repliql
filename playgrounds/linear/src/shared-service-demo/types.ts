export type CounterService = {
  inc: () => number
  get: () => number
}

export type PresenceService = {
  list: () => string[]
  whoAmI: () => string
}

export type TimerService = {
  delay: (ms: number, cb: (v: number) => unknown) => void
}

export type SharedServiceMap = {
  counter: CounterService
  presence: PresenceService
  timer: TimerService
}
