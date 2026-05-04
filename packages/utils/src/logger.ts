const LOG_LEVELS = {
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
}

const DEFAULT_LEVEL: LogLevel = 'warn'

export type LogLevel = keyof typeof LOG_LEVELS

export type LoggerConfig = {
  level?: LogLevel | (() => LogLevel)
} & {
  [L in LogLevel]?: (prefix: string, message: string, ...args: unknown[]) => void
}

export type Logger = {
  [L in LogLevel]: (message: string, ...args: unknown[]) => void
}

export function makeLogger(config: LoggerConfig & { prefix: string }): Logger {
  const { level, prefix, ...loggingFn } = config
  const getLevel = typeof level === 'function' ? level : () => level || DEFAULT_LEVEL

  return {
    debug(message, ...args) {
      if (loggingFn.debug && LOG_LEVELS[getLevel()] <= LOG_LEVELS.debug) {
        loggingFn.debug(prefix, message, ...args)
      }
    },
    info(message, ...args) {
      if (loggingFn.info && LOG_LEVELS[getLevel()] <= LOG_LEVELS.info) {
        loggingFn.info(prefix, message, ...args)
      }
    },
    warn(message, ...args) {
      if (loggingFn.warn && LOG_LEVELS[getLevel()] <= LOG_LEVELS.warn) {
        loggingFn.warn(prefix, message, ...args)
      }
    },
    error(message, ...args) {
      if (loggingFn.error && LOG_LEVELS[getLevel()] <= LOG_LEVELS.error) {
        loggingFn.error(prefix, message, ...args)
      }
    },
  }
}
