import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, NavLink, Outlet, useLoaderData } from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { db } from '~/utils/db.server.ts'
import { cn, invariantResponse } from '~/utils/misc.ts'

export async function loader({ params }: LoaderFunctionArgs) {
  const username = params.username
  const owner = await db.user.findFirst({
    where: { username },
    select: {
      name: true,
      username: true,
      image: { select: { id: true } },
      notes: { select: { id: true, title: true } },
    },
  })
  invariantResponse(owner, 'Invalid username', { status: 404 })
  return json({
    owner,
  })
}

export default function NotesRoute() {
  const data = useLoaderData<typeof loader>()

  const ownerDisplayName = data.owner.name ?? data.owner.username
  const navLinkDefaultClassName =
    'line-clamp-2 block rounded-l-full py-2 pl-8 pr-6 text-base lg:text-xl'
  return (
    <main className="container flex h-full min-h-[400px] px-0 pb-12 md:px-8">
      <div className="grid w-full grid-cols-4 bg-muted pl-2 md:container md:mx-2 md:rounded-3xl md:pr-0">
        <div className="relative col-span-1">
          <div className="absolute inset-0 flex flex-col">
            <Link
              to={`/users/${data.owner.username}`}
              className="pb-4 pl-8 pr-4 pt-12"
            >
              <h1 className="text-base font-bold md:text-lg lg:text-left lg:text-2xl">
                {ownerDisplayName}'s Notes
              </h1>
            </Link>
            <ul className="overflow-y-auto overflow-x-hidden pb-12">
              {data.owner.notes.map(note => (
                <li className="p-1 pr-0" key={note.id}>
                  <NavLink
                    to={note.id}
                    preventScrollReset
                    prefetch="intent"
                    className={({ isActive }) =>
                      cn(navLinkDefaultClassName, isActive && 'bg-accent')
                    }
                  >
                    {note.title}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="relative col-span-3 bg-accent md:rounded-r-3xl">
          <Outlet />
        </div>
      </div>
    </main>
  )
}

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        404: ({ params }) => (
          <p>No user with the username "{params.username}" exists</p>
        ),
      }}
    />
  )
}
