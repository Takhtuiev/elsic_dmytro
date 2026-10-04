import React, { useCallback, memo } from "react";
import { Box, Typography, Divider } from "@mui/material";
import MyTextField from "./MyTextField";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const UNIT_FONT_SIZE = "0.75rem";
const FRACTION_FONT_SIZE = "0.55rem";
// Единая сетка: Параметр | Инпут TOP | Инпут BOTTOM | UNIT (в конце)
const GRID_TEMPLATE = "1.5fr 1fr 1fr 0.5fr";

const HEATER_PROPS = [
    { key: "regulatorTemperatureC", label: "Regulator temperature", unit: String.raw`\,^{\circ}C` },
    { key: "heaterTemperatureFactor", label: "Temperature factor", unit: "" },
    { key: "heaterEmissivity", label: "Heater emissivity", unit: "" },
    { key: "viewFactor", label: "View factor", unit: "" },
    { key: "radiationGain", label: "Radiation gain", unit: "" },
    { key: "convectiveHeatTransferCoefficient", label: "Heat transfer coefficient", unit: String.raw`\frac{W}{m^2\cdot K}` }
];

const HeaterRow = memo(({ prop, topValue, bottomValue, onHeaterValueChange }) => {
    const isFraction = prop.unit.includes(String.raw`\frac`);

    return (
        <Box sx={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, alignItems: "center", gap: 1.5, borderBottom: "1px solid", borderColor: "divider", py: 0.5 }}>
            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500, minWidth: 0 }}>{prop.label}</Typography>

            {/* Чистые инпуты без внутренних единиц измерения */}
            <MyTextField
                value={topValue}
                onChange={(val) => onHeaterValueChange(0, prop.key, val)}
                type="number"
                size="small"
                fullWidth
            />
            <MyTextField
                value={bottomValue}
                onChange={(val) => onHeaterValueChange(1, prop.key, val)}
                type="number"
                size="small"
                fullWidth
            />

            {/* Выделенная колонка под Единицу измерения в самом конце */}
            <Box sx={{ display: "flex", alignItems: "center", minHeight: 24, color: "text.secondary" }}>
                {prop.unit ? (
                    <Box sx={{
                        "& .katex-display": { margin: 0, fontSize: isFraction ? FRACTION_FONT_SIZE : UNIT_FONT_SIZE, display: "flex", alignItems: "center" },
                        "& .katex": { lineHeight: 1, display: "flex", alignItems: "center" },
                        "& .katex-html": { display: "flex", alignItems: "center" }
                    }}><BlockMath math={prop.unit} /></Box>
                ) : <Typography variant="body2" color="text.disabled">—</Typography>}
            </Box>
        </Box>
    );
});

export default function MachineEditContent({ value = {}, onChange }) {
    const handleValueChange = useCallback((key, rawValue) => {
        onChange({
            ...value,
            [key]: key === "name" ? rawValue : rawValue === "" ? "" : Number(rawValue)
        });
    }, [value, onChange]);

    const handleHeaterValueChange = useCallback((heaterIndex, key, rawValue) => {
        const currentHeaters = value?.heaters || [];
        const nextHeaters = [currentHeaters[0] || {}, currentHeaters[1] || {}];
        const nextHeater = { ...nextHeaters[heaterIndex] };

        if (rawValue === "") delete nextHeater[key];
        else nextHeater[key] = Number(rawValue);

        nextHeaters[heaterIndex] = nextHeater;
        onChange({ ...value, heaters: nextHeaters });
    }, [value, onChange]);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <MyTextField
                label="Machine name"
                value={value?.name ?? ""}
                onChange={(val) => handleValueChange("name", val)}
                size="small"
                fullWidth
                slotProps={{ htmlInput: { style: { padding: "4px 8px", fontWeight: 700 } } }}
            />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <MyTextField
                    label="Tool radius"
                    value={value?.rTool ?? ""}
                    onChange={(val) => handleValueChange("rTool", val)}
                    type="number"
                    size="small"
                    sx={{ maxWidth: 260 }}
                    slotProps={{ htmlInput: { min: 0, style: { padding: "4px 8px", fontSize: "0.875rem" } } }}
                />
                {/* Единицы измерения для радиуса инструмента также вынесены в конец строки */}
                <Box sx={{ display: "inline-flex", mt: 1, color: "text.secondary", "& .katex-display": { margin: 0, fontSize: UNIT_FONT_SIZE, display: "inline-flex" }, "& .katex": { lineHeight: 1 } }}>
                    <BlockMath math="mm" />
                </Box>
            </Box>

            <Divider />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Box sx={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, px: 1, pb: 0.5, borderBottom: "2px solid", borderColor: "divider" }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">PARAMETER</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary.main">TOP HEATER</Typography>
                    <Typography variant="caption" fontWeight={700} color="secondary.main">BOTTOM HEATER</Typography>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">UNIT</Typography>
                </Box>

                {HEATER_PROPS.map(prop => (
                    <HeaterRow
                        key={prop.key}
                        prop={prop}
                        topValue={value?.heaters?.[0]?.[prop.key] ?? ""}
                        bottomValue={value?.heaters?.[1]?.[prop.key] ?? ""}
                        onHeaterValueChange={handleHeaterValueChange}
                    />
                ))}
            </Box>
        </Box>
    );
}
