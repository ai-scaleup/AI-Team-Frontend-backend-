import { redirect } from 'next/navigation';

export default function RedirectToNewAdmin() {
  redirect('/dashboard/admin/users');
}
