import { auth } from "@/auth";
import AuthButton from "@/components/AuthButton";
import UploadForm from "@/components/UploadForm";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
        <header className="flex items-center justify-between border-b border-zinc-200 px-16 py-4 dark:border-zinc-800">
          <h1 className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Вікіархіватор
          </h1>
          <AuthButton />
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-16 py-12">
          <UploadForm />
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 px-16 py-32">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Вікіархіватор
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Найлегший спосіб опублікувати справи з українських архівів на Wikimedia Commons.
        </p>
        <AuthButton />
      </main>
    </div>
  );
}
