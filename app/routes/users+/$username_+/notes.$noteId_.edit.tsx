import { json, type DataFunctionArgs } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'
import { db } from '~/utils/db.server'
import { invariantResponse } from '~/utils/misc'

export async function loader({ params }: DataFunctionArgs) {
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

export default function NoteEdit() {
  const data = useLoaderData<typeof loader>()

  return <pre>{JSON.stringify(data, null, 2)}</pre>
}
