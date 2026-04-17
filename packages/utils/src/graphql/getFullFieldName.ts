import { stringifyVariables } from '@urql/core'

export function getFullFieldName({ name, args }: { name: string; args?: any }): string {
  if (args && Object.keys(args).length) {
    name += `(${stringifyVariables(args)})`
  }
  return name
}
