import { sendMagicLink } from "@/app/actions/auth";

type Props = {
  searchParams: Promise<{ sent?: string; error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Pocket</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Split expenses with your roommates
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-zinc-800">Sign in</h2>

          {params.sent ? (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              Check your email — a magic link is on its way.
            </div>
          ) : (
            <form action={sendMagicLink} className="space-y-4">
              {params.error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {params.error}
                </div>
              )}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-zinc-700"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
              >
                Send magic link
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
