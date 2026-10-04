import React, { useEffect, useState, useCallback, memo } from "react";
import { Box, Typography, Radio, Card, CardContent, FormControlLabel, Switch } from "@mui/material";
import MyTextField from "./MyTextField";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const UNIT_FONT_SIZE = "0.75rem";
const FRACTION_FONT_SIZE = "0.55rem";
const CARD_SX = { borderRadius: 2, borderColor: "divider", backgroundColor: (t) => t.palette.mode === "dark" ? "background.paper" : "rgba(0, 0, 0, 0.01)" };
const TITLE_SX = { fontWeight: 700, color: "text.primary", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: 0.8 };

const TARGET_TYPES = [
    { key: "minTemperature", label: "Minimum temperature", unit: String.raw`\,^{\circ}C` },
    { key: "surfaceTemperature", label: "Surface temperature", unit: String.raw`\,^{\circ}C` },
    { key: "time", label: "Time", unit: "s" }
];

const ENVIRONMENT_PROPS = [
    { key: "ambientC", label: "Ambient temperature", unit: String.raw`\,^{\circ}C` },
    { key: "ambientRadiationC", label: "Ambient radiation temperature", unit: String.raw`\,^{\circ}C` },
    { key: "initialC", label: "Initial temperature", unit: String.raw`\,^{\circ}C` }
];

const RowField = ({ label, value, onChange, unit, disabled }) => {
    const isFraction = unit.includes(String.raw`\frac`);
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 45px", alignItems: "center", gap: 1 }}>
            <MyTextField label={label} value={value} onChange={onChange} type="number" size="small" fullWidth disabled={disabled} />
            <Box sx={{ display: "flex", alignItems: "center", pl: 0.5, minHeight: 24, color: "text.secondary", "& .katex-display": { margin: 0, fontSize: isFraction ? FRACTION_FONT_SIZE : UNIT_FONT_SIZE, display: "flex", alignItems: "center" }, "& .katex": { lineHeight: 1, display: "flex", alignItems: "center" }, "& .katex-html": { display: "flex", alignItems: "center" } }}>
                {unit ? <BlockMath math={unit} /> : null}
            </Box>
        </Box>
    );
};

const TargetCard = memo(({ targetType, targetValue, onTargetTypeChange, onTargetValueChange }) => {
    const currentTarget = TARGET_TYPES.find(item => item.key === targetType) || TARGET_TYPES;
    return (
        <Card variant="outlined" sx={CARD_SX}>
            <CardContent sx={{ p: 2, "&:last-child": { pb: 2 }, display: "flex", flexDirection: "column", gap: 2 }}>
                <RowField label="Target value" value={targetValue} onChange={onTargetValueChange} unit={currentTarget.unit} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                    {TARGET_TYPES.map((item) => {
                        const isSel = targetType === item.key;
                        return (
                            <Box key={item.key} onClick={() => onTargetTypeChange(item.key)} sx={{ p: 1, display: "flex", alignItems: "center", cursor: "pointer", border: "1px solid", borderRadius: 1.5, borderColor: isSel ? "primary.main" : "divider", bgcolor: isSel ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover" } }}>
                                <Radio checked={isSel} size="small" sx={{ p: 0, mr: 1 }} />
                                <Typography variant="body2" sx={{ fontWeight: isSel ? 600 : 400 }}>{item.label}</Typography>
                            </Box>
                        );
                    })}
                </Box>
            </CardContent>
        </Card>
    );
});

export default function SimulationContent({ value = {}, onChange }) {
    const [linkTemperatures, setLinkTemperatures] = useState(true);
    const temperatures = value?.temperatures || {};
    const cooling = value?.cooling || {};
    const targetType = value?.target?.type ?? "minTemperature";
    const targetValue = value?.target?.value ?? 120;
    const stopAtMaxTemperature = value?.stopAtMaxTemperature ?? true;
    const recordHistory = value?.recordHistory ?? true;
    const maxTimeSeconds = value?.maxTimeSeconds ?? 600;
    const cooldownTimeSeconds = cooling.timeSeconds ?? 0;
    const coolingH = cooling.convectiveHeatTransferCoefficient ?? 8;

    useEffect(() => {
        const ambient = temperatures.ambientC ?? 20;
        const radiation = temperatures.ambientRadiationC ?? 20;
        const initial = temperatures.initialC ?? 20;
        setLinkTemperatures(ambient === radiation && ambient === initial);
    }, [temperatures.ambientC, temperatures.ambientRadiationC, temperatures.initialC]);

    const handleTargetTypeChange = useCallback((type) => {
        onChange?.({ ...value, target: { ...value.target, type } });
    }, [value, onChange]);

    const handleTargetValueChange = useCallback((val) => {
        onChange?.({ ...value, target: { ...value.target, type: targetType, value: val === "" ? "" : Number(val) } });
    }, [value, targetType, onChange]);

    const handleTemperatureChange = useCallback((key) => (val) => {
        const nextValue = val === "" ? "" : Number(val);
        const currentTemps = value?.temperatures || {};
        if (linkTemperatures && key === "ambientC") {
            onChange?.({ ...value, temperatures: { ...currentTemps, ambientC: nextValue, ambientRadiationC: nextValue, initialC: nextValue } });
            return;
        }
        onChange?.({ ...value, temperatures: { ...currentTemps, [key]: nextValue } });
    }, [value, linkTemperatures, onChange]);

    const handleLinkChange = useCallback((event) => {
        const checked = event.target.checked;
        setLinkTemperatures(checked);
        if (checked) {
            const currentTemps = value?.temperatures || {};
            const ambient = currentTemps.ambientC ?? 20;
            onChange?.({ ...value, temperatures: { ...currentTemps, ambientC: ambient, ambientRadiationC: ambient, initialC: ambient } });
        }
    }, [value, onChange]);

    const handleCoolingChange = useCallback((key) => (val) => {
        const currentCooling = value?.cooling || {};
        onChange?.({ ...value, cooling: { ...currentCooling, [key]: val === "" ? "" : Number(val) } });
    }, [value, onChange]);

    const handleSimpleFieldChange = useCallback((key, isChecked = false) => (val) => {
        onChange?.({ ...value, [key]: isChecked ? val.target.checked : (val === "" ? "" : Number(val)) });
    }, [value, onChange]);

    return (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 2.5, width: "100%" }}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
                <Typography variant="subtitle2" sx={TITLE_SX}>Target Settings</Typography>
                <TargetCard targetType={targetType} targetValue={targetValue} onTargetTypeChange={handleTargetTypeChange} onTargetValueChange={handleTargetValueChange} />
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    <FormControlLabel control={<Switch size="small" checked={stopAtMaxTemperature} onChange={handleSimpleFieldChange("stopAtMaxTemperature", true)} />} label="Stop at maximum temperature" sx={{ mx: 0.5 }} />
                    <FormControlLabel control={<Switch size="small" checked={recordHistory} onChange={handleSimpleFieldChange("recordHistory", true)} />} label="Record heating history" sx={{ mx: 0.5 }} />
                </Box>
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
                <Card variant="outlined" sx={CARD_SX}>
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                            <Typography variant="subtitle2" sx={TITLE_SX}>Temperatures</Typography>
                            <FormControlLabel control={<Switch size="small" checked={linkTemperatures} onChange={handleLinkChange} />} label="Link" sx={{ m: 0, "& .MuiFormControlLabel-label": { fontSize: "0.8rem", fontWeight: 600 } }} />
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {ENVIRONMENT_PROPS.map((item) => (
                                <RowField key={item.key} label={item.label} value={temperatures[item.key] ?? ""} onChange={handleTemperatureChange(item.key)} unit={item.unit} disabled={linkTemperatures && (item.key === "ambientRadiationC" || item.key === "initialC")} />
                            ))}
                        </Box>
                    </CardContent>
                </Card>

                <Card variant="outlined" sx={CARD_SX}>
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Typography variant="subtitle2" sx={{ ...TITLE_SX, mb: 2 }}>Cooling & Environment</Typography>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <RowField label="Cooling time" value={cooldownTimeSeconds} onChange={handleCoolingChange("timeSeconds")} unit="s" />
                            <RowField label="Air convection coefficient" value={coolingH} onChange={handleCoolingChange("convectiveHeatTransferCoefficient")} unit={String.raw`\frac{W}{m^2\cdot K}`} />
                            <RowField label="Maximum simulation time" value={maxTimeSeconds} onChange={handleSimpleFieldChange("maxTimeSeconds")} unit="s" />
                        </Box>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
