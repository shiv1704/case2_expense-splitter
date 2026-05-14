import Link from "next/link";
import { register } from "@/app/actions/auth";

const FEATURES = [
  ["💰", "Split expenses equally or by custom amounts"],
  ["⚖️", "Smart balance netting — minimized transactions"],
  ["📱", "Settle via UPI — GPay, PhonePe, Paytm"],
];

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function RegisterPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="flex min-h-screen">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-3/5 flex-col items-center justify-center bg-gradient-to-br from-[#0F172A] to-[#1B7DF0] p-12 text-white">
        <div className="max-w-sm">
          <h1 className="text-5xl font-extrabold tracking-tight">Pocket</h1>
          <p className="mt-3 text-xl text-white/70">Split bills. Stay friends.</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(([emoji, text]) => (
              <li key={text} className="flex items-center gap-4">
                <span className="text-2xl">{emoji}</span>
                <span className="text-base text-white/85">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile-only logo */}
          <div className="mb-8 text-center lg:hidden">
            <h1 className="text-4xl font-extrabold text-[#1B7DF0]">Pocket</h1>
            <p className="mt-2 text-sm text-[#6B7280]">Split bills. Stay friends.</p>
          </div>

          <h2 className="mb-6 text-2xl font-bold text-[#1A1A2E]">
            Create account
          </h2>

          {params.error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
              {params.error}
            </div>
          )}

          <form action={register} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
              >
                Full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                autoFocus
                autoComplete="name"
                placeholder="Your name"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[#1A1A2E]"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                minLength={8}
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#1B7DF0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1567CC] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/40"
            >
              Create account
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#6B7280]">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#1B7DF0] hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
