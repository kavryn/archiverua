export default function LogoIcon({ className }: { className?: string }) {
  // Inline the UI logo to avoid a layout shift while an external SVG loads.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 900 1000"
      className={className}
      width="1em"
      height="1em"
      aria-hidden="true"
    >
      <polygon points="40,955 40,445 860,325 860,835" fill="#de585c" />
      <polygon points="40,955 40,325 660,185 660,815" fill="#efa345" />
      <polygon points="40,955 40,205 490,45 490,795" fill="#499bcf" />
    </svg>
  );
}
