import { prisma } from "@/lib/prisma";

type RecurrenceRule = "MONTHLY" | "WEEKLY" | "BIWEEKLY" | "YEARLY";

function advanceDate(from: Date, rule: RecurrenceRule, day: number | null): Date {
  const d = new Date(from);
  switch (rule) {
    case "MONTHLY": {
      const targetDay = day ?? 1;
      d.setMonth(d.getMonth() + 1);
      // Cap at actual last day of the resulting month (handles Jan 31 → Feb 28 etc.)
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(targetDay, lastDay));
      return d;
    }
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      return d;
    case "BIWEEKLY":
      d.setDate(d.getDate() + 14);
      return d;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      return d;
  }
}

export async function checkAndGenerateRecurring(groupId: string): Promise<number> {
  const now = new Date();

  const due = await prisma.expense.findMany({
    where: {
      group_id: groupId,
      is_recurring: true,
      next_due_date: { lte: now },
    },
    include: { splits: true },
  });

  let generated = 0;

  for (const anchor of due) {
    const dueDate = anchor.next_due_date!;
    const rule = anchor.recurrence_rule as RecurrenceRule;

    const newExpense = await prisma.expense.create({
      data: {
        group_id: anchor.group_id,
        paid_by: anchor.paid_by,
        title: anchor.title,
        total_amount: anchor.total_amount,
        split_type: anchor.split_type,
        created_at: dueDate,
        is_recurring: false,
        parent_expense_id: anchor.id,
        recurrence_anchor_id: anchor.recurrence_anchor_id ?? anchor.id,
        splits: {
          create: anchor.splits.map((s) => ({
            user_id: s.user_id,
            amount: s.amount,
            percentage: s.percentage,
          })),
        },
      },
    });

    await prisma.recurringLog.create({
      data: {
        expense_id: newExpense.id,
        anchor_id: anchor.id,
        due_date: dueDate,
        status: "AUTO_GENERATED",
      },
    });

    const next = advanceDate(dueDate, rule, anchor.recurrence_day);
    await prisma.expense.update({
      where: { id: anchor.id },
      data: { next_due_date: next },
    });

    generated++;
  }

  return generated;
}
