import type { DataFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server.ts'
import { handleMockAction } from '~/utils/connection.server.ts'
import { ProviderNameSchema } from '~/utils/connections.tsx'
import { getReferrerRoute } from '~/utils/misc.tsx'
import { getRedirectCookieHeader } from '~/utils/redirect-cookie.server.ts'

export async function loader() {
  return redirect('/login')
}

export async function action({ request, params }: DataFunctionArgs) {
  const providerName = ProviderNameSchema.parse(params.provider)

  try {
    await handleMockAction(providerName, request)
    return await authenticator.authenticate(providerName, request)
  } catch (error: unknown) {
    if (error instanceof Response) {
      const formData = await request.formData()
      const rawRedirectTo = formData.get('redirectTo')
      const redirectTo =
        typeof rawRedirectTo === 'string'
          ? rawRedirectTo
          : getReferrerRoute(request)
      const redirectToCookie = getRedirectCookieHeader(redirectTo)
      if (redirectToCookie) {
        error.headers.append('set-cookie', redirectToCookie)
      }
    }
    throw error
  }
}
