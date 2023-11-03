import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { json, redirect, type DataFunctionArgs } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { ErrorList, Field } from '~/components/forms.tsx'
import { Button } from '~/components/ui/button.tsx'
import { StatusButton } from '~/components/ui/status-button.tsx'
import { requireUserId, sessionKey } from '~/utils/auth.server.ts'
import { validateCSRF } from '~/utils/csrf.server.ts'
import { db } from '~/utils/db.server.ts'
import {
  getUserImgSrc,
  invariantResponse,
  useDoubleCheck,
} from '~/utils/misc.tsx'
import { sessionStorage } from '~/utils/session.server.ts'
import { NameSchema, UsernameSchema } from '~/utils/user-validation.ts'
import { twoFAVerificationType } from './profile.two-factor.tsx'

const ProfileFormSchema = z.object({
  name: NameSchema.optional(),
  username: UsernameSchema,
})

export async function loader({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      image: {
        select: { id: true },
      },
      _count: {
        select: {
          sessions: {
            where: {
              expirationDate: { gt: new Date() },
            },
          },
        },
      },
    },
  })

  const twoFactorVerification = await db.verification.findUnique({
    select: { id: true },
    where: { target_type: { type: twoFAVerificationType, target: userId } },
  })

  return json({ user, isTwoFAEnabled: Boolean(twoFactorVerification) })
}

type ProfileActionArgs = {
  request: Request
  userId: string
  formData: FormData
}
const profileUpdateActionIntent = 'update-profile'
const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
const deleteDataActionIntent = 'delete-data'

export async function action({ request }: DataFunctionArgs) {
  const userId = await requireUserId(request)
  const formData = await request.formData()
  await validateCSRF(formData, request.headers)
  const intent = formData.get('intent')
  switch (intent) {
    case profileUpdateActionIntent: {
      return profileUpdateAction({ request, userId, formData })
    }
    case signOutOfSessionsActionIntent: {
      return signOutOfSessionsAction({ request, userId, formData })
    }
    case deleteDataActionIntent: {
      return deleteDataAction({ request, userId, formData })
    }
    default: {
      throw new Response(`Invalid intent "${intent}"`, { status: 400 })
    }
  }
}

export default function EditUserProfile() {
  const data = useLoaderData<typeof loader>()

  return (
    <div className="flex flex-col gap-12">
      <div className="flex justify-center">
        <div className="relative h-52 w-52">
          <img
            src={getUserImgSrc(data.user.image?.id)}
            alt={data.user.username}
            className="h-full w-full rounded-full object-cover"
          />
          <Button
            asChild
            variant="outline"
            className="absolute -right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full p-0"
          >
            <Link
              preventScrollReset
              to="photo"
              title="Change profile photo"
              aria-label="Change profile photo"
            >
              Photo
            </Link>
          </Button>
        </div>
      </div>
      <UpdateProfile />

      <div className="col-span-6 my-6 h-1 border-b-[1.5px] border-foreground" />
      <div className="col-span-full flex flex-col gap-6">
        <div>
          <Link to="change-email">Change email from {data.user.email}</Link>
        </div>
        <div>
          <Link to="two-factor">
            {data.isTwoFAEnabled ? <>2FA is enabled</> : <>Enable 2FA</>}
          </Link>
        </div>
        <div>
          <Link to="password">Change password</Link>
        </div>
        <div>
          <a
            download="my-epic-notes-data.json"
            href="/resources/download-user-data"
          >
            Download your data
          </a>
        </div>
        <SignOutOfSessions />
        <DeleteData />
      </div>
    </div>
  )
}

async function profileUpdateAction({ userId, formData }: ProfileActionArgs) {
  const submission = await parse(formData, {
    async: true,
    schema: ProfileFormSchema.superRefine(async ({ username }, ctx) => {
      const existingUsername = await db.user.findUnique({
        where: { username },
        select: { id: true },
      })
      if (existingUsername && existingUsername.id !== userId) {
        ctx.addIssue({
          path: ['username'],
          code: 'custom',
          message: 'A user already exists with this username',
        })
      }
    }),
  })
  if (submission.intent !== 'submit') {
    return json({ status: 'idle', submission } as const)
  }
  if (!submission.value) {
    return json({ status: 'error', submission } as const, { status: 400 })
  }

  const data = submission.value

  await db.user.update({
    select: { username: true },
    where: { id: userId },
    data: {
      name: data.name,
      username: data.username,
    },
  })

  return json({ status: 'success', submission } as const)
}

function UpdateProfile() {
  const data = useLoaderData<typeof loader>()

  const fetcher = useFetcher<typeof profileUpdateAction>()

  const [form, fields] = useForm({
    id: 'edit-profile',
    constraint: getFieldsetConstraint(ProfileFormSchema),
    lastSubmission: fetcher.data?.submission,
    onValidate({ formData }) {
      return parse(formData, { schema: ProfileFormSchema })
    },
    defaultValue: {
      username: data.user.username,
      name: data.user.name ?? '',
      email: data.user.email,
    },
  })

  return (
    <fetcher.Form method="POST" {...form.props}>
      <AuthenticityTokenInput />
      <div className="grid grid-cols-6 gap-x-10">
        <Field
          className="col-span-3"
          labelProps={{
            htmlFor: fields.username.id,
            children: 'Username',
          }}
          inputProps={conform.input(fields.username)}
          errors={fields.username.errors}
        />
        <Field
          className="col-span-3"
          labelProps={{ htmlFor: fields.name.id, children: 'Name' }}
          inputProps={conform.input(fields.name)}
          errors={fields.name.errors}
        />
      </div>

      <ErrorList errors={form.errors} id={form.errorId} />

      <div className="mt-8 flex justify-center">
        <Button
          type="submit"
          size="wide"
          name="intent"
          value={profileUpdateActionIntent}
          disabled={fetcher.state !== 'idle'}
        >
          Save changes
        </Button>
      </div>
    </fetcher.Form>
  )
}

async function deleteDataAction({ userId }: ProfileActionArgs) {
  await db.user.delete({ where: { id: userId } })
  return redirect('/')
}

function DeleteData() {
  const dc = useDoubleCheck()

  const fetcher = useFetcher<typeof deleteDataAction>()
  return (
    <div>
      <fetcher.Form method="POST">
        <AuthenticityTokenInput />
        <Button
          {...dc.getButtonProps({
            type: 'submit',
            name: 'intent',
            value: deleteDataActionIntent,
          })}
          variant={dc.doubleCheck ? 'destructive' : 'default'}
          disabled={fetcher.state !== 'idle'}
        >
          {dc.doubleCheck ? `Are you sure?` : `Delete all your data`}
        </Button>
      </fetcher.Form>
    </div>
  )
}

async function signOutOfSessionsAction({ request, userId }: ProfileActionArgs) {
  const cookieSession = await sessionStorage.getSession(
    request.headers.get('cookie'),
  )
  const sessionId = cookieSession.get(sessionKey)
  invariantResponse(
    sessionId,
    'You must be authenticated to sign out of other sessions',
  )
  await db.session.deleteMany({
    where: {
      userId,
      id: { not: sessionId },
    },
  })
  return json({ status: 'success' } as const)
}

function SignOutOfSessions() {
  const data = useLoaderData<typeof loader>()
  const dc = useDoubleCheck()

  const fetcher = useFetcher<typeof signOutOfSessionsAction>()
  const otherSessionsCount = data.user._count.sessions - 1
  return (
    <div>
      {otherSessionsCount ? (
        <fetcher.Form method="POST">
          <AuthenticityTokenInput />
          <StatusButton
            {...dc.getButtonProps({
              type: 'submit',
              name: 'intent',
              value: signOutOfSessionsActionIntent,
            })}
            variant={dc.doubleCheck ? 'destructive' : 'default'}
            status={
              fetcher.state !== 'idle'
                ? 'pending'
                : fetcher.data?.status ?? 'idle'
            }
          >
            {dc.doubleCheck
              ? `Are you sure?`
              : `Sign out of ${otherSessionsCount} other sessions`}
          </StatusButton>
        </fetcher.Form>
      ) : (
        <span>This is your only session</span>
      )}
    </div>
  )
}
