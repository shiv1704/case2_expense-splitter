"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { loginAsDemo } from "@/app/actions/demo";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-12">
      <div className="w-full max-w-[400px] space-y-4">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-[#1B7DF0]">Pocket</h1>
          <p className="mt-2 text-sm text-[#6B7280]">Split bills. Stay friends.</p>
        </div>

        {/* Sign in card */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-bold text-[#1A1A2E]">Sign in</h2>

          {state.error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-[#EF4444]">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
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
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm text-[#1A1A2E] placeholder:text-[#6B7280] focus:border-[#1B7DF0] focus:outline-none focus:ring-2 focus:ring-[#1B7DF0]/20"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-lg bg-[#1B7DF0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1567CC] disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-[#6B7280]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#1B7DF0] hover:underline"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Demo accounts */}
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-widest text-[#6B7280]">
            Try a demo account
          </p>
          <div className="space-y-2">
            {(
              [
                { key: "alice",   label: "Alice",   sub: "alice@demo.com"   },
                { key: "bob",     label: "Bob",     sub: "bob@demo.com"     },
                { key: "charlie", label: "Charlie", sub: "charlie@demo.com" },
              ] as const
            ).map(({ key, label, sub }) => (
              <form key={key} action={loginAsDemo.bind(null, key)}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] px-4 py-3 text-left transition hover:border-[#1B7DF0]/40 hover:bg-white"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B7DF0]/10 text-sm font-bold text-[#1B7DF0]">
                    {label[0]}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#1A1A2E]">
                      {label}
                    </span>
                    <span className="block text-xs text-[#6B7280]">{sub}</span>
                  </span>
                  <span className="ml-auto text-sm text-[#1B7DF0]">→</span>
                </button>
              </form>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
