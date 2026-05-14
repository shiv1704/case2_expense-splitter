import Link from "next/link";
import { createGroup } from "@/app/actions/groups";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewGroupPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-[#6B7280] hover:text-[#1A1A2E]"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-[#1A1A2E]">Create a new group</h1>
        <p className="mb-6 text-sm text-[#6B7280]">
          Invite friends with a 6-character code generated automatically.
        </p>

        <form action={createGroup} className="space-y-4">
          {params.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
              {params.error}
            </div>
          )}
          <div>
            <label
              htmlFor="name"
              className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
            >
              Group name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoFocus
              placeholder="e.g. Beach House 2025"
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#1B7DF0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1567CC] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/40"
          >
            Create group
          </button>
        </form>
      </div>
    </div>
  );
}
