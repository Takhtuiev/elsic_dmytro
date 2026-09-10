import React from "react";
import {Container,List,ListItem,ListItemText,Typography} from "@mui/material";

export default function Datenschutz(){
    return (
        <Container maxWidth="md" sx={{py:6}}>
            <Typography variant="h4" gutterBottom>
                Datenschutzerklärung
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{mb:4}}>
                Stand: September 2026
            </Typography>

            <Typography variant="h6" gutterBottom>
                1. Verantwortlicher
            </Typography>

            <Typography sx={{mb:2}}>
                Verantwortlicher für die Verarbeitung personenbezogener Daten auf
                dieser Website ist:
            </Typography>

            <Typography sx={{mb:2}}>
                Dmytro Takhtuiev<br/>
                Schäferstraße 81 <br/>
                41239 Mönchengladbach<br/>
                Deutschland<br/>
                E-Mail: takhtuiev@gmail.com
            </Typography>

            <Typography sx={{mb:3}}>
                Diese Website ist ein privates persönliches Projekt und steht nicht
                im Auftrag oder im Namen eines Unternehmens.
            </Typography>

            <Typography variant="h6" gutterBottom>
                2. Allgemeine Informationen zur Datenverarbeitung
            </Typography>

            <Typography sx={{mb:2}}>
                Der Schutz Ihrer personenbezogenen Daten ist mir wichtig.
                Personenbezogene Daten werden auf dieser Website nur verarbeitet,
                soweit dies für den Betrieb der Website, die Bereitstellung der
                Funktionen, die Benutzeranmeldung sowie die Speicherung vom
                Benutzer erstellter Inhalte erforderlich ist.
            </Typography>

            <Typography sx={{mb:3}}>
                Eine Verarbeitung zu Werbe-, Marketing- oder Analysezwecken findet
                nicht statt.
            </Typography>

            <Typography variant="h6" gutterBottom>
                3. Hosting durch Render
            </Typography>

            <Typography sx={{mb:2}}>
                Diese Website wird über den Dienst Render bereitgestellt.
                Beim Aufruf der Website können technisch erforderliche
                Verbindungsdaten verarbeitet werden. Dazu können insbesondere
                IP-Adresse, Datum und Uhrzeit des Zugriffs sowie technische
                Informationen über das verwendete Endgerät und den Browser gehören.
            </Typography>

            <Typography sx={{mb:3}}>
                Die Verarbeitung erfolgt zur technischen Bereitstellung,
                Stabilität und Sicherheit der Website.
            </Typography>

            <Typography variant="h6" gutterBottom>
                4. Benutzerkonto und Authentifizierung durch Clerk
            </Typography>

            <Typography sx={{mb:2}}>
                Für Registrierung, Anmeldung und Benutzerverwaltung wird der
                Dienst Clerk verwendet.
            </Typography>

            <Typography sx={{mb:2}}>
                Im Rahmen der Registrierung und Anmeldung können insbesondere
                folgende Daten verarbeitet werden:
            </Typography>

            <List dense sx={{mb:2}}>
                <ListItem>
                    <ListItemText primary="E-Mail-Adresse" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Name, soweit vom Benutzer angegeben" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="technische Daten zur Authentifizierung und Kontosicherheit" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Benutzer-ID zur eindeutigen Zuordnung des Benutzerkontos" />
                </ListItem>
            </List>

            <Typography sx={{mb:2}}>
                Clerk wird außerdem für die Verwaltung von Benutzerkonten,
                Sitzungen, Organisationen und Benutzerrollen verwendet.
            </Typography>

            <Typography sx={{mb:3}}>
                Die Verarbeitung dieser Daten erfolgt zur Bereitstellung der
                Benutzerfunktionen und zur sicheren Authentifizierung.
            </Typography>

            <Typography variant="h6" gutterBottom>
                5. Automatische Zuordnung zu einer Organisation
            </Typography>

            <Typography sx={{mb:2}}>
                Bei einer neuen Registrierung kann die Benutzer-ID über eine
                serverseitige Schnittstelle verarbeitet werden, um den Benutzer
                automatisch einer bestehenden Organisation zuzuordnen.
            </Typography>

            <Typography sx={{mb:3}}>
                Für diese serverseitige Verarbeitung wird Vercel verwendet.
                Dabei werden nur die für diesen Vorgang erforderlichen technischen
                Informationen, insbesondere die Benutzer-ID, verarbeitet.
            </Typography>

            <Typography variant="h6" gutterBottom>
                6. Speicherung technischer Daten und Benutzerinhalte bei Neon
            </Typography>

            <Typography sx={{mb:2}}>
                Für die Speicherung bestimmter Daten wird eine PostgreSQL-
                Datenbank des Dienstes Neon verwendet.
            </Typography>

            <Typography sx={{mb:2}}>
                In der Datenbank können insbesondere folgende Daten gespeichert
                werden:
            </Typography>

            <List dense sx={{mb:2}}>
                <ListItem>
                    <ListItemText primary="technische Materialdaten" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="vom Benutzer erstellte technische Profile" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Geometrien, Parameter und Berechnungseinstellungen" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="die zur Zuordnung erforderliche Benutzer-ID" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Zeitstempel der Erstellung oder Änderung" />
                </ListItem>
            </List>

            <Typography sx={{mb:2}}>
                Die Benutzer-ID kann verwendet werden, damit ein angemeldeter
                Benutzer seine gespeicherten Profile nach einer späteren
                Anmeldung wieder aufrufen und bearbeiten kann.
            </Typography>

            <Typography sx={{mb:3}}>
                Die Speicherung erfolgt zur Bereitstellung dieser Funktionen.
            </Typography>

            <Typography variant="h6" gutterBottom>
                7. Rechtsgrundlage
            </Typography>

            <Typography sx={{mb:2}}>
                Soweit personenbezogene Daten zur Bereitstellung der von Ihnen
                angeforderten Funktionen verarbeitet werden, erfolgt die
                Verarbeitung auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO,
                soweit die Verarbeitung für die Erfüllung der damit verbundenen
                Vereinbarung erforderlich ist.
            </Typography>

            <Typography sx={{mb:3}}>
                Soweit die Verarbeitung für den sicheren und technisch
                ordnungsgemäßen Betrieb der Website erforderlich ist, erfolgt sie
                auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Das berechtigte
                Interesse liegt insbesondere in der Sicherheit, Stabilität und
                Funktionsfähigkeit der Website.
            </Typography>

            <Typography variant="h6" gutterBottom>
                8. Cookies und Sitzungsdaten
            </Typography>

            <Typography sx={{mb:2}}>
                Die Website verwendet technisch erforderliche Cookies bzw.
                vergleichbare Speichertechnologien, soweit diese für Anmeldung,
                Sitzungsverwaltung und sichere Nutzung erforderlich sind.
            </Typography>

            <Typography sx={{mb:3}}>
                Es werden keine Cookies zu Werbe- oder Trackingzwecken eingesetzt.
                Eine Nutzung von Google Analytics, Meta Pixel, Hotjar, Microsoft
                Clarity oder vergleichbaren Analyse- und Marketingdiensten findet
                nicht statt.
            </Typography>

            <Typography variant="h6" gutterBottom>
                9. Empfänger und eingesetzte Dienstleister
            </Typography>

            <Typography sx={{mb:2}}>
                Im Rahmen des technischen Betriebs können personenbezogene Daten
                durch folgende technische Dienstleister verarbeitet werden:
            </Typography>

            <List dense sx={{mb:2}}>
                <ListItem>
                    <ListItemText
                        primary="Render"
                        secondary="Hosting und technische Bereitstellung der Website"
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary="Clerk"
                        secondary="Authentifizierung, Benutzerkonten, Sitzungen und Organisationen"
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary="Vercel"
                        secondary="Serverseitige API-Funktion zur technischen Verarbeitung bei der Benutzerregistrierung"
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary="Neon"
                        secondary="Speicherung technischer Daten und vom Benutzer erstellter Inhalte"
                    />
                </ListItem>
            </List>

            <Typography sx={{mb:3}}>
                Die genannten Dienste können Daten auch außerhalb der Europäischen
                Union bzw. des Europäischen Wirtschaftsraums verarbeiten. Soweit
                hierfür erforderlich, erfolgt die Übermittlung auf Grundlage der
                nach der DSGVO zulässigen Übermittlungsmechanismen.
            </Typography>

            <Typography variant="h6" gutterBottom>
                10. Speicherdauer
            </Typography>

            <Typography sx={{mb:2}}>
                Personenbezogene Daten werden nur so lange gespeichert, wie dies
                für die jeweiligen Zwecke erforderlich ist oder gesetzliche
                Aufbewahrungspflichten bestehen.
            </Typography>

            <Typography sx={{mb:3}}>
                Benutzerbezogene technische Profile werden grundsätzlich so lange
                gespeichert, wie sie für die Bereitstellung der jeweiligen
                Funktion benötigt werden. Bei Löschung des Benutzerkontos können
                die diesem Benutzerkonto zugeordneten Daten gelöscht werden,
                soweit keine gesetzlichen Gründe für eine weitere Speicherung
                bestehen.
            </Typography>

            <Typography variant="h6" gutterBottom>
                11. Datensicherheit
            </Typography>

            <Typography sx={{mb:2}}>
                Es werden angemessene technische und organisatorische Maßnahmen
                eingesetzt, um personenbezogene Daten vor Verlust, Missbrauch,
                unbefugtem Zugriff, Veränderung oder Offenlegung zu schützen.
            </Typography>

            <Typography sx={{mb:3}}>
                Dazu gehören insbesondere die Verwendung verschlüsselter
                Verbindungen sowie die Nutzung von Authentifizierungs- und
                Zugriffskontrollen.
            </Typography>

            <Typography variant="h6" gutterBottom>
                12. Ihre Rechte
            </Typography>

            <Typography sx={{mb:2}}>
                Sie haben nach Maßgabe der gesetzlichen Voraussetzungen insbesondere
                folgende Rechte:
            </Typography>

            <List dense sx={{mb:2}}>
                <ListItem>
                    <ListItemText primary="Recht auf Auskunft gemäß Art. 15 DSGVO" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Recht auf Berichtigung gemäß Art. 16 DSGVO" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Recht auf Löschung gemäß Art. 17 DSGVO" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Recht auf Einschränkung der Verarbeitung gemäß Art. 18 DSGVO" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Recht auf Datenübertragbarkeit gemäß Art. 20 DSGVO" />
                </ListItem>
                <ListItem>
                    <ListItemText primary="Recht auf Widerspruch gemäß Art. 21 DSGVO" />
                </ListItem>
            </List>

            <Typography sx={{mb:3}}>
                Zur Ausübung Ihrer Rechte können Sie sich an die oben angegebene
                Kontaktadresse wenden.
            </Typography>

            <Typography variant="h6" gutterBottom>
                13. Beschwerderecht bei einer Aufsichtsbehörde
            </Typography>

            <Typography sx={{mb:3}}>
                Sie haben das Recht, sich bei einer Datenschutzaufsichtsbehörde
                über die Verarbeitung Ihrer personenbezogenen Daten zu beschweren.
            </Typography>

            <Typography variant="h6" gutterBottom>
                14. Änderungen dieser Datenschutzerklärung
            </Typography>

            <Typography sx={{mb:2}}>
                Diese Datenschutzerklärung kann angepasst werden, wenn sich die
                technischen Funktionen der Website oder die rechtlichen
                Anforderungen ändern.
            </Typography>

            <Typography>
                Maßgeblich ist jeweils die auf dieser Website veröffentlichte
                aktuelle Fassung.
            </Typography>
        </Container>
    );
}
