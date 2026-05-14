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
          className="text-sm text-[#6B7280] hover:text-[#1A1A2E]"
        >
          ← Back to dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-[#1A1A2E]">Join a group</h1>
        <p className="mb-6 text-sm text-[#6B7280]">
          Enter the 6-character invite code shared by a group member.
        </p>

        <form action={joinGroup} className="space-y-4">
          {params.error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
              {params.error}
            </div>
          )}
          <div>
            <label
              htmlFor="invite_code"
              className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
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
              className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 font-mono text-sm uppercase tracking-widest text-[#1A1A2E] placeholder:normal-case placeholder:tracking-normal placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-[#1B7DF0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1567CC] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/40"
          >
            Join group
          </button>
        </form>
      </div>
    </div>
  );
}
