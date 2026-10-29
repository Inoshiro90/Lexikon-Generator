/**
 * taxonomy-default.js
 * Vorgegebene semantische Taxonomie (Standardbaum).
 *
 * Die semantische Kategorie ist eine eigene Dimension neben der grammatischen
 * Wortart. Sie dient dem Namensgenerator dazu, semantisch redundante
 * Komposita zu vermeiden (z. B. "Rubinsmaragd": beide Edelstein).
 *
 * Format je Knoten: [id, Anzeigename, Eltern-id | null]
 * - IDs sind stabil und werden in Eintraegen referenziert; Anzeigenamen sind
 *   frei umbenennbar.
 * - Anzeigenamen duerfen weder "," noch ">" enthalten (Tabellen-Import).
 * - Eltern stehen immer vor ihren Kindern.
 */

/* eslint-disable no-unused-vars */
const TAXONOMY_DEFAULT_NODES = [
	// ── Person ──────────────────────────────────────────────
	['person', 'Person', null],
	['person.beruf', 'Beruf & Handwerk', 'person'],
	['person.herrschaft', 'Herrschaft & Amt', 'person'],
	['person.gelehrte', 'Gelehrte & Kunst', 'person'],
	['person.kampf', 'Kampf & Wache', 'person'],
	['person.archetyp', 'Archetyp & Wesensart', 'person'],
	['person.aussenseiter', 'Außenseiter & Zustand', 'person'],
	['person.verwandtschaft', 'Verwandtschaft & Lebensphase', 'person'],
	['person.volk', 'Volk & Spezies', 'person'],

	// ── Gruppe ──────────────────────────────────────────────
	['gruppe', 'Gruppe', null],
	['gruppe.militaer', 'Militär', 'gruppe'],
	['gruppe.politik', 'Politik & Herrschaftsform', 'gruppe'],
	['gruppe.wirtschaft', 'Wirtschaft & Zunft', 'gruppe'],
	['gruppe.religion', 'Religion', 'gruppe'],
	['gruppe.bildung', 'Bildung & Kunst', 'gruppe'],
	['gruppe.abstammung', 'Abstammung & Gemeinschaft', 'gruppe'],
	['gruppe.untergrund', 'Untergrund', 'gruppe'],
	['gruppe.menge', 'Lose Menge', 'gruppe'],

	// ── Kreatur ─────────────────────────────────────────────
	['kreatur', 'Kreatur', null],
	['kreatur.tier', 'Tier', 'kreatur'],
	['kreatur.pflanze', 'Pflanze & Pilz', 'kreatur'],
	['kreatur.fabelwesen', 'Fabelwesen & Ungeheuer', 'kreatur'],
	['kreatur.himmlisch', 'Himmlisches & Unholdiges', 'kreatur'],
	['kreatur.geist', 'Geister & Konstrukte', 'kreatur'],

	// ── Körperteil ──────────────────────────────────────────
	['koerperteil', 'Körperteil', null],

	// ── Objekt ──────────────────────────────────────────────
	['objekt', 'Objekt', null],
	['objekt.waffe', 'Waffe', 'objekt'],
	['objekt.ruestung', 'Rüstung & Schutz', 'objekt'],
	['objekt.kleidung', 'Kleidung & Schmuck', 'objekt'],
	['objekt.behaelter', 'Behälter', 'objekt'],
	['objekt.werkzeug', 'Werkzeug & Gerät', 'objekt'],
	['objekt.instrument', 'Instrument', 'objekt'],
	['objekt.fahrzeug', 'Fahrzeug', 'objekt'],
	['objekt.schrift', 'Schrift & Wissen', 'objekt'],
	['objekt.spiel', 'Spiel', 'objekt'],

	// ── Material ────────────────────────────────────────────
	['material', 'Material', null],
	['material.metall', 'Metall & Erz', 'material'],
	['material.stein', 'Stein & Erde', 'material'],
	['material.edelstein', 'Edelstein', 'material'],
	['material.pflanzlich', 'Pflanzlicher Rohstoff', 'material'],
	['material.tierisch', 'Tierischer Rohstoff', 'material'],
	['material.faser', 'Faser & Textil', 'material'],
	['material.nahrung', 'Nahrung & Würze', 'material'],
	['material.chemie', 'Chemikalie & Brennstoff', 'material'],
	['material.baustoff', 'Baustoff & Bindemittel', 'material'],

	// ── Ort (ehemals Region + Ort) ──────────────────────────
	['ort', 'Ort', null],
	['ort.landschaft', 'Landschaft & Biom', 'ort'],
	['ort.gewaesser', 'Gewässer & Küste', 'ort'],
	['ort.siedlung', 'Siedlung', 'ort'],
	['ort.bauwerk', 'Bauwerk & Anlage', 'ort'],

	// ── Ereignis ────────────────────────────────────────────
	['ereignis', 'Ereignis', null],
	['ereignis.natur', 'Naturereignis', 'ereignis'],
	['ereignis.konflikt', 'Krieg & Konflikt', 'ereignis'],
	['ereignis.politik', 'Politik & Recht', 'ereignis'],
	['ereignis.fest', 'Fest & Ritual', 'ereignis'],
	['ereignis.lebenszyklus', 'Lebenszyklus', 'ereignis'],
	['ereignis.unglueck', 'Unglück', 'ereignis'],

	// ── Handlung ────────────────────────────────────────────
	['handlung', 'Handlung', null],

	// ── Konzept ─────────────────────────────────────────────
	['konzept', 'Konzept', null],
	['konzept.farbe', 'Farbe', 'konzept'],
	['konzept.zeit', 'Himmel & Zeit', 'konzept'],
	['konzept.prinzip', 'Prinzip & Abstraktum', 'konzept'],
	['konzept.element', 'Element & Naturkraft', 'konzept'],
	['konzept.domaene_aspekt', 'Domäne & Aspekt', 'konzept'],

	// ── Namensgebung (neue Oberkategorie; Unterkategorien bei Bedarf selbst anlegen) ──
	['namensgebung', 'Namensgebung', null],

	// ── Modifikator ─────────────────────────────────────────
	['modifikator', 'Modifikator', null],
	['modifikator.charakter', 'Charakter & Haltung', 'modifikator'],
	['modifikator.koerper', 'Körper & Erscheinung', 'modifikator'],
	['modifikator.form', 'Oberfläche & Form', 'modifikator'],
	['modifikator.zustand', 'Zustand & Alter', 'modifikator'],
	['modifikator.sinne', 'Sinneseindruck', 'modifikator'],
	['modifikator.stil', 'Stil & Wertung', 'modifikator'],
	['modifikator.aehnlichkeit', 'Ähnlichkeit (-artig)', 'modifikator']
];

/**
 * Migration älterer Taxonomien (Version 1: Oberkategorie „Göttliches“).
 * Siehe taxonomy.js → taxMigrateSerialized().
 *
 * - LEGACY_IDS:     alte ID → neue ID (Knoten wurde verschoben, Bedeutung gleich)
 * - LEGACY_LABELS:  alter Anzeigepfad (kleingeschrieben, ohne Leerzeichen um ">") → neue ID
 * - REMOVED:        aufgelöste Kategorien: alte ID → Anzeigename. Zuordnungen darauf werden
 *                   NICHT automatisch umgehängt (keine sichere semantische Entsprechung).
 * - REMOVED_LABELS: Schreibweisen aufgelöster Kategorien (kleingeschrieben)
 * - V2_NEW_IDS:     mit Version 2 neu hinzugekommene Standardknoten
 */
const TAXONOMY_MIGRATION = {
	LEGACY_IDS: { 'goettliches.domaene': 'konzept.domaene_aspekt' },
	LEGACY_LABELS: { 'göttliches>domäne & aspekt': 'konzept.domaene_aspekt' },
	REMOVED: { 'goettliches': 'Göttliches', 'goettliches.beiname': 'Beiname & Archetyp' },
	REMOVED_LABELS: ['göttliches', 'göttliches>beiname & archetyp', 'beiname & archetyp'],
	V2_NEW_IDS: ['konzept.domaene_aspekt', 'namensgebung'],
};
