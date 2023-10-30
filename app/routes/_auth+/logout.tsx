import type { ActionFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { sessionStorage } from '~/utils/session.server.ts'

export async function loader() {
  return redirect('/')
}

export async function action({ request }: ActionFunctionArgs) {
  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  return redirect('/', {
    headers: {
      'set-cookie': await sessionStorage.destroySession(cookieSession),
    },
  })
}
