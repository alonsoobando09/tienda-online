import { getUserProfile } from "@/lib/authRoles";

export async function isAdminUser(user) {
  const profile = await getUserProfile(user);

  return profile.isAdmin;
}
