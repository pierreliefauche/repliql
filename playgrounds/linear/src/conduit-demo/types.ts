export type Computations = {
  square: (v: number) => number
  abs: (v: number) => number
}

export interface CounterService {
  increment: (offset: number) => void
  getValue: () => number
  getSquare: () => Promise<number>
  getAbs: () => Promise<number>
}
