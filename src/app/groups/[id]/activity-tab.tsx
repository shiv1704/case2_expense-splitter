"use client";

import { CheckCircle, ReceiptText } from "lucide-react";

export type ActivityEvent =
  | {
      type: "expense";
      id: string;
      title: string;
      payerName: string;
      amount: number;
      date: string;
    }
  | {
      type: "settlement";
      id: string;
      fromName: string;
      toName: string;
      amount: number;
      date: string;
    };

type Props = {
  events: ActivityEvent[];
};

export function ActivityTab({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1B7DF0]/10 text-2xl">
          📋
        </div>
        <p className="text-sm text-[#6B7280]">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="relative pl-8">
      {/* Vertical timeline line */}
      <div className="absolute left-3 top-3 bottom-3 w-px bg-[#E5E7EB]" />

      <ul className="space-y-4">
        {events.map((event) => (
          <li key={`${event.type}-${event.id}`} className="relative">
            {/* Dot on the timeline */}
            <div
              className={`absolute -left-5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${
                event.type === "settlement" ? "bg-[#10B981]" : "bg-[#1B7DF0]"
              }`}
            >
              {event.type === "settlement" ? (
                <CheckCircle className="h-3 w-3 text-white" />
              ) : (
                <ReceiptText className="h-3 w-3 text-white" />
              )}
            </div>

            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 transition hover:shadow-sm">
              {event.type === "expense" ? (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#1A1A2E]">
                      {event.title}
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {event.payerName} paid
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#1A1A2E]">
                    ${event.amount.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[#10B981]">
                      Settlement
                    </p>
                    <p className="text-xs text-[#6B7280]">
                      {event.fromName} → {event.toName}
                    </p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-[#10B981]">
                    ${event.amount.toFixed(2)}
                  </span>
                </div>
              )}
              <p className="mt-1 text-xs text-[#6B7280]">
                {new Date(event.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
