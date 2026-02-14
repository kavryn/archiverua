import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import AuthButton from "@/components/AuthButton";
import UploadForm from "@/components/UploadForm";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="page-shell">
        <AppHeader />
        <main className="page-content py-4">
          <UploadForm />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell items-center justify-center">
      <main className="page-content py-32">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Вікіархіватор
          <span className="ml-1.5 inline-block align-super rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-semibold tracking-wide text-blue-600 dark:bg-blue-900/40 dark:text-blue-400">
            beta
          </span>
        </h1>
        <p className="text-xl leading-8 text-zinc-600 dark:text-zinc-400">
          Найшвидший спосіб опублікувати справи з українських архівів на Вікісховищі та Вікіджерелах
        </p>
        <AuthButton />
      </main>
    </div>
  );
}
