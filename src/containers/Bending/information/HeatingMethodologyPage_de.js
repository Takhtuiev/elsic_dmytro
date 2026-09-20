import React from "react";
import {
    Box,
    Container,
    Paper,
    Stack,
    Typography,
    Divider,
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


function Formula({ children }: { children: string }) {
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
                boxShadow: "inset 0 1px 2px rgba(0,0,0,0.02)",
                "& .katex": {
                    fontSize: { xs: "1.05rem", sm: "1.25rem" }
                }
            }}
        >
            <BlockMath math={children} />
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
                display: "list-item",
                py: 0.5,
                pl: 1
            }}
        >
            <Typography
                variant="body1"
                sx={bodySx}
            >
                {children}
            </Typography>
        </ListItem>
    );
}


const sections = [
    {
        number: "1",
        title: "Wissenschaftliche und theoretische Grundlage",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die Berechnungsmethodik basiert auf der Kombination
                    eines experimentellen und eines numerischen Ansatzes
                    zur Bestimmung der Aufheizzeit von thermoplastischen
                    Platten, beschrieben von Buffel, Van Mieghem,
                    Van Bael und Desplentere (2017) in der Arbeit
                    „A Combined Experimental and Modelling Approach towards
                    an Optimized Heating Strategy in Thermoforming of
                    Thermoplastics Sheets“.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Der Ansatz wurde für ein TEN-Heizsystem mit einer
                    geschlossenen Heizzone angepasst, die durch die
                    Konstruktion des Heizkastens gebildet wird.
                    Dabei wird nicht nur die Erwärmung des Werkstücks,
                    sondern auch dessen Abkühlung nach dem Herausnehmen
                    aus der Heizzone berücksichtigt.
                </Typography>
            </>
        )
    },
    {
        number: "2",
        title: "Aufgabenstellung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die Berechnung bestimmt das zeitabhängige
                    Temperaturfeld der Plattenmaterialprobe bei
                    beidseitiger Erwärmung.
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        Geometrie und thermische Wirksamkeit der Heizzone;
                    </StyledListItem>

                    <StyledListItem>
                        Temperatur und Eigenschaften der Heizelemente;
                    </StyledListItem>

                    <StyledListItem>
                        Materialdicke und thermophysikalische Eigenschaften;
                    </StyledListItem>

                    <StyledListItem>
                        Strahlungsaustausch zwischen Heizelementen,
                        Oberflächen der Heizzone und Werkstück;
                    </StyledListItem>

                    <StyledListItem>
                        konvektiver Wärmeübergang;
                    </StyledListItem>

                    <StyledListItem>
                        temperaturabhängige Änderung der
                        Materialeigenschaften;
                    </StyledListItem>

                    <StyledListItem>
                        Abkühlung des Werkstücks nach dem Herausnehmen
                        aus der Heizzone;
                    </StyledListItem>

                    <StyledListItem>
                        Transportzeit des Werkstücks zur Biegestation;
                    </StyledListItem>

                    <StyledListItem>
                        Formungstemperaturbereich und Temperaturbeginn
                        der thermischen Zersetzung des Materials.
                    </StyledListItem>
                </List>
            </>
        )
    },
    {
        number: "3",
        title: "Physikalisches Modell von PVC",
        content: (
            <>
                <Typography sx={bodySx}>
                    Für opake thermoplastische Platten, insbesondere PVC,
                    wird angenommen, dass die Wärmestrahlung überwiegend
                    in einer oberflächennahen Schicht des Materials
                    absorbiert wird.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach der Energieübertragung auf die Oberfläche breitet
                    sich die Wärme hauptsächlich durch Wärmeleitung in das
                    Materialinnere aus. Daher ist die Temperaturverteilung
                    über die Plattendicke das zentrale Objekt der Berechnung.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Das Modell betrachtet den eindimensionalen instationären
                    Wärmetransport durch die Dicke des Werkstücks. Die
                    Wärmeeinwirkung wird dabei auf beiden Oberflächen
                    berücksichtigt.
                </Typography>
            </>
        )
    },
    {
        number: "4",
        title: "Mathematisches Modell",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die instationäre Temperaturverteilung wird durch die
                    Wärmeleitungsgleichung mit temperaturabhängigen
                    thermophysikalischen Eigenschaften beschrieben:
                </Typography>

                <Formula>
                    {String.raw`
                        \rho(T)\,C_p(T)\,
                        \frac{\partial T}{\partial t}
                        =
                        \frac{\partial}{\partial x}
                        \left[
                            \lambda(T)\,
                            \frac{\partial T}{\partial x}
                        \right]
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    Dabei gilt:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        <b>ρ(T)</b> — Dichte des Materials;
                    </StyledListItem>

                    <StyledListItem>
                        <b>Cₚ(T)</b> — spezifische Wärmekapazität;
                    </StyledListItem>

                    <StyledListItem>
                        <b>λ(T)</b> — Wärmeleitfähigkeit;
                    </StyledListItem>

                    <StyledListItem>
                        <b>T</b> — Temperatur;
                    </StyledListItem>

                    <StyledListItem>
                        <b>x</b> — Koordinate über die Plattendicke;
                    </StyledListItem>

                    <StyledListItem>
                        <b>t</b> — Zeit.
                    </StyledListItem>
                </List>
            </>
        )
    },
    {
        number: "5",
        title: "Numerisches Lösungsverfahren",
        content: (
            <>
                <Typography sx={bodySx}>
                    Zur Berechnung des Temperaturfeldes wird ein
                    implizites Finite-Differenzen-Verfahren verwendet.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Plattendicke wird in ein Rechengitter mit etwa
                    20–22 Rechenzellen unterteilt. Die räumliche Schrittweite
                    wird automatisch in Abhängigkeit von der Materialdicke
                    bestimmt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Zeitschrittweite beträgt 0,2 Sekunden. Das implizite
                    Verfahren gewährleistet eine hohe numerische Stabilität
                    der Berechnung auch bei kleiner räumlicher Schrittweite.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Temperaturabhängige Materialeigenschaften werden
                    iterativ innerhalb jedes Zeitschritts berücksichtigt.
                    Das daraus entstehende tridiagonale Gleichungssystem
                    wird mit dem Thomas-Algorithmus gelöst.
                </Typography>
            </>
        )
    },
    {
        number: "6",
        title: "Wärmebilanz an der Oberfläche",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die Wärmeübertragung auf die Oberfläche des Werkstücks
                    wird durch Strahlungs- und konvektiven Wärmeübergang
                    berücksichtigt:
                </Typography>

                <Formula>
                    {String.raw`
                        q_{\mathrm{total}}
                        =
                        q_{\mathrm{rad}}
                        +
                        q_{\mathrm{conv}}
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    Der Strahlungswärmestrom wird unter Berücksichtigung
                    des effektiven Emissionsgrades des Systems und des
                    geometrischen Sichtfaktors bestimmt:
                </Typography>

                <Formula>
                    {String.raw`
                        q_{\mathrm{rad}}
                        =
                        \varepsilon_{\mathrm{eff}}\,
                        F\,
                        \sigma
                        \left(
                            T_h^4-T_s^4
                        \right)
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    Dabei gilt:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        <b>εeff</b> — effektiver Emissionsgrad;
                    </StyledListItem>

                    <StyledListItem>
                        <b>F</b> — geometrischer Sichtfaktor;
                    </StyledListItem>

                    <StyledListItem>
                        <b>σ</b> — Stefan-Boltzmann-Konstante;
                    </StyledListItem>

                    <StyledListItem>
                        <b>Tₕ</b> — absolute Temperatur des Heizsystems;
                    </StyledListItem>

                    <StyledListItem>
                        <b>Tₛ</b> — absolute Temperatur der
                        Werkstückoberfläche.
                    </StyledListItem>
                </List>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Beim Strahlungsaustausch werden sowohl die direkte
                    Strahlung der Heizelemente als auch die Wärmestrahlung
                    der umgebenden Oberflächen der Heizzone berücksichtigt.
                </Typography>
            </>
        )
    },
    {
        number: "7",
        title: "Temperaturabhängige Materialeigenschaften",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die thermophysikalischen Eigenschaften von PVC können
                    sich mit steigender Temperatur verändern. Deshalb werden
                    im Modell temperaturabhängige Materialfunktionen
                    verwendet und nicht nur konstante Werte.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Eine besondere Bedeutung hat die Änderung der spezifischen
                    Wärmekapazität im Bereich des Glasübergangs. Dadurch kann
                    berücksichtigt werden, dass sich der Energiebedarf für
                    eine weitere Temperaturerhöhung des Materials verändert.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Glasübergangstemperatur wird als charakteristischer
                    Bereich des Übergangs von einem steiferen Materialzustand
                    zu einem Bereich mit höherer Beweglichkeit der
                    Polymerketten verwendet.
                </Typography>
            </>
        )
    },
    {
        number: "8",
        title: "Erwärmung, Transport und Abkühlung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Der gesamte Prozess wird in aufeinanderfolgende
                    physikalische Phasen unterteilt:
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
                            Herausnehmen des Werkstücks
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Transport und Abkühlung
                        </FlowBox>
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <FlowBox>
                            Start des Biegevorgangs
                        </FlowBox>
                    </Grid>
                </Grid>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Nach Erreichen des erforderlichen Erwärmungszustands
                    wird das Werkstück aus der Heizzone herausgenommen.
                    Während des Transports endet der direkte Einfluss
                    der Heizelemente und die Abkühlung der Oberfläche sowie
                    der anschließende Temperaturausgleich über die Dicke
                    beginnt.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Deshalb wird die tatsächliche Zeit bis zum Erreichen
                    der erforderlichen Temperatur für den Beginn des
                    Biegevorgangs nicht nur durch die Verweilzeit in der
                    Heizzone, sondern auch durch die Transportzeit bestimmt.
                </Typography>
            </>
        )
    },
    {
        number: "9",
        title: "Kriterium für das Ende der Erwärmung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Die Erwärmungsphase gilt als abgeschlossen, wenn die
                    minimale Temperatur über die gesamte Plattendicke
                    die vorgegebene Zieltemperatur erreicht:
                </Typography>

                <Formula>
                    {String.raw`
                        \min_{x}
                        T(x,t_{\mathrm{heat}})
                        \ge
                        T_{\mathrm{target}}
                    `}
                </Formula>

                <Typography sx={bodySx}>
                    Dieses Kriterium stellt sicher, dass auch der kälteste
                    Bereich des Werkstücks ausreichend erwärmt ist. Dadurch
                    wird verhindert, dass die Oberfläche die erforderliche
                    Temperatur bereits erreicht, während der mittlere Bereich
                    noch nicht ausreichend erwärmt ist.
                </Typography>
            </>
        )
    },
    {
        number: "10",
        title: "Berechnungsergebnisse",
        content: (
            <>
                <Typography sx={bodySx}>
                    Das Ergebnis der Berechnung ist die zeitliche Entwicklung
                    der Temperatur an verschiedenen Positionen über die
                    Plattendicke.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Diagramme ermöglichen die Beurteilung von:
                </Typography>

                <List
                    component="ul"
                    sx={{
                        pl: 3,
                        mt: 1
                    }}
                >
                    <StyledListItem>
                        Oberflächentemperatur;
                    </StyledListItem>

                    <StyledListItem>
                        Temperatur der mittleren Materialschicht;
                    </StyledListItem>

                    <StyledListItem>
                        Temperaturverteilung über die Plattendicke;
                    </StyledListItem>

                    <StyledListItem>
                        Zeit bis zum Erreichen der Zieltemperatur;
                    </StyledListItem>

                    <StyledListItem>
                        Gleichmäßigkeit der Erwärmung des Werkstücks;
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
        number: "11",
        title: "Überwachung der Zersetzungstemperatur",
        content: (
            <>
                <Typography sx={bodySx}>
                    Zur Vermeidung einer Überhitzung wird während der
                    Berechnung die Temperatur des Beginns der thermischen
                    Zersetzung des Materials überwacht.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Sobald die Temperatur an einem beliebigen Rechenknoten
                    die festgelegte Zersetzungstemperatur erreicht, wird
                    die Berechnung der Erwärmung beendet und ein
                    entsprechender Status über das Überschreiten des
                    zulässigen Temperaturniveaus zurückgegeben.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die Zersetzungstemperatur stellt dabei eine
                    Sicherheitsgrenze dar und wird nicht als
                    Zieltemperatur für die Umformung verwendet.
                </Typography>
            </>
        )
    },
    {
        number: "12",
        title: "Experimentelle Überprüfung",
        content: (
            <>
                <Typography sx={bodySx}>
                    Das numerische Modell kann zusätzlich durch
                    experimentelle Messungen der Oberflächentemperatur
                    und/oder der Temperatur im Inneren des Werkstücks
                    überprüft werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Eine solche Überprüfung ermöglicht die Bewertung der
                    Übereinstimmung zwischen dem numerischen Modell und
                    dem realen Heizsystem. Bei Bedarf können einzelne
                    Wärmeübergangsparameter weiter präzisiert werden.
                </Typography>

                <Typography sx={{ ...bodySx, mt: 2 }}>
                    Die experimentelle Kalibrierung wird als separater
                    Schritt zur Verifikation des Modells betrachtet
                    und ist nicht Bestandteil der grundlegenden Berechnung.
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
                            Thermische Biegung
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
                        Methodik der Erwärmungsberechnung
                    </Typography>

                    <Typography
                        variant="h6"
                        color="text.secondary"
                        sx={{
                            mt: 1.5,
                            maxWidth: 900,
                            lineHeight: 1.5,
                            fontWeight: 400
                        }}
                    >
                        Anpassung des experimentell-numerischen Ansatzes
                        von Buffel et al. (2017) an TEN-Heizsysteme
                        geschlossener Bauart unter Berücksichtigung
                        der Abkühlung während des Transports des Werkstücks
                        aus der Heizzone zur Biegestation.
                    </Typography>
                </Box>

                <Divider />

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
                        Die Methodik ermöglicht die Berechnung der
                        Aufheizzeit eines thermoplastischen Werkstücks
                        unter Berücksichtigung seiner Dicke, der
                        thermophysikalischen Materialeigenschaften,
                        der Parameter der Heizzone, des Temperaturregimes,
                        des Strahlungs- und konvektiven Wärmeübergangs
                        sowie der anschließenden Abkühlung während des
                        Transports zur Biegestation.
                    </Typography>
                </Paper>
            </Stack>
        </Container>
    );
}