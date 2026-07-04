# 🎮 Steam Reviews AR – Architektur & Komponentenreferenz

## Übersicht

Die Anwendung visualisiert Steam-Bewertungsverläufe als 3D-Balkendiagramme –
sowohl in einer normalen 3D-Ansicht (Three.js) als auch in einer AR-Ansicht (AR.js / A-Frame).

---

## 📁 Dateistruktur

```
/
├── index.html
├── data/
│   ├── index.json          ← Liste aller verfügbaren Spiele (id, name, file)
│   └── {id}.json           ← Bewertungsdaten pro Spiel
├── src/
│   ├── main.js             ← Einstiegspunkt, DOM, UI-Events
│   ├── state.js            ← Globaler Zustand
│   ├── scene.js            ← Three.js Szene, Renderer, Kamera
│   ├── camera.js           ← Kamerasteuerung (sphärisch)
│   ├── chart.js            ← 3D-Diagrammaufbau (Three.js)
│   ├── data.js             ← Datenladen, Spielverwaltung
│   ├── filter.js           ← Datumsfilter, Review-Bomb-Filter
│   ├── interactions.js     ← Touch/Maus-Interaktion, Drag, Zoom
│   ├── popup.js            ← Bar-Detail-Popup
│   ├── ar-aframe.js        ← AR-Modus (A-Frame iframe)
│   └── css2d.js            ← CSS2DObject für Three.js Labels
```

---

## 🧩 Komponenten im Detail

---

### `state.js`
**Globaler Zustand der Anwendung.**

| Export | Typ | Beschreibung |
|---|---|---|
| `state.loadedJsons` | `Array` | Alle aktuell geladenen Spiel-Datensätze |
| `state.rowGroups` | `Array` | Three.js `Group`-Objekte pro Spiel-Zeile |
| `state.allBars` | `Array` | Alle Balken-Meshes mit Metadaten |
| `state.globalChartT0` | `number` | Frühester Zeitstempel (ms) aller geladenen Spiele |
| `state.globalChartScale` | `number` | Höhenskalierung der Balken |
| `state.globalTotalWidth` | `number` | Gesamtbreite des Diagramms in Welteinheiten |
| `state.yLabelGroup` | `Group\|null` | Three.js-Gruppe der Y-Achsenbeschriftungen |
| `MAX_BAR_HEIGHT` | `const` | Maximale Balkenhöhe in Welteinheiten |
| `getBarColor()` | `function` | Gibt Three.js `Color` zurück (positiv/negativ/EA/Bomb) |
| `getBarColorHex()` | `function` | Gibt Hex-Farbstring zurück (für A-Frame) |

**Verbindungen:** Wird von fast allen anderen Modulen importiert.

---

### `main.js`
**Einstiegspunkt – baut das DOM auf und verdrahtet alle UI-Events.**

#### Verantwortlichkeiten
- Injiziert das gesamte Panel-HTML (Burger-Menü, Spielliste, Filter, AR-Skala)
- Öffnet/schließt das Slide-in Menü
- Verdrahtet alle Buttons (Suche, Filter, AR, Legende)
- Enthält `refreshActiveGamesList()` – rendert die Liste geladener Spiele mit 🔮 und ✕ Buttons
- Enthält die Autocomplete-Logik für die Spielsuche
- Startet den Render-Loop (`animate()`)
- Ruft `loadData()` beim Boot auf

#### Autocomplete
- Hört auf `input`-Events am `#game-search-input`
- Filtert `_index` via `getIndex()` nach Name/ID (ab 2 Zeichen)
- Zeigt max. 8 Vorschläge, hebt Treffer blau hervor
- Tastaturnavigation: ↑↓ Pfeile, Enter, Escape

#### 🔮 AR-Button pro Spiel
- Jede Zeile in der Spielliste hat einen `[data-ar-id]`-Button
- Klick → ruft `enterAFrameARWithGame(json)` aus `ar-aframe.js` auf
- `closeMenu()` wird vorher aufgerufen

**Importiert:** `scene.js`, `camera.js`, `interactions.js`, `filter.js`, `popup.js`, `ar-aframe.js`, `data.js`, `state.js`

---

### `data.js`
**Datenverwaltung – lädt, verwaltet und entfernt Spiele.**

#### Konstanten
| Konstante | Wert | Beschreibung |
|---|---|---|
| `INITIAL_GAME_LIMIT` | `10` | Anzahl Spiele beim initialen Index-Laden |
| `LOAD_MORE_STEP` | `10` | Schrittgröße beim „Mehr laden" |
| `MAX_LOADED_GAMES` | `20` | Hartes Limit für gleichzeitig geladene Spiele |

#### Exports

| Funktion | Beschreibung |
|---|---|
| `loadData()` | Initialer Boot – lädt `index.json`, startet mit bevorzugtem Spiel („The Long Dark") |
| `loadIndex()` | Lädt `data/index.json` in `_index` |
| `getIndex()` | Gibt `_index` zurück (für Autocomplete) |
| `loadGameDynamic(idOrName)` | Sucht Spiel im Index, lädt JSON, fügt es hinzu |
| `loadMoreGames()` | Lädt nächsten Chunk aus dem Index (respektiert `MAX_LOADED_GAMES`) |
| `removeGame(gameId)` | Entfernt Spiel aus State und baut Diagramm neu |
| `setupLoadMoreButton()` | Verdrahtet den „Load more"-Button |
| `_refreshActiveGamesList()` | Aktualisiert die Spielliste im Panel (auch aus `data.js` heraus aufrufbar) |

#### Interne Helfer
| Funktion | Beschreibung |
|---|---|
| `_initChart(jsons)` | Erstinitialisierung: setzt T0, Scale, baut alle Zeilen, Gitter |
| `_recalcScale()` | Berechnet `globalChartScale` und `globalChartT0` neu aus allen geladenen Spielen |
| `_rebuildAllRows()` | Disposed alle Gruppen, baut Diagramm komplett neu |
| `_rebuildGrid()` | Disposed altes Gitter, erstellt neues passend zu Breite & Zeilenzahl |
| `_clearAll()` | Räumt alles auf (alle Gruppen, Labels, Gitter, State) |
| `_setEmptyState(bool)` | Zeigt/versteckt den „No games loaded"-Hinweis |
| `_refreshLoadMoreButton()` | Aktualisiert Text/Status des „Load more"-Buttons |

#### Ablauf beim Hinzufügen eines Spiels
```
loadGameDynamic()
  → _recalcScale()        ← T0 + Scale neu berechnen
  → _rebuildAllRows()     ← Diagramm neu aufbauen
    → buildChart()        ← pro Spiel
    → _rebuildGrid()      ← Gitter anpassen
  → updateCamera()
  → _refreshActiveGamesList()
```

**Importiert:** `state.js`, `scene.js`, `chart.js`, `camera.js`, `ar-aframe.js`

---

### `chart.js`
**Baut die 3D-Diagrammzeilen mit Three.js.**

#### Exports

| Funktion | Beschreibung |
|---|---|
| `buildChart(json, zOffset, globalT0, scale)` | Erstellt eine `THREE.Group` mit allen Balken + Labels für ein Spiel |
| `addYLabels(allJson, axisX, axisZ, scale)` | Zeichnet Y-Achse mit Gitternetzlinien und Beschriftungen |
| `selectRow(group)` | Hebt eine Zeile hervor, blendet Detail-Labels ein |
| `clearRowSelection()` | Setzt alle Zeilen zurück |
| `makeLabel(text, pos, cssClass)` | Erstellt ein einzelnes CSS2D-Label |
| `disposeCSS2D(object)` | Entfernt alle CSS2D-DOM-Elemente aus einem Object3D |
| `disposeGroup(group)` | Vollständiges Dispose einer Diagrammzeile |

#### Label-Typen
| CSS-Klasse | Beschreibung |
|---|---|
| `label-z` | Spielname links neben der Zeile, immer sichtbar |
| `label-value` | Zahlenwert über/unter Balken, nur bei Zeilenauswahl |
| `label-bomb` | Review-Bomb-Span: `⚠ Review bomb` / `─` / `◀ ended` |
| `label-ea` | Early-Access-Span: `▶ Early Access` / `◀ EA ended` |

#### Review-Bomb-Span-Logik
```
Erster bombardierter Balken  → "⚠ Review bomb"
Mittlere Balken              → "─" (Verbindungsstrich)
Letzter bombardierter Balken → "◀ ended"
```

**Importiert:** `css2d.js`, `scene.js`, `state.js`

---

### `ar-aframe.js`
**AR-Modus auf Basis von A-Frame + AR.js.**

#### Funktionsweise
AR wird als **Blob-iframe** geöffnet – der komplette HTML-String wird
als `Blob` erzeugt, per `URL.createObjectURL` als `src` in ein `<iframe>` geladen
und über dem Hauptcanvas positioniert. Dadurch läuft A-Frame komplett isoliert.

#### Exports

| Funktion | Beschreibung |
|---|---|
| `enterAFrameAR()` | Öffnet AR mit allen geladenen Spielen |
| `enterAFrameARWithGame(json)` | Öffnet AR mit **genau einem** Spiel – tauscht State temporär aus |
| `exitAFrameAR()` | Schließt iframe + Exit-Button |
| `toggleAFrameAR()` | Wechselt AR ein/aus |
| `updateAFrameScale(val)` | Setzt `aframeScale`, öffnet AR neu falls aktiv |
| `enterWordCloudAR(wordMap, meta)` | Öffnet Word-Cloud-AR für einen einzelnen Balken |

#### `enterAFrameARWithGame(json)` – Ablauf
```
1. Snapshot von state.loadedJsons / T0 / Scale speichern
2. State temporär auf [json] setzen + Scale neu berechnen
3. buildIframeHTML() aufrufen → baut HTML mit diesem einen Spiel
4. _openIframe() → Blob-URL erzeugen, iframe ins DOM hängen
5. State sofort wiederherstellen
```

#### Interne Hilfsfunktionen

| Funktion | Beschreibung |
|---|---|
| `buildBarsHTML()` | Erzeugt `<a-box>` HTML für alle Balken aus `state.loadedJsons` |
| `buildIframeHTML()` | Vollständiges AR-HTML inkl. A-Frame Szene, Menü, Filter |
| `buildWordCloudHTML()` | Vollständiges HTML für Word-Cloud-AR |
| `iframeCSS()` | CSS-String für das AR-iframe-Menü |
| `iframeJS(minDate, maxDate)` | JS-String für Filter, Gesten, Marker-Events im iframe |
| `_openIframe(html, exitLabel)` | Erzeugt Blob, hängt iframe + Exit-Button ins DOM |
| `tryLockLandscape()` | Versucht Screen Orientation API auf Landscape zu sperren |

#### Z-Fighting Prävention
- `BAR_W = 0.18` (schmal) + `MAX_AR_WIDTH = 5.5` (breit) → ausreichend Abstand zwischen Balken
- `renderer="logarithmicDepthBuffer: true; precision: highp;"` für präzisen Tiefenpuffer

**Importiert:** `state.js`

---

### `scene.js`
**Three.js Grundsetup.**

| Export | Beschreibung |
|---|---|
| `scene` | `THREE.Scene` |
| `renderer` | `THREE.WebGLRenderer` |
| `labelRenderer` | `CSS2DRenderer` für DOM-Labels |
| `camera` | `THREE.PerspectiveCamera` |

---

### `camera.js`
**Sphärische Kamerasteuerung.**

| Export | Beschreibung |
|---|---|
| `spherical` | `THREE.Spherical` – aktuelle Kameraposition |
| `target` | `THREE.Vector3` – Blickpunkt |
| `updateCamera()` | Berechnet Kameraposition aus `spherical` + `target` |

---

### `interactions.js`
**Touch- und Mausinteraktion.**

| Funktion | Beschreibung |
|---|---|
| `setupInteractions()` | Registriert alle Event-Listener |

#### Gesten
| Geste | Aktion |
|---|---|
| 1 Finger / Maus ziehen | Kamera schwenken |
| 2 Finger Pinch | Zoom |
| Langer Druck + ziehen | Zeile verschieben (Drag) |
| Tap / Klick auf Balken | Detail-Popup öffnen |

---

### `filter.js`
**Datumsfilter und Review-Bomb-Filter.**

| Export | Beschreibung |
|---|---|
| `applyFilter()` | Liest `#filterFrom` / `#filterTo`, blendet Balken außerhalb aus |
| `resetFilter()` | Setzt alle Balken auf sichtbar |
| `applyReviewBombFilter(bool)` | Zeigt nur Zeilen mit Review-Bombs |

---

### `popup.js`
**Detail-Popup beim Klick auf einen Balken.**

| Export | Beschreibung |
|---|---|
| `showPopup(barData)` | Befüllt und zeigt `#popup` mit Balken-Details |
| `closePopup()` | Versteckt das Popup |

---

### `css2d.js`
**Minimale Implementierung von `CSS2DObject` / `CSS2DRenderer`** –
rendert HTML-Elemente positioniert im 3D-Raum.

---

## 🔄 Datenfluss: Spiel hinzufügen

```
Nutzer gibt Name/ID ein
        ↓
main.js: doGameSearch()
        ↓
data.js: loadGameDynamic()
  ├─ Index-Suche
  ├─ JSON laden
  ├─ _recalcScale()        → T0 + Scale aktualisieren
  ├─ _rebuildAllRows()
  │     ├─ disposeCSS2D()  → alte DOM-Labels entfernen
  │     ├─ scene.remove()  → alte Gruppen entfernen
  │     ├─ buildChart()    → neue Gruppen pro Spiel
  │     └─ _rebuildGrid()  → Gitter neu zeichnen
  ├─ updateCamera()
  └─ _refreshActiveGamesList() → Panel aktualisieren
```

---

## 🔄 Datenfluss: AR betreten

```
Nutzer klickt 🔮 in Spielzeile
        ↓
main.js / data.js: [data-ar-id] click handler
        ↓
ar-aframe.js: enterAFrameARWithGame(json)
  ├─ State snapshot speichern
  ├─ State temporär auf 1 Spiel setzen
  ├─ buildIframeHTML()
  │     ├─ buildBarsHTML()   → <a-box> Elemente
  │     ├─ iframeCSS()       → Styles
  │     └─ iframeJS()        → Filter + Gesten
  ├─ _openIframe()           → Blob-URL, iframe ins DOM
  └─ State wiederherstellen
```

---

## 📦 Dateiformat `data/{id}.json`

```json
{
  "id": 305620,
  "name": "The Long Dark",
  "data": [
    {
      "time": "2014-09-01",
      "earlyAccess": true,
      "reviewBombed": false,
      "values": {
        "cusumPositiv": 1200,
        "cusumNegativ": -340
      },
      "wordClouds": {
        "positive": { "survival": 0.8, "atmosphere": 0.6 },
        "negative": { "bugs": 0.4 }
      }
    }
  ]
}
```

---

## 📦 Dateiformat `data/index.json`

```json
[
  { "id": 305620, "name": "The Long Dark", "file": "./data/305620.json" },
  { "id": 965200, "name": "Walking Zombie 2", "file": "./data/965200.json" }
]
```
