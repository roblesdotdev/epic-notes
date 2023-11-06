import type { DataFunctionArgs } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server.ts'
import { redirectWithToast } from '~/utils/toast.server.ts'

export async function loader({ request }: DataFunctionArgs) {
  const providerName = 'github'

  const profile = await authenticator.authenticate(providerName, request, {
    throwOnError: true,
  })

  console.log({ profile })

  throw await redirectWithToast('/login', {
    title: 'Auth Success (jk)',
    description: `You have successfully authenticated with GitHub (not really though...).`,
    type: 'success',
  })
}
