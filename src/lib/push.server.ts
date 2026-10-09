/** Envoi de notifications push (Web Push standard, VAPID + chiffrement aes128gcm) via WebCrypto. */
import { VAPID_PUBLIC_KEY } from "@/lib/push-config";

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};
const concat = (...arr: Uint8Array[]) => {
  const out = new Uint8Array(arr.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arr) { out.set(a, o); o += a.length; }
  return out;
};

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, len * 8));
}

async function vapidJwt(audience: string, d: string) {
  const pub = fromB64u(VAPID_PUBLIC_KEY);
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d, ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(enc.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:contacts@irvetechnologie.fr" })));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

async function chiffrer(payload: string, p256dh: string, authSecret: string) {
  const uaPub = fromB64u(p256dh);
  const auth = fromB64u(authSecret);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(enc.encode(payload), new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}

export type PushMessage = { title: string; body?: string; url?: string; tag?: string };

/** Envoie à tous les téléphones enregistrés. Ne lève jamais d'erreur. */
export async function envoyerPushATous(msg: PushMessage): Promise<{ envoyes: number; echecs: number }> {
  let envoyes = 0, echecs = 0;
  try {
    const d = process.env.VAPID_PRIVATE_D;
    if (!d) { console.error("Push: clé VAPID absente"); return { envoyes, echecs }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("id, endpoint, p256dh, auth");
    const payload = JSON.stringify(msg);
    await Promise.all((subs ?? []).map(async (s) => {
      try {
        const aud = new URL(s.endpoint).origin;
        const res = await fetch(s.endpoint, {
          method: "POST",
          headers: {
            Authorization: `vapid t=${await vapidJwt(aud, d)}, k=${VAPID_PUBLIC_KEY}`,
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            TTL: "86400",
            Urgency: "high",
          },
          body: await chiffrer(payload, s.p256dh, s.auth),
        });
        if (res.ok) envoyes++;
        else {
          echecs++;
          console.error(`Push refusé [${res.status}]: ${await res.text()}`);
          if (res.status === 404 || res.status === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
        }
      } catch (e) {
        echecs++;
        console.error("Push échec:", e instanceof Error ? e.message : e);
      }
    }));
  } catch (e) {
    console.error("Push:", e instanceof Error ? e.message : e);
  }
  return { envoyes, echecs };
}
