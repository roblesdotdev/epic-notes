import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Form, Link, useActionData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { getPasswordHash, verifyUserPassword } from '~/utils/auth.server.ts'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { db } from '~/utils/db.server.ts'
import { useIsPending } from '~/utils/misc.tsx'
import { PasswordSchema } from '~/utils/user-validation.ts'

export const handle = {
  breadcrumb: <span>Password</span>,
}

const ChangePasswordForm = z
  .object({
    currentPassword: PasswordSchema,
    newPassword: PasswordSchema,
    confirmNewPassword: PasswordSchema,
  })
  .superRefine(({ confirmNewPassword, newPassword }, ctx) => {
    if (confirmNewPassword !== newPassword) {
      ctx.addIssue({
        path: ['confirmNewPassword'],
        code: 'custom',
        message: 'The passwords must match',
      })
    }
  })

export async function action({ request }: DataFunctionArgs) {
  const userId = 'some_user_id' // we'll take care of this next
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  const submission = await parse(formData, {
    async: true,
    schema: ChangePasswordForm.superRefine(
      async ({ currentPassword, newPassword }, ctx) => {
        if (currentPassword && newPassword) {
          const user = await verifyUserPassword({ id: userId }, currentPassword)
          if (!user) {
            ctx.addIssue({
              path: ['currentPassword'],
              code: 'custom',
              message: 'Incorrect password.',
            })
          }
        }
      },
    ),
  })
  // clear the payload so we don't send the password back to the client
  submission.payload = {}
  if (submission.intent !== 'submit') {
    // clear the value so we don't send the password back to the client
    submission.value = undefined
    return json({ status: 'idle', submission } as const)
  }
  if (!submission.value) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }

  const { newPassword } = submission.value

  await db.user.update({
    select: { username: true },
    where: { id: userId },
    data: {
      password: {
        update: {
          hash: await getPasswordHash(newPassword),
        },
      },
    },
  })

  return redirect(`/settings/profile`)
}

export default function ChangePasswordRoute() {
  const actionData = useActionData<typeof action>()
  const isPending = useIsPending()

  const [form, fields] = useForm({
    id: 'signup-form',
    constraint: getFieldsetConstraint(ChangePasswordForm),
    lastSubmission: actionData?.submission,
    onValidate({ formData }) {
      return parse(formData, { schema: ChangePasswordForm })
    },
    shouldRevalidate: 'onBlur',
  })

  return (
    <Form method="POST" {...form.props} className="mx-auto max-w-md">
      <AuthenticityTokenInput />
      <Field
        labelProps={{ children: 'Current Password' }}
        inputProps={conform.input(fields.currentPassword, { type: 'password' })}
        errors={fields.currentPassword.errors}
      />
      <Field
        labelProps={{ children: 'New Password' }}
        inputProps={conform.input(fields.newPassword, { type: 'password' })}
        errors={fields.newPassword.errors}
      />
      <Field
        labelProps={{ children: 'Confirm New Password' }}
        inputProps={conform.input(fields.confirmNewPassword, {
          type: 'password',
        })}
        errors={fields.confirmNewPassword.errors}
      />
      <ErrorList id={form.errorId} errors={form.errors} />
      <div className="grid w-full grid-cols-2 gap-6">
        <Button variant="secondary" asChild>
          <Link to="..">Cancel</Link>
        </Button>
        <Button type="submit" disabled={isPending}>
          Change Password
        </Button>
      </div>
    </Form>
  )
}
