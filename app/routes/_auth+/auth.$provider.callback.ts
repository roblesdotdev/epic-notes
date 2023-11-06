import type { DataFunctionArgs } from '@remix-run/node'
import {
  authenticator,
  getSessionExpirationDate,
  getUserId,
} from '~/utils/auth.server.ts'
import { providerLabels } from '~/utils/connections.tsx'
import { db } from '~/utils/db.server.ts'
import { redirectWithToast } from '~/utils/toast.server.ts'
import { handleNewSession } from './login.tsx'

export async function loader({ request }: DataFunctionArgs) {
  const providerName = 'github'

  const label = providerLabels[providerName]

  const profile = await authenticator
    .authenticate(providerName, request, { throwOnError: true })
    .catch(async error => {
      console.error(error)
      throw await redirectWithToast('/login', {
        type: 'error',
        title: 'Auth Failed',
        description: `There was an error authenticating with ${label}.`,
      })
    })

  const existingConnection = await db.connection.findUnique({
    select: { userId: true },
    where: {
      providerName_providerId: { providerName, providerId: profile.id },
    },
  })

  const userId = await getUserId(request)

  if (existingConnection && userId) {
    throw await redirectWithToast('/settings/profile/connections', {
      title: 'Already Connected',
      description:
        existingConnection.userId === userId
          ? `Your "${profile.username}" ${label} account is already connected.`
          : `The "${profile.username}" ${label} account is already connected to another account.`,
    })
  }

  if (existingConnection) {
    const session = await db.session.create({
      select: { id: true, expirationDate: true, userId: true },
      data: {
        expirationDate: getSessionExpirationDate(),
        userId: existingConnection.userId,
      },
    })
    return handleNewSession({ request, session, remember: true })
  }

  throw await redirectWithToast('/login', {
    title: 'Auth Success (jk)',
    description: `You have successfully authenticated with GitHub (not really though...).`,
    type: 'success',
  })
}
