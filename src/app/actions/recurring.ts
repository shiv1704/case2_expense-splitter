"use server";

import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type RecurringExpense = {
  id: string;
  title: string;
  total_amount: number;
  recurrence_rule: string;
  recurrence_day: number | null;
  next_due_date: string | null;
  payer_name: string;
};

export async function getRecurringExpenses(
  groupId: string
): Promise<{ data: RecurringExpense[]; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { data: [], error: "Not authenticated" };

  const expenses = await prisma.expense.findMany({
    where: { group_id: groupId, is_recurring: true },
    include: { payer: { select: { name: true } } },
    orderBy: { created_at: "asc" },
  });

  return {
    data: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      total_amount: Number(e.total_amount),
      recurrence_rule: e.recurrence_rule ?? "MONTHLY",
      recurrence_day: e.recurrence_day,
      next_due_date: e.next_due_date?.toISOString() ?? null,
      payer_name: e.payer.name,
    })),
  };
}

export async function pauseRecurring(
  expenseId: string
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { group_id: true },
  });
  if (!expense) return { error: "Expense not found" };

  const member = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: expense.group_id, user_id: user.id } },
  });
  if (!member) return { error: "Not a member of this group" };

  await prisma.expense.update({
    where: { id: expenseId },
    data: { next_due_date: null },
  });
  return {};
}

export async function resumeRecurring(
  expenseId: string,
  nextDueDate: string
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { group_id: true },
  });
  if (!expense) return { error: "Expense not found" };

  const member = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: expense.group_id, user_id: user.id } },
  });
  if (!member) return { error: "Not a member of this group" };

  await prisma.expense.update({
    where: { id: expenseId },
    data: { next_due_date: new Date(nextDueDate) },
  });
  return {};
}

export async function deleteRecurringSeries(
  expenseId: string
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    select: { group_id: true },
  });
  if (!expense) return { error: "Expense not found" };

  const member = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: expense.group_id, user_id: user.id } },
  });
  if (!member) return { error: "Not a member of this group" };

  // Remove recurring flag from anchor — keeps past expenses, stops future auto-generation
  await prisma.expense.update({
    where: { id: expenseId },
    data: {
      is_recurring: false,
      recurrence_rule: null,
      recurrence_day: null,
      next_due_date: null,
    },
  });
  return {};
}
