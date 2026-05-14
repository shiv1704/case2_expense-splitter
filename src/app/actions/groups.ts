"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function createGroup(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  if (!name) redirect("/groups/new?error=Name+is+required");

  const user = await getAuthUser();
  if (!user) redirect("/login");

  const invite_code = randomBytes(3).toString("hex").toUpperCase();

  const group = await prisma.group.create({
    data: {
      name,
      invite_code,
      created_by: user.id,
      members: { create: { user_id: user.id } },
    },
  });

  redirect(`/groups/${group.id}`);
}

export async function joinGroup(formData: FormData) {
  const invite_code = (formData.get("invite_code") as string)
    .trim()
    .toUpperCase();
  if (!invite_code) redirect("/groups/join?error=Invite+code+is+required");

  const user = await getAuthUser();
  if (!user) redirect("/login");

  const group = await prisma.group.findUnique({ where: { invite_code } });
  if (!group) redirect("/groups/join?error=Invalid+invite+code");

  await prisma.groupMember.upsert({
    where: { group_id_user_id: { group_id: group.id, user_id: user.id } },
    update: {},
    create: { group_id: group.id, user_id: user.id },
  });

  redirect(`/groups/${group.id}`);
}

export async function deleteGroup(
  groupId: string
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return { error: "Group not found" };
  if (group.created_by !== user.id)
    return { error: "Only the group creator can delete it" };

  await prisma.group.delete({ where: { id: groupId } });
  return {};
}

export async function leaveGroup(
  groupId: string
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  await prisma.groupMember.deleteMany({
    where: { group_id: groupId, user_id: user.id },
  });
  return {};
}

export async function renameGroup(
  groupId: string,
  name: string
): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Not authenticated" };

  const member = await prisma.groupMember.findUnique({
    where: { group_id_user_id: { group_id: groupId, user_id: user.id } },
  });
  if (!member) return { error: "Not a member of this group" };

  await prisma.group.update({ where: { id: groupId }, data: { name } });
  return {};
}
