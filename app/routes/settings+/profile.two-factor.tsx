import { Outlet } from '@remix-run/react'
import type { VerificationTypes } from '../_auth+/verify.tsx'

export const handle = {
  breadcrumb: <>2FA</>,
}

export const twoFAVerificationType = '2fa' satisfies VerificationTypes

export default function TwoFactorRoute() {
  return <Outlet />
}
