# -*- coding: utf-8 -*-
"""Erzeugt js/taxonomy-seed.js aus der kuratierten Zuordnung unten.
Quelle der Wörter: Lore Master Web Applikation.xlsx (Blätter Material, Creature, Object, Ort Primär,
Fraktion Primär, Figur Primär, Ereignis Primär) + die im Prompt genannten Beispiele.
Mit '#allg' markierte Gruppen sind allgemeine Ergänzungen, die NICHT aus den Dateien stammen."""
import re, sys, io, json
from collections import OrderedDict

W = OrderedDict()   # kategorie-id -> Wortliste
def add(cat, words): W.setdefault(cat, []).extend(words.split())

# ── Material ───────────────────────────────────────────────
add('material.metall', 'Messing Quecksilber Erz Metall Bronze Stahl Gold Silber Platin Eisen Kupfer Zinn')
add('material.stein', 'Stein Felsen Kiesel Lehm Ton Erde Sand Sandstein Schiefer Granit Marmor Quarz Kreide Schotter Torf Kohle Asche Schlamm Feuerstein Magma Mineral Graphit')
add('material.edelstein', 'Edelstein Perle Kristall Rubin Smaragd Bernstein Amethyst')                       # Rubin/Smaragd: Prompt; Bernstein/Amethyst: alte Version
add('material.edelstein', 'Diamant Saphir Opal Topas Jade Onyx')                                              # #allg
add('material.pflanzlich', 'Holz Rinde Harz Schilf Bambus Hanf Stroh Eiche Samen Wurzel Zellstoff')
add('material.tierisch', 'Fell Knochen Horn Leder Haut Feder Chitin Walspeck Stoßzahn Elfenbein Zähne Blut Organ Fett Pergament')
add('material.faser', 'Wolle Seide Stoff Gewebe Fasern Vlies Textil Filz Garn Faden Seil Schnur Leinen Segeltuch Gespinst Papier')
add('material.nahrung', 'Brühe Gewürz Gelee Nudel Soße Käse Schokolade Ei Mehl Getreide Bohne Fleisch Milch Saft Sirup Reis Obst Teig Knolle Salz Gemüse Essig Zucker Honig Zwiebel Eiweiß Hefe Alkohol')
add('material.chemie', 'Brennstoff Sprengstoff Dünger Puder Pheromone Flüssigkeit Plasma Reagenz Schießpulver Säure Toxin Droge Beruhigungsmittel Gas Pigment Schaum Seife Gift Farbe Salbe Tinte Politur Lack Öl Elektrolyt Kunstharz Kunststoff Emaille Gerbstoff Wachs')
add('material.baustoff', 'Mörtel Zement Leim Kitt Kleber Estrich Ziegelstein Gips Asphalt Pflasterstein Pflastersteine Keramik Glas')

# ── Kreatur ────────────────────────────────────────────────
add('kreatur.tier', 'Anglerfisch Bär Falke Ameise Gürteltier Löwe Hirsch Otter Raubvogel Luchs Reptil Rochen Alligator Biene Katze Dachs Reh Hund Käfer Krake Mastodon Beuteltier Kranich Leopard Krokodil Libelle Nagetier Delfin Spinnentier Wiesel Kopffüßer Tausendfüßler Wildschwein Bison Dinosaurier Kolibri Koralle Kamel Python Seestern Vogel Adler Antilope Fisch Elefant Fledermaus Pinguin Insekt Nilpferd Stinktier Eichelhäher Pferd Skorpion Eidechse Ratte Tümmler Hyäne Salamander Wanze Faultier Nashorn Schalentier Ziege Panther Rind Robbe Schnecke Känguru Stechmücke Tiger Geier Hase Wasserschildkröte Affe Huhn Walross Aal Schwertfisch Wolf Parasit Qualle Sauropode Vielfraß Fuchs Muschel Papagei Schwein Schaf Tintenfisch Gecko Motte Pelikan Lemur Oktopus Schlange Ente Kojote Wal Wurm Habicht Menschenaffe Seepferdchen Amphibie Spinne Strauß Frosch Rabenvogel Eule Krabbe Nacktschnecke Elch Hai Landschildkröte Singvogel Ameisenbär Koala Neunauge Anakonda Igel Opossum Chamäleon Maulwurf Piranha Geflügel Orca Schnabeltier Dickhäuter Plankton Trampeltier Tyrannosaurus Giraffe Glattechse Bärtierchen Blutegel Fischadler Stachelschwein')
add('kreatur.pflanze', 'Fungus Pflanze Liane Moos Algen Orchidee Blume Kaktus Baum Busch Lotus Strauch Farn Schlingpflanze Seetang Flechte Gras Pilz')
add('kreatur.fabelwesen', 'Wyrm Basilisk Pegasus Sirene Schimäre Drache Greif Greifen Hydra Einhorn Xenomorph Kryptide Yeti')
add('kreatur.himmlisch', 'Teufelchen Teufel Engel Dämon')
add('kreatur.geist', 'Elementar Wasserspeier')
add('koerperteil', 'Klaue Zahn Reißzahn Herz Faust Auge Hand Kopf Flügel')                                   # Klaue: Object-Blatt, Rest #allg

# ── Objekt ─────────────────────────────────────────────────
add('objekt.waffe', 'Keule Knüppel Machete Schusswaffe Schwert Bogen Speer Messer Axt Pike Bajonett Gewehr Flammenwerfer Blasrohr Schleuder Flegel Wurfwaffe Wurfspeer Sichel Peitsche Beil Bumerang Hellebarde Balliste Rapier Harpune Dreizack Vorschlaghammer Pfeil Wurfpfeil Bola Sprengkörper Brandbombe Projektil Geschoss Abschussvorrichtung Sprengfalle')
add('objekt.ruestung', 'Schild Helm Harnisch Faustschild Visier Schulterplatte Schutzanzug')
add('objekt.kleidung', 'Gewand Hemd Halskette Kopfbedeckung Uniform Gürtel Schal Schärpe Mantel Krawatte Schuh Diadem Juwel Handschuh Hut Hose Piercing Sandalen Spange Armband Ring Umhang Stiefel Halsband Halstuch Kette Regenumhang Stöckelschuh Unterwäsche Monokel Brille Tellermütze Korsett Augenbinde Fächer')
add('objekt.behaelter', 'Behälter Kanister Schachtel Krug Feldflasche Beutel Truhe Eimer Sack Fass Kelch Schale Becher Tiegel Kapsel Phiole Rucksack Köcher Schüssel')
add('objekt.werkzeug', 'Hammer Säge Amboss Meißel Nadel Pinsel Lupe Schere Zange Bohrer Pinzette Korkenzieher Blasebalg Dietrich Haken Schraube Schlüssel Stempel Lineal Destillierkolben Laterne Fernrohr Sextant Uhr Waage Abakus')
add('objekt.instrument', 'Gitarre Instrument Pfeife Geräuschmacher')
add('objekt.fahrzeug', 'Streitwagen Bodenfahrzeug Wasserfahrzeug Luftfahrzeug Fahrrad Gleiter Schwingenflugzeug Karre Wagen Fahrzeug Flugdrachen Ballon')
add('objekt.schrift', 'Globus Brief Tafel Kodex Schriftrolle Karte Buch Schreibgriffel Rune Wappen Beleg')
add('objekt.spiel', 'Spielstein Spielkarte')

# ── Ort ────────────────────────────────────────────────────
add('ort.landschaft', 'Wildnis Buschland Insel Oase Krater Morast Vulkan Schlucht Berg Berge Klippe Steppe Geysir Regenwald Sumpf Sanddüne Feuchtgebiet Gipfel Unterholz Spitzkuppe Mulde Gletscher Wald Wüste Hügelkuppe Anhöhe Waldgebiet Bergland Klamm Eiskappe Weite Grotte Höhle Tundra Taiga Schnee Eis Tal')
add('ort.gewaesser', 'Meerbusen Riff Untiefe Fluss Strand Quelle Stromschnelle Meer Wasserfall Bucht Stausee See Ufer Ozean Hafenbecken Kanal Küste')
add('ort.siedlung', 'Stadt Siedlung Gehöft Ortschaft Dorf Elendsviertel Bauernhof Viehhof Stadtbezirk')
add('ort.bauwerk', 'Gewölbe Gildenhaus Pavillon Burg Haus Glockenturm Zitadelle Geschäft Bunker Hörsaal Ruine Lagerhalle Kneipe Basilika Verkaufsstand Botschaft Altar Betriebsgebäude Café Vereinshaus Landebahn Kolosseum Kasino Begräbnisstätte Komplex Spelunke Gruft Räucherkammer Turm Theater Palast Werkstatt Archiv Halle Badehaus Labor Schiffswerft Terrasse Festung Fabrik Laden Spielhalle Tanzsaal Torbogen Tempel Anlage Galerie Gewächshaus Küche Garnison Turnhalle Baracke Villa Gaststube Katakombe Jagdhütte Apotheke Residenz Schutzhaus Pyramide Klinik Bergwerk Waffenkammer Irrgarten Restaurant Wachturm Krankenstation Gaststätte Dachwohnung Kino Sauna Speisesaal Einkaufszentrum Absteige Landhaus Rastplatz Wirtshaus Bollwerk Brauerei Gesellschaftsraum Bordell Bahnsteig Labyrinth Bau Grabhügel Grabstätte Hafen')

# ── Ereignis ───────────────────────────────────────────────
add('ereignis.natur', 'Tsunami Erdbeben Meteorit Regen Tornado Orkan Welle Eruption Dürre Flut Sturm Unwetter Eisschmelze Gezeit Sintflut Komet Sonnenfinsternis Schmelze')
add('ereignis.konflikt', 'Schlacht Niederlage Scharmützel Invasion Hinterhalt Duell Angriff Belagerung Krieg Gemetzel Bombardierung Überfall Handgemenge Rachekampf Sieg Kapitulation Waffenstillstand Meuchelmord Aufstand Raubüberfall Raubzug Fahnenflucht Flucht Ansturm Vernichtung Ausrottung Dezimierung')
add('ereignis.politik', 'Abkommen Urteil Abdankung Krönung Wahl Revolution Umsturz Annektierung Unterwerfung Gerichtsprozess Hinrichtung Korruption Skandal Kontroverse Verkündigung Wiedervereinigung Spaltung Säuberung Befreiung')
add('ereignis.fest', 'Beerdigung Weihe Konzert Tanz Gelage Turnier Festmahl Hochzeit Ernte Versöhnung Opferung Schwur Heiligsprechung Wettbewerb Rennen Jagd Spektakel')
add('ereignis.lebenszyklus', 'Tod Geburt Wiederauferstehung Wiedergeburt Wiedererwachung Erwachung Vererbung Ankunft Rückkehr Migration')
add('ereignis.unglueck', 'Massenpanik Hungersnot Seuche Epidemie Pandemie Tragödie Katastrophe Plage Weltuntergang Unheil Zusammenbruch Untergang Krise Absturz Explosion Detonation Brand Feuersbrunst Vergiftung Pleite Rezession')

# ── Gruppe ─────────────────────────────────────────────────
add('gruppe.militaer', 'Bataillon Kader Regiment Legion Brigade Flotte Kommando Einheit Kohorte Armee Truppenverband Heer Streitmacht Truppe Kompanie Kriegsflotte Schwadron Zugeinheit Patrouille Vorhut Kampftruppe Einsatzgruppe Miliz Reiterzug')
add('gruppe.politik', 'Parlament Republik Ministerium Staatenbund Föderation Partei Allianz Gremium Senat Monarchie Theokratie Diktatur Rat Kongress Magokratie Technokratie Nation Imperium Staat Land Konföderation Koalition Militärregierung Herrschaft Tribunal Gericht Komitee Vorstand Bündnis Bund')
add('gruppe.wirtschaft', 'Gewerkschaft Genossenschaft Gilde Monopolgesellschaft Kartell Syndikat Konsortium Unternehmen Großunternehmen Firma Kombinat Megakonzern Bank Branche Kanzlei Arbeiterschaft')
add('gruppe.religion', 'Glaubensgemeinschaft Glaubensrichtung Ketzerbewegung Sekte Inquisition Orden Kult Konvent Kirche Religion Pantheon Kloster Stift Konklave')
add('gruppe.bildung', 'Hochschule Schule Chor Künstlerbund Fakultät Orchester Musikgruppe Schauspielergruppe Darstellertruppe Institut Kampfschule Kochschule Zirkus Kulturverband Zirkel')
add('gruppe.abstammung', 'Kaste Nachbarschaft Klan Stamm Familie Verwandtschaft Volk Geschwisterschaft Kommune Wohngemeinschaft Gemeinschaft Lehensgemeinschaft Auswanderergemeinde')
add('gruppe.untergrund', 'Verbrecherbande Bande Rebellengruppe Zelle Verschwörung Widerstand Protestgruppe')
add('gruppe.menge', 'Horde Meute Herde Karawane Schar Publikum')

# ── Person ─────────────────────────────────────────────────
add('person.beruf', 'Heiler Mechaniker Waffenhersteller Produzent Maschinist Händler Tierarzt Imker Mediziner Lehrer Ladenbesitzer Botaniker Makler Waffenschmied Erfinder Handwerker Gastwirt Forscher Arzt Koch Schmied Buchbinder Uhrmacher Schreiner Klempner Dekorateur Fahrer Taucher Geologe Rechtsanwalt Jurist Bastler Kunsthandwerker Unternehmer Auktionator Fallensteller Facharzt Rennfahrer Pförtner Sprengmeister Erzieher Technologe Ökologe Gutachter Prüfer Wirtschaftler Gewerbetreibender Freiberufler Angestellter Großunternehmer Aeronaut Erbauer Seefahrer Fährtenleser')
add('person.herrschaft', 'Oligarch Botschafter Ratsmitglied Alleinherrscher Häuptling Würdenträger Marschall Herrscher Monarch Richter Kommandant Direktor Ältester Verwalter Offizieller Führungskraft Inspektor Glaubensoberhaupt Aufseher')
add('person.gelehrte', 'Chronist Komponist Geschichtenerzähler Künstler Dichter Kartograf Autor Sprachforscher Gelehrter Weiser Denker Koryphäe Kritiker Analyst Dozent Unterhaltungskünstler Theaterdarsteller Arkanist Magier Beschwörer Elementarmagier Berichterstatter Wahrsager')
add('person.kampf', 'Soldat Wächter Verteidiger Schütze Ringkämpfer Preiskämpfer Truppenführer Hauptmann Rekrut Leibwächter Monsterjäger Haudegen Wehrpflichtiger')
add('person.archetyp', 'Extrovertierter Idealist Traditionalist Spaßvogel Heißsporn Eiferer Perfektionist Grobian Bücherwurm Spießer Glücksspieler Einzelgänger Alleskönner Abenteurer Weltenbummler Stilist Liebhaber')
add('person.aussenseiter', 'Landstreicher Geflüchteter Büßer Abtrünniger Außenseiter Straftäter Dieb Betrüger Pirat Wucherer Schnüffler Informant')
add('person.verwandtschaft', 'Frau Kind Mann')
add('person.volk', 'Mensch Elf Zwerg Ork')                                                                     # #allg

# ── Konzept / Modifikator / Handlung ───────────────────────
add('konzept.farbe', 'Rot Grün')                                                                                # Rot: Deck of Worlds, Grün: Modifikator-Blatt
add('konzept.farbe', 'Blau Gelb Schwarz Weiß Grau Braun Violett')                                              # #allg
add('konzept.zeit', 'Nacht Abend Mitternacht Dämmerung Zwielicht Winter Sonnenwende Saison Jahrhundert Ära Sonnenuntergang')
add('konzept.prinzip', 'Chaos Ordnung Dunkelheit')
add('konzept.element', 'Feuer Wirbel Wind Frost')
add('handlung', 'Gang Lauf Kampf Dreh laufen brennen singen')
add('modifikator.charakter', 'Zynisch Mitfühlend Einfallsreich Ernsthaft Ruhig')
add('modifikator.koerper', 'Muskulös')
add('modifikator.zustand', 'Unangetastet Verwittert Ursprünglich')
add('modifikator.stil', 'Eklektisch Ikonisch')
add('modifikator.sinne', 'Dunkel')
add('modifikator.form', 'Groß')

# Mehrdeutige Wörter: Hauptkategorie bleibt die erste Zuordnung oben; weitere Kategorien nicht blockierend
WEITERE = {
  'Stadt': ['gruppe.politik'], 'Stadtbezirk': ['gruppe.politik'], 'Siedlung': ['gruppe.abstammung'],
  'Tempel': ['gruppe.religion'], 'Kloster': ['ort.bauwerk'], 'Schule': ['ort.bauwerk'], 'Hochschule': ['ort.bauwerk'],
  'Muschel': ['material.tierisch'], 'Koralle': ['material.edelstein'], 'Perle': ['kreatur.tier'],
  'Schnur': ['objekt.werkzeug'], 'Faden': ['objekt.werkzeug'], 'Hammer': ['objekt.waffe'],
  'Rubin': ['konzept.farbe'], 'Smaragd': ['konzept.farbe'], 'Bernstein': ['konzept.farbe'],
  'Silber': ['konzept.farbe'], 'Gold': ['konzept.farbe'], 'Kupfer': ['konzept.farbe'],
  'Eis': ['material.stein'], 'Schnee': ['konzept.element'], 'Meer': ['ort.landschaft'],
  'Feuer': ['ereignis.unglueck'], 'Kampf': ['ereignis.konflikt'], 'Nacht': ['modifikator.sinne'],
  'Dunkel': ['konzept.zeit'], 'Klaue': ['objekt.waffe'], 'Zähne': ['koerperteil'],
  'Zahn': ['material.tierisch'], 'Hafen': ['ort.gewaesser'], 'Strand': ['ort.landschaft'],
  'Küste': ['ort.landschaft'], 'Insel': ['ort.gewaesser'], 'Wald': ['kreatur.pflanze'],
}

# ── Auflösen: erste Zuordnung gewinnt, Konflikte melden ────
seed = OrderedDict(); conflicts = []
for cat, words in W.items():
    for w in words:
        k = w.lower()
        if k in seed:
            if seed[k][0] != cat: conflicts.append((w, seed[k][0], cat))
            continue
        seed[k] = [cat]
for w, extra in WEITERE.items():
    k = w.lower()
    if k in seed:
        for e in extra:
            if e != seed[k][0] and e not in seed[k]: seed[k].append(e)
    else:
        print('WEITERE ohne Hauptzuordnung:', w, file=sys.stderr)

# ids gegen Standardtaxonomie prüfen
src = open('js/taxonomy-default.js', encoding='utf8').read()
ids = set(re.findall(r"\['([a-z.]+)', '[^']+', (?:'[a-z.]+'|null)\]", src))
bad = sorted({c for v in seed.values() for c in v if c not in ids})
if bad: sys.exit('Unbekannte Kategorie-IDs: %s' % bad)

out = io.StringIO()
out.write('''/**
 * taxonomy-seed.js
 * Vorschlagstabelle: Wort (kleingeschrieben) → [Hauptkategorie, weitere …].
 *
 * Wird NUR auf ausdrücklichen Klick angewendet („Vorschläge prüfen“) und überschreibt nie
 * eine vorhandene Hauptkategorie. Einträge ohne Treffer bleiben unkategorisiert.
 *
 * Herkunft der Wörter
 *  - Lore Master Web Applikation.xlsx: Blätter Material, Creature, Object, Ort Primär,
 *    Fraktion Primär, Figur Primär, Ereignis Primär (Kategorie-Zuordnung kuratiert).
 *  - Beispiele aus der Aufgabenstellung (u. a. Rubin, Smaragd, Rot, Chaos, Nacht, Berg, Meer).
 *  - Allgemeine Ergänzungen, NICHT aus den Dateien: Edelsteine Diamant/Saphir/Opal/Topas/Jade/Onyx,
 *    Farben Blau/Gelb/Schwarz/Weiß/Grau/Braun/Violett, Völker Mensch/Elf/Zwerg/Ork,
 *    Körperteile Zahn/Reißzahn/Herz/Faust/Auge/Hand/Kopf/Flügel.
 *  - Nicht abgedeckt: Göttliches (die Beinamen sind Titel mit Artikel) und der Großteil der
 *    Modifikatoren (ca. 690 Adjektive) – dafür gibt es bewusst keine automatischen Vorschläge.
 *
 * Erzeugt mit tools/build_seed.py (im Projektordner: python3 tools/build_seed.py) – bitte dort pflegen, nicht von Hand.
 */

/* eslint-disable no-unused-vars */
const TAXONOMY_SEED = {
''')
for k, v in seed.items():
    out.write('\t%s: %s,\n' % (json.dumps(k, ensure_ascii=False), json.dumps(v, ensure_ascii=False)))
out.write('};\n')
open('js/taxonomy-seed.js', 'w', encoding='utf8').write(out.getvalue())
print('Seed-Einträge:', len(seed), '| Konflikte (erste Zuordnung gilt):', len(conflicts))
for c in conflicts: print('  ', c)
