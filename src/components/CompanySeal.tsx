import { COMPANY } from "@/lib/company";

/**
 * Cachet numérique officiel compact avec signature intégrée.
 */
export function CompanySeal({ className = "" }: { className?: string }) {
  return (
    <img
      src="/cachet-signature-irve-round.svg"
      alt={`Cachet et signature ${COMPANY.raisonSociale}`}
      className={`w-full h-auto object-contain ${className}`}
    />
  );
}
