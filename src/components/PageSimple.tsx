import Link from "next/link";
import type { ReactNode } from "react";

/** Gabarit des pages hors tableau de bord : questionnaire, confidentialité, admin. */
export default function PageSimple({ titre, sousTitre, children, large }: { titre: string; sousTitre?: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${large ? "max-w-[1480px]" : "max-w-3xl"}`}>
      <header className="flex items-center justify-between gap-3 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-plane">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M3 20h12M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3M7 8h4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Carburants Réunion</span>
        </Link>
        <Link href="/" className="text-[13px] text-ink-2 hover:text-ink">Tableau de bord →</Link>
      </header>
      <div className="mb-6 mt-4">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{titre}</h1>
        {sousTitre && <p className="mt-2 text-[14.5px] text-ink-2">{sousTitre}</p>}
      </div>
      {children}
    </div>
  );
}
