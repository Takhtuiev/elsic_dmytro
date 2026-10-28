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
import EngineeringIcon from "@mui/icons-material/Engineering"; // Импортируем иконку

function Home() {
    const theme = useTheme();
    const navigate = useNavigate();
    const isDark = theme.palette.mode === "dark";

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
            <Box sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
                <Container maxWidth="lg">
                    <Box sx={{ py: { xs: 3.5, md: 4.5 } }}>
                        <Typography sx={{ color: "primary.main", fontSize: 12, fontWeight: 800, letterSpacing: 2, mb: 1 }}>
                            ELSIC_Dmytro • TECHNICAL TOOLS
                        </Typography>
                        <Typography component="h1" sx={{ fontSize: { xs: "2rem", md: "2.7rem" }, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-.03em", mb: 1 }}>
                            Technische Werkzeuge
                        </Typography>
                        <Typography color="text.secondary" sx={{ maxWidth: 650, lineHeight: 1.6 }} >
                            Praktische Berechnungen und Hilfswerkzeuge für die tägliche Arbeit in der Fertigung.
                        </Typography>
                    </Box>
                </Container>
            </Box>

            <Container maxWidth="lg">
                <Box sx={{ py: { xs: 4, md: 5 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                        <Box sx={{ width: 4, height: 25, bgcolor: "primary.main", borderRadius: 1 }} />
                        <Typography component="h2" sx={{ fontSize: { xs: "1.5rem", md: "1.8rem" }, fontWeight: 800 }}>
                            Werkzeuge
                        </Typography>
                    </Box>

                    <Grid container spacing={2}>
                        {/* Карточка 1: Термическая гибка */}
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <Paper
                                onClick={() => navigate("/biegeberechnung")}
                                elevation={0}
                                sx={{
                                    height: "100%",
                                    minHeight: 145,
                                    p: 2.5,
                                    cursor: "pointer",
                                    bgcolor: "background.paper",
                                    border: "1px solid",
                                    borderColor: "divider",
                                    borderRadius: 2,
                                    transition: "all .2s ease",
                                    "&:hover": {
                                        borderColor: "primary.main",
                                        transform: "translateY(-2px)",
                                        boxShadow: isDark ? "0 10px 30px rgba(0,0,0,.3)" : "0 10px 30px rgba(20,70,80,.10)"
                                    },
                                    "&:focus-visible": {
                                        outline: "3px solid",
                                        outlineColor: "primary.main",
                                        outlineOffset: 2
                                    }
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                                    <Box sx={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 1.5, bgcolor: isDark ? "rgba(80,190,210,.12)" : "rgba(40,150,170,.10)", color: "primary.main" }}>
                                        <ArchitectureIcon sx={{ fontSize: 22 }} />
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "primary.main" }}>
                                            BERECHNUNG
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" >
                                            Thermoplastische Materialien
                                        </Typography>
                                    </Box>
                                </Box>
                                <Typography component="h3" sx={{ fontSize: "1.25rem", fontWeight: 700, mb: 0.7 }}>
                                    Thermische Biegung
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, mb: 1.5 }} >
                                    Berechnung der Parameter für die thermische Biegung von PVC und anderen Thermoplasten.
                                </Typography>
                                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                                    <Typography variant="caption" color="text.secondary" >
                                        <Box component="span" sx={{ fontWeight: 700, color: "primary.main" }} >
                                            PVC
                                        </Box>
                                        {" "}• weitere Thermoplaste
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        endIcon={ <ArrowForwardIcon sx={{ fontSize: "17px !important" }} /> }
                                        onClick={event => {
                                            event.stopPropagation();
                                            navigate("/biegeberechnung");
                                        }}
                                        sx={{ textTransform: "none", fontWeight: 700, boxShadow: "none", px: 1.5, "&:hover": { boxShadow: "none" } }}
                                    >
                                        Öffnen
                                    </Button>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Карточка 2: Инженерные расчеты */}
                        <ToolCard
                            icon={<EngineeringIcon />}
                            subTitle="INGENIEURWESEN"
                            caption="Konstruktion & Analyse"
                            title="Ingenieurberechnungen"
                            text="Komplexe ingenieurtechnische Berechnungen und statische Analysen."
                            tags={<><Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>Statik</Box> • Mechanik</>}
                            path="/ingenieur-berechnungen"
                        />

                        {/* Карточка 3: Расчеты */}
                        <ToolCard
                            icon={<CalculateIcon />}
                            subTitle="BERECHNUNG"
                            caption="Allgemeine Formeln"
                            title="Berechnungen"
                            text="Weitere technische und mathematische Berechnungen für den Alltag."
                            tags={<><Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>Formeln</Box> • Werte</>}
                            path="/berechnungen"
                        />

                        {/* Карточка 4: Размеры и геометрия */}
                        <ToolCard
                            icon={<StraightenIcon />}
                            subTitle="GEOMETRIE"
                            caption="Winkel & Toleranzen"
                            title="Maße & Geometrie"
                            text="Maße, Abstände, Winkel und komplexe geometrische Berechnungen."
                            tags={<><Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>mm / Zoll</Box> • Winkel</>}
                            path="/geometrie"
                        />

                        {/* Карточка 5: Производство */}
                        <ToolCard
                            icon={<ConstructionIcon />}
                            subTitle="FERTIGUNG"
                            caption="Werkstatt-Hilfen"
                            title="Fertigung"
                            text="Praktische Hilfswerkzeuge für die tägliche Arbeit an Maschinen."
                            tags={<><Box component="span" sx={{ fontWeight: 700, color: "primary.main" }}>CNC</Box> • Parameter</>}
                            path="/fertigung"
                        />
                    </Grid>

                    <Box sx={{ mt: 4, px: 2, py: 2, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: isDark ? "rgba(255,255,255,.025)" : "rgba(40,150,170,.04)" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }} >
                            Die Werkzeuge dienen als technische Unterstützung bei Berechnungen und der Vorbereitung von Arbeitsprozessen. Ergebnisse sind anhand der jeweiligen technischen Zeichnungen, Maschinenparameter und betrieblichen Vorgaben zu prüfen.
                        </Typography>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
}

// Универсальный компонент ToolCard, повторяющий дизайн первой карточки
function ToolCard({ icon, subTitle, caption, title, text, tags, path }) {
    const navigate = useNavigate();
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Paper
                onClick={() => path && navigate(path)}
                elevation={0}
                sx={{
                    height: "100%",
                    minHeight: 145,
                    p: 2.5,
                    cursor: "pointer",
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    transition: "all .2s ease",
                    "&:hover": {
                        borderColor: "primary.main",
                        transform: "translateY(-2px)",
                        boxShadow: isDark ? "0 10px 30px rgba(0,0,0,.3)" : "0 10px 30px rgba(20,70,80,.10)"
                    },
                    "&:focus-visible": {
                        outline: "3px solid",
                        outlineColor: "primary.main",
                        outlineOffset: 2
                    }
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Box sx={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 1.5, bgcolor: isDark ? "rgba(80,190,210,.12)" : "rgba(40,150,170,.10)", color: "primary.main" }}>
                        {React.cloneElement(icon, { sx: { fontSize: 22 } })}
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: "primary.main" }}>
                            {subTitle}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {caption}
                        </Typography>
                    </Box>
                </Box>
                <Typography component="h3" sx={{ fontSize: "1.25rem", fontWeight: 700, mb: 0.7 }}>
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, mb: 1.5 }}>
                    {text}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        {tags}
                    </Typography>
                    <Button
                        variant="contained"
                        size="small"
                        endIcon={<ArrowForwardIcon sx={{ fontSize: "17px !important" }} />}
                        onClick={event => {
                            event.stopPropagation();
                            if (path) navigate(path);
                        }}
                        sx={{ textTransform: "none", fontWeight: 700, boxShadow: "none", px: 1.5, "&:hover": { boxShadow: "none" } }}
                    >
                        Öffnen
                    </Button>
                </Box>
            </Paper>
        </Grid>
    );
}

export default Home;
