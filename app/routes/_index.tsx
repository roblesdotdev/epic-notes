import type { MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => {
  return [
    { title: 'Epic Notes' },
    { name: 'description', content: 'Welcome to Epic Notes App!' },
  ]
}

export default function Index() {
  return (
    <div className="px-6 pt-10 lg:px-8">
      <div className="mx-auto max-w-2xl py-32 sm:py-48">
        <h1 className="flex flex-col text-4xl font-bold sm:text-6xl">
          <span>All yuor notes.</span>
          <span>Organized.</span> <span>Effortless.</span>
        </h1>
        <p className="mt-4 leading-6 text-gray-700 sm:text-lg">
          Inspiration strikes anywhere.{' '}
          <span className="font-medium">Epic notes</span> lets you capture,
          organize and share your ideas accross any device.
        </p>
        <div className="mt-2">
          <button className="mt-2 self-start rounded-lg bg-black px-6 py-3 font-medium text-white">
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
