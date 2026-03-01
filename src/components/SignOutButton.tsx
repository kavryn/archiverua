"use client";
import { signOutAction } from "@/actions/auth";
import { useNavigationGuard } from "@/context/NavigationGuardContext";

export default function SignOutButton({ className }: { className?: string }) {
  const { isGuarded } = useNavigationGuard();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (isGuarded() && !window.confirm("Незбережені дані будуть втрачені. Виходити?")) {
      e.preventDefault();
    }
  }

  return (
    <form action={signOutAction} onSubmit={handleSubmit}>
      <button type="submit" className={className}>
        Вийти
      </button>
    </form>
  );
}
