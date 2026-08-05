# Deployment bei dogado

Diese Anleitung bringt die Seite samt Mitgliederbereich auf einen dogado-Server.
Domain in allen Beispielen: `kungfu-spirit.de` — bitte überall ersetzen.

## Kurzfazit: welches Produkt

**Das normale Webhosting (WEB S/M/L/XL 5.0) reicht nicht.** Dort laufen PHP,
Python und Ruby — Node.js steht auf der Produktseite nicht in der Feature-Liste.
Diese Anwendung ist ein dauerhaft laufender Node-Prozess (Express + SQLite über
`node:sqlite`) und braucht deshalb einen eigenen Server.

**Passend ist der kleinste vServer (Cloud Server S 4.0):** 2 vCPU, 4 GB RAM,
100 GB NVMe, voller Root-Zugriff per SSH. Das ist für diese Anwendung reichlich
dimensioniert — sie belegt im Leerlauf rund 60–80 MB RAM.

| Variante | Wann sinnvoll |
| --- | --- |
| **A: vServer, unmanaged, nginx + systemd** | Empfohlen. Volle Kontrolle, kein Plesk nötig, alles unten beschrieben. |
| **B: vServer mit Plesk + Node.js-Extension** | Wenn du lieber ein Webinterface bedienst. Plesk kostet bei dogado extra. |
| **C: Managed vServer** | Nur wenn dogado die Wartung übernehmen soll — dort hast du in der Regel **keine** Root-Rechte, die Node-Installation muss der Support einrichten. Vorher nachfragen. |

Vor der Bestellung würde ich dem Support (support@dogado.de, +49 231 2866 200)
eine Frage stellen: *„Kann ich auf dem Cloud Server S 4.0 (unmanaged) eigene
Node.js-Versionen per Root-SSH installieren und dauerhaft als systemd-Dienst
betreiben?"* — Antwort sollte ja sein, dann passt Variante A.

## Voraussetzungen

- **Node.js 24 LTS oder neuer.** Die App nutzt `node:sqlite`; auf Node 22.x lag
  das noch hinter `--experimental-sqlite`. Mit 24+ entfällt die Frage.
- Ein DNS-A-Record der Domain auf die IP des Servers.
- Ein E-Mail-Postfach für den Versand (dogado-Postfach genügt).

---

## Variante A: vServer mit nginx und systemd

### 1. Node.js installieren

Per SSH als root auf dem Server (Beispiel Ubuntu/Debian):

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt-get install -y nodejs
```

Prüfen:

```bash
node --version
```

### 2. Systembenutzer und Verzeichnis anlegen

Die App soll nicht als root laufen:

```bash
adduser --system --group --home /opt/chogar chogar && mkdir -p /opt/chogar/site && chown -R chogar:chogar /opt/chogar
```

### 3. Dateien hochladen

Vom eigenen Rechner aus, aus dem Projektordner heraus. `node_modules`, die
Datenbank und `.env` gehören **nicht** mit hoch:

```bash
rsync -avz --delete --exclude node_modules --exclude server/data --exclude server/.env ./ root@kungfu-spirit.de:/opt/chogar/site/
```

Ohne rsync geht auch SFTP (FileZilla, WinSCP) auf denselben Zielpfad. Danach:

```bash
chown -R chogar:chogar /opt/chogar/site
```

### 4. Abhängigkeiten installieren

```bash
cd /opt/chogar/site/server && sudo -u chogar npm install --omit=dev
```

### 5. Konfiguration anlegen

`/opt/chogar/site/server/.env` (Vorlage ist `.env.example`):

```bash
PORT=3000
NODE_ENV=production
TRUST_PROXY_HOPS=1
SITE_URL=https://kungfu-spirit.de

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=sifu@kungfu-spirit.de
SMTP_PASS=
MAIL_FROM=Cho Gar Wing Chun <sifu@kungfu-spirit.de>

CHOGAR_DATA_DIR=/opt/chogar/data
CHOGAR_ADMIN_USER=instructor
CHOGAR_ADMIN_PASSWORD=
CHOGAR_ADMIN_NAME=Sifu Nils Ring
CHOGAR_ADMIN_EMAIL=sifu@kungfu-spirit.de
```

`SMTP_HOST` und `SMTP_PASS` stehen im dogado-Kundenportal bei den Postfach-
Einstellungen. Solange `SMTP_HOST` leer ist, wird **keine** Mail verschickt —
die Nachrichten landen nur im Log.

Rechte einschränken, die Datei enthält Zugangsdaten:

```bash
chown chogar:chogar /opt/chogar/site/server/.env && chmod 600 /opt/chogar/site/server/.env && mkdir -p /opt/chogar/data && chown chogar:chogar /opt/chogar/data
```

### 6. systemd-Dienst einrichten

`/etc/systemd/system/chogar.service`:

```ini
[Unit]
Description=Cho Gar Wing Chun member backend
After=network.target

[Service]
Type=simple
User=chogar
Group=chogar
WorkingDirectory=/opt/chogar/site/server
ExecStart=/usr/bin/node --env-file=/opt/chogar/site/server/.env server.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/chogar/data

[Install]
WantedBy=multi-user.target
```

Starten und beim Booten aktivieren:

```bash
systemctl daemon-reload && systemctl enable --now chogar && systemctl status chogar
```

### 7. Erststart: Instructor-Passwort abholen

Beim allerersten Start legt die App das Instructor-Konto an und schreibt das
generierte Passwort **einmalig** ins Log:

```bash
journalctl -u chogar --since "10 minutes ago"
```

Notieren. Alternativ jederzeit selbst setzen:

```bash
sudo -u chogar node /opt/chogar/site/server/set-password.js instructor "dein neues Passwort"
```

### 8. nginx als Reverse Proxy

```bash
apt-get install -y nginx
```

`/etc/nginx/sites-available/chogar`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name kungfu-spirit.de www.kungfu-spirit.de;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktivieren:

```bash
ln -s /etc/nginx/sites-available/chogar /etc/nginx/sites-enabled/ && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl reload nginx
```

`X-Forwarded-For` ist wichtig: die App vertraut in Produktion genau einem Proxy
(`TRUST_PROXY_HOPS=1`), damit die Login-Bremse pro echter Besucher-IP greift.

### 9. HTTPS mit Let's Encrypt

```bash
apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d kungfu-spirit.de -d www.kungfu-spirit.de
```

Certbot trägt die TLS-Konfiguration selbst in den nginx-Block ein und erneuert
automatisch. Erst ab hier setzt die App das Session-Cookie mit `Secure` — dafür
muss `NODE_ENV=production` gesetzt sein (ist es in Schritt 5).

### 10. Firewall

Node soll nur lokal erreichbar sein, nach außen nur 80/443 und SSH:

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

---

## Variante B: vServer mit Plesk

Plesk bringt eine Node.js-Extension mit (Passenger). Grober Ablauf:

1. Extension „Node.js" in Plesk installieren.
2. Domain anlegen, Dokumentenstamm auf das hochgeladene Projekt zeigen lassen.
3. Unter *Websites & Domains → Node.js*: Application Root `/…/server`,
   Application Startup File `server.js`, Node-Version 24+ wählen.
4. Umgebungsvariablen aus Schritt 5 oben in der Plesk-Oberfläche eintragen —
   Plesk lädt keine `.env`-Datei von selbst.
5. „NPM install" klicken, dann „Restart App".
6. SSL über *Let's Encrypt* in Plesk aktivieren.

Wichtig: `CHOGAR_DATA_DIR` auf einen Pfad **außerhalb** des Dokumentenstamms
legen, sonst wäre die Datenbank theoretisch über HTTP erreichbar.

---

## Updates einspielen

Nach Änderungen am Projekt vom eigenen Rechner aus:

```bash
rsync -avz --delete --exclude node_modules --exclude server/data --exclude server/.env ./ root@kungfu-spirit.de:/opt/chogar/site/
```

Danach auf dem Server:

```bash
cd /opt/chogar/site/server && sudo -u chogar npm install --omit=dev && systemctl restart chogar
```

Reine Änderungen an HTML/CSS/JS brauchen keinen Neustart — die Dateien werden
direkt von der Platte ausgeliefert.

## Backup

Alle Mitgliederdaten liegen in einer einzigen Datei. Täglich sichern:

```bash
sqlite3 /opt/chogar/data/chogar.db ".backup '/opt/chogar/backup/chogar-$(date +%F).db'"
```

Die Datenbank läuft im WAL-Modus — deshalb `.backup` benutzen und nicht die
Datei im laufenden Betrieb einfach kopieren. dogado sichert den Server zusätzlich
täglich, das ersetzt aber kein eigenes Backup, das du auch herunterlädst.

## Checkliste vor dem Livegang

- [ ] `NODE_ENV=production` gesetzt (sonst Cookie ohne `Secure` — die App warnt im Log)
- [ ] `SITE_URL` auf die echte HTTPS-Adresse (Passwort-Reset-Links werden daraus gebaut)
- [ ] SMTP eingetragen und eine Test-Registrierung durchgeklickt
- [ ] Instructor-Passwort geändert
- [ ] `https://kungfu-spirit.de/server/` liefert 404 (die App blockt den Ordner)
- [ ] Backup läuft und wurde einmal zurückgespielt
- [ ] Impressum und Datenschutzerklärung mit dem tatsächlichen Hoster ergänzt:
      in `privacy.html` Abschnitt 4 (Hosting) und 9 (E-Mail-Versand) stehen
      „externer Dienstleister" ohne Namen. Mit dogado einen AV-Vertrag nach
      Art. 28 DSGVO abschließen (im Kundenportal abrufbar).
