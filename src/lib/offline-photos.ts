/* File d'attente hors-ligne : photos et retours de travaux gardés sur le
   téléphone quand le réseau manque, envoyés automatiquement au retour du réseau. */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { enregistrerRetourTravaux, uploadPhotoChantier } from "@/lib/planning.functions";

export type FileAttenteItem = {
  id: string;
  rdv_id: string;
  type: "photo" | "retour";
  label: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const DB_NAME = "irve-hors-ligne";
const STORE = "file-attente";

let dbPromise: Promise<IDBDatabase> | null = null;
let cache: FileAttenteItem[] | null = null;
let traitement = false;
const abonnes = new Set<(items: FileAttenteItem[]) => void>();

function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ouvrirDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponible"));
    });
  }
  return dbPromise;
}

async function lireDb(): Promise<FileAttenteItem[]> {
  const db = await ouvrirDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result ?? []) as FileAttenteItem[]);
    req.onerror = () => reject(req.error);
  });
}

async function ecrireDb(items: FileAttenteItem[]): Promise<void> {
  const db = await ouvrirDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    store.clear();
    for (const item of items) store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function notifier(items: FileAttenteItem[]) {
  cache = items;
  for (const cb of abonnes) cb(items);
}

export async function lireFile(): Promise<FileAttenteItem[]> {
  if (typeof indexedDB === "undefined") return [];
  try {
    const items = await lireDb();
    cache = items;
    return items;
  } catch {
    return cache ?? [];
  }
}

export async function ajouterFile(
  item: Omit<FileAttenteItem, "id" | "created_at">,
): Promise<void> {
  const complet: FileAttenteItem = {
    ...item,
    id: uid(),
    created_at: new Date().toISOString(),
  };
  const items = [...(cache ?? (await lireFile())), complet];
  await ecrireDb(items);
  notifier(items);
}

export async function retirerFile(id: string): Promise<void> {
  const items = (cache ?? (await lireFile())).filter((i) => i.id !== id);
  await ecrireDb(items);
  notifier(items);
}

export function souscrireFile(cb: (items: FileAttenteItem[]) => void): () => void {
  abonnes.add(cb);
  return () => {
    abonnes.delete(cb);
  };
}

/** Envoie tout ce qui attend le réseau. Appelé automatiquement au retour du réseau. */
export async function traiterFile(): Promise<void> {
  if (traitement) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  traitement = true;
  try {
    const items = await lireFile();
    if (items.length === 0) return;
    let envoyes = 0;
    for (const item of items) {
      if (typeof navigator !== "undefined" && !navigator.onLine) break;
      try {
        if (item.type === "photo") {
          await uploadPhotoChantier({
            data: item.payload as {
              rendezvous_id: string;
              categorie: string;
              data_url: string;
            },
          });
        } else {
          await enregistrerRetourTravaux({
            data: item.payload as {
              id: string;
              metrage_inclus_m?: number | string | null;
              metrage_reel_m?: number | string | null;
              retour_observations?: string | null;
              retour_delestage?: boolean;
              retour_repartiteur?: boolean;
            },
          });
        }
        await retirerFile(item.id);
        envoyes++;
      } catch (e) {
        console.warn("Envoi différé en échec, nouvelle tentative plus tard", e);
      }
    }
    if (envoyes > 0) {
      toast.success(
        `${envoyes} élément${envoyes > 1 ? "s" : ""} envoyé${envoyes > 1 ? "s" : ""} dès le retour du réseau.`,
      );
    }
  } finally {
    traitement = false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void traiterFile();
  });
  window.addEventListener("load", () => {
    void traiterFile();
  });
}

/** État réactif de la file d'attente pour un chantier (ou tout, sans rdvId). */
export function useFileAttente(rdvId?: string) {
  const [items, setItems] = useState<FileAttenteItem[]>([]);
  const [enLigne, setEnLigne] = useState(true);

  useEffect(() => {
    let vivant = true;
    setEnLigne(navigator.onLine);
    const maj = (liste: FileAttenteItem[]) => {
      if (vivant) setItems(rdvId ? liste.filter((i) => i.rdv_id === rdvId) : liste);
    };
    void lireFile().then(maj);
    const desabonner = souscrireFile(maj);
    const reseau = () => {
      if (vivant) setEnLigne(navigator.onLine);
      if (navigator.onLine) void traiterFile();
    };
    window.addEventListener("online", reseau);
    window.addEventListener("offline", reseau);
    return () => {
      vivant = false;
      desabonner();
      window.removeEventListener("online", reseau);
      window.removeEventListener("offline", reseau);
    };
  }, [rdvId]);

  return { items, enLigne };
}
