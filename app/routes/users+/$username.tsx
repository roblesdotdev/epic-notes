import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { Button } from '~/components/ui/button.tsx'
import { db } from '~/utils/db.server.ts'
import { getUserImgSrc, invariantResponse } from '~/utils/misc.tsx'
import { useOptionalUser } from '~/utils/user.ts'

export async function loader({ params }: LoaderFunctionArgs) {
  const username = params.username
  const user = await db.user.findFirst({
    where: { username },
    select: {
      id: true,
      name: true,
      username: true,
      createdAt: true,
      image: { select: { id: true } },
    },
  })
  invariantResponse(user, 'Invalid username', { status: 404 })

  return json({
    user,
    userJoinedDisplay: user.createdAt.toLocaleDateString(),
  })
}

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
  const displayName = data?.user.name ?? params.username
  return [
    { title: `${displayName} | Epic Notes` },
    { name: 'description', content: `Profile of ${displayName} on Epic Notes` },
  ]
}

export default function KodyProfileRoute() {
  const data = useLoaderData<typeof loader>()
  const user = data.user
  const userDisplayName = user.name ?? user.username
  const loggedInUser = useOptionalUser()
  const isLoggedInUser = data.user.id === loggedInUser?.id

  return (
    <div className="container mb-48 mt-36 flex flex-col items-center justify-center">
      <Spacer size="4xs" />

      <div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
        <div className="relative w-52">
          <div className="absolute -top-40">
            <div className="relative">
              <img
                src={getUserImgSrc(data.user.image?.id)}
                alt={userDisplayName}
                className="h-52 w-52 rounded-full object-cover"
              />
            </div>
          </div>
        </div>

        <Spacer size="sm" />

        <div className="flex flex-col items-center">
          <div className="flex flex-wrap items-center justify-center gap-4">
            <h1 className="text-center text-h2">{userDisplayName}</h1>
          </div>
          <p className="mt-2 text-center text-muted-foreground">
            Joined {data.userJoinedDisplay}
          </p>
          {isLoggedInUser ? (
            <Form className="mt-3" method="POST" action="/logout">
              <AuthenticityTokenInput />
              <Button type="submit" variant="link" size="pill">
                Logout
              </Button>
            </Form>
          ) : null}
          <div className="mt-10 flex gap-4">
            <Button asChild>
              <Link to="notes" prefetch="intent">
                {userDisplayName}'s notes
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
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
