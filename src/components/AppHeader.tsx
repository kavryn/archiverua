import AuthButton from "@/components/AuthButton";

export default function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-16 py-4">
      <div className="flex items-end gap-6">
        <a href="/" className="text-3xl font-semibold tracking-tight text-black">
          Вікіархіватор
          <span className="ml-1.5 inline-block align-super rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-blue-600">
            beta
          </span>
        </a>
        <a href="/my-files" className="text-base text-zinc-500 hover:text-zinc-800">
          Мої файли
        </a>
      </div>
      <AuthButton />
    </header>
  );
}
