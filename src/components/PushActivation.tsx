import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";
import { enregistrerAbonnementPush, supprimerAbonnementPush, testerPush } from "@/lib/push.functions";

type Etat = "chargement" | "actif" | "inactif" | "non-supporte" | "iphone-installer" | "iframe" | "refuse";

const versUint8 = (s: string): Uint8Array<ArrayBuffer> => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
const estIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const estInstallee = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export function PushActivation() {
  const [etat, setEtat] = useState<Etat>("chargement");
  const [occupe, setOccupe] = useState(false);
  const enregistrer = useServerFn(enregistrerAbonnementPush);
  const supprimer = useServerFn(supprimerAbonnementPush);
  const tester = useServerFn(testerPush);

  useEffect(() => {
    (async () => {
      if (window.top !== window.self) return setEtat("iframe");
      if (estIos() && !estInstallee()) return setEtat("iphone-installer");
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setEtat("non-supporte");
      if (Notification.permission === "denied") return setEtat("refuse");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setEtat(sub ? "actif" : "inactif");
    })().catch(() => setEtat("non-supporte"));
  }, []);

  const activer = async () => {
    setOccupe(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setEtat("refuse");
      const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versUint8(VAPID_PUBLIC_KEY) });
      const j = sub.toJSON();
      await enregistrer({ data: { endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth, appareil: navigator.userAgent.slice(0, 120) } });
      setEtat("actif");
      toast.success("Notifications activées sur ce téléphone");
    } catch (e) {
      toast.error(`Activation impossible : ${e instanceof Error ? e.message : "erreur"}`);
    } finally {
      setOccupe(false);
    }
  };

  const desactiver = async () => {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await supprimer({ data: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
    setEtat("inactif");
  };

  const essayer = async () => {
    setOccupe(true);
    try {
      const r = await tester();
      toast.success(`Test envoyé à ${r.envoyes} téléphone(s)${r.echecs ? `, ${r.echecs} échec(s)` : ""}`);
    } finally { setOccupe(false); }
  };

  return (
    <div className="rounded-2xl border-2 border-primary/50 bg-card p-4">
      <p className="mb-2 flex items-center gap-2 font-bold"><BellRing className="h-5 w-5 text-primary" /> Sonnerie sur ce téléphone</p>
      {etat === "chargement" && <Loader2 className="h-4 w-4 animate-spin" />}
      {etat === "iframe" && <p className="text-sm text-muted-foreground">Ouvrez la plateforme dans son propre onglet (ou l'application installée) pour activer les notifications.</p>}
      {etat === "non-supporte" && <p className="text-sm text-muted-foreground">Ce navigateur ne permet pas les notifications. Utilisez Chrome sur Android, ou l'application installée sur iPhone.</p>}
      {etat === "refuse" && <p className="text-sm text-destructive">Les notifications sont bloquées. Autorisez-les dans les réglages du téléphone (Réglages › Notifications) pour ce site, puis rechargez la page.</p>}
      {etat === "iphone-installer" && (
        <div className="space-y-1 text-sm">
          <p className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4" /> Sur iPhone, installez d'abord l'application :</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Ouvrez ce site dans <strong>Safari</strong>.</li>
            <li>Touchez le bouton <strong>Partager</strong> (carré avec une flèche vers le haut).</li>
            <li>Choisissez <strong>« Sur l'écran d'accueil »</strong>, puis « Ajouter ».</li>
            <li>Ouvrez la plateforme avec la nouvelle icône, revenez ici et touchez « Activer ».</li>
          </ol>
          <p className="text-muted-foreground">iPhone avec iOS 16.4 ou plus récent requis.</p>
        </div>
      )}
      {etat === "inactif" && (
        <Button onClick={activer} disabled={occupe} className="w-full sm:w-auto">
          {occupe && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Activer les notifications sur ce téléphone
        </Button>
      )}
      {etat === "actif" && (
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm font-semibold text-primary">Activé sur ce téléphone</span>
          <Button onClick={essayer} disabled={occupe} variant="outline">Tester la sonnerie</Button>
          <Button onClick={desactiver} variant="ghost">Désactiver</Button>
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">La sonnerie est celle des notifications du téléphone : désactivez le mode silencieux et « Concentration » pour l'entendre.</p>
    </div>
  );
}
