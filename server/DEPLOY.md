# Deployment bei Hostinger

So läuft chogarkungfu.com. Die Seite ist als **Node.js Web-App** im Business-Tarif
eingerichtet und zieht sich den Code selbst aus GitHub.

## Wie es aufgesetzt ist

| Einstellung | Wert |
| --- | --- |
| Repository | `kungfulollar-pixel/cho-gar-wing-chun`, Branch `main` |
| Root-Verzeichnis | `./` |
| Eingabedatei | `server/server.js` |
| Node-Version | 22.x |
| Rechenzentrum | Niederlande |

Jeder Push nach `main` löst automatisch ein Deployment aus. Der Node-Prozess
liefert die Website und die API aus einem Stück aus — es gibt keinen separaten
Webserver davor, den man konfigurieren müsste.

> **Root-Verzeichnis und Eingabedatei lassen sich nachträglich nicht ändern.**
> hPanel bietet dafür kein Feld. Stimmt eines von beiden nicht, hilft nur:
> Web-App löschen und neu anlegen. Beim Verbinden der Domain warnt Hostinger
> dann, dass der kostenlose E-Mail-Plan zurückgesetzt und **alle Postfächer
> gelöscht** werden — dieses Häkchen genau lesen.

## Konfiguration

Die App läuft **ohne jede Umgebungsvariable**. Alle Werte haben Standardwerte im
Code, weil das hPanel-Formular Einträge wiederholt verloren hat:

| Variable | Standard ohne Eintrag | Wo im Code |
| --- | --- | --- |
| `CHOGAR_DATA_DIR` | `~/chogar-data` in Produktion | `db.js` |
| `SITE_URL` | `https://chogarkungfu.com` | `mailer.js` |
| `SMTP_HOST` / `SMTP_PORT` | `smtp.hostinger.com` / `465` | `mailer.js` |
| `SMTP_USER` / `MAIL_FROM` | `nils@chogarkungfu.com` | `mailer.js` |
| `CHOGAR_ADMIN_EMAIL` | `nils@chogarkungfu.com` | `server.js` |
| `NODE_ENV` | von Hostinger auf `production` gesetzt | – |

**Die einzige Variable, die gesetzt sein muss, ist `SMTP_PASS`** — das Passwort
des Postfachs `nils@chogarkungfu.com`. Ohne sie schreibt der Server E-Mails ins
Log statt sie zu verschicken und sagt das beim Start: „SMTP is not configured".

Beim Eintragen: nach **jeder** Variable auf *Änderungen anwenden* klicken und die
Seite neu laden. Das Formular verwirft vorgemerkte Zeilen, wenn es zwischendurch
hängt — das ist mehrfach passiert.

## Die Datenbank

`~/chogar-data/chogar.db` — bewusst **außerhalb** des Deployment-Ordners, denn
den ersetzt Hostinger bei jedem Deployment vollständig. Läge die Datei dort,
wären nach jedem Push alle Mitgliederkonten weg.

Sicherung über *Dateien → Dateimanager*: den Ordner `chogar-data` herunterladen.
Im laufenden Betrieb nicht einfach kopieren — die Datenbank läuft im WAL-Modus;
`chogar.db-wal` und `chogar.db-shm` gehören dazu.

## Instructor-Konto

Beim allerersten Start auf einer leeren Datenbank legt der Server das Konto an
und schreibt das generierte Passwort **einmalig** ins Log. Zu finden unter
*Laufzeitprotokolle* — Zeitfilter auf **„Letzter Tag"** stellen, sonst ist die
Liste leer.

Passwort vergessen und keine Mail zur Hand? `CHOGAR_ADMIN_RESET_PASSWORD` mit dem
neuen Passwort anlegen, Deployment abwarten, anmelden — und die Variable
**sofort wieder löschen**. Solange sie existiert, setzt jeder Neustart das
Passwort erneut zurück, und sie steht im Klartext im Panel.

## E-Mail-Versand prüfen

Jeder Versand landet im Laufzeitprotokoll:

```
Mail sent to … ("Reset your password") — server said: 250 2.0.0 Ok: queued as …
Could not send mail to …: EAUTH Invalid login
```

`250 … queued` heißt: Hostinger hat die Nachricht angenommen. Kommt sie trotzdem
nicht an, liegt es an der Zustellung — zuerst den Spam-Ordner prüfen.

Die Handler warten inzwischen auf das Ergebnis des Versands. Das ist kein Detail:
Der Prozess wird auf dieser Plattform im Minutentakt recycelt, und ohne Warten
brach das SMTP-Gespräch mittendrin ab. Die Mail war dann weg, ohne jede Spur.

## Nach Änderungen

```bash
npm run build
```

```bash
git add -A && git commit -m "…" && git push
```

**`npm run build` ist Pflicht, wenn du CSS oder JavaScript anfasst** — nicht nur
zum Erzeugen von `dist/`. Der Schritt schreibt in jede HTML-Datei eine
Versionskennung aus dem Dateiinhalt, etwa `js/animations.js?v=36f12033`.

Der Grund: Hostingers CDN liefert `css/` und `js/` mit `max-age=604800` aus —
**eine Woche**. Ohne geänderte Adresse bekommen Besucher tagelang die alte
Datei, obwohl das Deployment längst durch ist. Das hat einmal Stunden gekostet:
Ein Fix an `animations.js` war live, im Browser lief weiter die Fassung von drei
Tagen zuvor. Die HTML-Dateien selbst kommen mit `max-age=0`, sind also immer
frisch — deshalb wirkt die Kennung sofort.

Prüfen lässt sich das so:

```bash
curl -sI https://chogarkungfu.com/js/animations.js | grep -i "age\|last-modified"
```

Ein hohes `age` bedeutet: Es kommt eine zwischengespeicherte Fassung. Mit
Versionskennung ist das unkritisch, weil jede Änderung eine neue Adresse ergibt.

## Checkliste, wenn etwas nicht geht

1. *Einsätze* — ist das letzte Deployment „Abgeschlossen"?
2. *Laufzeitprotokolle*, Zeitfilter „Letzter Tag" — läuft „Cho Gar Wing Chun
   running at…"? Steht dort ein Fehler?
3. `https://chogarkungfu.com/api/me` sollte `401` mit JSON liefern. Kommt HTML,
   läuft der Node-Prozess nicht und es wird nur statisch ausgeliefert.
4. Seite hart neu laden (`Strg`+`F5`) — der Browser merkt sich Fehlerseiten.
