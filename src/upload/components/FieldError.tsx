import { ExclamationCircleIcon } from "@heroicons/react/20/solid";

export default function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
      <ExclamationCircleIcon className="h-3.5 w-3.5 shrink-0" />
      {error}
    </p>
  );
}
