# Informationsvisualisierung: Steam Reviews und Review Bombs

**Pages link**: https://annieweig.github.io/steam-reviewbombs/

Dieses Projekt wurde im Zuge des Kurses Informationsvisualisierung erstellt und stellt Reviews von Spielen auf Steam in einer 3D Visualisierung dar, wobei Review Bombs markiert werden. Die Auswahl der Spiele beschränkt sich dabei auf die Genres Open World, Survival und Sandbox.

## Datenquelle

Die Daten werden über die Steam API bereitgestellt.

Steam bietet die Funktion, dass Nutzer einem Spiel einen Tag hinzufügen können. Über diese Tags können über die Steam API unter https://api.steampowered.com/IStoreQueryService/Query/v1/ abgerufen werden.

Rieviews zu einzelnen Spielen werden über die Schnittstelle https://store.steampowered.com/appreviews/ abgerufen werden.

Zu jedem Spiel, welches per Tag einem Genre zugeordnet ist, werden so sämtliche Reviews abgerufen.
Jedes Review enthält Informationen zu:

- Erstelldatum
- Ist das Review Positiv oder Negativ
- Fällt das Review in einen Zeitraum, in dem Review Bombing betrieben wurde
- Der Text des Reviews
- Wurde das Review während einer Early Access Phase erstellt?

## Motivation

Die Visualisierung soll eine besseren Überblick über Reviews von Spielen gewähren.

Im Gegensatz zu Steam werden Reviews hier kummulativ dargestellt, wohingegen bei Steam pro Zeitabschnitt nur die in diesem Zeitraum erstellten Reviews angezeigt werden.  
Es ist anhand der Einfärbung des Graphen erkennbar, wann ein Spiel aus dem Early Access ging und in welchem Zeitraum Reviews von Steam als auffällig geflagt wurden, also Umgangssprachlich Review Bombing betrieben wurde. 

## Visualisierung

Die Darstellung erfolgt anhand von 3D-Balkendiagrammen. Jeder Balken stellt dabei die Gesamtzahl der bis dahin entstandenen negativen bzw. positiven Reviews dar. 
Rote Balken zeigen Zeiträume an, in denen Steam Reviews als auffällig geflagt hat. Reviews mit diesem Flag werden von Steam standardmäßig nicht angezeigt.

Für jeden Review-Balken wird angezeigt, wie viel positive und negative Revies in diesem Zeitraum hinzukamen und, falls im jeweiligen Zeitraum Review Bombing betrieben wurde, eine Zusammenfassung der Reviews als Wordcloud.

## Steuerung

Über den Pages Link kann die Visualisierung aufgerufen werden. 

- Mit der Linken Maustaste wird die Ansicht von Links nach Rechts verschoben. 
- Mit dem Mausrad wird herangezoomt.
- Bei gedrückter rechten Maustaste auf einem Graph kann dieser in den Vorder- oder Hintergrund geschoben werden.
- Ein Klick mit der linken Maustaste auf einen Balken zeigt die Anzahl der in diesem Zeitraum entstandenen Reviews dar und, falls in diesem Zeitraum Review Bombing betrieben wurde und Reviews in Deutsch oder Englisch vorhanden sind, eine Wordcloud mit Bigrammen der häufigsten verwendeten Wörtern in den Reviews.
- Ist eine Wordcloud verfügbar, kann diese in AR dargestellt werden.

Links oben im Eck kann das Menü aufgerufen werden. In diesem können: 
- Spiele hinzugefügt oder entfernt werden
- die Darstellung der Reviews auf einen Zeitraum begrenzt werden
- ein Review Graph in AR angesehen werden
- Spiele ohne Review Bombing in der Visualisierung ausgeblendet werden
- die Skalierung in AR einstellen
- der Marker für die AR Darstellung aufgerufen werden

## AR

Für die Nutzung der AR-Funktionalität muss der Nutzer zunächst den Marker (z. B. https://raw.githubusercontent.com/AR-js-org/AR.js/master/data/images/hiro.png oder den in der Anwendung verlinkten Marker) auf der Oberfläche platzieren, auf der das gewünschte Objekt (der Graph oder die Wordcloud) dargestellt werden soll. Anschließend muss die Kamera des verwendeten Geräts in einem leicht schrägen Winkel von oben auf den Marker ausgerichtet werden, damit die AR-Ansicht korrekt erkannt und angezeigt werden kann.

Aufgrund der vergleichsweise unpraktischen Handhabung dieses Ansatzes wurden für diese Ansicht keine zusätzlichen Nutzerinteraktionen implementiert.

## EEG-Messung

Während der Entwicklung wurde ein EEG Test durchgeführt, der die Hirnströme eines Testers während der Anwendung der Software gemessen hat. 

Eine qualifizierte Einschätzung des Tests kann nicht gegeben werden. In diesem Abschnitt wird daher nur eine zeitliche Einteilung der EEG Messung und der im Test getätigten Tasks gegeben. 

**Abschnitte im Test**

1. 0-170: Start des Tests
2. 170-210: Task 1 "Spielauswahl" wird vorgelesen
3. 210-340: Task 1 wird durchgeführt, Alpha und Beta Wellen deutlich erhöht. Der Tester hat Probleme bei der Eingabe eines Spielenamens
4. 340-380: Task 2 "Filtern eines Zeitraums", wird vorgelesen
5. 380-450: Task 2 wird ausgeführt. Erhöhte Alpha- und Beta Wellen, der Tester setzt den Task schnell und problemlos um.
6. 450-550: Task 3 "Erkunden der Reviews" wird vorgelesen
7. 550-630: Task 3 wird ausgeführt. Im ersten Teil der Durchführung erhöhte Alpha-Wellen-Aktivität, danach eher Beta-Wellen-Aktivität.
8. 630-1270 : Task 4: "AR" wird vorbereitet. Wegen technischer Probleme ist hier eine längere Pause
9. 1270-1330 : Task 4 wird vorgelesen.
10. 1330-1480 Task 4 wird durchgeführt. Ganz zu beginn hohe Alpha-Wellen-Aktivität, anschließend eine Phase mit geringer Alpha- und erhöhter Beta-Wellen-Aktivität, in dieser Zeit navigiert der Tester auf die App und versucht, den VR Marker zu scannen. Danach weder herhöhte Alpha- noch Beta-Wellen-Aktivität feststellbar
11. 1480-1550 Ende, gehört nicht mehr zu den Tasks

**Improvement durch Test**

- durch die Schwierigkeiten bei der Eingabe des Spielenamens wurde dem Programm eine Auto-Vervollständigung hinzugefügt, welche die Eingaben erleichtert.
