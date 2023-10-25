import { json, redirect } from '@remix-run/node'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import {
  Form,
  useActionData,
  useFormAction,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import { Textarea } from '~/components/ui/textarea.tsx'
import { db } from '~/utils/db.server.ts'
import { invariantResponse, useFocusInvalid } from '~/utils/misc.ts'

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

const titleMaxLength = 100
const contentMaxLength = 1000

const NoteEditionSchema = z.object({
  title: z.string().min(1).max(titleMaxLength),
  content: z.string().min(1).max(contentMaxLength),
})

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()

  const result = NoteEditionSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
  })

  if (!result.success) {
    return json({ status: 'error', errors: result.error.flatten() } as const, {
      status: 400,
    })
  }

  const { title, content } = result.data

  db.note.update({
    where: {
      id: { equals: params.noteId },
    },
    data: { title, content },
  })

  return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({
  id,
  errors,
}: {
  id?: string
  errors?: Array<string> | null
}) {
  return errors?.length ? (
    <ul className="flex flex-col gap-1" id={id}>
      {errors.map((error, i) => (
        <li key={i} className="text-[10px] text-foreground-destructive">
          {error}
        </li>
      ))}
    </ul>
  ) : null
}

function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}

export default function NoteEdit() {
  const data = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const formId = 'edit-form'
  const isHydrated = useHydrated()
  const formRef = useRef<HTMLFormElement>(null)
  // Pending UI
  const navigation = useNavigation()
  const formAction = useFormAction()
  const isSubmitting =
    navigation.state !== 'idle' &&
    navigation.formMethod === 'POST' &&
    navigation.formAction === formAction

  // Errors
  const fieldErrors =
    actionData?.status === 'error' ? actionData.errors.fieldErrors : null
  const formErrors =
    actionData?.status === 'error' ? actionData.errors.formErrors : null
  const formHasErrors = Boolean(formErrors?.length)
  const formErrorId = formHasErrors ? 'form-error' : undefined
  const titleHasErrors = Boolean(fieldErrors?.title?.length)
  const titleErrorId = titleHasErrors ? 'title-error' : undefined
  const contentHasErrors = Boolean(fieldErrors?.content?.length)
  const contentErrorId = contentHasErrors ? 'content-error' : undefined

  useFocusInvalid(formRef.current, actionData?.status === 'error')

  return (
    <div className="absolute inset-0">
      <Form
        method="POST"
        className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
        id={formId}
        noValidate={isHydrated}
        aria-invalid={formHasErrors || undefined}
        aria-describedby={formErrorId}
        ref={formRef}
        tabIndex={-1}
      >
        <div className="flex flex-col gap-1">
          <div>
            <Label htmlFor="note-title">Title</Label>
            <Input
              name="title"
              id="note-title"
              defaultValue={data.note.title}
              required
              maxLength={titleMaxLength}
              aria-invalid={titleHasErrors || undefined}
              aria-describedby={titleErrorId}
              autoFocus
            />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList id={titleErrorId} errors={fieldErrors?.title} />
            </div>
          </div>
          <div>
            <Label htmlFor="note-content">Content</Label>
            <Textarea
              name="content"
              id="note-content"
              defaultValue={data.note.content}
              required
              maxLength={contentMaxLength}
              aria-invalid={contentHasErrors || undefined}
              aria-describedby={contentErrorId}
            />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList id={contentErrorId} errors={fieldErrors?.content} />
            </div>
          </div>
        </div>
        <ErrorList id={formErrorId} errors={formErrors} />
      </Form>
      <div className={floatingToolbarClassName}>
        <Button variant="destructive" type="reset" form={formId}>
          Reset
        </Button>
        <Button disabled={isSubmitting} type="submit" form={formId}>
          Submit
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
