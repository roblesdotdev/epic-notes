import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, Link, useActionData, useLoaderData } from '@remix-run/react'
import { formatDistanceToNow } from 'date-fns'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { db } from '~/utils/db.server.ts'
import {
  getNoteImgSrc,
  invariantResponse,
  useIsPending,
} from '~/utils/misc.tsx'
import type { loader as notesLoader } from './notes.tsx'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { redirectWithToast } from '~/utils/toast.server.ts'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { z } from 'zod'
import { useForm } from '@conform-to/react'
import { ErrorList } from '~/components/forms.tsx'
import { useOptionalUser } from '~/utils/user.ts'
import { requireUser } from '~/utils/auth.server.ts'
import {
  requireUserWithPermission,
  userHasPermission,
} from '~/utils/permissions.ts'

export async function loader({ params, request }: LoaderFunctionArgs) {
  const note = await db.note.findUnique({
    where: { id: params.noteId },
    select: {
      id: true,
      title: true,
      content: true,
      ownerId: true,
      updatedAt: true,
      images: {
        select: { id: true, altText: true },
      },
    },
  })
  invariantResponse(note, 'Not found note', { status: 404 })

  const date = new Date(note.updatedAt)
  const timeAgo = formatDistanceToNow(date)

  return json({
    note,
    timeAgo,
  })
}

const DeleteFormSchema = z.object({
  intent: z.literal('delete-note'),
  noteId: z.string(),
})

export async function action({ params, request }: ActionFunctionArgs) {
  const user = await requireUser(request)
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  const submission = parse(formData, {
    schema: DeleteFormSchema,
  })
  if (submission.intent !== 'submit') {
    return json({ status: 'idle', submission } as const)
  }
  if (!submission.value) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }

  const { noteId } = submission.value

  const note = await db.note.findFirst({
    select: { id: true, ownerId: true, owner: { select: { username: true } } },
    where: { id: noteId },
  })
  invariantResponse(note, 'Not found', { status: 404 })

  const isOwner = note.ownerId === user.id
  await requireUserWithPermission(
    request,
    isOwner ? `delete:note:own` : `delete:note:any`,
  )

  await db.note.delete({ where: { id: noteId } })

  throw await redirectWithToast(`/users/${note.owner.username}/notes`, {
    type: 'success',
    title: 'Success',
    description: 'Your note has been deleted',
  })
}

export const meta: MetaFunction<
  typeof loader,
  { 'routes/users+/$username_+/notes': typeof notesLoader }
> = ({ data, params, matches }) => {
  const notesMatch = matches.find(
    m => m.id === 'routes/users+/$username_+/notes',
  )
  const displayName = notesMatch?.data?.owner.name ?? params.username
  const noteTitle = data?.note.title ?? 'Note'
  const noteContentsSummary =
    data && data.note.content.length > 100
      ? data?.note.content.slice(0, 97) + '...'
      : 'No content'
  return [
    { title: `${noteTitle} | ${displayName}'s Notes | Epic Notes` },
    {
      name: 'description',
      content: noteContentsSummary,
    },
  ]
}

export default function SomeNoteId() {
  const data = useLoaderData<typeof loader>()
  const user = useOptionalUser()
  const isOwner = user?.id === data.note.ownerId
  const canDelete = userHasPermission(
    user,
    isOwner ? 'delete:note:own' : 'delete:note:any',
  )
  const displayBar = canDelete || isOwner

  return (
    <div className="absolute inset-0 flex flex-col px-10">
      <h2 className="mb-2 pt-12 text-h2 lg:mb-6">{data.note.title}</h2>
      <div className={`${isOwner ? 'pb-24' : 'pb-12'} overflow-y-auto`}>
        <ul className="flex flex-wrap gap-5 py-5">
          {data.note.images.map(image => (
            <li key={image.id}>
              <a href={getNoteImgSrc(image.id)}>
                <img
                  src={getNoteImgSrc(image.id)}
                  alt={image.altText ?? ''}
                  className="h-32 w-32 rounded-lg object-cover"
                />
              </a>
            </li>
          ))}
        </ul>
        <p className="whitespace-break-spaces text-sm md:text-lg">
          {data.note.content}
        </p>
      </div>
      {displayBar ? (
        <div className={floatingToolbarClassName}>
          <span className="text-sm text-foreground/90 max-[524px]:hidden">
            {data.timeAgo} ago
          </span>
          <div className="grid flex-1 grid-cols-2 justify-end gap-2 min-[525px]:flex md:gap-4">
            {canDelete ? <DeleteNote id={data.note.id} /> : null}
            <Button
              asChild
              className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0"
            >
              <Link to="edit">
                <span>Edit</span>
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function DeleteNote({ id }: { id: string }) {
  const actionData = useActionData<typeof action>()
  const isPending = useIsPending()
  const [form] = useForm({
    id: 'delete-note',
    lastSubmission: actionData?.submission,
    constraint: getFieldsetConstraint(DeleteFormSchema),
    onValidate({ formData }) {
      return parse(formData, { schema: DeleteFormSchema })
    },
  })

  return (
    <Form method="post" {...form.props}>
      <AuthenticityTokenInput />
      <input type="hidden" name="noteId" value={id} />
      <Button
        type="submit"
        name="intent"
        value="delete-note"
        variant="destructive"
        disabled={isPending}
        className="w-full max-md:aspect-square max-md:px-0"
      >
        <span>Delete</span>
      </Button>
      <ErrorList errors={form.errors} id={form.errorId} />
    </Form>
  )
}

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        403: () => <p>You are not allowed to do that</p>,
        404: ({ params }) => (
          <p>No note with the id "{params.noteId}" exists</p>
        ),
      }}
    />
  )
}
