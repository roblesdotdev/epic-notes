import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect } from '@remix-run/node'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import {
  Form,
  useActionData,
  useFormAction,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import { z } from 'zod'
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
    note: {
      title: note.title,
      content: note.content,
    },
  })
}

const titleMaxLength = 100
const contentMaxLength = 1000

const NoteEditionSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).max(titleMaxLength),
  content: z
    .string({ required_error: 'Content is required' })
    .max(contentMaxLength),
})

export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData()

  const submission = parse(formData, {
    schema: NoteEditionSchema,
  })

  console.log(submission)

  if (!submission.value) {
    return json({ status: 'error', submission } as const, {
      status: 400,
    })
  }

  const { title, content } = submission.value

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

export default function NoteEdit() {
  const data = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  // Pending UI
  const navigation = useNavigation()
  const formAction = useFormAction()
  const isSubmitting =
    navigation.state !== 'idle' &&
    navigation.formMethod === 'POST' &&
    navigation.formAction === formAction

  const [form, fields] = useForm({
    id: 'note-form',
    constraint: getFieldsetConstraint(NoteEditionSchema),
    lastSubmission: actionData?.submission,
    onValidate({ formData }) {
      return parse(formData, { schema: NoteEditionSchema })
    },
    defaultValue: {
      title: data.note.title,
      content: data.note.content,
    },
  })

  return (
    <div className="absolute inset-0">
      <Form
        method="POST"
        className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
        {...form.props}
      >
        <div className="flex flex-col gap-1">
          <div>
            <Label htmlFor={fields.title.id}>Title</Label>
            <Input autoFocus {...conform.input(fields.title)} />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList
                id={fields.title.errorId}
                errors={fields.title.errors}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={fields.content.id}>Content</Label>
            <Textarea {...conform.input(fields.content)} />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList
                id={fields.content.errorId}
                errors={fields.content.errors}
              />
            </div>
          </div>
        </div>
        <ErrorList id={form.errorId} errors={form.errors} />
      </Form>
      <div className={floatingToolbarClassName}>
        <Button variant="destructive" type="reset" form={form.id}>
          Reset
        </Button>
        <Button disabled={isSubmitting} type="submit" form={form.id}>
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
