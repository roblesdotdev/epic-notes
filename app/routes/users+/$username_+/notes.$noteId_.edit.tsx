import type { FieldConfig } from '@conform-to/react'
import { conform, useFieldset, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import {
  json,
  redirect,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'
import {
  Form,
  useActionData,
  useFormAction,
  useLoaderData,
  useNavigation,
} from '@remix-run/react'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { floatingToolbarClassName } from '~/components/floating-toolbar.tsx'
import { Button } from '~/components/ui/button.tsx'
import { Input } from '~/components/ui/input.tsx'
import { Label } from '~/components/ui/label.tsx'
import { Textarea } from '~/components/ui/textarea.tsx'
import { db, updateNote } from '~/utils/db.server.ts'
import { cn, invariantResponse } from '~/utils/misc.ts'

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
      images: note.images.map(i => ({ id: i.id, altText: i.altText })),
    },
  })
}

const titleMaxLength = 100
const contentMaxLength = 1000
const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const ImageFieldsetSchema = z.object({
  id: z.string().optional(),
  file: z
    .instanceof(File)
    .refine(file => {
      return file.size <= MAX_UPLOAD_SIZE
    }, 'File size must be less than 3MB')
    .optional(),
  altText: z.string().optional(),
})

const NoteEditionSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).max(titleMaxLength),
  content: z
    .string({ required_error: 'Content is required' })
    .max(contentMaxLength),
  image: ImageFieldsetSchema,
})

export async function action({ request, params }: ActionFunctionArgs) {
  invariantResponse(params.noteId, 'noteId param is required')

  const formData = await parseMultipartFormData(
    request,
    createMemoryUploadHandler({ maxPartSize: MAX_UPLOAD_SIZE }),
  )

  const submission = parse(formData, {
    schema: NoteEditionSchema,
  })

  if (!submission.value) {
    return json({ status: 'error', submission } as const, {
      status: 400,
    })
  }

  const { title, content, image } = submission.value

  updateNote({
    id: params.noteId,
    title,
    content,
    images: [image],
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
      image: data.note.images[0],
    },
  })

  return (
    <div className="absolute inset-0">
      <Form
        method="POST"
        className="flex h-full flex-col gap-y-4 overflow-x-hidden px-10 pb-28 pt-12"
        {...form.props}
        encType="multipart/form-data"
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
            <Textarea {...conform.textarea(fields.content)} />
            <div className="min-h-[32px] px-4 pb-3 pt-1">
              <ErrorList
                id={fields.content.errorId}
                errors={fields.content.errors}
              />
            </div>
          </div>
          <div>
            <Label>Image</Label>
            <ImageChooser config={fields.image} />
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

function ImageChooser({
  config,
}: {
  config: FieldConfig<z.infer<typeof ImageFieldsetSchema>>
}) {
  const ref = useRef<HTMLFieldSetElement>(null)
  const fields = useFieldset(ref, config)
  const existingImage = Boolean(fields.id.defaultValue)
  const [previewImage, setPreviewImage] = useState<string | null>(
    existingImage ? `/resources/images/${fields.id.defaultValue}` : null,
  )
  const [altText, setAltText] = useState(fields.altText.defaultValue ?? '')

  return (
    <fieldset ref={ref} {...conform.fieldset(config)}>
      <div className="flex gap-3">
        <div className="w-32">
          <div className="relative h-32 w-32">
            <label
              htmlFor={fields.file.id}
              className={cn('group absolute h-32 w-32 rounded-lg', {
                'bg-accent opacity-40 focus-within:opacity-100 hover:opacity-100':
                  !previewImage,
                'cursor-pointer focus-within:ring-4': !existingImage,
              })}
            >
              {previewImage ? (
                <div className="relative">
                  <img
                    src={previewImage}
                    alt={altText ?? ''}
                    className="h-32 w-32 rounded-lg object-cover"
                  />
                  {existingImage ? null : (
                    <div className="pointer-events-none absolute -right-0.5 -top-0.5 rotate-12 rounded-sm bg-secondary px-2 py-1 text-xs text-secondary-foreground shadow-md">
                      new
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-muted-foreground text-4xl text-muted-foreground">
                  ➕
                </div>
              )}
              {existingImage ? (
                <input {...conform.input(fields.id, { type: 'hidden' })} />
              ) : null}
              <input
                aria-label="Image"
                className="absolute left-0 top-0 z-0 h-32 w-32 cursor-pointer opacity-0"
                onChange={event => {
                  const file = event.target.files?.[0]

                  if (file) {
                    const reader = new FileReader()
                    reader.onloadend = () => {
                      setPreviewImage(reader.result as string)
                    }
                    reader.readAsDataURL(file)
                  } else {
                    setPreviewImage(null)
                  }
                }}
                accept="image/*"
                {...conform.input(fields.file, { type: 'file' })}
              />
            </label>
          </div>
          <div className="min-h-[32px] px-4 pb-3 pt-1">
            <ErrorList id={fields.file.errorId} errors={fields.file.errors} />
          </div>
        </div>
        <div className="flex-1">
          <Label htmlFor={fields.altText.id}>Alt Text</Label>
          <Textarea
            onChange={e => setAltText(e.currentTarget.value)}
            {...conform.textarea(fields.altText)}
          />
          <div className="min-h-[32px] px-4 pb-3 pt-1">
            <ErrorList
              id={fields.altText.errorId}
              errors={fields.altText.errors}
            />
          </div>
        </div>
      </div>
      <div className="min-h-[32px] px-4 pb-3 pt-1">
        <ErrorList id={config.errorId} errors={config.errors} />
      </div>
    </fieldset>
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
