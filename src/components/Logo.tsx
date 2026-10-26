import { useId } from "react";

/** Logo « Carburants Réunion » : pompe à essence en line art, goutte en dégradé SP98 → E85
 *  avec une feuille de canne. Les traits suivent la couleur du texte (currentColor), donc le thème.
 *  Mêmes tracés que public/brand/logo-*.svg. */
export default function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <defs>
        <linearGradient id={id} x1="17" y1="27" x2="31" y2="47" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--s1, #2a78d6)" />
          <stop offset="1" stopColor="var(--s3, #1baf7a)" />
        </linearGradient>
      </defs>
      <g stroke="currentColor" strokeWidth="2.6">
        <path d="M10 54V14a6 6 0 0 1 6-6h16a6 6 0 0 1 6 6v40" />
        <path d="M5.5 54h37" />
        <rect x="15" y="13" width="18" height="10" rx="2.5" />
        <path d="M19.5 18h9" strokeWidth="2" opacity="0.55" />
        <path d="M38 30h4a4 4 0 0 1 4 4v8.5a4 4 0 0 0 8 0V22" />
        <rect x="50.5" y="13" width="7" height="9" rx="2.2" />
        <path d="M52.6 13l-3.6-4.6" />
      </g>
      <g stroke={`url(#${id})`} strokeWidth="2.6">
        <path d="M24 27.5c3.9 4.9 7 8.8 7 12.5a7 7 0 0 1-14 0c0-3.7 3.1-7.6 7-12.5z" />
        <path d="M20.8 44.2c0-4.3 3.1-7.4 7.2-7.4 0 4.2-3.1 7.4-7.2 7.4z" strokeWidth="2.2" />
        <path d="M20.8 44.2l3.9-3.9" strokeWidth="1.8" />
      </g>
    </svg>
  );
}
