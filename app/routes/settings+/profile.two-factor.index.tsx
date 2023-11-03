import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Link, Form, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Button } from '~/components/ui/button.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { db } from '~/utils/db.server.ts'
import { useIsPending } from '~/utils/misc.tsx'
import { twoFAVerificationType } from './profile.two-factor.tsx'
import { generateTOTP } from '@epic-web/totp'
import { twoFAVerifyVerificationType } from './profile.two-factor.verify.tsx'

export async function loader({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const verification = await db.verification.findUnique({
    where: { target_type: { type: twoFAVerificationType, target: userId } },
    select: { id: true },
  })
  return json({ isTwoFAEnabled: Boolean(verification) })
}

export async function action({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  const { otp: _otp, ...config } = generateTOTP()
  const verificationData = {
    ...config,
    type: twoFAVerifyVerificationType,
    target: userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 10),
  }
  await db.verification.upsert({
    where: {
      target_type: { target: userId, type: twoFAVerifyVerificationType },
    },
    create: verificationData,
    update: verificationData,
  })
  return redirect('/settings/profile/two-factor/verify')
}

export default function TwoFactorRoute() {
  const data = useLoaderData<typeof loader>()
  const isPending = useIsPending()

  return (
    <div className="flex flex-col gap-4">
      {data.isTwoFAEnabled ? (
        <>
          <p className="text-lg">You have enabled two-factor authentication.</p>
          <Link to="disable">Disable 2FA</Link>
        </>
      ) : (
        <>
          <p>You have not enabled two-factor authentication yet.</p>
          <p className="text-sm">
            Two factor authentication adds an extra layer of security to your
            account. You will need to enter a code from an authenticator app
            like{' '}
            <a className="underline" href="https://1password.com/">
              1Password
            </a>{' '}
            to log in.
          </p>
          <Form method="POST">
            <AuthenticityTokenInput />
            <Button
              type="submit"
              name="intent"
              value="enable"
              disabled={isPending}
              className="mx-auto"
            >
              Enable 2FA
            </Button>
          </Form>
        </>
      )}
    </div>
  )
}
