import React from "react";
import {
    Box,
    Container,
    Paper,
    Stack,
    Typography,
    List,
    ListItem,
    Chip,
    Grid
} from "@mui/material";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const bodySx = {
    color: "text.secondary",
    lineHeight: 1.75
};

function Formula({
                     children,
                     title,
                     source
                 }: {
    children: string;
    title: string;
    source: React.ReactNode;
}) {
    return (
        <Paper
            variant="outlined"
            sx={{
                my: 2.5,
                px: { xs: 1, sm: 3 },
                py: { xs: 2, sm: 2.5 },
                overflowX: "auto",
                borderRadius: 2,
                bgcolor: "grey.50",
                borderColor: "grey.200",
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)"
            }}
        >
            <Typography
                variant="subtitle2"
                sx={{
                    color: "text.primary",
                    fontWeight: 700,
                    mb: 1
                }}
            >
                {title}
            </Typography>

            <Box
                sx={{
                    "& .katex": {
                        fontSize: {
                            xs: "1.05rem",
                            sm: "1.25rem"
                        }
                    }
                }}
            >
                <BlockMath math={children} />
            </Box>

            <Typography
                variant="caption"
                sx={{
                    display: "block",
                    mt: 1.5,
                    color: "text.secondary",
                    lineHeight: 1.5
                }}
            >
                <b>Quelle:</b> {source}
            </Typography>
        </Paper>
    );
}

function FlowBox({ children }: { children: React.ReactNode }) {
    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                textAlign: "center",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 2,
                bgcolor: "background.paper"
            }}
        >
            <Typography
                variant="body2"
                fontWeight={600}
            >
                {children}
            </Typography>
        </Paper>
    );
}

function StyledListItem({ children }: { children: React.ReactNode }) {
    return (
        <ListItem
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.25,
                py: 1,
                px: 0,
                borderBottom: "1px solid",
                borderColor: "divider",
                "&:last-child": {
                    borderBottom: "none"
                }
            }}
        >
            <Box
                sx={{
                    width: 6,
                    height: 6,
                    minWidth: 6,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    mt: "0.65em"
                }}
            />

            <Typography
                variant="body1"
                sx={{
                    ...bodySx,
                    flex: 1
                }}
            >
                {children}
            </Typography>
        </ListItem>
    );
}

const sections = [
    {
        number: "1",
        title: "Auswahl der Berechnungsmethode",
        content: (
            <>
                <Typography sx={bodySx}>
                    Für die Abschätzung der Aufheizzeit thermoplastischer
                    Werkstücke können unterschiedliche mathematische Ansätze
                    verwendet werden – von einfachen empirischen Beziehungen
                    bis hin zur instationären numerischen Berechnung des
                    Temperaturfeldes über die Werkstückdicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    <b>1. Empirischer Ansatz – Potenzabhängigkeit</b><br />
                    Eine einfache Möglichkeit besteht darin, die Aufheizzeit
                    über einen empirischen Zusammenhang mit der Materialdicke
                    zu beschreiben:
                </Typography>

                <Formula
                    title="Empirische Potenzabhängigkeit der Aufheizzeit"
                    source={
                        <>
                            Allgemeine Form eines empirischen Zusammenhangs
                            zwischen Aufheizzeit und Materialdicke.
                            In der zuvor betrachteten Näherung wurde der
                            Exponent <b>n = 1,35</b> verwendet. Dieser Wert
                            ist ein Parameter einer bestimmten empirischen
                            Beziehung und keine universelle physikalische
                            Konstante.
                        </>
                    }
                >
                    {String.raw`t \sim s^{\,n}`}
                </Formula>

                <Typography sx={{ ...bodySx, mt: 1 }}>
                    <i>Einschränkung:</i> Dieser Ansatz liefert lediglich
                    eine schnelle technische Abschätzung. Er beschreibt weder
                    das Temperaturfeld im Inneren des Werkstücks noch die
                    konkreten Wärmeübertragungsbedingungen der Heizzone.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    <b>
                        2. Analytischer Ansatz – klassische Lösungen
                        der Wärmeleitungsgleichung
                    </b><br />
                    Für einfache Geometrien können analytische Lösungen der
                    instationären Wärmeleitungsgleichung, beispielsweise in
                    Form von Fourier-Reihen, zur Berechnung der
                    Temperaturverteilung verwendet werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 1 }}>
                    <i>Einschränkung:</i> Solche Lösungen setzen stark
                    vereinfachte Geometrien, Randbedingungen und
                    thermophysikalische Eigenschaften voraus. Bei einer
                    konkreten Heizzone mit beidseitiger Erwärmung,
                    Strahlung, Konvektion, temperaturabhängigen
                    Materialeigenschaften und anschließender Abkühlung
                    wird die analytische Beschreibung deutlich komplexer.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    <b>
                        3. Gewählter Ansatz – instationäre numerische
                        Modellierung
                    </b><br />
                    Für die vorliegende Anwendung wird daher ein
                    instationäres numerisches Modell des Temperaturfeldes
                    verwendet. Dieser Ansatz ermöglicht die Berücksichtigung
                    der konkreten Heizkonfiguration sowie der zeitlichen
                    Entwicklung der Temperatur über die Werkstückdicke.
                </Typography>

                <List component="ul" sx={{ mt: 1.5, p: 0 }}>
                    <StyledListItem>
                        Beidseitige Erwärmung des Werkstücks durch die
                        betrachtete Heizanlage mit Rohrheizelementen.
                    </StyledListItem>

                    <StyledListItem>
                        Strahlungs- und Konvektionswärmeübertragung
                        an den Werkstückoberflächen.
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturabhängige thermophysikalische
                        Eigenschaften des Werkstoffs.
                    </StyledListItem>

                    <StyledListItem>
                        Zeitabhängige Temperaturverteilung über die
                        gesamte Werkstückdicke.
                    </StyledListItem>

                    <StyledListItem>
                        Übergang von der Heizzone in die Transport- und
                        Abkühlphase.
                    </StyledListItem>

                    <StyledListItem>
                        Überwachung des Formungstemperaturbereichs und
                        der Temperatur des beginnenden thermischen Abbaus.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der numerische Ansatz ermöglicht damit nicht nur die
                    Bestimmung der Aufheizzeit, sondern auch die Berechnung
                    des thermischen Zustands des Werkstücks und der
                    Temperaturverteilung über seine Dicke.
                </Typography>
            </>
        )
    },

    {
        number: "2",
        title: "Wissenschaftliche Grundlage und Anpassung an Rohrheizelemente",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die wissenschaftliche Grundlage der vorliegenden
                    Berechnung bilden Arbeiten von Buffel und seinen
                    Mitautoren zur experimentellen und numerischen
                    Untersuchung der Erwärmung thermoplastischer Platten
                    beim Thermoformen.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Buffel et al. (2015) entwickelten ein
                    Finite-Differenzen-Modell zur Berechnung der
                    zeitabhängigen Temperaturverteilung über die Dicke
                    einer thermoplastischen Platte. In der Untersuchung
                    wurden unter anderem Halogen- und Keramikheizelemente
                    betrachtet. Die Autoren zeigen dabei, dass sich die
                    Temperaturverteilung über die Dicke während der
                    Erwärmung deutlich verändern kann.
                </Typography>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        mt: 1.5,
                        lineHeight: 1.6
                    }}
                >
                    Buffel, B.; Amerijckx, M.; Hamblok, M.; Van Mieghem, B.;
                    Desplentere, F.; Van Bael, A. (2015).{" "}
                    <i>
                        Experimental and Computational Analysis of the Heating
                        Step during Thermoforming of Thermoplastics.
                    </i>{" "}
                    <i>Key Engineering Materials</i>, Volumes 651–653,
                    1003–1008. Trans Tech Publications.
                    DOI: 10.4028/www.scientific.net/KEM.651-653.1003
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Für die vorliegende Anwendung ist insbesondere die
                    unterschiedliche spektrale Wirkung verschiedener
                    Heizertypen relevant. Buffel et al. beschreiben
                    Unterschiede zwischen Halogen- und Keramikheizungen
                    und diskutieren den Einfluss der spektralen Eigenschaften
                    der Wärmestrahlung auf die Temperaturverteilung über
                    die Materialdicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Gleichzeitig ist zu beachten, dass die in der Arbeit
                    von Buffel et al. (2015) beschriebene
                    Finite-Differenzen-Berechnung selbst keine explizite
                    Modellierung der Durchdringung der Strahlungsenergie
                    in die Materialtiefe enthält. Die Wärmeübertragung
                    wird über die Randbedingungen an den Oberflächen
                    beschrieben.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Für die vorliegende Anwendung wird daher nicht das
                    Wärmemodell eines bestimmten IR-Heizertyps unverändert
                    übernommen. Stattdessen wird die grundlegende
                    numerische Vorgehensweise an die tatsächlich
                    verwendeten Rohrheizelemente und die konkrete
                    Heizanlage angepasst.
                </Typography>

                <Paper
                    variant="outlined"
                    sx={{
                        mt: 2.5,
                        p: 2.5,
                        borderRadius: 2,
                        bgcolor: "grey.50"
                    }}
                >
                    <Typography
                        sx={{
                            fontWeight: 700,
                            color: "text.primary",
                            mb: 1
                        }}
                    >
                        Anpassung des Modells an die verwendeten
                        Rohrheizelemente
                    </Typography>

                    <Typography
                        sx={{
                            ...bodySx,
                            color: "text.secondary"
                        }}
                    >
                        Die Rohrheizelemente werden in diesem Modell
                        als thermische Strahlungsquellen betrachtet.
                        Eine separate volumetrische Modellierung der
                        Strahlungsabsorption innerhalb der Werkstückdicke
                        wird nicht verwendet. Der Wärmeeintrag wird
                        stattdessen über eine thermische Randbedingung
                        an der Werkstückoberfläche beschrieben. Die
                        anschließende Erwärmung des Werkstoffs über die
                        Dicke wird durch die Wärmeleitungsgleichung
                        berechnet.
                    </Typography>
                </Paper>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Diese Anpassung ist eine bewusste Modellierungsentscheidung
                    für die betrachtete Heizkonfiguration. Die aus den
                    Arbeiten von Buffel übernommene numerische Grundidee
                    wird dabei mit einer an die Rohrheizelemente, deren
                    Anordnung und die konkrete Geometrie der Heizzone
                    angepassten Oberflächenrandbedingung verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Arbeit von Buffel et al. (2017) ergänzt diesen
                    Ansatz durch eine kombinierte experimentelle und
                    modellbasierte Methodik zur Charakterisierung von
                    Heizanlagen und zur Bestimmung geeigneter
                    Heizstrategien. Dabei werden Parameter der
                    Heizanlage und der Umgebung berücksichtigt und
                    mit experimentellen Untersuchungen kombiniert.
                </Typography>

                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                        mt: 1.5,
                        lineHeight: 1.6
                    }}
                >
                    Buffel, B.; Van Mieghem, B.; Van Bael, A.;
                    Desplentere, F. (2017).{" "}
                    <i>
                        A Combined Experimental and Modelling Approach
                        towards an Optimized Heating Strategy in Thermoforming
                        of Thermoplastics Sheets.
                    </i>{" "}
                    <i>International Polymer Processing</i>,
                    32(3), 378–386. Hanser Publishers.
                    DOI: 10.3139/217.3370
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Für die vorliegende Anwendung werden diese
                    wissenschaftlichen Grundlagen nicht als fertiges
                    Rechenmodell übernommen. Sie dienen als Ausgangspunkt
                    für eine eigene technische Implementierung, die auf
                    die verwendeten Rohrheizelemente, deren Geometrie,
                    den Wärmeeintrag, die Abstände, die Konvektion, den
                    beidseitigen Heizbetrieb sowie die anschließende
                    Transport- und Abkühlphase zugeschnitten ist.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die wissenschaftlichen Veröffentlichungen bilden somit
                    die Grundlage des methodischen Ansatzes. Die konkrete
                    Anpassung an die Rohrheizelemente, die Geometrie der
                    Heizzone, die numerische Implementierung, die
                    Berechnungsparameter, die Abfolge der Prozessphasen
                    und die Abbruchkriterien sind Bestandteil des für
                    diese Anwendung entwickelten Berechnungsmodells.
                </Typography>
            </>
        )
    },

    {
        number: "3",
        title: "Aufgabenstellung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die Berechnung bestimmt die zeitliche Entwicklung
                    der Werkstücktemperatur während der beidseitigen
                    Erwärmung durch die betrachtete Heizanlage mit
                    Rohrheizelementen und während der anschließenden
                    Abkühlung beim Transport zur Biegestation.
                </Typography>

                <List component="ul" sx={{ mt: 1.5, p: 0 }}>
                    <StyledListItem>
                        Geometrie und thermische Wirksamkeit der Heizzone.
                    </StyledListItem>

                    <StyledListItem>
                        Temperatur und thermische Parameter der
                        Rohrheizelemente.
                    </StyledListItem>

                    <StyledListItem>
                        Abstand zwischen Heizelementen und Werkstück.
                    </StyledListItem>

                    <StyledListItem>
                        Materialdicke und thermophysikalische Eigenschaften.
                    </StyledListItem>

                    <StyledListItem>
                        Strahlungswärmeübertragung von der Heizzone
                        auf die Werkstückoberflächen.
                    </StyledListItem>

                    <StyledListItem>
                        Konvektive Wärmeübertragung an den
                        Werkstückoberflächen.
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturabhängige Materialeigenschaften.
                    </StyledListItem>

                    <StyledListItem>
                        Wärmeleitung innerhalb des Werkstücks.
                    </StyledListItem>

                    <StyledListItem>
                        Abkühlung nach dem Verlassen der Heizzone.
                    </StyledListItem>

                    <StyledListItem>
                        Transportzeit zur Biegestation.
                    </StyledListItem>

                    <StyledListItem>
                        Zielbereich der Formungstemperatur und
                        Schutzgrenze gegen thermischen Abbau.
                    </StyledListItem>
                </List>
            </>
        )
    },

    {
        number: "4",
        title: "Physikalisches Modell von PVC bei Erwärmung mit Rohrheizelementen",
        content: (
            <>
                <Typography sx={bodySx}>
                    Das Werkstück wird als opake thermoplastische Platte
                    betrachtet. Für die vorliegende Modellierung wird
                    angenommen, dass die durch die Rohrheizelemente
                    eingebrachte Strahlungsenergie nicht als separater
                    volumetrischer Wärmeeintrag innerhalb der
                    Werkstückdicke berücksichtigt werden muss.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Rohrheizelemente sind thermische Strahlungsquellen.
                    Sie besitzen keine einzelne, fest definierte
                    Strahlungswellenlänge. Das Emissionsspektrum hängt
                    insbesondere von der Temperatur und den
                    Oberflächeneigenschaften des Heizelements ab.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    In dieser Anwendung wird deshalb keine
                    spektralabhängige Absorption der Strahlung über
                    verschiedene Tiefen des Werkstücks berechnet.
                    Stattdessen wird der Wärmeeintrag als thermische
                    Randbedingung an der Werkstückoberfläche formuliert.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Von der Oberfläche aus wird die Wärme innerhalb
                    des Materials durch Wärmeleitung über die
                    Werkstückdicke weitergeleitet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Diese Vereinfachung ist Bestandteil des für die
                    betrachtete Heizkonfiguration entwickelten Modells.
                    Sie stellt kein allgemeines physikalisches Gesetz
                    für alle thermoplastischen Werkstoffe oder alle
                    Arten von Infrarotstrahlern dar.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die räumliche Betrachtung wird auf die Werkstückdicke
                    reduziert. Ein Wärmetransport innerhalb der
                    Plattenebene wird in diesem Modell nicht berücksichtigt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das zentrale Ergebnis der inneren thermischen
                    Berechnung ist die zeitabhängige Temperaturverteilung
                    über die gesamte Werkstückdicke.
                </Typography>
            </>
        )
    },

    {
        number: "5",
        title: "Mathematisches Modell",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die Temperaturänderung innerhalb des Werkstoffs wird
                    durch die instationäre Wärmeleitungsgleichung mit
                    temperaturabhängigen thermophysikalischen Eigenschaften
                    beschrieben.
                </Typography>

                <Formula
                    title="Instationäre Wärmeleitungsgleichung"
                    source={
                        <>
                            Allgemeine Gleichung der instationären
                            Wärmeleitung. Ihre eindimensionale Anwendung
                            über die Werkstückdicke bildet die physikalisch-
                            mathematische Grundlage des verwendeten
                            numerischen Modells.
                        </>
                    }
                >
                    {String.raw`\rho(T) C_p(T) \frac{\partial T}{\partial t} = \frac{\partial}{\partial x} \left[ \lambda(T)\frac{\partial T}{\partial x} \right]`}
                </Formula>

                <Typography sx={bodySx}>
                    Dabei gilt:
                </Typography>

                <List component="ul" sx={{ mt: 1.5, p: 0 }}>
                    <StyledListItem>
                        <b>ρ(T)</b> — Dichte des Materials;
                    </StyledListItem>

                    <StyledListItem>
                        <b>C<sub>p</sub>(T)</b> — spezifische Wärmekapazität;
                    </StyledListItem>

                    <StyledListItem>
                        <b>λ(T)</b> — Wärmeleitfähigkeit;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T</b> — Temperatur;
                    </StyledListItem>

                    <StyledListItem>
                        <b>x</b> — Koordinate über die Werkstückdicke;
                    </StyledListItem>

                    <StyledListItem>
                        <b>t</b> — Zeit.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die konkrete Berechnung verwendet die aktuellen
                    temperaturabhängigen Materialeigenschaften der
                    jeweiligen Rechenschicht. Dadurch wird berücksichtigt,
                    dass sich die thermische Reaktion des Werkstoffs
                    während des Aufheizens verändert.
                </Typography>
            </>
        )
    },

    {
        number: "6",
        title: "Numerisches Lösungsverfahren",
        content: (
            <>
                <Typography sx={bodySx}>
                    Zur Lösung der Wärmeleitungsgleichung wird eine
                    implizite Finite-Differenzen-Methode verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Werkstück wird über seine Dicke in ein
                    eindimensionales Rechengitter aufgeteilt. Die
                    räumliche Auflösung wird aus der Materialdicke
                    abgeleitet und innerhalb des vorgegebenen Bereichs
                    gehalten.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    In der aktuellen Implementierung werden ungefähr
                    20–22 Rechenzellen über die Werkstückdicke verwendet.
                    Der zeitliche Berechnungsschritt beträgt 0,2 Sekunden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das implizite Verfahren berechnet den neuen
                    Temperaturzustand aus dem vorhergehenden Zustand.
                    Dadurch kann die zeitliche Entwicklung des
                    Temperaturfeldes schrittweise und numerisch stabil
                    verfolgt werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Für jeden Zeitschritt werden die thermischen
                    Randbedingungen an den beiden Oberflächen sowie der
                    Wärmeaustausch zwischen den benachbarten
                    Materialschichten berücksichtigt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Da die Materialeigenschaften von der Temperatur
                    abhängen, werden Temperatur und Materialparameter
                    innerhalb eines Zeitschritts iterativ aktualisiert.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach der räumlichen Diskretisierung entsteht ein
                    dreidiagonales Gleichungssystem. Dieses wird mit dem
                    Thomas-Algorithmus gelöst.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das berechnete Temperaturfeld dient anschließend als
                    Ausgangszustand für den nächsten Zeitschritt.
                </Typography>
            </>
        )
    },

    {
        number: "7",
        title: "Wärmeübertragung an den Werkstückoberflächen",
        content: (
            <>
                <Typography sx={bodySx}>
                    In der vorliegenden Heizzone mit Rohrheizelementen
                    wird der Wärmeeintrag an die Werkstückoberflächen
                    über Strahlungs- und Konvektionswärmeübertragung
                    beschrieben.
                </Typography>

                <Formula
                    title="Gesamter Wärmestrom an der Oberfläche"
                    source={
                        <>
                            Energiebilanz der verwendeten
                            Oberflächenrandbedingung. Die Aufteilung in
                            Strahlungs- und Konvektionsanteil ist Bestandteil
                            der vorliegenden Modellimplementierung.
                        </>
                    }
                >
                    {String.raw`q_{\mathrm{total}} = q_{\mathrm{rad}} + q_{\mathrm{conv}}`}
                </Formula>

                <Typography sx={bodySx}>
                    Der Strahlungsanteil beschreibt den Wärmeeintrag
                    von den Rohrheizelementen auf die Werkstückoberfläche.
                    Dabei werden die Temperatur der Heizelemente und
                    die geometrische Anordnung zwischen Heizelementen
                    und Werkstück berücksichtigt.
                </Typography>

                <Formula
                    title="Strahlungswärmestrom"
                    source={
                        <>
                            Auf dem Stefan-Boltzmann-Gesetz basierende
                            Randbedingung für den Strahlungsaustausch.
                            Die effektive Beschreibung des
                            Strahlungsaustauschs mit Emissionsgrad und
                            geometrischem Sichtfaktor ist Bestandteil
                            der vorliegenden technischen Implementierung.
                        </>
                    }
                >
                    {String.raw`q_{\mathrm{rad}} = \varepsilon_{\mathrm{eff}} F \sigma \left( T_h^4 - T_s^4 \right)`}
                </Formula>

                <Typography sx={bodySx}>
                    Dabei gilt:
                </Typography>

                <List component="ul" sx={{ mt: 1.5, p: 0 }}>
                    <StyledListItem>
                        <b>ε<sub>eff</sub></b> — effektiver Emissionsgrad;
                    </StyledListItem>

                    <StyledListItem>
                        <b>F</b> — geometrischer Sichtfaktor;
                    </StyledListItem>

                    <StyledListItem>
                        <b>σ</b> — Stefan-Boltzmann-Konstante;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T<sub>h</sub></b> — absolute Temperatur
                        der Heizelemente;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T<sub>s</sub></b> — absolute Temperatur
                        der Werkstückoberfläche.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die geometrische Beschreibung der Heizzone wird dabei
                    nicht als abstrakte Standardgeometrie des
                    Literaturmodells übernommen. Sie wird an die konkrete
                    Konstruktion der verwendeten Heizanlage angepasst,
                    einschließlich der Anordnung der Rohrheizelemente,
                    der Abstände und der umgebenden Flächen.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Eine separate volumetrische Absorption der von den
                    Rohrheizelementen abgegebenen Strahlung innerhalb
                    des Werkstücks wird nicht angesetzt. Die
                    Temperaturausbreitung in die Materialtiefe erfolgt
                    im Modell über die Wärmeleitungsgleichung.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Konvektion wird unabhängig davon über den
                    Wärmeübergangskoeffizienten und die Temperaturdifferenz
                    zwischen Werkstückoberfläche und Umgebung beschrieben.
                </Typography>
            </>
        )
    },

    {
        number: "8",
        title: "Temperaturabhängige Materialeigenschaften",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die thermophysikalischen Eigenschaften von PVC
                    verändern sich mit der Temperatur. Deshalb werden
                    im Berechnungsmodell temperaturabhängige Werte
                    verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Insbesondere wird die Veränderung der spezifischen
                    Wärmekapazität im Bereich des Glasübergangs
                    berücksichtigt. Dadurch wird die Energiemenge,
                    die für eine weitere Temperaturerhöhung erforderlich
                    ist, temperaturabhängig beschrieben.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Glasübergangstemperatur wird als Kennwert eines
                    Übergangsbereichs des Polymerwerkstoffs betrachtet.
                    In diesem Bereich können sich thermophysikalische
                    und mechanische Eigenschaften des Materials verändern.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Materialeigenschaften werden deshalb während der
                    Berechnung aus der aktuellen Temperatur der jeweiligen
                    Rechenschicht bestimmt und nicht als ein einziger
                    konstanter Wert für den gesamten Prozess angenommen.
                </Typography>
            </>
        )
    },

    {
        number: "9",
        title: "Erwärmung, Transport und Abkühlung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Der Berechnungsprozess wird entsprechend dem realen
                    Ablauf in mehrere aufeinanderfolgende Phasen unterteilt:
                </Typography>

                <Grid
                    container
                    spacing={1.5}
                    sx={{ mt: 1 }}
                >
                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Heizzone mit Rohrheizelementen
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Entnahme
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Transport und Abkühlung
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Beginn des Biegevorgangs
                        </FlowBox>
                    </Grid>
                </Grid>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Während sich das Werkstück in der Heizzone befindet,
                    wirken die Wärmeübertragungsbedingungen der
                    Rohrheizelemente auf beide Oberflächen.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach dem Verlassen der Heizzone entfällt der direkte
                    Wärmeeintrag der Heizelemente. Während des Transports
                    verändert sich das Temperaturfeld weiter: Wärme wird
                    aus den wärmeren inneren Bereichen zu den Oberflächen
                    geleitet und gleichzeitig an die Umgebung abgegeben.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Dadurch kann die Oberflächentemperatur während des
                    Transports sinken, während sich die
                    Temperaturverteilung über die Werkstückdicke weiter
                    ausgleicht.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der thermische Zustand zu Beginn des Biegevorgangs
                    hängt daher sowohl von der Aufheizzeit in der
                    Heizzone als auch von der anschließenden
                    Transport- und Abkühlzeit ab.
                </Typography>
            </>
        )
    },

    {
        number: "10",
        title: "Kriterium für das Ende der Erwärmung",
        content: (
            <>
                <Typography sx={bodySx}>
                    In der vorliegenden Implementierung gilt die
                    Aufheizphase als abgeschlossen, wenn die minimale
                    Temperatur über die gesamte Werkstückdicke die
                    vorgegebene Zieltemperatur erreicht.
                </Typography>

                <Formula
                    title="Kriterium der Mindesttemperatur über die Dicke"
                    source={
                        <>
                            Berechnungskriterium der vorliegenden
                            Implementierung. Die Formulierung über die
                            Minimaltemperatur stellt ein definiertes
                            Abschlusskriterium des Modells dar.
                        </>
                    }
                >
                    {String.raw`\min_{x} T(x,t_{\mathrm{heat}}) \ge T_{\mathrm{target}}`}
                </Formula>

                <Typography sx={bodySx}>
                    Dadurch wird verhindert, dass lediglich die
                    Oberflächentemperatur als Maß für den thermischen
                    Zustand des gesamten Werkstücks verwendet wird,
                    während der Kern noch deutlich kälter ist.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Ende der Aufheizung wird somit anhand des
                    Temperaturzustands über die gesamte Materialdicke
                    bestimmt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach Erfüllung dieses Kriteriums kann die Berechnung
                    in die Transport- und Abkühlphase übergehen.
                </Typography>
            </>
        )
    },

    {
        number: "11",
        title: "Berechnungsergebnisse",
        content: (
            <>
                <Typography sx={bodySx}>
                    Das zentrale Ergebnis der Berechnung ist die
                    zeitabhängige Temperaturverteilung an verschiedenen
                    Positionen über die Werkstückdicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die berechneten Temperaturverläufe ermöglichen die
                    Analyse von:
                </Typography>

                <List component="ul" sx={{ mt: 1.5, p: 0 }}>
                    <StyledListItem>
                        Oberflächentemperatur des Werkstücks.
                    </StyledListItem>

                    <StyledListItem>
                        Temperatur im zentralen Bereich des Materials.
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturverteilung über die Werkstückdicke.
                    </StyledListItem>

                    <StyledListItem>
                        Zeit bis zum Erreichen der Zieltemperatur.
                    </StyledListItem>

                    <StyledListItem>
                        Gleichmäßigkeit der Erwärmung über die Dicke.
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturänderung während des Transports
                        zur Biegestation.
                    </StyledListItem>
                </List>
            </>
        )
    },

    {
        number: "12",
        title: "Überwachung der Zersetzungstemperatur",
        content: (
            <>
                <Typography sx={bodySx}>
                    Während der Berechnung wird die für den jeweiligen
                    Werkstoff definierte Temperatur des beginnenden
                    thermischen Abbaus überwacht.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Erreicht die Temperatur an einem beliebigen
                    Berechnungspunkt diese Grenze, wird die weitere
                    Aufheizberechnung beendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Ergebnis wird mit einem entsprechenden Status
                    zurückgegeben, der anzeigt, dass die
                    Schutzgrenze für den thermischen Abbau erreicht wurde.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Zersetzungstemperatur ist damit eine
                    Schutzgrenze des Berechnungsmodells und keine
                    Zieltemperatur für den Formgebungsprozess.
                </Typography>
            </>
        )
    },

    {
        number: "13",
        title: "Experimentelle Überprüfung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Das numerische Modell kann durch experimentelle
                    Temperaturmessungen an der realen Heizanlage mit
                    Rohrheizelementen überprüft werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Besonders relevant ist dabei der Vergleich zwischen
                    der berechneten und der gemessenen
                    Oberflächentemperatur. Soweit messtechnisch möglich,
                    können zusätzlich Temperaturen in unterschiedlichen
                    Tiefen des Werkstücks gemessen werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der Vergleich mit Messdaten ermöglicht die Beurteilung,
                    wie gut die angesetzten Wärmeübertragungsbedingungen
                    die reale Heizzone beschreiben. Abweichungen können
                    beispielsweise auf die tatsächliche thermische
                    Leistungsabgabe der Rohrheizelemente, die
                    Wärmeübergangsbedingungen, die Geometrie oder
                    Materialparameter zurückzuführen sein.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Eine experimentelle Anpassung beziehungsweise Kalibrierung
                    ist dabei von der grundlegenden physikalisch-numerischen
                    Berechnung zu unterscheiden. Die vorliegende Methode
                    beschreibt zunächst ein eigenständiges Rechenmodell;
                    experimentelle Daten können anschließend zu dessen
                    Überprüfung und gegebenenfalls zur Anpassung einzelner
                    Modellparameter verwendet werden.
                </Typography>
            </>
        )
    }
];

export default function HeatingMethodologyPage() {
    return (
        <Container
            maxWidth="lg"
            sx={{
                py: {
                    xs: 3,
                    md: 6
                }
            }}
        >
            <Stack spacing={4}>
                <Box>
                    <Stack
                        direction="row"
                        spacing={1}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                    >
                        <Chip
                            label="METHODIK"
                            size="small"
                            color="primary"
                        />

                        <Typography
                            variant="overline"
                            color="text.secondary"
                        >
                            Thermobiegetechnik
                        </Typography>
                    </Stack>

                    <Typography
                        variant="h3"
                        component="h1"
                        sx={{
                            mt: 1.5,
                            fontWeight: 700,
                            fontSize: {
                                xs: "2rem",
                                md: "2.75rem"
                            }
                        }}
                    >
                        Methodik der Wärmeberechnung
                    </Typography>

                    <Typography
                        variant="h6"
                        color="text.secondary"
                        sx={{
                            mt: 1.5,
                            maxWidth: 950,
                            lineHeight: 1.5,
                            fontWeight: 400
                        }}
                    >
                        Wissenschaftliche Grundlage nach Buffel et al.
                        (2015, 2017) und deren technische Anpassung an
                        eine Heizanlage mit Rohrheizelementen zur Berechnung
                        der Temperaturverteilung über die Werkstückdicke
                        sowie der anschließenden Abkühlung während des
                        Transports zur Biegestation.
                    </Typography>
                </Box>

                <Stack spacing={3}>
                    {sections.map((section) => (
                        <Paper
                            key={section.number}
                            variant="outlined"
                            sx={{
                                p: {
                                    xs: 2,
                                    sm: 3,
                                    md: 4
                                },
                                borderRadius: 3
                            }}
                        >
                            <Stack spacing={2}>
                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    alignItems="center"
                                >
                                    <Chip
                                        label={section.number}
                                        color="primary"
                                        size="small"
                                    />

                                    <Typography
                                        variant="h5"
                                        component="h2"
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: {
                                                xs: "1.25rem",
                                                sm: "1.5rem"
                                            }
                                        }}
                                    >
                                        {section.title}
                                    </Typography>
                                </Stack>

                                {section.content}
                            </Stack>
                        </Paper>
                    ))}
                </Stack>

                <Paper
                    sx={{
                        p: {
                            xs: 2.5,
                            sm: 4
                        },
                        borderRadius: 3,
                        bgcolor: "primary.main",
                        color: "primary.contrastText"
                    }}
                >
                    <Typography
                        variant="h5"
                        sx={{
                            fontWeight: 700,
                            mb: 1.5
                        }}
                    >
                        Zusammenfassung
                    </Typography>

                    <Typography
                        sx={{
                            lineHeight: 1.75
                        }}
                    >
                        Die Berechnung basiert auf den physikalischen
                        Grundlagen der Wärmeübertragung und auf der
                        numerischen Modellierung der zeitabhängigen
                        Temperaturverteilung in thermoplastischen
                        Werkstücken. Als wissenschaftliche Ausgangsbasis
                        dienen insbesondere die Arbeiten von Buffel et al.
                        zur experimentellen und numerischen Untersuchung
                        der Erwärmung thermoplastischer Platten. Für die
                        vorliegende Anwendung wird diese methodische
                        Grundlage jedoch nicht unverändert übernommen,
                        sondern an die konkrete Heizanlage mit
                        Rohrheizelementen angepasst. Der Wärmeeintrag
                        der Heizelemente wird über thermische
                        Oberflächenrandbedingungen beschrieben, während
                        die weitere Temperaturausbreitung durch
                        Wärmeleitung über die Werkstückdicke berechnet
                        wird. Zusätzlich werden die konkrete Heizgeometrie,
                        temperaturabhängige Materialeigenschaften, die
                        Abkühlung beim Transport und die definierten
                        thermischen Abschluss- und Schutzkriterien
                        berücksichtigt.
                    </Typography>
                </Paper>

                <Paper
                    variant="outlined"
                    sx={{
                        p: {
                            xs: 2.5,
                            sm: 3
                        },
                        borderRadius: 3
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 700,
                            mb: 2
                        }}
                    >
                        Literatur und Quellen
                    </Typography>

                    <List
                        component="ol"
                        sx={{
                            p: 0,
                            pl: {
                                xs: 0,
                                sm: 2
                            }
                        }}
                    >
                        <StyledListItem>
                            Buffel, B.; Amerijckx, M.; Hamblok, M.;
                            Van Mieghem, B.; Desplentere, F.; Van Bael, A.
                            (2015).
                            <br />
                            <i>
                                Experimental and Computational Analysis
                                of the Heating Step during Thermoforming
                                of Thermoplastics.
                            </i>
                            <br />
                            <i>Key Engineering Materials</i>,
                            Volumes 651–653, 1003–1008.
                            <br />
                            Trans Tech Publications.
                            <br />
                            DOI: 10.4028/www.scientific.net/KEM.651-653.1003
                        </StyledListItem>

                        <StyledListItem>
                            Buffel, B.; Van Mieghem, B.; Van Bael, A.;
                            Desplentere, F. (2017).
                            <br />
                            <i>
                                A Combined Experimental and Modelling
                                Approach towards an Optimized Heating
                                Strategy in Thermoforming of Thermoplastics
                                Sheets.
                            </i>
                            <br />
                            <i>International Polymer Processing</i>,
                            32(3), 378–386.
                            <br />
                            Hanser Publishers.
                            <br />
                            DOI: 10.3139/217.3370
                        </StyledListItem>

                        <StyledListItem>
                            Holman, J. P.
                            <br />
                            <i>Heat Transfer.</i>
                            <br />
                            McGraw-Hill.
                        </StyledListItem>
                    </List>

                    <Typography
                        variant="caption"
                        sx={{
                            display: "block",
                            mt: 2,
                            color: "text.secondary",
                            lineHeight: 1.6
                        }}
                    >
                        Die Veröffentlichungen von Buffel et al. bilden
                        die wissenschaftliche Grundlage für die numerische
                        Beschreibung der Erwärmung thermoplastischer Platten.
                        Die konkrete Anwendung auf die betrachtete Heizanlage
                        mit Rohrheizelementen, die technische Beschreibung
                        der Heizgeometrie, die Oberflächenrandbedingungen,
                        die numerische Implementierung, die
                        temperaturabhängigen Materialparameter, die
                        Transport- und Abkühlphase sowie die definierten
                        Abbruchkriterien sind Bestandteil des hier
                        entwickelten Berechnungsmodells.
                    </Typography>
                </Paper>
            </Stack>
        </Container>
    );
}