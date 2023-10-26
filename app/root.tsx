import { cssBundleHref } from '@remix-run/css-bundle'
import { json } from '@remix-run/node'
import type { MetaFunction, LinksFunction } from '@remix-run/node'
import {
  Link,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
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

export const links: LinksFunction = () => [
  { rel: 'icon', type: 'image+svg', href: iconAssetUrl },
  { rel: 'stylesheet', href: fontStyles },
  { rel: 'stylesheet', href: tailwindStyles },
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
]

export async function loader() {
  const honeyProps = honeypot.getInputProps()
  const [csrfToken, csrfCookieHeader] = await csrf.commitToken()
  return json(
    { ENV: getEnv(), honeyProps, csrfToken },
    {
      headers: csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : {},
    },
  )
}

export const meta: MetaFunction = () => {
  return [
    { title: 'Epic Notes' },
    { name: 'description', content: "Your own captain's log" },
  ]
}

function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full overflow-x-hidden">
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
  return (
    <Document>
      <header className="container mx-auto py-6">
        <nav className="flex justify-between">
          <Link to="/">
            <div className="font-light">epic</div>
            <div className="font-bold">notes</div>
          </Link>
          {/* 
          <Link className="underline" to="users/kody/notes/d27a197e">
            Kody's Notes
          </Link>
          */}
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

export function ErrorBoundary() {
  return (
    <Document>
      <div className="flex-1">
        <GeneralErrorBoundary />
      </div>
    </Document>
  )
}
