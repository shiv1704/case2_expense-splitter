"use server";

import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function settleUp(
  groupId: string,
  toUserId: string,
  amount: number
): Promise<{ error: string | null }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  const isMember = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: user.id } },
  });
  if (!isMember) return { error: "Not a member of this group" };

  await prisma.settlement.create({
    data: {
      group_id: groupId,
      from_user: user.id,
      to_user: toUserId,
      amount,
      created_by: user.id,
    },
  });

  return { error: null };
}
