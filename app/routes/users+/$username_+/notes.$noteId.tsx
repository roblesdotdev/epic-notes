import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Form, Link, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { CSRFError } from 'remix-utils/csrf/server'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { db } from '~/utils/db.server.ts'
import { invariantResponse } from '~/utils/misc.ts'
import type { loader as notesLoader } from './notes.tsx'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { csrf } from '~/utils/csrf.secret.ts'

export async function loader({ params }: LoaderFunctionArgs) {
  const noteId = params.noteId
  const note = db.note.findFirst({ where: { id: { equals: noteId } } })
  invariantResponse(note, 'Not found note', { status: 404 })
  return json({
    note: {
      title: note.title,
      content: note.content,
      images: note.images.map(i => ({ id: i.id, altText: i.altText })),
    },
  })
}

export async function action({ params, request }: ActionFunctionArgs) {
  const formData = await request.formData()
  try {
    await csrf.validate(formData, request.headers)
  } catch (error) {
    if (error instanceof CSRFError) {
      throw new Response('Invalid CSRF token', { status: 403 })
    }
    throw error
  }
  const intent = formData.get('intent')
  invariantResponse(intent === 'delete', 'Invalid intent')
  db.note.delete({ where: { id: { equals: params.noteId } } })
  return redirect(`/users/${params.username}/notes`)
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

  return (
    <div className="absolute inset-0 flex flex-col px-10">
      <h2 className="mb-2 pt-12 text-h2 lg:mb-6">{data.note.title}</h2>
      <div className="overflow-y-auto pb-24">
        <ul className="flex flex-wrap gap-5 py-5">
          {data.note.images.map(image => (
            <li key={image.id}>
              <a href={`/resources/images/${image.id}`}>
                <img
                  src={`/resources/images/${image.id}`}
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
      <div className={floatingToolbarClassName}>
        <Form method="POST">
          <AuthenticityTokenInput />
          <Button
            type="submit"
            variant="destructive"
            name="intent"
            value="delete"
          >
            Delete
          </Button>
        </Form>
        <Button asChild>
          <Link to="edit">Edit</Link>
        </Button>
      </div>
    </div>
  )
}

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        404: ({ params }) => (
          <p>No note with the id "{params.noteId}" exists</p>
        ),
      }}
    />
  )
}
