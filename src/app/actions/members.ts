"use server";

import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export type UserSearchResult = {
  id: string;
  name: string;
  email: string;
};

export async function searchUsers(
  groupId: string,
  query: string
): Promise<{ results: UserSearchResult[]; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { results: [], error: "Not authenticated" };

  // Only members may search (prevents email enumeration by outsiders)
  const membership = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: user.id } },
  });
  if (!membership) return { results: [], error: "Not a member of this group" };

  const q = query.trim();
  if (q.length < 2) return { results: [] };

  // Exclude users already in the group
  const existing = await prisma.groupMember.findMany({
    where: { group_id: groupId },
    select: { user_id: true },
  });
  const excludeIds = existing.map((m) => m.user_id);

  const users = await prisma.user.findMany({
    where: {
      id: { notIn: excludeIds },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 8,
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return { results: users };
}

export async function addMemberToGroup(
  groupId: string,
  userId: string
): Promise<{ error?: string }> {
  const caller = await getAuthUser();
  if (!caller) return { error: "Not authenticated" };

  // Only existing members may add people
  const callerMembership = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: caller.id } },
  });
  if (!callerMembership) return { error: "You are not a member of this group" };

  const [group, target] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.user.findUnique({ where: { id: userId } }),
  ]);
  if (!group) return { error: "Group not found" };
  if (!target) return { error: "User not found" };

  await prisma.groupMember.upsert({
    where: { group_id_user_id: { group_id: groupId, user_id: userId } },
    update: {},
    create: { group_id: groupId, user_id: userId },
  });

  return {};
}
