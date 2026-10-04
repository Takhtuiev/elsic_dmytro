import React, { useCallback, memo } from "react";
import { Box, Typography, Card, CardContent } from "@mui/material";
import MyTextField from "./MyTextField"; // Путь к вашему общему компоненту MyTextField
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const UNIT_FONT_SIZE = "0.75rem";
const FRACTION_FONT_SIZE = "0.55rem";
// Сетка для строки свойства: Инпут занимает всё пространство, UNIT фиксирован в конце
const ROW_GRID_TEMPLATE = "1fr 45px";

// Переведено на String.raw с использованием красивого синтаксиса LaTeX-формул
const SECTIONS = [
    {
        title: "Physical properties",
        props: [
            { key: "density", label: "Density", unit: String.raw`\frac{kg}{m^3}` },
            { key: "thermalConductivity", label: "Thermal conductivity", unit: String.raw`\frac{W}{m\cdot K}` },
            { key: "specificHeat", label: "Specific heat", unit: String.raw`\frac{J}{kg\cdot K}` }
        ]
    },
    {
        title: "Tg transition",
        props: [
            { key: "tgSpecificHeatJumpFactor", label: "Tg heat capacity jump", unit: String.raw`\times` },
            { key: "tgTransitionWidthC", label: "Tg transition width", unit: String.raw`\,^{\circ}C` }
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
            { key: "glassTransitionTemp", label: "Glass transition temp.", unit: String.raw`\,^{\circ}C` },
            { key: "minFormingTemp", label: "Min. forming temp.", unit: String.raw`\,^{\circ}C` },
            { key: "maxFormingTemp", label: "Max. forming temp.", unit: String.raw`\,^{\circ}C` },
            { key: "decompositionTemp", label: "Decomposition temp.", unit: String.raw`\,^{\circ}C` }
        ]
    },
    {
        title: "Bending",
        props: [
            { key: "kFactor", label: "K-factor", unit: "" }
        ]
    }
];

// Изолированная карточка секции — защищает от лишних ререндеров
const SectionCard = memo(({ section, materialValue, onPropChange }) => {
    return (
        <Card
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

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {section.props.map((prop) => {
                        const isFraction = prop.unit.includes(String.raw`\frac`);
                        const propValue = materialValue?.[prop.key] ?? "";

                        return (
                            <Box
                                key={prop.key}
                                sx={{
                                    display: "grid",
                                    gridTemplateColumns: ROW_GRID_TEMPLATE,
                                    alignItems: "center",
                                    gap: 1
                                }}
                            >
                                <MyTextField
                                    label={prop.label}
                                    value={propValue}
                                    onChange={(val) => onPropChange(prop.key, val)}
                                    type="number"
                                    size="small"
                                    fullWidth
                                />

                                {/* Вынесенная колонка под Единицу измерения в конце каждой строки */}
                                <Box sx={{ display: "flex", alignItems: "center", pl: 0.5, minHeight: 24, color: "text.secondary" }}>
                                    {prop.unit ? (
                                        <Box sx={{
                                            "& .katex-display": { margin: 0, fontSize: isFraction ? FRACTION_FONT_SIZE : UNIT_FONT_SIZE, display: "flex", alignItems: "center" },
                                            "& .katex": { lineHeight: 1, display: "flex", alignItems: "center" },
                                            "& .katex-html": { display: "flex", alignItems: "center" }
                                        }}><BlockMath math={prop.unit} /></Box>
                                    ) : null}
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
});

export default function MaterialEditContent({ value = {}, onChange }) {

    const handleMaterialNameChange = useCallback((val) => {
        onChange?.({
            ...value,
            name: val
        });
    }, [value, onChange]);

    const handlePropChange = useCallback((key, rawValue) => {
        onChange?.({
            ...value,
            [key]: rawValue === "" ? "" : Number(rawValue)
        });
    }, [value, onChange]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, width: "100%" }}>

            {/* Оптимизированное поле названия материала */}
            <MyTextField
                label="Material name"
                value={value?.name ?? ""}
                onChange={handleMaterialNameChange}
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

            {/* Контейнер многоколоночной сетки карточек */}
            <Box
                sx={{
                    columnCount: {
                        xs: 1, // Для очень узких экранов лучше 1
                        sm: 2, // 2 колонки на планшетах
                        md: 3  // 3 колонки на десктопах
                    },
                    columnGap: 2.5,
                }}
            >
                {SECTIONS.map((section) => (
                    <SectionCard
                        key={section.title}
                        section={section}
                        materialValue={value}
                        onPropChange={handlePropChange}
                    />
                ))}
            </Box>
        </Box>
    );
}
