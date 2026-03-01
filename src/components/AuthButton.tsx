import { auth, signIn } from "@/auth";
import SignOutButton from "@/components/SignOutButton";
import { UserCircleIcon } from "@heroicons/react/24/solid";

export default async function AuthButton() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <UserCircleIcon className="hidden sm:block h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="hidden sm:inline text-base text-zinc-700">{session.user.name}</span>
        <span className="hidden sm:inline text-zinc-300" aria-hidden="true">·</span>
        <SignOutButton className="text-base text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer" />
      </div>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("wikimedia");
      }}
    >
      <button
        type="submit"
        className="rounded-full bg-foreground px-5 py-2 text-base font-medium text-background transition-colors hover:bg-[#383838]"
      >
        Авторизуватись
      </button>
    </form>
  );
}
