import { COMPANY } from "@/lib/company";

/**
 * Cachet numérique compact avec signature apposée (un seul visuel).
 */
export function CompanySeal({ className = "" }: { className?: string }) {
  return (
    <img
      src="/cachet-signature-irve.svg"
      alt={`Cachet et signature ${COMPANY.raisonSociale}`}
      className={`w-full h-auto object-contain ${className}`}
    />
  );
}
