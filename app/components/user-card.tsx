import { Link } from '@remix-run/react'
import { getUserImgSrc } from '~/utils/misc.tsx'

export default function UserCard({
  user,
}: {
  user: {
    username: string
    name: string | null
    imageId: string | null
  }
}) {
  return (
    <li className="w-full sm:w-64">
      <Link
        to={user.username}
        className="flex w-full flex-col items-center justify-center gap-4 rounded-lg bg-muted px-5 pb-8 pt-6"
      >
        <img
          alt={user.name ?? user.username}
          src={getUserImgSrc(user.imageId)}
          className="aspect-square h-20 rounded-full"
        />
        <div className="flex flex-col gap-1">
          {user.name ? (
            <span className="w-full truncate text-center text-body-md">
              {user.name}
            </span>
          ) : null}
          <span className="w-full overflow-hidden text-ellipsis text-center text-body-sm text-muted-foreground">
            {user.username}
          </span>
        </div>
      </Link>
    </li>
  )
}
