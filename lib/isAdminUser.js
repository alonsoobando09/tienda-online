import { getUserRole } from "@/lib/getUserRole";

const ADMIN_EMAILS = ["alriver1995zit@gmail.com"];

export async function isAdminUser(user) {
  if (!user) return false;

  if (ADMIN_EMAILS.includes(user.email)) {
    return true;
  }

  const token = await user.getIdTokenResult(true);

  if (token.claims.admin === true) {
    return true;
  }

  const rol = await getUserRole(user.uid);

  return rol === "admin";
}
