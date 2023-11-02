import {
  json,
  type DataFunctionArgs,
  type MetaFunction,
  redirect,
} from '@remix-run/node'
import { GeneralErrorBoundary } from '~/components/error-boundary.tsx'
import * as E from '@react-email/components'
import { z } from 'zod'
import { EmailSchema, UsernameSchema } from '~/utils/user-validation.ts'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { checkHoneypot } from '~/utils/honeypot.server.ts'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { db } from '~/utils/db.server.ts'
import { sendEmail } from '~/utils/email.server.ts'
import { Link, useFetcher, useSearchParams } from '@remix-run/react'
import { conform, useForm } from '@conform-to/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { ErrorList, Field } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { prepareVerification } from './verify.tsx'

const ForgotPasswordSchema = z.object({
  usernameOrEmail: z.union([EmailSchema, UsernameSchema]),
})

export async function action({ request }: DataFunctionArgs) {
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  checkHoneypot(formData)
  const submission = await parse(formData, {
    schema: ForgotPasswordSchema.superRefine(async (data, ctx) => {
      const user = await db.user.findFirst({
        where: {
          OR: [
            { email: data.usernameOrEmail },
            { username: data.usernameOrEmail },
          ],
        },
        select: { id: true },
      })
      if (!user) {
        ctx.addIssue({
          path: ['usernameOrEmail'],
          code: z.ZodIssueCode.custom,
          message: 'No user exists with this username or email',
        })
        return
      }
    }),
    async: true,
  })
  if (submission.intent !== 'submit') {
    return json({ status: 'idle', submission } as const)
  }
  if (!submission.value) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }
  const { usernameOrEmail } = submission.value

  const user = await db.user.findFirstOrThrow({
    where: { OR: [{ email: usernameOrEmail }, { username: usernameOrEmail }] },
    select: { email: true, username: true },
  })

  const { verifyUrl, redirectTo, otp } = await prepareVerification({
    period: 10 * 60,
    request,
    type: 'reset-password',
    target: usernameOrEmail,
  })

  const response = await sendEmail({
    to: user.email,
    subject: `Epic Notes Password Reset`,
    react: (
      <ForgotPasswordEmail onboardingUrl={verifyUrl.toString()} otp={otp} />
    ),
  })

  if (response.status === 'success') {
    return redirect(redirectTo.toString())
  } else {
    submission.error[''] = [response.error.message]
    return json({ status: 'error', submission } as const, { status: 500 })
  }
}

function ForgotPasswordEmail({
  onboardingUrl,
  otp,
}: {
  onboardingUrl: string
  otp: string
}) {
  return (
    <E.Html lang="en" dir="ltr">
      <E.Container>
        <h1>
          <E.Text>Epic Notes Password Reset</E.Text>
        </h1>
        <p>
          <E.Text>
            Here's your verification code: <strong>{otp}</strong>
          </E.Text>
        </p>
        <p>
          <E.Text>Or click the link:</E.Text>
        </p>
        <E.Link href={onboardingUrl}>{onboardingUrl}</E.Link>
      </E.Container>
    </E.Html>
  )
}

export const meta: MetaFunction = () => {
  return [{ title: 'Password Recovery for Epic Notes' }]
}

export default function ForgotPassword() {
  const forgotPassword = useFetcher<typeof action>()

  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')

  const [form, fields] = useForm({
    id: 'signup-form',
    constraint: getFieldsetConstraint(ForgotPasswordSchema),
    defaultValue: { redirectTo },
    lastSubmission: forgotPassword.data?.submission,
    onValidate({ formData }) {
      const result = parse(formData, { schema: ForgotPasswordSchema })
      return result
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <div className="container pb-32 pt-20">
      <div className="flex flex-col justify-center">
        <div className="text-center">
          <h1 className="text-h1">Forgot Password</h1>
          <p className="mt-3 text-body-md text-muted-foreground">
            No worries, we'll send you reset instructions.
          </p>
        </div>
        <div className="mx-auto mt-16 min-w-[368px] max-w-sm">
          <forgotPassword.Form method="POST" {...form.props}>
            <AuthenticityTokenInput />
            <HoneypotInputs />
            <div>
              <Field
                labelProps={{
                  htmlFor: fields.usernameOrEmail.id,
                  children: 'Username or Email',
                }}
                inputProps={{
                  autoFocus: true,
                  ...conform.input(fields.usernameOrEmail),
                }}
                errors={fields.usernameOrEmail.errors}
              />
            </div>
            <ErrorList errors={form.errors} id={form.errorId} />

            <div className="mt-6">
              <Button
                className="w-full"
                type="submit"
                disabled={forgotPassword.state !== 'idle'}
              >
                Recover password
              </Button>
            </div>
          </forgotPassword.Form>
          <Link
            to="/login"
            className="mt-11 text-center text-body-sm font-bold"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  )
}

export function ErrorBoundary() {
  return <GeneralErrorBoundary />
}
