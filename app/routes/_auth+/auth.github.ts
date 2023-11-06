import type { DataFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { createId as cuid } from '@paralleldrive/cuid2'
import { authenticator } from '~/utils/auth.server.ts'
import { connectionSessionStorage } from '~/utils/connection.server.ts'

export async function loader() {
  return redirect('/login')
}

export async function action({ request }: DataFunctionArgs) {
  const providerName = 'github'

  if (process.env.GITHUB_CLIENT_ID?.startsWith('MOCK_')) {
    const connectionSession = await connectionSessionStorage.getSession(
      request.headers.get('cookie'),
    )
    const state = cuid()
    connectionSession.set('oauth2:state', state)
    const code = 'MOCK_GITHUB_CODE_KODY'
    const searchParams = new URLSearchParams({ code, state })
    throw redirect(`/auth/github/callback?${searchParams}`, {
      headers: {
        'set-cookie':
          await connectionSessionStorage.commitSession(connectionSession),
      },
    })
  }

  return await authenticator.authenticate(providerName, request)
}
