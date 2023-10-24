import { json, redirect } from '@remix-run/node'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import {
  Form,
  useActionData,
  useFormAction,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import { useEffect, useState } from 'react'
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

type ActionErrors = {
  formErrors: Array<string>
  fieldErrors: {
    title: Array<string>
    content: Array<string>
  }
}

const titleMaxLength = 100
const contentMaxLength = 1000

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()
  const title = formData.get('title')
  const content = formData.get('content')

  invariantResponse(typeof title === 'string', 'Title must be a string')
  invariantResponse(typeof content === 'string', 'Content must be a string')

  const errors: ActionErrors = {
    formErrors: [],
    fieldErrors: {
      title: [],
      content: [],
    },
  }

  if (title === '') {
    errors.fieldErrors.title.push('Title is required')
  }
  if (title.length > titleMaxLength) {
    errors.fieldErrors.title.push(
      `Title must be at least ${titleMaxLength} characters`,
    )
  }
  if (content === '') {
    errors.fieldErrors.content.push('Content is required')
  }
  if (content.length > contentMaxLength) {
    errors.fieldErrors.content.push(
      `Content must be at least ${contentMaxLength} characters`,
    )
  }

  const hasErrors =
    errors.formErrors.length ||
    Object.values(errors.fieldErrors).some(fieldError => fieldError.length)

  if (hasErrors) {
    return json({ status: 'error', errors } as const, { status: 400 })
  }

  db.note.update({
    where: {
      id: { equals: params.noteId },
    },
    data: { title, content },
  })

  return redirect(`/users/${params.username}/notes/${params.noteId}`)
}

function ErrorList({ errors }: { errors?: Array<string> | null }) {
  return errors?.length ? (
    <ul className="flex flex-col gap-1">
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

  return (
    <div className="absolute inset-0">
      <Form
        method="POST"
        className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
        id={formId}
        noValidate={isHydrated}
      >
        <div className="flex flex-col gap-1">
          <div>
            <Label>Title</Label>
            <Input
              name="title"
              defaultValue={data.note.title}
              required
              maxLength={titleMaxLength}
            />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList errors={fieldErrors?.title} />
            </div>
          </div>
          <div>
            {/* 🦉 NOTE: this is not an accessible label, we'll get to that in the accessibility exercises */}
            <Label>Content</Label>
            <Textarea
              name="content"
              defaultValue={data.note.content}
              required
              maxLength={contentMaxLength}
            />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList errors={fieldErrors?.content} />
            </div>
          </div>
        </div>
        <ErrorList errors={formErrors} />
      </Form>
      <div className={floatingToolbarClassName}>
        <Button variant="destructive" type="reset">
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
