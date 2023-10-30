import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import {
  json,
  redirect,
  type DataFunctionArgs,
  type MetaFunction,
} from '@remix-run/node'
import { Form, Link, useActionData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import { ErrorList, Field } from '~/components/forms.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { Button } from '~/components/ui/button.tsx'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { db } from '~/utils/db.server.ts'
import { checkHoneypot } from '~/utils/honeypot.server.ts'
import { useIsPending } from '~/utils/misc.tsx'
import { sessionStorage } from '~/utils/session.server.ts'
import { PasswordSchema, UsernameSchema } from '~/utils/user-validation.ts'

const LoginFormSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
})

export async function action({ request }: DataFunctionArgs) {
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  checkHoneypot(formData)
  const submission = await parse(formData, {
    schema: intent =>
      LoginFormSchema.transform(async (data, ctx) => {
        if (intent !== 'submit') return { ...data, user: null }

        const user = await db.user.findUnique({
          select: { id: true },
          where: { username: data.username },
        })
        if (!user) {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid username or password',
          })
          return z.NEVER
        }
        // verify the password (we'll do this later)
        return { ...data, user }
      }),
    async: true,
  })
  // get the password off the payload that's sent back
  delete submission.payload.password

  if (submission.intent !== 'submit') {
    // @ts-expect-error - conform should probably have support for doing this
    delete submission.value?.password
    return json({ status: 'idle', submission } as const)
  }
  if (!submission.value?.user) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }

  const { user } = submission.value

  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  cookieSession.set('userId', user.id)

  return redirect('/', {
    headers: {
      'set-cookie': await sessionStorage.commitSession(cookieSession),
    },
  })
}

export default function LoginPage() {
  const actionData = useActionData<typeof action>()
  const isPending = useIsPending()

  const [form, fields] = useForm({
    id: 'login-form',
    constraint: getFieldsetConstraint(LoginFormSchema),
    lastSubmission: actionData?.submission,
    onValidate({ formData }) {
      return parse(formData, { schema: LoginFormSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <div className="flex min-h-full flex-col justify-center pb-32 pt-20">
      <div className="mx-auto w-full max-w-md">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-h1">Welcome back!</h1>
          <p className="text-body-md text-muted-foreground">
            Please enter your details.
          </p>
        </div>
        <Spacer size="xs" />

        <div>
          <div className="mx-auto w-full max-w-md px-8">
            <Form method="POST" {...form.props}>
              <AuthenticityTokenInput />
              <HoneypotInputs />
              <Field
                labelProps={{ children: 'Username' }}
                inputProps={{
                  ...conform.input(fields.username),
                  autoFocus: true,
                  className: 'lowercase',
                }}
                errors={fields.username.errors}
              />

              <Field
                labelProps={{ children: 'Password' }}
                inputProps={conform.input(fields.password, {
                  type: 'password',
                })}
                errors={fields.password.errors}
              />

              <div className="flex justify-between">
                <div />
                <div>
                  <Link
                    to="/forgot-password"
                    className="text-body-xs font-semibold"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <ErrorList errors={form.errors} id={form.errorId} />

              <div className="flex items-center justify-between gap-6 pt-3">
                <Button className="w-full" type="submit" disabled={isPending}>
                  Log in
                </Button>
              </div>
            </Form>
            <div className="flex items-center justify-center gap-2 pt-6">
              <span className="text-muted-foreground">New here?</span>
              <Link to="/signup">Create an account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const meta: MetaFunction = () => {
  return [{ title: 'Login to Epic Notes' }]
}

export function ErrorBoundary() {
  return <GeneralErrorBoundary />
}