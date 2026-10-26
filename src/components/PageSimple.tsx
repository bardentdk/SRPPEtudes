import Link from "next/link";
import type { ReactNode } from "react";
import Logo from "./Logo";

/** Gabarit des pages hors tableau de bord : questionnaire, confidentialité, admin. */
export default function PageSimple({ titre, sousTitre, children, large }: { titre: string; sousTitre?: string; children: ReactNode; large?: boolean }) {
  return (
    <div className={`mx-auto w-full px-4 pb-16 sm:px-6 ${large ? "max-w-[1480px]" : "max-w-3xl"}`}>
      <header className="flex items-center justify-between gap-3 py-5">
        <Link href="/" className="flex items-center gap-3">
          <Logo size={40} className="shrink-0 text-ink" />
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
