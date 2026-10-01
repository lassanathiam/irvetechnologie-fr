import { useServerFn } from "@tanstack/react-start";

/** Enveloppe une fonction d'envoi : rien ne part sans confirmation explicite. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useEnvoiConfirme<T extends (...args: any[]) => Promise<any>>(fn: T, message: string): T {
  const appel = useServerFn(fn);
  return (async (...args: Parameters<T>) => {
    if (typeof window !== "undefined" && !window.confirm(message)) {
      throw new Error("Envoi annulé : rien n'a été envoyé.");
    }
    return appel(...args);
  }) as unknown as T;
}
