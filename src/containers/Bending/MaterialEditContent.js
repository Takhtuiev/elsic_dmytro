import React from "react";
import {
    Box,
    TextField,
    InputAdornment,
    Typography,
    Card,
    CardContent
} from "@mui/material";

const sections = [
    {
        title: "Physical properties",
        props: [
            { key: "density", label: "Density", unit: "kg/m³" },
            { key: "thermalConductivity", label: "Thermal conductivity", unit: "W/(m·K)" },
            { key: "specificHeat", label: "Specific heat", unit: "J/(kg·K)" }
        ]
    },
    {
        title: "Tg transition",
        props: [
            { key: "tgSpecificHeatJumpFactor", label: "Tg heat capacity jump", unit: "×" },
            { key: "tgTransitionWidthC", label: "Tg transition width", unit: "°C" }
        ]
    },
    {
        title: "Surface",
        props: [
            { key: "emissivity", label: "Emissivity", unit: "" },
            { key: "surfaceReflectance", label: "Surface reflectance", unit: "" }
        ]
    },
    {
        title: "Temperature",
        props: [
            { key: "glassTransitionTemp", label: "Glass transition temp.", unit: "°C" },
            { key: "minFormingTemp", label: "Min. forming temp.", unit: "°C" },
            { key: "maxFormingTemp", label: "Max. forming temp.", unit: "°C" },
            { key: "decompositionTemp", label: "Decomposition temp.", unit: "°C" }
        ]
    },
    {
        title: "Bending",
        props: [
            { key: "kFactor", label: "K-factor", unit: "" }
        ]
    }
];

export default function MaterialEditContent({ value = {}, onChange }) {
    const handleChange = (key) => (event) => {
        const raw = event.target.value;
        onChange?.({
            ...value,
            [key]: raw === "" ? "" : Number(raw)
        });
    };

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 2.5,
                width: "100%"
            }}
        >
            {/* Название материала */}
            <TextField
                label="Material name"
                value={value?.name ?? ""}
                onChange={(event) => {
                    onChange?.({
                        ...value,
                        name: event.target.value
                    });
                }}
                size="medium"
                fullWidth
                placeholder="e.g. Polycarbonate"
                slotProps={{
                    input: {
                        sx: {
                            fontWeight: 600,
                            fontSize: "1.05rem",
                            borderRadius: 2,
                            backgroundColor: "background.paper",
                            mb: 0.5
                        }
                    }
                }}
            />

            {/* Контейнер колонок */}
            <Box
                sx={{
                    columnCount: {
                        xs: 2,       // 2 колонки на маленьких экранах
                        md: 3        // 3 колонки на больших экранах
                    },
                    columnGap: 2.5,
                }}
            >
                {sections.map((section) => (
                    <Card
                        key={section.title} // Ключ для первой итерации map
                        variant="outlined"
                        sx={{
                            borderRadius: 2,
                            borderColor: "divider",
                            backgroundColor: (theme) =>
                                theme.palette.mode === "dark" ? "background.paper" : "rgba(0, 0, 0, 0.01)",
                            display: "inline-block",
                            width: "100%",
                            breakInside: "avoid",
                            mb: 2.5
                        }}
                    >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                            {/* Заголовок секции */}
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    fontWeight: 700,
                                    color: "text.primary",
                                    mb: 2,
                                    fontSize: "0.85rem",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.8
                                }}
                            >
                                {section.title}
                            </Typography>

                            {/* Поля ввода строго в один столбик */}
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2
                                }}
                            >
                                {section.props.map((prop) => (
                                    <Box
                                        key={prop.key} // Перенесли ключ на самый верхний родительский элемент итерации
                                        sx={{ width: "100%" }}
                                    >
                                        <TextField
                                            label={prop.label}
                                            value={value?.[prop.key] ?? ""}
                                            onChange={handleChange(prop.key)}
                                            type="number"
                                            size="small"
                                            fullWidth
                                            slotProps={{
                                                htmlInput: {
                                                    min: 0,
                                                    style: {
                                                        padding: "4px 8px",
                                                        fontSize: "0.875rem"
                                                    }
                                                },
                                                input: {
                                                    endAdornment: prop.unit ? (
                                                        <InputAdornment position="end">
                                                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                                                {prop.unit}
                                                            </Typography>
                                                        </InputAdornment>
                                                    ) : undefined
                                                }
                                            }}
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Box>
    );
}
