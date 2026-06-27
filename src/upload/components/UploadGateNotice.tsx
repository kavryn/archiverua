const UAGENEALOGY_GROUP_URL = "https://www.facebook.com/groups/UAGenealogy";

function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "long" }).format(date);
}

// Shown instead of the upload wizard when the signed-in account is not yet
// autoconfirmed. Until then Wikimedia blocks its uploads (captcha + abuse
// filter 281), but the account becomes eligible automatically after 4 days.
export default function UploadGateNotice({ availableFrom }: { availableFrom: string | null }) {
  const formatted = availableFrom ? formatDate(availableFrom) : null;

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-5 flex flex-col gap-3">
      <h2 className="font-semibold text-gray-900">Завантаження поки недоступне</h2>
      <p className="text-sm text-gray-700">
        Завантаження PDF файлів стає доступним лише через 4 дні після реєстрації акаунта
        (це обмеження Вікімедіа для захисту від спаму).
        {formatted ? <> Для вашого акаунта це орієнтовно {formatted}.</> : null}
      </p>
      <p className="text-sm text-gray-700">
        Якщо потрібно завантажити архівні справи раніше, можна попросити про це інших учасників
        спільноти в групі{" "}
        <a
          href={UAGENEALOGY_GROUP_URL}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-blue-600 hover:underline"
        >
          UAGenealogy
        </a>{" "}
        у Facebook.
      </p>
    </div>
  );
}
