import type { MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => {
  return [
    { title: 'Epic Notes' },
    { name: 'description', content: 'Welcome to Epic Notes App!' },
  ]
}

export default function Index() {
  return (
    <div className="flex flex-col justify-center px-4 py-12 gap-2 max-w-2xl mx-auto">
      <h1 className="flex flex-col font-bold text-3xl">
        <span>All yuor notes.</span>
        <span>Organized.</span> <span>Effortless.</span>
      </h1>
      <p>
        Inspiration strikes anywhere.{' '}
        <span className="font-medium">Epic notes</span> lets you capture,
        organize and share your ideas accross any device.
      </p>
      <button className="px-6 py-3 bg-black text-white self-start font-medium mt-2">
        Get Started
      </button>
    </div>
  )
}
