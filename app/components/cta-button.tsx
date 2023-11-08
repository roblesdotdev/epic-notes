import { Link } from '@remix-run/react'
import { Button } from './ui/button.tsx'
import { useTheme } from '~/utils/theme.ts'

export default function CTAButton() {
  const theme = useTheme()

  return (
    <Button
      size="lg"
      variant={theme === 'light' ? 'default' : 'secondary'}
      asChild
    >
      <Link
        to="/users"
        className="inline-flex items-center justify-center gap-2"
      >
        <span>Get Started {theme}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="inline h-4 w-4"
          fill="none"
          viewBox="0 0 65 65"
        >
          <path
            fill="currentColor"
            d="M39.445 25.555 37 17.163 65 0 47.821 28l-8.376-2.445Zm-13.89 0L28 17.163 0 0l17.179 28 8.376-2.445Zm13.89 13.89L37 47.837 65 65 47.821 37l-8.376 2.445Zm-13.89 0L28 47.837 0 65l17.179-28 8.376 2.445Z"
          />
        </svg>
      </Link>
    </Button>
  )
}
