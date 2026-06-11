import { getUserProfile } from "@/lib/authRoles";

export async function getUserRole(user) {
  const profile = await getUserProfile(user);

  return profile.role;
}
