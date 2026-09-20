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
                    Für die Abschätzung der Aufheizzeit eines Werkstücks
                    stehen verschiedene Ebenen der mathematischen Beschreibung
                    zur Verfügung – von einfachen empirischen Zusammenhängen
                    bis hin zur instationären numerischen Modellierung
                    des Temperaturfeldes.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    <b>1. Empirischer Ansatz – Potenzabhängigkeit</b><br />
                    Die einfachste Möglichkeit besteht darin, die Aufheizzeit
                    über einen ingenieurmäßigen Zusammenhang mit der
                    Materialdicke zu beschreiben:
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
                    <i>Einschränkung:</i> Dieser Ansatz eignet sich für eine
                    schnelle technische Abschätzung, beschreibt jedoch nicht
                    den inneren Temperaturzustand des Materials. Bei Änderungen
                    der Materialdicke, des Werkstoffs, der Heizparameter oder
                    der Prozessbedingungen ist eine entsprechende
                    experimentelle Überprüfung und gegebenenfalls eine
                    erneute Anpassung erforderlich.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    <b>2. Analytischer Ansatz – klassische Lösungen
                    der Wärmeleitungsgleichung</b><br />
                    Zur Berechnung der Temperaturverteilung über die Dicke
                    können analytische Lösungen der instationären
                    Wärmeleitungsgleichung verwendet werden, beispielsweise
                    Lösungen in Form von Fourier-Reihen.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 1 }}>
                    <i>Einschränkung:</i> Solche Lösungen setzen eine deutlich
                    vereinfachte Beschreibung des Prozesses voraus. Geometrie,
                    Randbedingungen und häufig auch die thermophysikalischen
                    Eigenschaften müssen vorgegeben bzw. vereinfacht werden.
                    Bei gleichzeitiger Berücksichtigung temperaturabhängiger
                    Materialeigenschaften, Strahlungs- und Konvektionswärme-
                    übertragung, beidseitiger Erwärmung und anschließender
                    Abkühlung wird eine analytische Lösung wesentlich
                    komplexer.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    <b>3. Gewählter Ansatz – instationäre numerische
                    Modellierung</b><br />
                    Daher wird in der Anwendung eine numerische Berechnung
                    des zeitabhängigen Temperaturfeldes eingesetzt.
                    Dieser Ansatz ermöglicht es, die Eigenschaften der
                    betrachteten Heizvorrichtung und die zeitliche Entwicklung
                    der Temperatur über die Materialdicke direkt zu
                    berücksichtigen.
                </Typography>

                <List component="ul" sx={{ mt: 1.5, p: 0 }}>
                    <StyledListItem>
                        Beidseitige Erwärmung unter Berücksichtigung von
                        Strahlungs- und Konvektionswärmeübertragung.
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturabhängige thermophysikalische Eigenschaften
                        des Werkstoffs.
                    </StyledListItem>

                    <StyledListItem>
                        Zeitabhängige Temperaturverteilung über die Dicke
                        des Blechs.
                    </StyledListItem>

                    <StyledListItem>
                        Transportphase nach dem Verlassen der Heizzone,
                        in der die äußere Wärmezufuhr endet und die Abkühlung
                        beginnt.
                    </StyledListItem>

                    <StyledListItem>
                        Überwachung der Formungstemperatur und der Temperatur
                        des beginnenden thermischen Abbaus.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der gewählte numerische Ansatz ermöglicht damit nicht nur
                    die Berechnung der Aufheizzeit, sondern auch die Analyse
                    des thermischen Zustands des Werkstücks einschließlich
                    der Temperaturverteilung über die Dicke und deren Änderung
                    während des Transports zur Biegestation.
                </Typography>
            </>
        )
    },

    {
        number: "2",
        title: "Wissenschaftliche und theoretische Grundlage",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die wissenschaftliche Grundlage des Berechnungsansatzes
                    bilden Arbeiten von Buffel und seinen Mitautoren zur
                    experimentellen und numerischen Untersuchung der
                    Aufheizphase von Thermoplastplatten beim Thermoformen.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    In der Arbeit von Buffel et al. (2015) wird eine
                    experimentelle und rechnerische Untersuchung der
                    Aufheizphase thermoplastischer Platten vorgestellt.
                    Unter anderem wird ein Finite-Differenzen-Modell
                    verwendet, mit dem die zeitliche Entwicklung der
                    Temperaturverteilung über die Plattendicke berechnet
                    werden kann.
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
                    In der Arbeit von Buffel et al. (2017) wird ein
                    kombinierter experimentell-modellbasierter Ansatz
                    zur Untersuchung von Infrarotheizanlagen und zur
                    Bestimmung einer geeigneten Heizstrategie für
                    thermoplastische Platten beschrieben. Dabei werden
                    Parameter der Heizvorrichtung und der Umgebung
                    berücksichtigt und mit experimentellen Untersuchungen
                    kombiniert.
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
                        A Combined Experimental and Modelling Approach towards
                        an Optimized Heating Strategy in Thermoforming of
                        Thermoplastics Sheets.
                    </i>{" "}
                    <i>International Polymer Processing</i>, 32(3), 378–386.
                    Hanser Publishers.
                    DOI: 10.3139/217.3370
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Im Rahmen der Entwicklung dieser Anwendung wurden diese
                    wissenschaftlichen und numerischen Grundlagen an die
                    betrachtete Heizvorrichtung mit beidseitiger Erwärmung
                    angepasst. Insbesondere wurde eine Berechnung des
                    Temperaturfeldes über die Materialdicke mit
                    temperaturabhängigen Werkstoffeigenschaften sowie unter
                    Berücksichtigung von Strahlungs- und Konvektionswärme-
                    übertragung und der anschließenden Abkühlung während
                    des Transports zur Biegestation umgesetzt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Literaturquellen bilden somit die physikalisch-
                    mathematische Grundlage des Ansatzes. Die konkrete
                    Softwareimplementierung, die Anpassung des Modells
                    an die Geometrie der betrachteten Heizzone, die
                    numerischen Parameter, die Abfolge der Berechnungsschritte
                    sowie die Abbruchkriterien wurden im Rahmen dieser
                    Anwendung entwickelt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die veröffentlichten Arbeiten werden dabei als
                    wissenschaftliche Grundlage verwendet und nicht als
                    fertiges Rechenmodell unmittelbar in den Programmcode
                    übernommen. Die Entwicklung der Anwendung umfasst
                    die eigene technische Anpassung dieser Prinzipien
                    an die konkrete Aufgabenstellung und die vorhandene
                    Heizkonfiguration.
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
                    der Werkstücktemperatur bei beidseitiger Erwärmung
                    mit anschließender Abkühlung während des Transports
                    zur Biegestation.
                </Typography>

                <List
                    component="ul"
                    sx={{
                        mt: 1.5,
                        p: 0
                    }}
                >
                    <StyledListItem>
                        Geometrie und thermische Wirksamkeit der Heizzone.
                    </StyledListItem>

                    <StyledListItem>
                        Temperatur und Parameter der Heizelemente.
                    </StyledListItem>

                    <StyledListItem>
                        Materialdicke und thermophysikalische Eigenschaften.
                    </StyledListItem>

                    <StyledListItem>
                        Strahlungswärmeübertragung zwischen Heizelementen,
                        Oberflächen der Heizzone und Werkstück.
                    </StyledListItem>

                    <StyledListItem>
                        Konvektive Wärmeübertragung zwischen Heizsystem,
                        Umgebung und Werkstückoberfläche.
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturabhängige Änderung der thermophysikalischen
                        Eigenschaften.
                    </StyledListItem>

                    <StyledListItem>
                        Abkühlung des Werkstücks nach dem Verlassen
                        der Heizzone.
                    </StyledListItem>

                    <StyledListItem>
                        Transportzeit des Werkstücks zur Biegestation.
                    </StyledListItem>

                    <StyledListItem>
                        Zielbereich der Formungstemperatur und Temperatur
                        des beginnenden thermischen Abbaus.
                    </StyledListItem>
                </List>
            </>
        )
    },

    {
        number: "4",
        title: "Physikalisches Modell von PVC",
        content: (
            <>
                <Typography sx={bodySx}>
                    Für opake thermoplastische Platten, insbesondere PVC,
                    wird im verwendeten Modell angenommen, dass die
                    Wärmestrahlung überwiegend in einem oberflächennahen
                    Bereich des Materials absorbiert wird.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Eine separate Modellierung des Eindringens der
                    Infrarotstrahlung in die Tiefe der Platte wird in dieser
                    Implementierung nicht verwendet. Die Energieübertragung
                    wird über eine thermische Randbedingung an der Oberfläche
                    beschrieben. Anschließend breitet sich die Wärme im
                    Material überwiegend durch Wärmeleitung aus.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das zentrale Ergebnis der inneren thermischen Berechnung
                    ist daher die zeitabhängige Temperaturverteilung
                    über die Plattendicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Berechnung wird als eindimensionale instationäre
                    Wärmeleitung über die Dicke des Werkstücks mit
                    beidseitiger Erwärmung durchgeführt.
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
                    Die Temperaturänderung innerhalb des Materials wird
                    durch die instationäre Wärmeleitungsgleichung mit
                    temperaturabhängigen thermophysikalischen Eigenschaften
                    beschrieben.
                </Typography>

                <Formula
                    title="Instationäre Wärmeleitungsgleichung"
                    source={
                        <>
                            Grundlegende Gleichung der instationären
                            Wärmeleitung. Die eindimensionale Anwendung
                            dieser Gleichung zur Berechnung des
                            Temperaturfeldes einer thermoplastischen
                            Plattengeometrie bildet die physikalisch-
                            mathematische Grundlage des numerischen Ansatzes.
                        </>
                    }
                >
                    {String.raw`\rho(T) C_p(T) \frac{\partial T}{\partial t} = \frac{\partial}{\partial x} \left[ \lambda(T)\frac{\partial T}{\partial x} \right]`}
                </Formula>

                <Typography sx={bodySx}>
                    Dabei gilt:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        mt: 1.5,
                        p: 0
                    }}
                >
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
                        <b>x</b> — Koordinate über die Materialdicke;
                    </StyledListItem>

                    <StyledListItem>
                        <b>t</b> — Zeit.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    In der vorliegenden Implementierung werden die
                    temperaturabhängigen Materialeigenschaften während
                    der zeitlichen Berechnung des Temperaturfeldes
                    aktualisiert.
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
                    Zur numerischen Lösung der Wärmeleitungsgleichung
                    wird eine implizite Finite-Differenzen-Methode verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Material wird über die Dicke in ein Rechengitter
                    mit ungefähr 20–22 Zellen unterteilt. Die räumliche
                    Schrittweite wird automatisch aus der Materialdicke
                    bestimmt und innerhalb des vorgegebenen Bereichs
                    der Rechengitterauflösung gehalten.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der zeitliche Berechnungsschritt beträgt 0,2 Sekunden.
                    Das implizite Verfahren ermöglicht dabei eine hohe
                    numerische Stabilität bei der schrittweisen Berechnung
                    des Temperaturfeldes.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Berechnung erfolgt schrittweise über die Zeit.
                    Für jeden Zeitschritt wird der neue Temperaturzustand
                    aller Berechnungspunkte über die Materialdicke unter
                    Berücksichtigung der thermischen Einwirkung an den
                    Oberflächen und des Wärmeaustauschs zwischen benachbarten
                    Schichten bestimmt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das berechnete Temperaturfeld bildet den Ausgangszustand
                    für den nächsten Zeitschritt. Dadurch beeinflusst die
                    bereits im Material gespeicherte Wärme unmittelbar
                    die weitere Wärmeausbreitung über die Dicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Bei der iterativen Lösung innerhalb eines Zeitschritts
                    werden Temperatur und thermophysikalische Eigenschaften
                    bis zum Erreichen der vorgegebenen Konvergenzbedingung
                    aktualisiert. Dadurch kann die Temperaturabhängigkeit
                    der Materialeigenschaften direkt in der instationären
                    Berechnung berücksichtigt werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach der Diskretisierung entsteht ein
                    dreidiagonales Gleichungssystem, das mit dem
                    Thomas-Algorithmus gelöst wird.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Auf diese Weise bildet der numerische Algorithmus
                    die zeitliche Entwicklung des Temperaturfeldes
                    vom Ausgangszustand bis zum Erreichen des definierten
                    Heizkriteriums oder einer thermischen Schutzgrenze ab.
                </Typography>
            </>
        )
    },

    {
        number: "7",
        title: "Wärmebilanz an der Oberfläche",
        content: (
            <>
                <Typography sx={bodySx}>
                    In der vorliegenden Modellierung wird der Wärmeeintrag
                    an die Werkstückoberfläche als Summe aus Strahlungs-
                    und Konvektionswärmestrom betrachtet.
                </Typography>

                <Formula
                    title="Wärmebilanz an der Oberfläche"
                    source={
                        <>
                            Allgemeine Form der Energiebilanz an der
                            Werkstückoberfläche. Die Aufteilung in
                            Strahlungs- und Konvektionsanteil entspricht
                            den im Modell berücksichtigten
                            Wärmeübertragungsmechanismen. Die konkrete
                            Summendarstellung ist Bestandteil der
                            vorliegenden Berechnungsimplementierung.
                        </>
                    }
                >
                    {String.raw`q_{\mathrm{total}} = q_{\mathrm{rad}} + q_{\mathrm{conv}}`}
                </Formula>

                <Typography sx={bodySx}>
                    Der Strahlungsanteil wird über das thermische
                    Strahlungsgesetz unter Berücksichtigung der effektiven
                    geometrischen Anordnung von Heizsystem und Werkstück
                    bestimmt.
                </Typography>

                <Formula
                    title="Strahlungswärmestrom"
                    source={
                        <>
                            Stefan-Boltzmann-Gesetz für den Strahlungs-
                            wärmeaustausch unter Berücksichtigung einer
                            effektiven Emissionsfähigkeit und eines
                            geometrischen Sichtfaktors. Die verwendete
                            Form stellt die Randbedingung der vorliegenden
                            Berechnungsimplementierung dar.
                        </>
                    }
                >
                    {String.raw`q_{\mathrm{rad}} = \varepsilon_{\mathrm{eff}} F \sigma \left( T_h^4 - T_s^4 \right)`}
                </Formula>

                <Typography sx={bodySx}>
                    Dabei gilt:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        mt: 1.5,
                        p: 0
                    }}
                >
                    <StyledListItem>
                        <b>ε<sub>eff</sub></b> — effektive Emissionsfähigkeit;
                    </StyledListItem>

                    <StyledListItem>
                        <b>F</b> — geometrischer Sichtfaktor;
                    </StyledListItem>

                    <StyledListItem>
                        <b>σ</b> — Stefan-Boltzmann-Konstante;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T<sub>h</sub></b> — absolute Temperatur
                        des Heizsystems;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T<sub>s</sub></b> — absolute Temperatur
                        der Werkstückoberfläche.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    In der betrachteten Geometrie werden sowohl die direkte
                    Strahlung der Heizelemente als auch der Beitrag
                    der umgebenden Flächen der Heizzone über eine
                    effektive Beschreibung des Strahlungsaustauschs
                    berücksichtigt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die konvektive Wärmeübertragung wird separat über
                    den entsprechenden Wärmeübergangskoeffizienten und
                    die Temperaturdifferenz zwischen Werkstückoberfläche
                    und Umgebung berücksichtigt.
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
                    Die thermophysikalischen Eigenschaften von PVC verändern
                    sich mit der Temperatur. Deshalb werden in der Berechnung
                    temperaturabhängige Werte der relevanten Material-
                    eigenschaften verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Insbesondere wird die Änderung der spezifischen
                    Wärmekapazität im Bereich des Glasübergangs berücksichtigt.
                    Dadurch kann die für eine weitere Temperaturerhöhung
                    erforderliche Energiemenge temperaturabhängig beschrieben
                    werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Glasübergangstemperatur wird dabei als Kennwert
                    eines Übergangsbereichs des Polymerwerkstoffs betrachtet.
                    In diesem Bereich können sich thermophysikalische und
                    mechanische Eigenschaften des Materials deutlich verändern.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    In der Berechnung werden die Materialeigenschaften
                    entsprechend der aktuellen Temperatur der jeweiligen
                    Rechenschicht bestimmt und nicht als ein einziger
                    konstanter Wert für den gesamten Aufheizprozess
                    angenommen.
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
                    Der Prozess wird nacheinander in mehrere physikalische
                    Phasen unterteilt:
                </Typography>

                <Grid
                    container
                    spacing={1.5}
                    sx={{ mt: 1 }}
                >
                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Heizzone
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Entnahme des Werkstücks
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
                    Solange sich das Werkstück in der Heizzone befindet,
                    wirken die vorgegebenen Wärmeströme des Heizsystems
                    auf seine Oberflächen.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach der Entnahme aus der Heizzone endet die direkte
                    Wärmezufuhr durch die Heizelemente. Während des Transports
                    beginnt die Oberflächentemperatur zu sinken, während sich
                    die Temperaturverteilung über die Dicke aufgrund der
                    inneren Wärmeleitung und des Wärmeaustauschs mit der
                    Umgebung weiter verändert.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Temperatur zu Beginn des Biegevorgangs hängt daher
                    nicht nur von der Aufenthaltszeit in der Heizzone,
                    sondern auch von der anschließenden Transport- und
                    Abkühlzeit ab.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die während der Erwärmung entstandene Temperaturverteilung
                    wird dabei als Ausgangszustand für die anschließende
                    Abkühlphase übernommen.
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
                    In der vorliegenden Implementierung gilt die Heizphase
                    als abgeschlossen, wenn die minimale Temperatur über
                    die gesamte Werkstückdicke die vorgegebene Zieltemperatur
                    erreicht.
                </Typography>

                <Formula
                    title="Kriterium der Mindesttemperatur über die Dicke"
                    source={
                        <>
                            Berechnungskriterium der vorliegenden
                            Implementierung. Es basiert auf der Forderung,
                            dass die vorgegebene Temperatur über die gesamte
                            Werkstückdicke erreicht wird. Die konkrete
                            Formulierung über den Minimalwert ist ein
                            Kriterium dieses Modells und kein eigenständiges
                            physikalisches Gesetz.
                        </>
                    }
                >
                    {String.raw`\min_{x} T(x,t_{\mathrm{heat}}) \ge T_{\mathrm{target}}`}
                </Formula>

                <Typography sx={bodySx}>
                    Dadurch wird verhindert, dass die Oberfläche bereits
                    die erforderliche Temperatur erreicht hat, während
                    der zentrale Bereich der Platte noch deutlich kälter ist.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Ende der Erwärmung wird somit nicht ausschließlich
                    über die Oberflächentemperatur bestimmt, sondern über
                    den thermischen Zustand des gesamten Materialquerschnitts.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach Erfüllung dieses Kriteriums kann die Berechnung,
                    abhängig von den Prozessparametern, in die Transport-
                    und Abkühlphase übergehen.
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
                    Das zentrale Ergebnis der Berechnung ist die zeitliche
                    Entwicklung der Temperatur an verschiedenen Positionen
                    über die Werkstückdicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die berechneten Diagramme ermöglichen die Analyse von:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        mt: 1.5,
                        p: 0
                    }}
                >
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
                        Zeit bis zum Erreichen der vorgegebenen
                        Zieltemperatur.
                    </StyledListItem>

                    <StyledListItem>
                        Gleichmäßigkeit der Erwärmung über die Dicke.
                    </StyledListItem>

                    <StyledListItem>
                        Änderung der Temperatur während des Transports
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
                    Zur Vermeidung einer Überhitzung wird während der
                    Berechnung die für den jeweiligen Werkstoff definierte
                    Temperatur des beginnenden thermischen Abbaus überwacht.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Erreicht die Temperatur an einem beliebigen
                    Berechnungspunkt diese Grenze, wird die weitere
                    Aufheizberechnung beendet. Das Ergebnis wird mit einem
                    entsprechenden Status zurückgegeben, der das Erreichen
                    der Zersetzungstemperatur anzeigt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Zersetzungstemperatur stellt dabei eine
                    Schutzgrenze der Berechnung dar und wird nicht als
                    Zieltemperatur für den Formgebungsprozess verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Erreichen dieser Grenze wird somit als unzulässiger
                    thermischer Zustand des Berechnungsprozesses betrachtet
                    und nicht als normales Abschlusskriterium der Erwärmung.
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
                    Temperaturmessungen überprüft werden. Dazu können
                    insbesondere Messungen der Oberflächentemperatur und,
                    soweit messtechnisch möglich, der Temperatur im Inneren
                    des Werkstücks herangezogen werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der Vergleich zwischen berechneten und gemessenen
                    Temperaturen ermöglicht eine Beurteilung der
                    Übereinstimmung des Modells mit der realen Heizvorrichtung
                    und kann Hinweise auf die Notwendigkeit einer
                    Anpassung einzelner Wärmeübertragungsparameter liefern.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Eine experimentelle Kalibrierung ist kein zwingender
                    Bestandteil der grundlegenden Berechnung dieser Anwendung
                    und wird als separate Vorgehensweise zur Verifikation
                    und gegebenenfalls zur weiteren Modellanpassung betrachtet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Bei vorhandenen Messdaten kann der Vergleich sowohl
                    anhand der Oberflächentemperatur als auch anhand der
                    Temperaturverteilung über die Dicke und der Zeit bis
                    zum Erreichen des definierten thermischen Zustands
                    durchgeführt werden.
                </Typography>
            </>
        )
    }
];

export default function HeatingMethodologyPage_de() {
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
                        (2015, 2017) und deren Anwendung in einem
                        Berechnungsmodell für eine Heizzone unter
                        Berücksichtigung der Temperaturverteilung
                        über die Werkstückdicke und der Abkühlung
                        während des Transports zur Biegestation.
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
                        Die Methodik verwendet physikalische Grundlagen
                        der Wärmeübertragung und numerische Verfahren
                        zur Berechnung des Temperaturfeldes einer
                        thermoplastischen Platte. Die wissenschaftliche
                        Grundlage bilden veröffentlichte Untersuchungen
                        zur experimentellen und numerischen Analyse der
                        Erwärmung von Thermoplasten. Auf dieser Grundlage
                        wurde für diese Anwendung ein angepasster
                        Berechnungsansatz entwickelt, der die Erwärmung
                        des Werkstücks in der betrachteten Heizzone,
                        die Temperaturverteilung über die Dicke und die
                        anschließende Temperaturänderung während des
                        Transports zur Biegestation berücksichtigt.
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
                            <i>
                                Heat Transfer.
                            </i>
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
                        Die Veröffentlichungen von Buffel et al. bilden die
                        wissenschaftliche Grundlage des Ansatzes zur
                        numerischen und experimentellen Untersuchung der
                        Erwärmung thermoplastischer Platten. Auf dieser
                        Grundlage wurde in dieser Anwendung ein angepasster
                        Berechnungsansatz für die betrachtete Heizvorrichtung
                        implementiert. Die konkrete Geometrie der Heizzone,
                        die Softwareimplementierung, die numerischen
                        Einstellungen, die Abfolge der Berechnungsschritte
                        und die Abbruchkriterien sind Bestandteil dieser
                        Anwendung und werden den Literaturquellen nicht
                        unmittelbar zugeschrieben.
                    </Typography>
                </Paper>
            </Stack>
        </Container>
    );
}
