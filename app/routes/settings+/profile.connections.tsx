import {
  json,
  type DataFunctionArgs,
  type SerializeFrom,
} from '@remix-run/node'
import { Form, useFetcher, useLoaderData } from '@remix-run/react'
import { useState } from 'react'
import { Button } from '~/components/ui/button.tsx'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { resolveConnectionData } from '~/utils/connection.server.ts'
import { ProviderNameSchema } from '~/utils/connections.tsx'
import { db } from '~/utils/db.server.ts'
import { invariantResponse, useIsPending } from '~/utils/misc.tsx'
import { createToastHeaders } from '~/utils/toast.server.ts'

export const handle = {
  breadcrumb: <>Connections</>,
}

async function userCanDeleteConnections(userId: string) {
  const user = await db.user.findUnique({
    select: {
      password: { select: { userId: true } },
      _count: { select: { connections: true } },
    },
    where: { id: userId },
  })
  // user can delete their connections if they have a password
  if (user?.password) return true
  // users have to have more than one remaining connection to delete one
  return Boolean(user?._count.connections && user?._count.connections > 1)
}

export async function loader({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const rawConnections = await db.connection.findMany({
    select: { id: true, providerName: true, providerId: true, createdAt: true },
    where: { userId },
  })
  const connections: Array<{
    id: string
    displayName: string
    link?: string | null
    createdAtFormatted: string
  }> = []
  for (const connection of rawConnections) {
    const r = ProviderNameSchema.safeParse(connection.providerName)
    if (!r.success) continue
    const connectionData = await resolveConnectionData(
      r.data,
      connection.providerId,
    )
    if (connectionData) {
      connections.push({
        ...connectionData,
        id: connection.id,
        createdAtFormatted: connection.createdAt.toLocaleString(),
      })
    } else {
      connections.push({
        id: connection.id,
        displayName: 'Unknown',
        createdAtFormatted: connection.createdAt.toLocaleString(),
      })
    }
  }

  return json({
    connections,
    canDeleteConnections: await userCanDeleteConnections(userId),
  })
}

export async function action({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const formData = await request.formData()
  invariantResponse(
    formData.get('intent') === 'delete-connection',
    'Invalid intent',
  )
  invariantResponse(
    await userCanDeleteConnections(userId),
    'You cannot delete your last connection unless you have a password.',
  )
  const connectionId = formData.get('connectionId')
  invariantResponse(typeof connectionId === 'string', 'Invalid connectionId')
  await db.connection.delete({
    where: {
      id: connectionId,
      userId: userId,
    },
  })
  const toastHeaders = await createToastHeaders({
    title: 'Deleted',
    description: 'Your connection has been deleted.',
  })
  return json({ status: 'success' } as const, { headers: toastHeaders })
}

export default function Connections() {
  const data = useLoaderData<typeof loader>()
  const isGitHubSubmitting = useIsPending({ formAction: '/auth/github' })

  return (
    <div className="mx-auto max-w-md">
      {data.connections.length ? (
        <div className="flex flex-col gap-2">
          <p>Here are your current connections:</p>
          <ul className="flex flex-col gap-4">
            {data.connections.map(c => (
              <li key={c.id}>
                <Connection
                  connection={c}
                  canDelete={data.canDeleteConnections}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p>You don't have any connections yet.</p>
      )}
      <Form
        className="mt-5 flex items-center justify-center gap-2 border-t-2 border-border pt-3"
        action="/auth/github"
        method="POST"
      >
        <Button type="submit" className="w-full" disabled={isGitHubSubmitting}>
          Connect with Github
        </Button>
      </Form>
    </div>
  )
}

function Connection({
  connection,
  canDelete,
}: {
  connection: SerializeFrom<typeof loader>['connections'][number]
  canDelete: boolean
}) {
  const deleteFetcher = useFetcher<typeof action>()
  const [infoOpen, setInfoOpen] = useState(false)
  return (
    <div className="flex justify-between gap-2">
      {connection.link ? (
        <a href={connection.link} className="underline">
          {connection.displayName}
        </a>
      ) : (
        connection.displayName
      )}{' '}
      ({connection.createdAtFormatted})
      {canDelete ? (
        <deleteFetcher.Form method="POST">
          <input name="connectionId" value={connection.id} type="hidden" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  name="intent"
                  value="delete-connection"
                  variant="destructive"
                  size="sm"
                >
                  X
                </Button>
              </TooltipTrigger>
              <TooltipContent>Disconnect this account</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </deleteFetcher.Form>
      ) : (
        <TooltipProvider>
          <Tooltip open={infoOpen} onOpenChange={setInfoOpen}>
            <TooltipTrigger onClick={() => setInfoOpen(true)}>?</TooltipTrigger>
            <TooltipContent>
              You cannot delete your last connection unless you have a password.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
