import closeWithGrace from 'close-with-grace'
import type { HttpHandler } from 'msw'
import { passthrough, http } from 'msw'
import { setupServer } from 'msw/node'
import { handlers as resendHandlers } from './resend.ts'
import { handlers as githubHandlers } from './github.ts'

const miscHandlers: HttpHandler[] = process.env.REMIX_DEV_ORIGIN
  ? [http.post(`${process.env.REMIX_DEV_ORIGIN}ping`, passthrough)]
  : []

export const server = setupServer(
  ...miscHandlers,
  ...resendHandlers,
  ...githubHandlers,
)

server.listen({ onUnhandledRequest: 'warn' })

console.info('🔶 Mock server installed')

closeWithGrace(() => {
  server.close()
})
