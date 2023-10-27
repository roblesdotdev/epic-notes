import { type DataFunctionArgs } from '@remix-run/node'
import { db } from '~/utils/db.server.ts'
import { invariantResponse } from '~/utils/misc.ts'

export async function loader({ params }: DataFunctionArgs) {
  invariantResponse(params.imageId, 'Invalid image ID')
  const image = await db.userImage.findUnique({
    where: { id: params.imageId },
    select: { contentType: true, blob: true },
  })
  invariantResponse(image, 'Image not found', { status: 404 })

  return new Response(image.blob, {
    status: 200,
    headers: {
      'content-type': image.contentType,
      'content-length': Buffer.byteLength(image.blob).toString(),
      'content-disposition': `inline; filename="${params.imageId}"`,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
