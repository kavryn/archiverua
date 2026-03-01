import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import AuthButton from "@/components/AuthButton";
import UploadWizard from "@/upload/components/UploadWizard";
import LogoIcon from "@/components/icons/LogoIcon";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    return (
      <div className="page-shell">
        <AppHeader />
        <main className="page-content py-4">
          <UploadWizard />
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="flex flex-1 flex-col items-center justify-center">
        <main className="page-content py-32">
          <h1 className="flex items-center gap-3 text-4xl font-semibold tracking-tight text-black">
            <LogoIcon className="h-8 w-auto" /> Вікіархіватор
          </h1>
          <p className="text-xl leading-8 text-zinc-600">
            Допоможе опублікувати справи з українських архівів на Вікісховищі та Вікіджерелах
          </p>
          <AuthButton />
        </main>
      </div>
      <AppFooter />
    </div>
  );
}
