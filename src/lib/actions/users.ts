"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { passwordResetTokens, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { assertAdmin } from "@/lib/auth/permissions";
import {
  isMailjetConfigured,
  sendPasswordResetEmail,
} from "@/lib/email/mailjet";

const SALT_ROUNDS = 10;

async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: "admin" | "staff" | "artist";
}) {
  const session = await auth();
  assertAdmin(session);

  const email = data.email.trim().toLowerCase();
  if (!email || data.password.length < 8) {
    throw new Error("E-mail en wachtwoord (min. 8 tekens) zijn verplicht");
  }

  const [user] = await db
    .insert(users)
    .values({
      name: data.name.trim(),
      email,
      passwordHash: await hashPassword(data.password),
      role: data.role,
    })
    .returning();

  revalidatePath("/settings");
  return user;
}

export async function updateUser(
  id: number,
  data: Partial<{
    name: string;
    email: string;
    role: "admin" | "staff" | "artist";
    password: string;
  }>
) {
  const session = await auth();
  assertAdmin(session);

  const payload: Partial<typeof users.$inferInsert> = {};
  if (data.name) payload.name = data.name.trim();
  if (data.email) payload.email = data.email.trim().toLowerCase();
  if (data.role) payload.role = data.role;
  if (data.password) {
    if (data.password.length < 8) throw new Error("Wachtwoord min. 8 tekens");
    payload.passwordHash = await hashPassword(data.password);
  }

  await db.update(users).set(payload).where(eq(users.id, id));
  revalidatePath("/settings");
}

export async function updateOwnProfile(data: {
  name: string;
  email: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  await db
    .update(users)
    .set({
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
    })
    .where(eq(users.id, Number(session.user.id)));

  revalidatePath("/settings");
}

export async function changeOwnPassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Niet ingelogd");

  if (data.newPassword.length < 8) {
    throw new Error("Nieuw wachtwoord moet minimaal 8 tekens zijn");
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .limit(1);
  if (!user) throw new Error("Gebruiker niet gevonden");

  const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!valid) throw new Error("Huidig wachtwoord is onjuist");

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(data.newPassword) })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
}

export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  // Altijd success tonen (geen email-enumeration)
  if (!user) return { ok: true as const, sent: false as const };

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token,
    expiresAt,
  });

  const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
  const resetUrl = `${baseUrl}/reset-password/${token}`;

  if (!isMailjetConfigured()) {
    return { ok: true as const, sent: false as const, mailjet: false as const };
  }

  const result = await sendPasswordResetEmail({
    toEmail: user.email,
    toName: user.name,
    resetUrl,
  });

  return {
    ok: true as const,
    sent: result.ok,
    mailjet: true as const,
  };
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error("Wachtwoord moet minimaal 8 tekens zijn");
  }

  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (!row || row.usedAt) throw new Error("Ongeldige of gebruikte link");
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error("Link is verlopen");
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, row.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date().toISOString() })
    .where(eq(passwordResetTokens.id, row.id));
}

export async function getAllUsers() {
  const session = await auth();
  assertAdmin(session);
  return db.select().from(users).orderBy(users.name);
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .limit(1);
  return user ?? null;
}
