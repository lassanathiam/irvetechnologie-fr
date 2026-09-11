import { COMPANY } from "@/lib/company";

/**
 * Cachet entreprise + signature superposée pour apposition sur les documents.
 */
export function CompanySeal({ className = "" }: { className?: string }) {
  return (
    <div className={`relative rounded-sm border border-border bg-white p-2 ${className}`}>
      <img
        src="/cachet-irve.jpg"
        alt={`Cachet ${COMPANY.raisonSociale}`}
        className="w-full h-auto object-contain rounded-[2px]"
      />
      <img
        src="/signature-irve.jpg"
        alt="Signature IRVE Technologie"
        className="absolute -bottom-1 right-1 w-16 sm:w-20 h-auto object-contain rotate-[-8deg] opacity-90 mix-blend-multiply"
      />
    </div>
  );
}
