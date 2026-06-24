import type { Session } from "next-auth";

export type Role = "admin" | "staff" | "artist";

export function getRole(session: Session | null): Role | null {
  const role = session?.user?.role;
  if (role === "admin" || role === "staff" || role === "artist") return role;
  return null;
}

export function isStaff(session: Session | null): boolean {
  const role = getRole(session);
  return role === "admin" || role === "staff";
}

export function isAdmin(session: Session | null): boolean {
  return getRole(session) === "admin";
}

export function isArtist(session: Session | null): boolean {
  return getRole(session) === "artist";
}

export function assertStaff(session: Session | null): void {
  if (!isStaff(session)) throw new Error("Geen toegang");
}

export function assertAdmin(session: Session | null): void {
  if (!isAdmin(session)) throw new Error("Alleen admin");
}
