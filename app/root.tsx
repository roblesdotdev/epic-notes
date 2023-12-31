import { cssBundleHref } from '@remix-run/css-bundle'
import { json } from '@remix-run/node'
import type {
  MetaFunction,
  LinksFunction,
  DataFunctionArgs,
  LoaderFunctionArgs,
} from '@remix-run/node'
import {
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
  useMatches,
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
import { useEffect } from 'react'
import { Spacer } from './components/spacer.tsx'
import { Button } from './components/ui/button.tsx'
import { db } from './utils/db.server.ts'
import { useOptionalUser } from './utils/user.ts'
import { getUserId } from './utils/auth.server.ts'
import { userHasRole } from './utils/permissions.ts'
import { SearchBar } from './components/search-bar.tsx'

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
  const userId = await getUserId(request)
  const user = userId
    ? await db.user.findUniqueOrThrow({
        select: {
          id: true,
          name: true,
          username: true,
          image: { select: { id: true } },
          roles: {
            select: {
              name: true,
              permissions: {
                select: { entity: true, action: true, access: true },
              },
            },
          },
        },
        where: { id: userId },
      })
    : null

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
}: {
  children: React.ReactNode
  theme?: Theme
  env?: Record<string, string>
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
  const userIsAdmin = userHasRole(user, 'admin')
  const matches = useMatches()
  const isOnSearchPage = matches.find(m => m.id === 'routes/users+/_index')

  return (
    <Document theme={theme} env={data.ENV}>
      <header className="container mx-auto py-6">
        <nav className="flex items-center justify-between gap-4 sm:gap-6">
          <Link to="/">
            <div className="font-light">epic</div>
            <div className="font-bold">notes</div>
          </Link>
          {isOnSearchPage ? null : (
            <div className="ml-auto hidden max-w-sm flex-1 sm:block">
              <SearchBar status="idle" />
            </div>
          )}
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
                {userIsAdmin ? (
                  <Button asChild variant="secondary">
                    <Link to="/admin">
                      <span className="hidden sm:block">Admin</span>
                    </Link>
                  </Button>
                ) : null}
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

      <div className="container mx-auto mt-32 flex justify-between">
        <Link to="/" className="hidden xs:block">
          <div className="font-light">epic</div>
          <div className="font-bold">notes</div>
        </Link>
        <div className="flex items-center gap-2">
          <p>
            Built with ♥️ by{' '}
            <a
              href="https://github.com/roblesdotdev"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              roblesdotdev
            </a>
          </p>
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

export function ErrorBoundary() {
  return (
    <Document>
      <div className="flex-1">
        <GeneralErrorBoundary />
      </div>
    </Document>
  )
}
