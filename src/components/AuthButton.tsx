import { auth, signIn, signOut } from "@/auth";

export default async function AuthButton() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <span className="text-base text-zinc-700">
          Вітаємо, {session.user.name}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-full border border-solid border-black/[.08] px-4 py-2 text-base transition-colors hover:border-transparent hover:bg-black/[.04]"
          >
            Вийти
          </button>
        </form>
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
