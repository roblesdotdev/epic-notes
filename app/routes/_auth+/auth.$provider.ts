import type { DataFunctionArgs } from '@remix-run/node'
import { redirect } from '@remix-run/node'
import { authenticator } from '~/utils/auth.server.ts'
import { handleMockAction } from '~/utils/connection.server.ts'
import { ProviderNameSchema } from '~/utils/connections.tsx'

export async function loader() {
  return redirect('/login')
}

export async function action({ request, params }: DataFunctionArgs) {
  const providerName = ProviderNameSchema.parse(params.provider)

  await handleMockAction(providerName, request)

  return await authenticator.authenticate(providerName, request)
}
