import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect } from '@remix-run/node'
import type {
  LoaderFunctionArgs,
  DataFunctionArgs,
  MetaFunction,
} from '@remix-run/node'
import {
  Form,
  useActionData,
  useLoaderData,
  useSearchParams,
} from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { HoneypotInputs } from 'remix-utils/honeypot/react'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { z } from 'zod'
import { CheckboxField, ErrorList, Field } from '~/components/forms.tsx'
import { Spacer } from '~/components/spacer.tsx'
import { Button } from '~/components/ui/button.tsx'
import { requireAnonymous, sessionKey, signup } from '~/utils/auth.server.ts'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { db } from '~/utils/db.server.ts'
import { checkHoneypot } from '~/utils/honeypot.server.ts'
import { useIsPending } from '~/utils/misc.tsx'
import { sessionStorage } from '~/utils/session.server.ts'
import {
  NameSchema,
  PasswordSchema,
  UsernameSchema,
} from '~/utils/user-validation.ts'
import { verifySessionStorage } from '~/utils/verification.server.ts'

export const onboardingEmailSessionKey = 'onboardingEmail'

const SignupFormSchema = z
  .object({
    username: UsernameSchema,
    name: NameSchema,
    password: PasswordSchema,
    confirmPassword: PasswordSchema,
    agreeToTermsOfServiceAndPrivacyPolicy: z.boolean({
      required_error:
        'You must agree to the terms of service and privacy policy',
    }),
    remember: z.boolean().optional(),
    redirectTo: z.string().optional(),
  })
  .superRefine(({ confirmPassword, password }, ctx) => {
    if (confirmPassword !== password) {
      ctx.addIssue({
        path: ['confirmPassword'],
        code: 'custom',
        message: 'The passwords must match',
      })
    }
  })

export async function action({ request }: DataFunctionArgs) {
  const email = await requireOnboardingEmail(request)
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  checkHoneypot(formData)
  const submission = await parse(formData, {
    schema: SignupFormSchema.superRefine(async (data, ctx) => {
      const existingUser = await db.user.findUnique({
        where: { username: data.username },
        select: { id: true },
      })
      if (existingUser) {
        ctx.addIssue({
          path: ['username'],
          code: z.ZodIssueCode.custom,
          message: 'A user already exists with this username',
        })
        return
      }
    }).transform(async data => {
      const session = await signup({ ...data, email })
      return { ...data, session }
    }),
    async: true,
  })

  if (submission.intent !== 'submit') {
    return json({ status: 'idle', submission } as const)
  }
  if (!submission.value?.session) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }

  const { session, remember, redirectTo } = submission.value

  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  cookieSession.set(sessionKey, session.id)
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const headers = new Headers()
  headers.append(
    'set-cookie',
    await sessionStorage.commitSession(cookieSession, {
      expires: remember ? session.expirationDate : undefined,
    }),
  )
  headers.append(
    'set-cookie',
    await verifySessionStorage.destroySession(verifySession),
  )

  return redirect(safeRedirect(redirectTo), { headers })
}

async function requireOnboardingEmail(request: Request) {
  await requireAnonymous(request)
  const verifySession = await verifySessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const email = verifySession.get(onboardingEmailSessionKey)
  if (typeof email !== 'string' || !email) {
    throw redirect('/signup')
  }
  return email
}

export async function loader({ request }: LoaderFunctionArgs) {
  const email = await requireOnboardingEmail(request)
  return json({ email })
}

export const meta: MetaFunction = () => {
  return [{ title: 'Setup Epic Notes Account' }]
}

export default function SignupRoute() {
  const data = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const isPending = useIsPending()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirectTo')

  const [form, fields] = useForm({
    id: 'signup-form',
    constraint: getFieldsetConstraint(SignupFormSchema),
    defaultValue: { redirectTo },
    lastSubmission: actionData?.submission,
    onValidate({ formData }) {
      return parse(formData, { schema: SignupFormSchema })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <div className="container flex min-h-full flex-col justify-center pb-32 pt-20">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-h1">Welcome aboard {data.email}!</h1>
          <p className="text-body-md text-muted-foreground">
            Please enter your details.
          </p>
        </div>
        <Spacer size="xs" />
        <Form
          method="POST"
          className="mx-auto min-w-[368px] max-w-sm"
          {...form.props}
        >
          <AuthenticityTokenInput />
          <HoneypotInputs />
          <Field
            labelProps={{ htmlFor: fields.username.id, children: 'Username' }}
            inputProps={{
              ...conform.input(fields.username),
              autoComplete: 'username',
              className: 'lowercase',
            }}
            errors={fields.username.errors}
          />
          <Field
            labelProps={{ htmlFor: fields.name.id, children: 'Name' }}
            inputProps={{
              ...conform.input(fields.name),
              autoComplete: 'name',
            }}
            errors={fields.name.errors}
          />
          <Field
            labelProps={{ htmlFor: fields.password.id, children: 'Password' }}
            inputProps={{
              ...conform.input(fields.password, { type: 'password' }),
              autoComplete: 'new-password',
            }}
            errors={fields.password.errors}
          />

          <Field
            labelProps={{
              htmlFor: fields.confirmPassword.id,
              children: 'Confirm Password',
            }}
            inputProps={{
              ...conform.input(fields.confirmPassword, { type: 'password' }),
              autoComplete: 'new-password',
            }}
            errors={fields.confirmPassword.errors}
          />

          <CheckboxField
            labelProps={{
              htmlFor: fields.agreeToTermsOfServiceAndPrivacyPolicy.id,
              children:
                'Do you agree to our Terms of Service and Privacy Policy?',
            }}
            buttonProps={conform.input(
              fields.agreeToTermsOfServiceAndPrivacyPolicy,
              { type: 'checkbox' },
            )}
            errors={fields.agreeToTermsOfServiceAndPrivacyPolicy.errors}
          />
          <CheckboxField
            labelProps={{
              htmlFor: fields.remember.id,
              children: 'Remember me',
            }}
            buttonProps={conform.input(fields.remember, { type: 'checkbox' })}
            errors={fields.remember.errors}
          />

          <input {...conform.input(fields.redirectTo, { type: 'hidden' })} />
          <ErrorList errors={form.errors} id={form.errorId} />

          <div className="flex items-center justify-between gap-6">
            <Button className="w-full" type="submit" disabled={isPending}>
              Create an account
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}
