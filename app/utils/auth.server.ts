import bcrypt from 'bcryptjs'
import { db } from './db.server.ts'
import type { Password, User } from '@prisma/client'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { redirect } from '@remix-run/node'
import { combineResponseInits } from './misc.tsx'
import { sessionStorage } from './session.server.ts'

export { bcrypt }

const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export const getSessionExpirationDate = () =>
  new Date(Date.now() + SESSION_EXPIRATION_TIME)

export const sessionKey = 'sessionId'

export async function getUserId(request: Request) {
  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const sessionId = cookieSession.get(sessionKey)
  if (!sessionId) return null
  const session = await db.session.findUnique({
    select: { user: { select: { id: true } } },
    where: { id: sessionId, expirationDate: { gt: new Date() } },
  })
  if (!session?.user) {
    throw await logout({ request })
  }
  return session.user.id
}

export async function login({
  username,
  password,
}: {
  username: User['username']
  password: string
}) {
  const user = await verifyUserPassword({ username }, password)
  if (!user) return null
  const session = await db.session.create({
    select: { id: true, expirationDate: true },
    data: {
      expirationDate: getSessionExpirationDate(),
      userId: user.id,
    },
  })
  return session
}

export async function signup({
  email,
  username,
  password,
  name,
}: {
  email: User['email']
  username: User['username']
  name: User['name']
  password: string
}) {
  const hashedPassword = await getPasswordHash(password)

  const session = await db.session.create({
    select: { id: true, expirationDate: true },
    data: {
      expirationDate: getSessionExpirationDate(),
      user: {
        create: {
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          name,
          password: {
            create: {
              hash: hashedPassword,
            },
          },
        },
      },
    },
  })

  return session
}

export async function logout(
  {
    request,
    redirectTo = '/',
  }: {
    request: Request
    redirectTo?: string
  },
  responseInit?: ResponseInit,
) {
  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const sessionId = cookieSession.get(sessionKey)
  // delete the session if it exists, but don't wait for it, go ahead an log the user out
  if (sessionId)
    void (await db.session.deleteMany({ where: { id: sessionId } }))
  throw redirect(
    safeRedirect(redirectTo),
    combineResponseInits(responseInit, {
      headers: {
        'set-cookie': await sessionStorage.destroySession(cookieSession),
      },
    }),
  )
}

export async function getPasswordHash(password: string) {
  const hash = await bcrypt.hash(password, 10)
  return hash
}

export async function verifyUserPassword(
  where: Pick<User, 'username'> | Pick<User, 'id'>,
  password: Password['hash'],
) {
  const userWithPassword = await db.user.findUnique({
    where,
    select: { id: true, password: { select: { hash: true } } },
  })

  if (!userWithPassword || !userWithPassword.password) {
    return null
  }

  const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

  if (!isValid) {
    return null
  }

  return { id: userWithPassword.id }
}

export async function requireAnonymous(request: Request) {
  const userId = await getUserId(request)
  if (userId) {
    throw redirect('/')
  }
}

export async function requireUserId(
  request: Request,
  { redirectTo }: { redirectTo?: string | null } = {},
) {
  const userId = await getUserId(request)
  if (!userId) {
    const requestUrl = new URL(request.url)
    redirectTo =
      redirectTo === null
        ? null
        : redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
    const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
    const loginRedirect = ['/login', loginParams?.toString()]
      .filter(Boolean)
      .join('?')
    throw redirect(loginRedirect)
  }
  return userId
}

export async function requireUser(request: Request) {
  const userId = await requireUserId(request)
  const user = await db.user.findUnique({
    select: { id: true, username: true },
    where: { id: userId },
  })
  if (!user) {
    throw await logout({ request })
  }
  return user
}

export async function resetUserPassword({
  username,
  password,
}: {
  username: User['username']
  password: string
}) {
  const hashedPassword = await bcrypt.hash(password, 10)
  return db.user.update({
    where: { username },
    data: {
      password: {
        update: {
          hash: hashedPassword,
        },
      },
    },
  })
}
