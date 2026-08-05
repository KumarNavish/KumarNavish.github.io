import { useEffect, useState } from 'react'

export interface ResourceState<T> {
  loading: boolean
  data: T | null
  error: string | null
}

export function useResource<T>(loader: () => Promise<T>): ResourceState<T> {
  const [state, setState] = useState<ResourceState<T>>({
    loading: true,
    data: null,
    error: null,
  })

  useEffect(() => {
    let active = true

    loader()
      .then((data) => {
        if (!active) {
          return
        }
        setState({
          loading: false,
          data,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (!active) {
          return
        }
        const message =
          error instanceof Error ? error.message : 'unexpected data loading error'
        setState({
          loading: false,
          data: null,
          error: message,
        })
      })

    return () => {
      active = false
    }
  }, [loader])

  return state
}
