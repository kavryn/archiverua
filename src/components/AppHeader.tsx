import AuthButton from "@/components/AuthButton";

export default function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-16 py-4 dark:border-zinc-800">
      <div className="flex items-center gap-6">
        <a href="/" className="text-xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Вікіархіватор
        </a>
        <a href="/my-files" className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100">
          Мої файли
        </a>
      </div>
      <AuthButton />
    </header>
  );
}
