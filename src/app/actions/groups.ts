"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function createGroup(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  if (!name) redirect("/groups/new?error=Name+is+required");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const invite_code = randomBytes(3).toString("hex").toUpperCase(); // 6-char hex

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const group = await prisma.group.findUnique({ where: { invite_code } });
  if (!group) redirect("/groups/join?error=Invalid+invite+code");

  // upsert is safe if the user is already a member
  await prisma.groupMember.upsert({
    where: { group_id_user_id: { group_id: group.id, user_id: user.id } },
    update: {},
    create: { group_id: group.id, user_id: user.id },
  });

  redirect(`/groups/${group.id}`);
}
