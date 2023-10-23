import { cssBundleHref } from '@remix-run/css-bundle'
import { json, type LinksFunction } from '@remix-run/node'
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

export const links: LinksFunction = () => [
  { rel: 'icon', type: 'image+svg', href: iconAssetUrl },
  { rel: 'stylesheet', href: fontStyles },
  { rel: 'stylesheet', href: tailwindStyles },
  ...(cssBundleHref ? [{ rel: 'stylesheet', href: cssBundleHref }] : []),
]

export async function loader() {
  return json({ ENV: getEnv() })
}

export default function App() {
  const data = useLoaderData<typeof loader>()
  return (
    <html lang="en" className="dark h-full overflow-x-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="flex h-full flex-col justify-between bg-background text-foreground">
        <header className="container mx-auto py-6">
          <nav className="flex justify-between">
            <Link to="/">
              <div className="font-light">epic</div>
              <div className="font-bold">notes</div>
            </Link>
            <Link className="underline" to="users/kody/notes/d27a197e">
              Kody's Notes
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
        <Scripts />
        <LiveReload />
      </body>
    </html>
  )
}
