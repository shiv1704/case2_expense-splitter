import Link from "next/link";
import { joinGroup } from "@/app/actions/groups";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function JoinGroupPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-zinc-900">
          Join a group
        </h1>

        <form action={joinGroup} className="space-y-4">
          {params.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {params.error}
            </div>
          )}
          <div>
            <label
              htmlFor="invite_code"
              className="mb-1.5 block text-sm font-medium text-zinc-700"
            >
              Invite code
            </label>
            <input
              id="invite_code"
              name="invite_code"
              type="text"
              required
              autoFocus
              autoCapitalize="characters"
              placeholder="e.g. A1B2C3"
              maxLength={6}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm uppercase text-zinc-900 placeholder:normal-case placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-200"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2"
          >
            Join group
          </button>
        </form>
      </div>
    </div>
  );
}
