import { cssBundleHref } from '@remix-run/css-bundle'
import { json, redirect } from '@remix-run/node'
import type {
  MetaFunction,
  LinksFunction,
  DataFunctionArgs,
  LoaderFunctionArgs,
} from '@remix-run/node'
import {
  Form,
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetcher,
  useFetchers,
  useLoaderData,
  useLocation,
  useSubmit,
} from '@remix-run/react'
import iconAssetUrl from './assets/favicon.svg'
import fontStyles from './styles/fonts.css'
import tailwindStyles from './styles/tailwind.css'
import { getEnv } from './utils/env.server.ts'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { Toaster, toast as showToast } from 'sonner'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { honeypot } from './utils/honeypot.server.ts'
import { csrf } from './utils/csrf.server.ts'
import { z } from 'zod'
import { useForm } from '@conform-to/react'
import { getTheme, setTheme, type Theme } from './utils/theme.server.ts'
import { parse } from '@conform-to/zod'
import { ErrorList } from './components/forms.tsx'
import SunIcon from './components/ui/icons/sun-icon.tsx'
import MoonIcon from './components/ui/icons/moon-icon.tsx'
import {
  combineHeaders,
  getUserImgSrc,
  invariantResponse,
} from './utils/misc.tsx'
import type { Toast } from './utils/toast.server.ts'
import { getToast } from './utils/toast.server.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Spacer } from './components/spacer.tsx'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './components/ui/alert-dialog.tsx'
import { Button } from './components/ui/button.tsx'
import { db } from './utils/db.server.ts'
import { sessionStorage } from './utils/session.server.ts'
import { useOptionalUser } from './utils/user.ts'

const ThemeFormSchema = z.object({
  theme: z.enum(['light', 'dark']),
})

export const links: LinksFunction = () => [
  { rel: 'icon', type: 'image+svg', href: iconAssetUrl },
  { rel: 'stylesheet', href: fontStyles },
  { rel: 'stylesheet', href: tailwindStyles },
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
]

export async function loader({ request }: LoaderFunctionArgs) {
  const honeyProps = honeypot.getInputProps()
  const [csrfToken, csrfCookieHeader] = await csrf.commitToken()

  const { toast, headers: toastHeaders } = await getToast(request)
  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const userId = cookieSession.get('userId')
  const user = userId
    ? await db.user.findUnique({
        select: {
          id: true,
          name: true,
          username: true,
          image: { select: { id: true } },
        },
        where: { id: userId },
      })
    : null

  if (userId && !user) {
    // something weird happened... The user is authenticated but we can't find
    // them in the database. Maybe they were deleted? Let's log them out.
    throw redirect('/', {
      headers: {
        'set-cookie': await sessionStorage.destroySession(cookieSession),
      },
    })
  }

  return json(
    {
      user,
      theme: getTheme(request),
      toast,
      ENV: getEnv(),
      honeyProps,
      csrfToken,
    },
    {
      headers: combineHeaders(
        csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : null,
        toastHeaders,
      ),
    },
  )
}

export async function action({ request }: DataFunctionArgs) {
  const formData = await request.formData()
  invariantResponse(
    formData.get('intent') === 'update-theme',
    'Invalid intent',
    { status: 400 },
  )
  const submission = parse(formData, {
    schema: ThemeFormSchema,
  })
  if (submission.intent !== 'submit') {
    return json({ status: 'success', submission } as const)
  }
  if (!submission.value) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }

  const { theme } = submission.value

  const responseInit = {
    headers: {
      'set-cookie': setTheme(theme),
    },
  }

  return json({ success: true, submission }, responseInit)
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Epic Notes' },
    { name: 'description', content: "Your own captain's log" },
  ]
}

function Document({
  children,
  theme,
  env,
  isLoggedIn = false,
}: {
  children: React.ReactNode
  theme?: Theme
  env?: Record<string, string>
  isLoggedIn?: boolean
}) {
  return (
    <html lang="en" className={`${theme} h-full overflow-x-hidden`}>
      <head>
        <Meta />
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Links />
      </head>
      <body className="flex h-full flex-col justify-between bg-background text-foreground">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(env)}`,
          }}
        />
        {isLoggedIn ? <LogoutTimer /> : null}
        <Toaster closeButton position="top-center" />
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}

function App() {
  const data = useLoaderData<typeof loader>()
  const theme = useTheme()
  const user = useOptionalUser()

  return (
    <Document isLoggedIn={Boolean(user)} theme={theme} env={data.ENV}>
      <header className="container mx-auto py-6">
        <nav className="flex justify-between">
          <Link to="/">
            <div className="font-light">epic</div>
            <div className="font-bold">notes</div>
          </Link>
          <div className="flex items-center gap-10">
            {user ? (
              <div className="flex items-center gap-2">
                <Button asChild variant="secondary">
                  <Link
                    to={`/users/${user.username}`}
                    className="flex items-center gap-2"
                  >
                    <img
                      className="h-8 w-8 rounded-full object-cover"
                      alt={user.name ?? user.username}
                      src={getUserImgSrc(user.image?.id)}
                    />
                    <span className="hidden text-body-sm font-bold sm:block">
                      {user.name ?? user.username}
                    </span>
                  </Link>
                </Button>
              </div>
            ) : (
              <Button asChild variant="default" size="sm">
                <Link to="/login">Log In</Link>
              </Button>
            )}
          </div>
        </nav>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <div className="container mx-auto flex justify-between">
        <Link to="/">
          <div className="font-light">epic</div>
          <div className="font-bold">notes</div>
        </Link>
        <div className="flex items-center gap-2">
          <p>Built with ♥️ by robledotdev</p>
          <ThemeSwitch userPreference={theme} />
        </div>
      </div>
      <Spacer size="3xs" />
      {data.toast ? <ShowToast toast={data.toast} /> : null}
    </Document>
  )
}

export default function AppWithProviders() {
  const data = useLoaderData<typeof loader>()
  return (
    <AuthenticityTokenProvider token={data.csrfToken}>
      <HoneypotProvider {...data.honeyProps}>
        <App />
      </HoneypotProvider>
    </AuthenticityTokenProvider>
  )
}

function useTheme() {
  const data = useLoaderData<typeof loader>()
  const fetchers = useFetchers()
  const themeFetcher = fetchers.find(
    f => f.formData?.get('intent') === 'update-theme',
  )
  const optimisticTheme = themeFetcher?.formData?.get('theme')
  if (optimisticTheme === 'light' || optimisticTheme === 'dark') {
    return optimisticTheme
  }
  return data.theme
}

function ThemeSwitch({ userPreference }: { userPreference?: Theme }) {
  const fetcher = useFetcher<typeof action>()

  const [form] = useForm({
    id: 'theme-switch',
    lastSubmission: fetcher.data?.submission,
    onValidate({ formData }) {
      return parse(formData, { schema: ThemeFormSchema })
    },
  })

  const mode = userPreference ?? 'dark'
  const nextMode = mode === 'light' ? 'dark' : 'light'
  const modeLabel = {
    light: <SunIcon />,
    dark: <MoonIcon />,
  }

  return (
    <fetcher.Form {...form.props} method="POST">
      <input type="hidden" name="theme" value={nextMode} />
      <div className="flex gap-2">
        <button
          name="intent"
          value="update-theme"
          type="submit"
          className="flex h-8 w-8 cursor-pointer items-center justify-center"
        >
          {modeLabel[mode]}
        </button>
      </div>
      <ErrorList errors={form.errors} id={form.errorId} />
    </fetcher.Form>
  )
}

function ShowToast({ toast }: { toast: Toast }) {
  const { id, type, title, description } = toast
  useEffect(() => {
    setTimeout(() => {
      showToast[type](title, { id, description })
    }, 0)
  }, [description, id, title, type])
  return null
}

function LogoutTimer() {
  const [status, setStatus] = useState<'idle' | 'show-modal'>('idle')
  const location = useLocation()
  const submit = useSubmit()
  const logoutTime = 5000
  const modalTime = 2000
  // 🦉 here's what would be more likely:
  // const logoutTime = 1000 * 60 * 60;
  // const modalTime = logoutTime - 1000 * 60 * 2;
  const modalTimer = useRef<ReturnType<typeof setTimeout>>()
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>()

  const logout = useCallback(() => {
    submit(null, { method: 'POST', action: '/logout' })
  }, [submit])

  const cleanupTimers = useCallback(() => {
    clearTimeout(modalTimer.current)
    clearTimeout(logoutTimer.current)
  }, [])

  const resetTimers = useCallback(() => {
    cleanupTimers()
    modalTimer.current = setTimeout(() => {
      setStatus('show-modal')
    }, modalTime)
    logoutTimer.current = setTimeout(logout, logoutTime)
  }, [cleanupTimers, logout, logoutTime, modalTime])

  useEffect(() => resetTimers(), [resetTimers, location.key])
  useEffect(() => cleanupTimers, [cleanupTimers])

  function closeModal() {
    setStatus('idle')
    resetTimers()
  }

  return (
    <AlertDialog
      aria-label="Pending Logout Notification"
      open={status === 'show-modal'}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you still there?</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription>
          You are going to be logged out due to inactivity. Close this modal to
          stay logged in.
        </AlertDialogDescription>
        <AlertDialogFooter className="flex items-end gap-8">
          <AlertDialogCancel onClick={closeModal}>
            Remain Logged In
          </AlertDialogCancel>
          <Form method="POST" action="/logout">
            <AlertDialogAction type="submit">Logout</AlertDialogAction>
          </Form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ErrorBoundary() {
  return (
    <Document>
      <div className="flex-1">
        <GeneralErrorBoundary />
      </div>
    </Document>
  )
}
