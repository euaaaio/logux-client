import type { LoguxNotFoundError, SyncMapValues } from '@logux/actions'
import type { StoreValue } from 'nanostores'
import { Component } from 'react'
import type { ComponentType, Context as ReactContext, ReactNode } from 'react'

import type { Client } from '../client/index.js'
import type { AuthStore } from '../create-auth/index.js'
import type {
  Filter,
  FilterOptions,
  FilterStore
} from '../create-filter/index.js'
import type {
  ChannelDeniedError,
  ChannelError,
  ChannelNotFoundError
} from '../logux-undo-error/index.js'
import type {
  SyncMapTemplateLike,
  SyncMapValue
} from '../sync-map-template/index.js'

/**
 * Context to send Logux Client or object space to components deep in the tree.
 *
 * ```js
 * import { ClientContext, ChannelErrors } from '@logux/client/react'
 * import { CrossTabClient } from '@logux/client'
 *
 * let client = new CrossTabClient(…)
 *
 * render(
 *  <ClientContext.Provider value={client}>
 *    <ChannelErrors NotFound={Page404} AccessDenied={Page403}>
 *      <App />
 *    </ChannelErrors>
 *  </ClientContext.Provider>,
 *  document.body
 * )
 * ```
 */
export const ClientContext: ReactContext<Client>

/**
 * Hook to return Logux client, which you set by `<ClientContext.Provider>`.
 *
 * ```js
 * import { useClient } from '@logux/client/react'
 *
 * import { User } from '../stores/user'
 *
 * export const NewUserForm = () => {
 *   let client = useClient()
 *   let onAdd = data => {
 *     User.create(client, data)
 *   }
 * }
 * ```
 */
export function useClient(): Client

interface ReactErrorHandlers {
  AccessDenied?: ComponentType<{ error: ChannelDeniedError }>
  Error?: ComponentType<{ error: ChannelError }>
  NotFound?: ComponentType<{ error: ChannelNotFoundError | LoguxNotFoundError }>
}

/**
 * Context to pass error handlers from `ChannelErrors`.
 */
export const ErrorsContext: ReactContext<ReactErrorHandlers>

/**
 * Show error message to user on subscription errors in components
 * deep in the tree.
 *
 * ```js
 * import { ChannelErrors } from '@logux/client/react'
 *
 * export const App: FC = () => {
 *   return <>
 *     <SideMenu />
 *     <ChannelErrors
 *       NotFound={NotFoundPage}
 *       AccessDenied={AccessDeniedPage}
 *       Error={ServerErrorPage}
 *     >
 *       <Layout />
 *     </ChannelErrors>
 *   <>
 * }
 * ```
 */
export class ChannelErrors extends Component<
  ReactErrorHandlers & { children?: ReactNode }
> {}

/**
 * Create store by ID, subscribe and get store’s value.
 *
 * ```js
 * import { useSync } from '@logux/client/react'
 *
 * import { User } from '../stores/user'
 *
 * export const UserPage: FC = ({ id }) => {
 *   let user = useSync(User, id)
 *   if (user.isLoading) {
 *     return <Loader />
 *   } else {
 *     return <h1>{user.name}</h1>
 *   }
 * }
 * ```
 *
 * @param Template Store builder.
 * @param id Store ID.
 * @param args Other store arguments.
 * @returns Store value.
 */
export function useSync<Value extends SyncMapValues>(
  Template: SyncMapTemplateLike<Value>,
  id: string
): SyncMapValue<Value>
export function useSync<Value extends object, Args extends any[]>(
  Template: SyncMapTemplateLike<Value, Args>,
  id: string,
  ...args: Args
): Value

/**
 * The way to {@link createFilter} in React.
 *
 * ```js
 * import { useFilter } from '@logux/client/react'
 *
 * import { User } from '../stores/user'
 *
 * export const Users = ({ projectId }) => {
 *   let users = useFilter(User, { projectId })
 *   return <div>
 *     {users.list.map(user => <User user={user} />)}
 *     {users.isLoading && <Loader />}
 *   </div>
 * }
 * ```
 *
 * @param Template Store template.
 * @param filter Key-value filter for stores.
 * @param opts Filter options.
 * @returns Filter store to use with map.
 */
export function useFilter<Value extends SyncMapValues>(
  Template: SyncMapTemplateLike<Value>,
  filter?: Filter<Value>,
  opts?: FilterOptions
): StoreValue<FilterStore<Value>>

/**
 * Hook to return user's current authentication state and ID.
 *
 * ```js
 * import { useAuth } from '@logux/client/react'
 *
 * export const UserPage = () => {
 *   let { isAuthenticated, userId } = useAuth()
 *   if (isAuthenticated) {
 *     return <User id={userId} />
 *   } else {
 *     return <Loader />
 *   }
 * }
 * ```
 */
export function useAuth(): StoreValue<AuthStore>
