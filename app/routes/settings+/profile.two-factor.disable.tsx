import { json, type DataFunctionArgs } from '@remix-run/node'
import { Form } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { Button } from '~/components/ui/button.tsx'
import { requireUserId } from '~/utils/auth.server.ts'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { db } from '~/utils/db.server.ts'
import { useDoubleCheck, useIsPending } from '~/utils/misc.tsx'
import { redirectWithToast } from '~/utils/toast.server.ts'
import { twoFAVerificationType } from './profile.two-factor.tsx'

export const handle = {
  breadcrumb: <>Disable</>,
}

export async function loader({ request }: DataFunctionArgs) {
  await requireUserId(request)
  return json({})
}

export async function action({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)

  await db.verification.delete({
    where: { target_type: { target: userId, type: twoFAVerificationType } },
  })

  throw await redirectWithToast('/settings/profile/two-factor', {
    title: '2FA Disabled',
    description: 'Two factor authentication has been disabled.',
  })
}

export default function TwoFactorDisableRoute() {
  const isPending = useIsPending()
  const dc = useDoubleCheck()

  return (
    <div className="mx-auto max-w-sm">
      <Form method="POST">
        <AuthenticityTokenInput />
        <p>
          Disabling two factor authentication is not recommended. However, if
          you would like to do so, click here:
        </p>
        <Button
          variant="destructive"
          disabled={isPending}
          {...dc.getButtonProps({
            className: 'mx-auto',
            name: 'intent',
            value: 'disable',
            type: 'submit',
          })}
        >
          {dc.doubleCheck ? 'Are you sure?' : 'Disable 2FA'}
        </Button>
      </Form>
    </div>
  )
}
