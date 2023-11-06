import { redirect, type DataFunctionArgs } from '@remix-run/node'
import {
  authenticator,
  getSessionExpirationDate,
  getUserId,
} from '~/utils/auth.server.ts'
import { providerLabels } from '~/utils/connections.tsx'
import { db } from '~/utils/db.server.ts'
import { createToastHeaders, redirectWithToast } from '~/utils/toast.server.ts'
import { handleNewSession } from './login.tsx'
import { verifySessionStorage } from '~/utils/verification.server.ts'
import {
  onboardingEmailSessionKey,
  prefilledProfileKey,
  providerIdKey,
} from './onboarding_.$provider.tsx'

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
    return makeSession({ request, userId: existingConnection.userId })
  }

  // if the email matches a user in the db, then link the account and
  // make a new session
  const user = await db.user.findUnique({
    select: { id: true },
    where: { email: profile.email.toLowerCase() },
  })
  if (user) {
    await db.connection.create({
      data: { providerName, providerId: profile.id, userId: user.id },
    })
    return makeSession(
      {
        request,
        userId: user.id,
        // send them to the connections page to see their new connection
        redirectTo: '/settings/profile/connections',
      },
      {
        headers: await createToastHeaders({
          title: 'Connected',
          description: `Your "${profile.username}" ${label} account has been connected.`,
        }),
      },
    )
  }

  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  verifySession.set(onboardingEmailSessionKey, profile.email)
  verifySession.set(prefilledProfileKey, {
    ...profile,
    username: profile.username
      ?.replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase()
      .slice(0, 20)
      .padEnd(3, '_'),
  })
  verifySession.set(providerIdKey, profile.id)
  return redirect(`/onboarding/${providerName}`, {
    headers: {
      'set-cookie': await verifySessionStorage.commitSession(verifySession),
    },
  })
}

async function makeSession(
  {
    request,
    userId,
    redirectTo,
  }: { request: Request; userId: string; redirectTo?: string | null },
  responseInit?: ResponseInit,
) {
  redirectTo ??= '/'
  const session = await db.session.create({
    select: { id: true, expirationDate: true, userId: true },
    data: {
      expirationDate: getSessionExpirationDate(),
      userId,
    },
  })
  return handleNewSession(
    { request, session, redirectTo, remember: true },
    responseInit,
  )
}
