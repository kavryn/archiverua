import GitHubIcon from "./icons/GitHubIcon";

export default function AppFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-100 px-4 py-4 sm:px-16">
      <div className="flex items-center justify-center sm:justify-end">
        <p className="flex items-center gap-1.5 text-sm text-zinc-600">
          <GitHubIcon className="h-3.5 w-3.5 shrink-0 fill-current text-zinc-900" />
          Код доступний на{" "}
          <a
            href="https://github.com/kavryn/archiverua"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >GitHub</a>
        </p>
      </div>
    </footer>
  );
}
