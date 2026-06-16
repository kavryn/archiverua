import { auth } from "@/auth";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import AuthButton from "@/components/AuthButton";
import UploadWizard from "@/upload/components/UploadWizard";
import UploadGateNotice from "@/upload/components/UploadGateNotice";
import LogoIcon from "@/components/icons/LogoIcon";
import { getUploadAvailableFrom, isUploadAllowed } from "@/lib/wikimedia";

export default async function Home() {
  const session = await auth();
  const directUploadEnabled = process.env.DIRECT_UPLOAD !== "false";

  if (session?.user) {
    // Gate accounts that aren't autoconfirmed yet: they'd otherwise fail only at
    // the final publish step (captcha / abuse filter 281 on PDF uploads). The
    // eligibility date is cached per user, so this is network-free after the
    // first render. Fail open on a lookup error — the upload flow still throws
    // UploadNotAllowedError as a backstop if the account really can't publish.
    let availableFrom: string | null = null;
    if (session.user?.id && session.accessToken) {
      try {
        availableFrom = await getUploadAvailableFrom(session.user.id, session.accessToken);
      } catch (err) {
        console.error("[Home] upload eligibility lookup failed", err);
      }
    }

    return (
      <div className="page-shell">
        <AppHeader />
        <main className="page-content py-4">
          {isUploadAllowed(availableFrom) ? (
            <UploadWizard directUploadEnabled={directUploadEnabled} />
          ) : (
            <UploadGateNotice availableFrom={availableFrom} />
          )}
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
