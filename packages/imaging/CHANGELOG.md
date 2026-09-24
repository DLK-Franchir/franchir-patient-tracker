# Changelog — `@franchir/imaging`

## 0.2.1

- `isNonImageDicomModality` : masquer SR / PR / KO / RT* / SEG (comptes rendus et parasites CD) de la grille séries ; DOC (PDF encapsulé) reste affiché.

## 0.1.0

- Extraction initiale depuis tracker : grouping séries, UID names, dédup pont, bande PDF listing.
- Pont clinicien : métadonnées SeriesInstanceUID requises pour éviter ~200 cartes / coupe.
