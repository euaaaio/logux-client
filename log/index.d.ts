import type { Client } from '../client/index.js'

interface LogMessages {
  /**
   * Disable action added messages.
   */
  add?: boolean

  /**
   * Disable action cleaned messages.
   */
  clean?: boolean

  /**
   * Disable error messages.
   */
  error?: boolean

  /**
   * Disable action messages with specific types.
   */
  ignoreActions?: string[]

  /**
   * Disable tab role messages.
   */
  role?: boolean

  /**
   * Disable connection state messages.
   */
  state?: boolean

  /**
   * Disable user ID changing.
   */
  user?: boolean
}

/**
 * Display Logux events in browser console.
 *
 * ```js
 * import { log } from '@logux/client'
 * log(client, { ignoreActions: ['user/add'] })
 * ```
 *
 * @param client Observed Client instance.
 * @param messages Disable specific message types.
 * @returns Unbind listener.
 */
export function log(client: Client, messages?: LogMessages): () => void
