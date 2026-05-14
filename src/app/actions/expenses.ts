"use server";

import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SplitType } from "@/generated/prisma/enums";

type SplitInput = {
  user_id: string;
  amount: number;
  percentage: number | null;
};

export async function addExpense(
  groupId: string,
  formData: FormData
): Promise<{ error: string | null }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  // --- Parse inputs ---
  const title = (formData.get("title") as string | null)?.trim();
  const totalAmountRaw = formData.get("total_amount") as string | null;
  const paid_by = formData.get("paid_by") as string | null;
  const splitTypeRaw = formData.get("split_type") as string | null;
  const splitsJson = formData.get("splits_json") as string | null;

  if (!title) return { error: "Title is required" };

  const totalAmount = parseFloat(totalAmountRaw ?? "");
  if (isNaN(totalAmount) || totalAmount <= 0)
    return { error: "Amount must be greater than zero" };

  if (!paid_by) return { error: "Payer is required" };

  const validTypes: string[] = ["EQUAL", "PERCENTAGE", "FIXED"];
  if (!splitTypeRaw || !validTypes.includes(splitTypeRaw))
    return { error: "Invalid split type" };
  const splitType = splitTypeRaw as SplitType;

  // --- Parse splits ---
  let splits: SplitInput[];
  try {
    splits = JSON.parse(splitsJson ?? "");
    if (!Array.isArray(splits) || splits.length === 0) throw new Error();
  } catch {
    return { error: "Invalid split data" };
  }

  for (const s of splits) {
    if (typeof s.user_id !== "string" || !s.user_id)
      return { error: "Invalid split: missing user_id" };
    if (typeof s.amount !== "number" || isNaN(s.amount))
      return { error: "Invalid split: amount must be a number" };
    if (s.amount < 0) return { error: "Split amounts cannot be negative" };
    if (splitType === "PERCENTAGE") {
      if (s.percentage === null || s.percentage === undefined)
        return { error: "Invalid split: missing percentage" };
      if (typeof s.percentage !== "number" || isNaN(s.percentage))
        return { error: "Invalid split: percentage must be a number" };
      if (s.percentage < 0) return { error: "Percentages cannot be negative" };
    }
  }

  // --- Membership guard ---
  const memberRows = await prisma.groupMember.findMany({
    where: { group_id: groupId },
    select: { user_id: true },
  });
  const memberIds = new Set(memberRows.map((r) => r.user_id));

  if (!memberIds.has(user.id)) return { error: "You are not a member of this group" };
  if (!memberIds.has(paid_by)) return { error: "Payer is not a group member" };
  for (const s of splits) {
    if (!memberIds.has(s.user_id))
      return { error: `Split recipient ${s.user_id} is not a group member` };
  }

  // --- Split-type validation (server is authoritative) ---
  if (splitType === "PERCENTAGE") {
    const pctTotal = splits.reduce((sum, s) => sum + (s.percentage ?? 0), 0);
    if (Math.abs(pctTotal - 100) > 0.01)
      return {
        error: `Percentages must sum to 100 (got ${pctTotal.toFixed(2)})`,
      };
    // Recompute amounts from percentages — client values are advisory only
    splits = splits.map((s) => ({
      ...s,
      amount: Math.round(((s.percentage! / 100) * totalAmount) * 100) / 100,
    }));
  }

  // For all types, amounts must sum to total (±1 cent tolerance)
  const splitAmountTotal = splits.reduce((sum, s) => sum + s.amount, 0);
  if (Math.abs(splitAmountTotal - totalAmount) > 0.01)
    return {
      error: `Split amounts must sum to ${totalAmount.toFixed(2)} (got ${splitAmountTotal.toFixed(2)})`,
    };

  // --- Persist ---
  try {
    await prisma.expense.create({
      data: {
        group_id: groupId,
        paid_by,
        title,
        total_amount: totalAmount,
        split_type: splitType,
        splits: {
          create: splits.map((s) => ({
            user_id: s.user_id,
            amount: s.amount,
            percentage: s.percentage ?? null,
          })),
        },
      },
    });
    return { error: null };
  } catch (err) {
    console.error("addExpense:", err);
    return { error: "Failed to save expense. Please try again." };
  }
}
