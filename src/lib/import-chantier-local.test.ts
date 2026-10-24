import { describe, expect, it as test } from "bun:test";
import { dateLocaleImport, lireFicheSansIA, lireRdvSansIA } from "./import-chantier-local";

describe("imports de chantier sans IA", () => {
  test("texte copié : coordonnées et créneau sans inventer les champs absents", () => {
    const rows = lireRdvSansIA("Client : Mme Dupont\nAdresse : 12 rue des Lilas\n44100 Nantes\n27/10/2026 entre 14h et 16h\nTéléphone : 06 12 34 56 78\nRéseau : BUMP", new Date(2026, 9, 24));
    expect(rows[0]?.client_nom).toEqual("Mme Dupont");
    expect(rows[0]?.adresse).toEqual("12 rue des Lilas");
    expect(rows[0]?.date_debut).toEqual("2026-10-27T14:00");
    expect(rows[0]?.creneau_fin).toEqual("16:00");
    expect(rows[0]?.client_telephone).toEqual("0612345678");
    expect(rows[0]?.reseau_client).toEqual("BUMP");
    expect(rows[0]?.client_email).toEqual(null);
  });
  test("tableau copié : une intervention par ligne et réseau indépendant", () => {
    const rows = lireRdvSansIA("Client\tAdresse\tCP\tVille\tDate\tHeure\tRéseau\nDupont\t12 rue A\t44100\tNantes\t27/10/2026\t09:30\tAMARA\nMartin\t3 rue B\t35000\tRennes\t28/10/2026\t10h\tDKV");
    expect(rows.length).toEqual(2);
    expect(rows[1]?.client_nom).toEqual("Martin");
    expect(rows[1]?.reseau_client).toEqual("DKV");
    expect(rows[0]?.date_debut).toEqual("2026-10-27T09:30");
  });
  test("absence de date ou heure : pas de rendez-vous inventé", () => {
    expect(lireRdvSansIA("Client : Martin\nAdresse : 12 rue A")[0]?.date_debut).toEqual(null);
    expect(dateLocaleImport("27/10/2026")).toEqual(null);
    expect(dateLocaleImport("31/02/2026 10h")).toEqual(null);
  });
  test("une date sans année correspond à la prochaine occurrence", () => {
    expect(dateLocaleImport("27 octobre 9h", new Date(2026, 9, 24))).toEqual("2026-10-27T09:00");
  });
  test("fiche technique : lecture explicite sans inventer un répartiteur", () => {
    const f = lireFicheSansIA("Client : Martin\nPuissance : 7,4 kW\nMonophasé\nLongueur de câble : 18 m\nSans répartiteur");
    expect(f.client_nom).toEqual("Martin");
    expect(f.puissance_borne).toEqual("7,4 kW");
    expect(f.metrage_m).toEqual(18);
    expect(f.repartiteur).toBeFalse();
  });
});