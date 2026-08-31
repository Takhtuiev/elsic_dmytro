import React from "react";
import {
    Box,
    Button,
    Container,
    Grid,
    Paper,
    Typography,
    useTheme,
} from "@mui/material";

import { useNavigate } from "react-router-dom";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CalculateIcon from "@mui/icons-material/Calculate";
import StraightenIcon from "@mui/icons-material/Straighten";
import ConstructionIcon from "@mui/icons-material/Construction";
import ArchitectureIcon from "@mui/icons-material/Architecture";

function Home() {
    const theme = useTheme();
    const navigate = useNavigate();

    const isDark = theme.palette.mode === "dark";

    return (
        <Box
            sx={{
                minHeight: "100vh",
                bgcolor: "background.default",
                color: "text.primary",
            }}
        >

            {/* =====================================================
                COMPACT HEADER
            ===================================================== */}

            <Box
                sx={{
                    bgcolor: "background.paper",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Container maxWidth="lg">

                    <Box
                        sx={{
                            py: {
                                xs: 3.5,
                                md: 4.5,
                            },
                        }}
                    >

                        <Typography
                            sx={{
                                color: "primary.main",
                                fontSize: 12,
                                fontWeight: 800,
                                letterSpacing: 2,
                                mb: 1,
                            }}
                        >
                            ELSIC • TECHNICAL TOOLS
                        </Typography>


                        <Typography
                            component="h1"
                            sx={{
                                fontSize: {
                                    xs: "2rem",
                                    md: "2.7rem",
                                },

                                fontWeight: 800,
                                lineHeight: 1.15,
                                letterSpacing: "-.03em",

                                mb: 1,
                            }}
                        >
                            Technische Werkzeuge
                        </Typography>


                        <Typography
                            color="text.secondary"
                            sx={{
                                maxWidth: 650,
                                lineHeight: 1.6,
                            }}
                        >
                            Praktische Berechnungen und Hilfswerkzeuge
                            für die tägliche Arbeit in der Fertigung.
                        </Typography>

                    </Box>

                </Container>
            </Box>


            {/* =====================================================
                CONTENT
            ===================================================== */}

            <Container maxWidth="lg">

                <Box
                    sx={{
                        py: {
                            xs: 4,
                            md: 5,
                        },
                    }}
                >

                    {/* SECTION TITLE */}

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1.5,
                            mb: 2.5,
                        }}
                    >

                        <Box
                            sx={{
                                width: 4,
                                height: 25,
                                bgcolor: "primary.main",
                                borderRadius: 1,
                            }}
                        />

                        <Typography
                            component="h2"
                            sx={{
                                fontSize: {
                                    xs: "1.5rem",
                                    md: "1.8rem",
                                },
                                fontWeight: 800,
                            }}
                        >
                            Werkzeuge
                        </Typography>

                    </Box>


                    {/* =================================================
                        MAIN TOOL
                    ================================================= */}

                    <Paper
                        component="button"
                        type="button"
                        onClick={() =>
                            navigate("/biegeberechnung")
                        }
                        elevation={0}
                        sx={{
                            width: "100%",

                            textAlign: "left",

                            p: 0,

                            overflow: "hidden",

                            cursor: "pointer",

                            font: "inherit",

                            color: "inherit",

                            bgcolor:
                                "background.paper",

                            border: "1px solid",

                            borderColor:
                                "divider",

                            borderRadius: 2,

                            mb: 2.5,

                            transition:
                                "all .2s ease",

                            "&:hover": {
                                borderColor:
                                    "primary.main",

                                transform:
                                    "translateY(-2px)",

                                boxShadow: isDark
                                    ? "0 10px 30px rgba(0,0,0,.3)"
                                    : "0 10px 30px rgba(20,70,80,.10)",
                            },

                            "&:focus-visible": {
                                outline: "3px solid",
                                outlineColor:
                                    "primary.main",
                                outlineOffset: 2,
                            },
                        }}
                    >

                        {/* ACCENT */}

                        <Box
                            sx={{
                                height: 4,
                                bgcolor: "primary.main",
                            }}
                        />


                        <Grid container>

                            {/* LEFT */}

                            <Grid
                                size={{
                                    xs: 12,
                                    md: 8,
                                }}
                            >

                                <Box
                                    sx={{
                                        p: {
                                            xs: 2.5,
                                            md: 3.5,
                                        },
                                    }}
                                >

                                    <Box
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 1.5,
                                            mb: 2,
                                        }}
                                    >

                                        <Box
                                            sx={{
                                                width: 44,
                                                height: 44,

                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent:
                                                    "center",

                                                borderRadius: 1.5,

                                                bgcolor:
                                                    isDark
                                                        ? "rgba(80,190,210,.12)"
                                                        : "rgba(40,150,170,.10)",

                                                color:
                                                    "primary.main",
                                            }}
                                        >
                                            <ArchitectureIcon
                                                sx={{
                                                    fontSize: 25,
                                                }}
                                            />
                                        </Box>


                                        <Box>

                                            <Typography
                                                sx={{
                                                    fontSize: 11,
                                                    fontWeight: 800,
                                                    letterSpacing: 1.2,
                                                    color:
                                                        "primary.main",
                                                }}
                                            >
                                                BERECHNUNG
                                            </Typography>


                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                Thermoplastische Materialien
                                            </Typography>

                                        </Box>

                                    </Box>


                                    <Typography
                                        component="h3"
                                        sx={{
                                            fontSize: {
                                                xs: "1.4rem",
                                                md: "1.7rem",
                                            },

                                            fontWeight: 800,

                                            mb: 1,
                                        }}
                                    >
                                        Thermische Biegung
                                    </Typography>


                                    <Typography
                                        color="text.secondary"
                                        sx={{
                                            maxWidth: 680,

                                            lineHeight: 1.65,

                                            mb: 2.5,
                                        }}
                                    >
                                        Berechnung der Parameter
                                        für die thermische Biegung
                                        von PVC und anderen
                                        thermoplastischen Materialien.
                                    </Typography>


                                    <Button
                                        variant="contained"
                                        size="small"
                                        endIcon={
                                            <ArrowForwardIcon
                                                sx={{
                                                    fontSize:
                                                        "17px !important",
                                                }}
                                            />
                                        }
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            navigate(
                                                "/biegeberechnung"
                                            );
                                        }}
                                        sx={{
                                            textTransform: "none",
                                            fontWeight: 700,
                                            boxShadow: "none",
                                            px: 2,

                                            "&:hover": {
                                                boxShadow: "none",
                                            },
                                        }}
                                    >
                                        Öffnen
                                    </Button>

                                </Box>

                            </Grid>


                            {/* RIGHT */}

                            <Grid
                                size={{
                                    xs: 12,
                                    md: 4,
                                }}
                            >

                                <Box
                                    sx={{
                                        height: "100%",

                                        minHeight: {
                                            xs: 120,
                                            md: 210,
                                        },

                                        p: 3,

                                        bgcolor:
                                            isDark
                                                ? "rgba(255,255,255,.025)"
                                                : "#f2f9fa",

                                        borderLeft: {
                                            xs: "none",
                                            md: "1px solid",
                                        },

                                        borderTop: {
                                            xs: "1px solid",
                                            md: "none",
                                        },

                                        borderColor:
                                            "divider",

                                        display: "flex",
                                        alignItems:
                                            "center",
                                        justifyContent:
                                            "center",
                                    }}
                                >

                                    <Box
                                        sx={{
                                            textAlign: "center",
                                        }}
                                    >

                                        <Typography
                                            sx={{
                                                fontSize: 11,
                                                fontWeight: 800,
                                                letterSpacing: 1.3,
                                                color:
                                                    "text.secondary",
                                                mb: 1,
                                            }}
                                        >
                                            MATERIAL
                                        </Typography>


                                        <Typography
                                            sx={{
                                                fontSize: "2.3rem",
                                                fontWeight: 800,
                                                lineHeight: 1,
                                                color:
                                                    "primary.main",
                                            }}
                                        >
                                            PVC
                                        </Typography>


                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            & weitere Thermoplaste
                                        </Typography>

                                    </Box>

                                </Box>

                            </Grid>

                        </Grid>

                    </Paper>


                    {/* =================================================
                        OTHER TOOLS
                    ================================================= */}

                    <Grid
                        container
                        spacing={2}
                    >

                        <Grid
                            size={{
                                xs: 12,
                                sm: 6,
                                md: 4,
                            }}
                        >

                            <ToolCard
                                icon={<CalculateIcon />}
                                title="Berechnungen"
                                text="Weitere technische Berechnungen."
                            />

                        </Grid>


                        <Grid
                            size={{
                                xs: 12,
                                sm: 6,
                                md: 4,
                            }}
                        >

                            <ToolCard
                                icon={<StraightenIcon />}
                                title="Maße & Geometrie"
                                text="Maße, Winkel und geometrische Berechnungen."
                            />

                        </Grid>


                        <Grid
                            size={{
                                xs: 12,
                                sm: 6,
                                md: 4,
                            }}
                        >

                            <ToolCard
                                icon={<ConstructionIcon />}
                                title="Fertigung"
                                text="Hilfswerkzeuge für die praktische Arbeit."
                            />

                        </Grid>

                    </Grid>


                    {/* =================================================
                        INFO
                    ================================================= */}

                    <Box
                        sx={{
                            mt: 4,
                            px: 2,
                            py: 2,

                            borderLeft: "3px solid",
                            borderColor: "primary.main",

                            bgcolor: isDark
                                ? "rgba(255,255,255,.025)"
                                : "rgba(40,150,170,.04)",
                        }}
                    >

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                lineHeight: 1.65,
                            }}
                        >
                            Die Werkzeuge dienen als technische
                            Unterstützung bei Berechnungen und der
                            Vorbereitung von Arbeitsprozessen.
                            Ergebnisse sind anhand der jeweiligen
                            technischen Zeichnungen, Maschinenparameter
                            und betrieblichen Vorgaben zu prüfen.
                        </Typography>

                    </Box>

                </Box>

            </Container>

        </Box>
    );
}


/* =========================================================
   TOOL CARD
========================================================= */

function ToolCard({
    icon,
    title,
    text,
}) {
    return (
        <Paper
            elevation={0}
            sx={{
                height: "100%",

                minHeight: 145,

                p: 2.5,

                bgcolor: "background.paper",

                border: "1px solid",

                borderColor: "divider",

                borderRadius: 2,

                transition:
                    "all .2s ease",

                "&:hover": {
                    borderColor:
                        "primary.main",

                    transform:
                        "translateY(-2px)",
                },
            }}
        >

            <Box
                sx={{
                    width: 40,
                    height: 40,

                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                        "center",

                    borderRadius: 1.5,

                    bgcolor:
                        "action.hover",

                    color:
                        "primary.main",

                    mb: 2,
                }}
            >
                {React.cloneElement(icon, {
                    sx: {
                        fontSize: 22,
                    },
                })}
            </Box>


            <Typography
                sx={{
                    fontWeight: 700,
                    mb: 0.7,
                }}
            >
                {title}
            </Typography>


            <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                    lineHeight: 1.55,
                }}
            >
                {text}
            </Typography>

        </Paper>
    );
}


export default Home;
