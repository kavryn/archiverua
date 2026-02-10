import AuthButton from "@/components/AuthButton";

export default async function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-8 px-16 py-32">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          ArchiverUA
        </h1>
        <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Інструмент для архівування матеріалів на Wikimedia Commons.
        </p>
        <AuthButton />
      </main>
    </div>
  );
}
