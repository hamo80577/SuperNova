import { redirect } from "next/navigation";

// /admin/users was a duplicate of /users (both rendered the same UsersAreaPage).
// User management is now unified under /users, which already scopes what each
// role sees via backend permissions. Redirect to keep any old links working.
export default function AdminUsersPage() {
  redirect("/users");
}
