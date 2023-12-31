import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { ErrorList } from '~/components/forms.tsx'
import { SearchBar } from '~/components/search-bar.tsx'
import UserCard from '~/components/user-card.tsx'
import { db } from '~/utils/db.server.ts'
import { cn, useDelayedIsPending } from '~/utils/misc.tsx'

const UserSearchResultSchema = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().nullable(),
  imageId: z.string().nullable(),
})

const UserSearchResultsSchema = z.array(UserSearchResultSchema)

export async function loader({ request }: DataFunctionArgs) {
  const searchTerm = new URL(request.url).searchParams.get('search')
  if (searchTerm === '') {
    return redirect('/users')
  }

  const like = `%${searchTerm ?? ''}%`
  const rawUsers = await db.$queryRaw`
    SELECT User.id, User.username, User.name, UserImage.id AS imageId
    FROM User
    LEFT JOIN UserImage ON UserImage.userId = User.id
		WHERE User.username LIKE ${like}
		OR User.name LIKE ${like}
    ORDER BY (
			SELECT Note.updatedAt
			FROM Note
			WHERE Note.ownerId = user.id
			ORDER BY Note.updatedAt DESC
			LIMIT 1
		) DESC
    LIMIT 50
  `
  const result = UserSearchResultsSchema.safeParse(rawUsers)
  if (!result.success) {
    return json({ status: 'error', error: result.error.message } as const, {
      status: 400,
    })
  }

  return json({
    status: 'idle',
    users: result.data,
  } as const)
}

export default function UsersRoute() {
  const data = useLoaderData<typeof loader>()
  const isPending = useDelayedIsPending({
    formMethod: 'GET',
    formAction: '/users',
  })

  return (
    <div className="container mb-24 mt-12 flex flex-col items-center justify-center gap-6">
      <h1 className="text-h1">Epic Notes Users</h1>
      <div className="w-full max-w-[700px] ">
        <SearchBar status={data.status} autoFocus autoSubmit />
      </div>
      <main className="mt-8">
        {data.status === 'idle' ? (
          data.users.length ? (
            <ul
              className={cn(
                'flex w-full flex-wrap items-center justify-center gap-4 delay-200',
                { 'opacity-50': isPending },
              )}
            >
              {data.users.map(user => (
                <UserCard key={user.id} user={user} />
              ))}
            </ul>
          ) : (
            <p>No users found</p>
          )
        ) : data.status === 'error' ? (
          <ErrorList errors={['There was an error parsing the results']} />
        ) : null}
      </main>
    </div>
  )
}

export function ErrorBoundary() {
  return <GeneralErrorBoundary />
}
