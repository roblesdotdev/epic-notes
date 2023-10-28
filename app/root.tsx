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
} from '@remix-run/react'
import iconAssetUrl from './assets/favicon.svg'
import fontStyles from './styles/fonts.css'
import tailwindStyles from './styles/tailwind.css'
import { getEnv } from './utils/env.server.ts'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { honeypot } from './utils/honeypot.server.ts'
import { csrf } from './utils/csrf.secret.ts'
import { z } from 'zod'
import { useForm } from '@conform-to/react'
import { getTheme, setTheme, type Theme } from './utils/theme.server.ts'
import { parse } from '@conform-to/zod'
import { ErrorList } from './components/forms.tsx'
import SunIcon from './components/ui/icons/sun-icon.tsx'
import MoonIcon from './components/ui/icons/moon-icon.tsx'
import { invariantResponse } from './utils/misc.tsx'

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
  return json(
    { theme: getTheme(request), ENV: getEnv(), honeyProps, csrfToken },
    {
      headers: csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : {},
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
}: {
  children: React.ReactNode
  theme?: Theme
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
  return (
    <Document theme={theme}>
      <header className="container mx-auto py-6">
        <nav className="flex justify-between">
          <Link to="/">
            <div className="font-light">epic</div>
            <div className="font-bold">notes</div>
          </Link>
          <Link className="underline" to="/signup">
            Signup
          </Link>
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
        <p>Built with ♥️ by robledotdev</p>
        <ThemeSwitch userPreference={theme} />
      </div>
      <div className="h-5" />
      <ScrollRestoration />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.ENV = ${JSON.stringify(data.ENV)}`,
        }}
      />
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
    fetcher => fetcher.formData?.get('intent') === 'update-theme',
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

export function ErrorBoundary() {
  return (
    <Document>
      <div className="flex-1">
        <GeneralErrorBoundary />
      </div>
    </Document>
  )
}
