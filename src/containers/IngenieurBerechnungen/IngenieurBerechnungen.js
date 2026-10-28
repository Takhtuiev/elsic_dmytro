import React from "react";
import {
    Box,
    Container,
    Paper,
    Typography,
    useTheme,
} from "@mui/material";
import SvgLineChart from "../Bending/Chart/SvgLineChart";
import {
    chartDataCH1,
    chartDataCH2,
    chartDataCH3,
    chartDataCH4,
    chartDataCH5,
    chartDataCH6,
    chartDataCH7, chartDataCH8
} from "./chartData";
import {alpha} from "@mui/material/styles";
// Импортируем ваш собственный SVG-компонент графика

function IngenieurBerechnungen() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // Преобразуем исходные демонстрационные данные под структуру вашего SvgLineChart
    const chartConfig1 = {
        showPoints: true,
        showLabels: true,
        axes: {
            x: { unit: "s" ,
                lines: [
                    {
                        value: 30,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 146,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 277,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },
                    {
                        value: 413,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },
                    {
                        value: 542,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },


                    {
                        value: 64,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 168,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 289,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 390,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 528,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },

                ],

            }, // Единица измерения оси X (Деформация)
            y: { unit: "°" ,
                ranges: [
                    { from: 345, to: 270, color: theme.palette.success.main },
                    { from: 300, to: 230, color: theme.palette.info.main },
                ]

            },
        },
        graphs: [
            {
                index: 0,
                name: "Belastung",
                color: theme.palette.primary.main,
                lineWidth: 2,
                showMarker: true,
                points: chartDataCH1
            },
            {
                index: 1,
                name: "Verformung",
                color: theme.palette.success.main,
                lineWidth: 2,
                showMarker: true,
                points: chartDataCH2
            },
            {
                index: 2,
                name: "Belastung2",
                color: alpha(theme.palette.primary.main, 0.7),
                lineWidth: 0.7,
                showMarker: true,
                points: chartDataCH4
            },
            {
                index: 3,
                name: "Verformung2",
                color: alpha(theme.palette.success.main, 0.7),
                lineWidth: 0.7,
                showMarker: true,
                points: chartDataCH3
            }
        ]
    };

    const chartConfig3 = {
        showPoints: true,
        showLabels: true,
        axes: {
            x: { unit: "s" ,
                lines: [
                    {
                        value: 30,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 146,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 277,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },
                    {
                        value: 413,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },
                    {
                        value: 542,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },


                    {
                        value: 64,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 168,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 289,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 390,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 528,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },

                ],

            }, // Единица измерения оси X (Деформация)
            y: { unit: "°" ,
                ranges: [
                    { from: 345, to: 270, color: theme.palette.success.main },
                    { from: 300, to: 230, color: theme.palette.info.main },
                ]

            },
        },
        graphs: [
            {
                index: 0,
                name: "Belastung",
                color: theme.palette.primary.main,
                lineWidth: 1,
                showMarker: true,
                points: chartDataCH5
            },
            {
                index: 1,
                name: "Verformung",
                color: theme.palette.primary.main,
                lineWidth: 1,
                showMarker: true,
                points: chartDataCH6
            },
            {
                index: 2,
                name: "Belastung21",
                color: alpha(theme.palette.success.main, 1),
                lineWidth: 1,
                showMarker: true,
                points: chartDataCH7
            },
            {
                index: 3,
                name: "Verformung21",
                color: alpha(theme.palette.success.main, 1),
                lineWidth: 1,
                showMarker: true,
                points: chartDataCH8
            }
        ]
    };


    const chartConfig2 = {
        showPoints: true,
        showLabels: true,
        axes: {
            x: { unit: "s" ,
                lines: [
                    {
                        value: 46,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 93,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 129,
                        color: alpha(theme.palette.success.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 177,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },
                    {
                        value: 213,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },
                    {
                        value: 260,
                        color: alpha(theme.palette.success.main, 0.8), // info.main отвечает за синий (информационный) цвет в MUI
                    },


                    {
                        value: 35,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 63,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 93,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 116,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 142,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 222,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 253,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },
                    {
                        value: 276,
                        color: alpha(theme.palette.info.main, 0.8), // error.main отвечает за красный цвет в MUI
                    },

                ],

            }, // Единица измерения оси X (Деформация)
            y: { unit: "°" ,
                ranges: [
                    { from: 273, to: 253, color: theme.palette.success.main },
                    { from: 288, to: 275, color: theme.palette.info.main },
                ]

            },
        },
        graphs: [
            {
                index: 0,
                name: "Belastung",
                color: theme.palette.primary.main,
                lineWidth: 3,
                showMarker: true,
                points: chartDataCH4
            },
            {
                index: 1,
                name: "Verformung",
                color: theme.palette.success.main,
                lineWidth: 2,
                showMarker: true,
                points: chartDataCH3
            }
        ]
    };

    return (
        <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
            {/* Шапка страницы */}
            <Box sx={{ bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider" }}>
                <Container maxWidth="lg">
                    <Box sx={{ py: { xs: 3.5, md: 4.5 } }}>
                        <Typography sx={{ color: "primary.main", fontSize: 12, fontWeight: 800, letterSpacing: 2, mb: 1 }}>
                            ELSIC_Dmytro • TECHNICAL TOOLS
                        </Typography>
                        <Typography component="h1" sx={{ fontSize: { xs: "2rem", md: "2.7rem" }, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-.03em", mb: 1 }}>
                            Ingenieurberechnungen
                        </Typography>
                        <Typography color="text.secondary" sx={{ maxWidth: 650, lineHeight: 1.6 }} >
                            Technisches Diagramm und ingenieurwissenschaftliche Berechnungen.
                        </Typography>
                    </Box>
                </Container>
            </Box>

            {/* Основной контент */}
            <Container maxWidth="lg">
                <Box sx={{ py: { xs: 4, md: 5 } }}>

                    {/* Контейнер для графика */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: { xs: 2, md: 3 },
                            bgcolor: "background.paper",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2
                        }}
                    >
                        <Typography component="h2" sx={{ fontSize: "1.25rem", fontWeight: 700, mb: 3 }}>
                            Diagramm
                        </Typography>

                        {/* Контейнер с вашим SVG графиком */}
                        <Box sx={{ width: "100%" }}>
                            <SvgLineChart
                                chart={chartConfig1}
                                maxHeight={400}
                            />
                        </Box>

                        <Box sx={{ width: "100%" }}>
                            <SvgLineChart
                                chart={chartConfig3}
                                maxHeight={400}
                            />
                        </Box>

                        <Box sx={{ width: "100%" }}>
                            <SvgLineChart
                                chart={chartConfig2}
                                maxHeight={400}
                            />
                        </Box>

                    </Paper>

                    {/* Информационный дисклеймер внизу страницы */}
                    <Box sx={{ mt: 4, px: 2, py: 2, borderLeft: "3px solid", borderColor: "primary.main", bgcolor: isDark ? "rgba(255,255,255,.025)" : "rgba(40,150,170,.04)" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }} >
                            Upper & Lower Heating Elements Temperature Fluctuations
                        </Typography>
                    </Box>

                </Box>
            </Container>
        </Box>
    );
}

export default IngenieurBerechnungen;
