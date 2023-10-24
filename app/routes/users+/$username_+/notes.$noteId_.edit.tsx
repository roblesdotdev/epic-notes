import { json, redirect } from '@remix-run/node'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import {
  Form,
  useFormAction,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import { Textarea } from '~/components/ui/textarea.tsx'
import { db } from '~/utils/db.server.ts'
import { invariantResponse } from '~/utils/misc.ts'

export async function loader({ params }: LoaderFunctionArgs) {
  const note = db.note.findFirst({
    where: {
      id: {
        equals: params.noteId,
      },
    },
  })

  invariantResponse(note, 'Note not found', { status: 404 })

  return json({
    note: { title: note.title, content: note.content },
  })
}

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()
  const title = formData.get('title')
  const content = formData.get('content')

  invariantResponse(typeof title === 'string', 'Title must be a string')
  invariantResponse(typeof content === 'string', 'Content must be a string')

  db.note.update({
    where: {
      id: { equals: params.noteId },
    },
    data: { title, content },
  })

  return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

export default function NoteEdit() {
  const data = useLoaderData<typeof loader>()
  // Pending UI
  const navigation = useNavigation()
  const formAction = useFormAction()
  const isSubmitting =
    navigation.state !== 'idle' &&
    navigation.formMethod === 'POST' &&
    navigation.formAction === formAction

  return (
    <Form
      method="POST"
      className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
    >
      <div className="flex flex-col gap-1">
        <div>
          <Label>Title</Label>
          <Input name="title" defaultValue={data.note.title} />
        </div>
        <div>
          {/* 🦉 NOTE: this is not an accessible label, we'll get to that in the accessibility exercises */}
          <Label>Content</Label>
          <Textarea name="content" defaultValue={data.note.content} />
        </div>
      </div>
      <div className={floatingToolbarClassName}>
        <Button variant="destructive" type="reset">
          Reset
        </Button>
        <Button disabled={isSubmitting} type="submit">
          Submit
        </Button>
      </div>
    </Form>
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
