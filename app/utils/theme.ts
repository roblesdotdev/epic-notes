import { useRouteLoaderData } from '@remix-run/react'
import { type loader as rootLoader } from '~/root.tsx'

export function useTheme() {
  const data = useRouteLoaderData<typeof rootLoader>('root')
  return data?.theme ?? ''
}
