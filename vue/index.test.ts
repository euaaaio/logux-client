import '@testing-library/jest-dom/extend-expect'
import { cleanStores, atom, mapTemplate, MapTemplate } from 'nanostores'
import Vue, { Component, isReadonly } from 'vue'
import { LoguxNotFoundError } from '@logux/actions'
import VueTesting from '@testing-library/vue'
import { delay } from 'nanodelay'
import { jest } from '@jest/globals'

import {
  changeSyncMapById,
  SyncMapTemplate,
  syncMapTemplate,
  LoguxUndoError,
  createSyncMap,
  TestClient
} from '../index.js'
import {
  ChannelErrorsSlotProps,
  ChannelErrors,
  loguxPlugin,
  useClient,
  useFilter,
  useSync,
  useAuth
} from './index.js'

let { render, screen } = VueTesting
let { onErrorCaptured, defineComponent, nextTick, ref, h } = Vue

function getCatcher(cb: () => void): [string[], Component] {
  let errors: string[] = []
  let Catcher = defineComponent(() => {
    try {
      cb()
    } catch (e) {
      if (e instanceof Error) errors.push(e.message)
    }
    return () => null
  })
  return [errors, Catcher]
}

function renderWithClient(component: Component, client?: TestClient): void {
  client = client || new TestClient('10')
  render(component, {
    global: {
      plugins: [[loguxPlugin, client]]
    }
  })
}

async function getText(component: Component): Promise<string | null> {
  let client = new TestClient('10')
  render(
    defineComponent(
      () => () => h('div', { 'data-testid': 'test' }, h(component))
    ),
    {
      global: {
        plugins: [[loguxPlugin, client]]
      }
    }
  )
  await nextTick()
  return screen.getByTestId('test').textContent
}

let defineIdTest = (Template: SyncMapTemplate | MapTemplate): Component => {
  return defineComponent(() => {
    let store = useSync(Template, 'ID')
    return () => {
      return h('div', store.value.isLoading ? 'loading' : store.value.id)
    }
  })
}

let defineSyncTest = (Template: SyncMapTemplate): Component => {
  return defineComponent(() => {
    let store = useSync(Template, 'ID')
    return () => h('div', store.value.isLoading ? 'loading' : store.value.id)
  })
}

let ErrorCatcher = defineComponent((props, { slots }) => {
  let message = ref<null | {}>(null)
  onErrorCaptured(e => {
    // @ts-ignore
    message.value = e.message
    return false
  })
  return () => (message.value ? h('div', message.value) : slots.default?.())
})

async function catchLoadingError(
  error: string | Error
): Promise<string | null> {
  let IdTest = defineIdTest(BrokenStore)

  renderWithClient(
    defineComponent(
      () => () =>
        h(
          'div',
          { 'data-testid': 'test' },
          h(ErrorCatcher, null, {
            default: () =>
              h(ChannelErrors, null, {
                default: () =>
                  h(ChannelErrors, null, {
                    default: () =>
                      h(ChannelErrors, null, {
                        default: ({
                          error: e,
                          code
                        }: ChannelErrorsSlotProps) => {
                          if (!e.value && !code.value) {
                            return h(IdTest)
                          } else {
                            return h(
                              'div',
                              `${code.value} ${e.value?.data.name}`
                            )
                          }
                        }
                      })
                  })
              })
          })
        )
    )
  )
  await nextTick()
  expect(screen.getByTestId('test')).toHaveTextContent('loading')

  BrokenStore('ID').reject(error)
  await delay(10)
  await nextTick()
  return screen.getByTestId('test').textContent
}

let LocalPostStore = syncMapTemplate<{ projectId: string; title: string }>(
  'local',
  {
    offline: true,
    remote: false
  }
)

let RemotePostStore = syncMapTemplate<{ title?: string }>('posts')

let BrokenStore = mapTemplate<
  { isLoading: boolean },
  [],
  { loading: Promise<void>; reject(e: Error | string): void }
>(store => {
  store.setKey('isLoading', true)
  store.loading = new Promise<void>((resolve, reject) => {
    store.reject = e => {
      if (typeof e === 'string') {
        reject(
          new LoguxUndoError({
            type: 'logux/undo',
            reason: e,
            id: '',
            action: {
              type: 'logux/subscribe',
              channel: 'A'
            }
          })
        )
      } else {
        reject(e)
      }
    }
  })
})

afterEach(() => {
  cleanStores(BrokenStore, LocalPostStore, RemotePostStore)
})

it('throws on missed logux client dependency', () => {
  let spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let Test = syncMapTemplate<{ name: string }>('test')
  let [errors, Catcher] = getCatcher(() => {
    useSync(Test, 'ID')
  })
  render(
    h(ChannelErrors, null, {
      default: () => h(Catcher)
    })
  )
  expect(errors).toEqual([
    `Install Logux Client using loguxPlugin: app.use(loguxPlugin, client).`
  ])
  spy.mockRestore()
})

it('throws on missed logux client dependency for useClient', () => {
  let spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let [errors, Catcher] = getCatcher(() => {
    useClient()
  })
  render(
    h(ChannelErrors, null, {
      default: () => h(Catcher)
    })
  )
  expect(errors).toEqual([
    `Install Logux Client using loguxPlugin: app.use(loguxPlugin, client).`
  ])
  spy.mockRestore()
})

it('throws on missed ID for builder', () => {
  let spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let store = atom<undefined>()
  let [errors, Catcher] = getCatcher(() => {
    // @ts-expect-error
    useSync(store)
  })
  render(h(Catcher))
  expect(errors).toEqual(['Use useStore() from @nanostores/vue for stores'])
  spy.mockRestore()
})

it('throws store init errors', () => {
  let spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let Template = mapTemplate(() => {
    throw new Error('Test')
  })
  let [errors, Catcher] = getCatcher(() => {
    useSync(Template, 'id')
  })
  renderWithClient(
    h(ChannelErrors, null, {
      default: () => h(Catcher)
    })
  )
  expect(errors).toEqual(['Test'])
  spy.mockRestore()
})

it('throws and catches not found error', async () => {
  expect(await catchLoadingError(new LoguxNotFoundError())).toBe(
    '404 LoguxNotFoundError'
  )
})

it('throws and catches not found error from server', async () => {
  expect(await catchLoadingError('notFound')).toBe('404 LoguxUndoError')
})

it('throws and catches access denied error', async () => {
  expect(await catchLoadingError('denied')).toBe('403 LoguxUndoError')
})

it('throws and catches access server error during loading', async () => {
  expect(await catchLoadingError('error')).toBe('500 LoguxUndoError')
})

it('ignores unknown error', async () => {
  expect(await catchLoadingError(new Error('Test Error'))).toBe('Test Error')
})

it('throws an error on missed ChannelErrors', async () => {
  let spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  let SyncTest = defineSyncTest(RemotePostStore)
  expect(
    await getText(
      defineComponent(
        () => () =>
          h(ErrorCatcher, null, {
            default: () => h(SyncTest)
          })
      )
    )
  ).toBe('Wrap components in Logux <channel-errors v-slot="{ code, error }">')
  spy.mockRestore()
})

it('has composable to get client', async () => {
  expect(
    await getText(
      defineComponent(() => {
        let client = useClient()
        return () => h('div', client.options.userId)
      })
    )
  ).toBe('10')
})

it('recreates state on id changes', async () => {
  let client = new TestClient('10')
  let Test = defineComponent(() => {
    let id = ref('1')
    let state = useSync(RemotePostStore, id)
    return () =>
      h(
        'div',
        {
          'data-testid': 'test',
          'onClick': () => {
            id.value = '2'
          }
        },
        state.value.isLoading ? 'loading' : state.value.id
      )
  })

  renderWithClient(
    defineComponent(
      () => () =>
        h(ChannelErrors, null, {
          default: () => h(Test)
        })
    ),
    client
  )
  expect(screen.getByTestId('test').textContent).toBe('loading')

  await client.connect()
  await createSyncMap(client, RemotePostStore, { id: '1' })
  await createSyncMap(client, RemotePostStore, { id: '2' })
  expect(screen.getByTestId('test').textContent).toBe('1')

  screen.getByTestId('test').click()
  await nextTick()
  expect(screen.getByTestId('test').textContent).toBe('loading')
  await delay(10)
  expect(screen.getByTestId('test').textContent).toBe('2')
})

it('composables return readonly', () => {
  renderWithClient(
    defineComponent(
      () => () =>
        h(ChannelErrors, null, {
          default: () =>
            h(
              defineComponent(() => {
                let state = useSync(RemotePostStore, 'ID')
                let list = useFilter(RemotePostStore)
                expect(isReadonly(state)).toBe(true)
                expect(isReadonly(list)).toBe(true)
                return () => null
              })
            )
        })
    )
  )
})

it('renders filter', async () => {
  let client = new TestClient('10')
  let renders: string[] = []
  let TestList = defineComponent(() => {
    let posts = useFilter(LocalPostStore, { projectId: '1' })
    expect(posts.value.stores.size).toEqual(posts.value.list.length)
    return () => {
      renders.push('list')
      return h(
        'ul',
        { 'data-testid': 'test' },
        posts.value.list.map((post, index) => {
          renders.push(post.id)
          return h('li', ` ${index}:${post.title}`)
        })
      )
    }
  })

  renderWithClient(
    defineComponent(
      () => () =>
        h(ChannelErrors, null, {
          default: () => h(TestList)
        })
    ),
    client
  )
  expect(screen.getByTestId('test').textContent).toBe('')
  expect(renders).toEqual(['list'])

  await Promise.all([
    createSyncMap(client, LocalPostStore, {
      id: '1',
      projectId: '1',
      title: 'Y'
    }),
    createSyncMap(client, LocalPostStore, {
      id: '2',
      projectId: '2',
      title: 'Y'
    }),
    createSyncMap(client, LocalPostStore, {
      id: '3',
      projectId: '1',
      title: 'A'
    })
  ])
  await nextTick()
  expect(screen.getByTestId('test').textContent).toBe(' 0:Y 1:A')
  expect(renders).toEqual(['list', 'list', '1', '3'])

  await changeSyncMapById(client, LocalPostStore, '3', 'title', 'B')
  await nextTick()
  expect(screen.getByTestId('test').textContent).toBe(' 0:Y 1:B')
  expect(renders).toEqual(['list', 'list', '1', '3', 'list', '1', '3'])

  await changeSyncMapById(client, LocalPostStore, '3', 'title', 'Z')
  await nextTick()
  expect(screen.getByTestId('test').textContent).toBe(' 0:Y 1:Z')
  expect(renders).toEqual([
    'list',
    'list',
    '1',
    '3',
    'list',
    '1',
    '3',
    'list',
    '1',
    '3'
  ])
})

it('recreates filter on args changes', async () => {
  let client = new TestClient('10')
  let renders: string[] = []
  let TestList = defineComponent(() => {
    let filter = ref({ projectId: '1' })
    let posts = useFilter(LocalPostStore, filter)
    return () => {
      renders.push('list')
      return h('div', {}, [
        h('button', {
          'data-testid': 'change',
          'onClick': () => {
            filter.value.projectId = filter.value.projectId === '2' ? '1' : '2'
          }
        }),
        h(
          'ul',
          { 'data-testid': 'test' },
          posts.value.list.map((post, index) => {
            renders.push(post.id)
            return h('li', ` ${index}:${post.title}`)
          })
        )
      ])
    }
  })

  renderWithClient(
    defineComponent(
      () => () =>
        h(ChannelErrors, null, {
          default: () => h(TestList)
        })
    ),
    client
  )
  expect(screen.getByTestId('test').textContent).toBe('')
  expect(renders).toEqual(['list'])

  await Promise.all([
    createSyncMap(client, LocalPostStore, {
      id: '1',
      projectId: '1',
      title: 'Y'
    }),
    createSyncMap(client, LocalPostStore, {
      id: '2',
      projectId: '2',
      title: 'Y'
    }),
    createSyncMap(client, LocalPostStore, {
      id: '3',
      projectId: '1',
      title: 'A'
    })
  ])
  expect(screen.getByTestId('test').textContent).toBe(' 0:Y 1:A')
  expect(renders).toEqual(['list', 'list', '1', '3'])

  screen.getByTestId('change').click()
  await nextTick()
  await Promise.all([
    createSyncMap(client, LocalPostStore, {
      id: '1',
      projectId: '1',
      title: 'Y'
    }),
    createSyncMap(client, LocalPostStore, {
      id: '2',
      projectId: '2',
      title: 'Y'
    }),
    createSyncMap(client, LocalPostStore, {
      id: '3',
      projectId: '1',
      title: 'A'
    })
  ])
  expect(screen.getByTestId('test').textContent).toBe(' 0:Y')
  expect(renders).toEqual([
    'list',
    'list',
    '1',
    '3',
    'list',
    'list',
    'list',
    '2'
  ])

  screen.getByTestId('change').click()
  await nextTick()
  expect(screen.getByTestId('test').textContent).toBe(' 0:Y 1:A')
})

it('renders authentication state', async () => {
  let client = new TestClient('10')
  renderWithClient(
    defineComponent(() => {
      let { isAuthenticated, userId } = useAuth()
      return () =>
        h(
          'div',
          {
            'data-testid': 'test'
          },
          isAuthenticated.value ? userId.value : 'loading'
        )
    }),
    client
  )
  expect(screen.getByTestId('test').textContent).toBe('loading')

  await client.connect()
  expect(screen.getByTestId('test').textContent).toBe('10')

  client.disconnect()
  await nextTick()
  expect(screen.getByTestId('test').textContent).toBe('10')

  client.changeUser('20', 'token')
  await delay(1)
  await client.connect()
  expect(screen.getByTestId('test').textContent).toBe('20')

  client.pair.right.send(['error', 'wrong-credentials'])
  client.pair.right.disconnect()
  await client.pair.wait()
  await delay(1)
  expect(screen.getByTestId('test').textContent).toBe('loading')
})
