import React, { useEffect, useState, useCallback, memo } from "react";
import {
    Box, Typography, Radio, Card, CardContent,
    FormControlLabel, Switch, ToggleButton, ToggleButtonGroup, MenuItem
} from "@mui/material";
import MyTextField from "./MyTextField";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";

const DEFAULT_2D_WIDTH_HALF_MM = 20;

const CARD_SX = {
    borderRadius: 2,
    borderColor: "divider",
    backgroundColor: (t) => t.palette.mode === "dark"
        ? "background.paper"
        : "rgba(0, 0, 0, 0.01)"
};

const TITLE_SX = {
    fontWeight: 700,
    color: "text.primary",
    fontSize: "0.85rem",
    textTransform: "uppercase",
    letterSpacing: 0.8
};

const TARGET_TYPES = [
    { key: "minTemperature", label: "Minimum temperature", unit: String.raw`\,^{\circ}C` },
    { key: "surfaceTemperature", label: "Surface temperature", unit: String.raw`\,^{\circ}C` },
    { key: "time", label: "Time", unit: "s" }
];

const RowField = memo(({ label, value, onChange, unit, disabled }) => (
    <Box sx={{
        display: "grid",
        gridTemplateColumns: "1fr 45px",
        alignItems: "center",
        gap: 1,
        flexGrow: 1
    }}>
        <MyTextField
            label={label}
            value={value}
            onChange={onChange}
            type="number"
            size="small"
            fullWidth
            disabled={disabled}
        />
        <Box sx={{
            display: "flex",
            alignItems: "center",
            pl: 0.5,
            minHeight: 24,
            color: "text.secondary",
            "& .katex-display": {
                margin: 0,
                fontSize: unit?.includes(String.raw`\frac`) ? "0.55rem" : "0.75rem",
                display: "flex",
                alignItems: "center"
            }
        }}>
            {unit ? <BlockMath math={unit} /> : null}
        </Box>
    </Box>
));

const ConfigCard = memo(({ title, children, action }) => (
    <Card variant="outlined" sx={CARD_SX}>
        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
            <Box sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                mb: 2
            }}>
                <Typography variant="subtitle2" sx={TITLE_SX}>
                    {title}
                </Typography>
                {action}
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {children}
            </Box>
        </CardContent>
    </Card>
));

export default function SimulationContent({ value = {}, onChange }) {
    const [linkTemps, setLinkTemps] = useState(true);

    const {
        temperatures,
        cooling,
        target,
        stopAtMaxTemperature,
        recordHistory,
        maxTimeSeconds,
        widthHalfMm,
        accuracyMode = "optimal",
        calculateAccuracyError = true,
        ui
    } = value;

    const {
        showVerticalSlice,
        showHorizontalWidth,
        showTimeDynamics,
        showContours2D
    } = ui ?? {};

    const dimension = widthHalfMm === 0 ? "1d" : "2d";

    useEffect(() => {
        setLinkTemps(
            temperatures?.ambientC === temperatures?.ambientRadiationC &&
            temperatures?.ambientC === temperatures?.initialC
        );
    }, [
        temperatures?.ambientC,
        temperatures?.ambientRadiationC,
        temperatures?.initialC
    ]);

    const updateValue = useCallback(
        (updater) => onChange?.({ ...value, ...updater(value) }),
        [value, onChange]
    );

    const handleTempChange = useCallback(
        (key) => (val) => updateValue((prev) => {
            const next = val === "" ? "" : Number(val);
            const currentTemperatures = prev.temperatures ?? {};

            return {
                temperatures: linkTemps && key === "ambientC"
                    ? {
                        ambientC: next,
                        ambientRadiationC: next,
                        initialC: next
                    }
                    : { ...currentTemperatures, [key]: next }
            };
        }),
        [linkTemps, updateValue]
    );

    const handleDimensionChange = useCallback((_, newDim) => {
        if (!newDim) return;

        updateValue(() => ({
            widthHalfMm: newDim === "1d" ? 0 : DEFAULT_2D_WIDTH_HALF_MM
        }));
    }, [updateValue]);

    const handleChartUiChange = useCallback(
        (key) => (e) => updateValue((prev) => ({
            ui: {
                ...prev.ui,
                [key]: e.target.checked
            }
        })),
        [updateValue]
    );

    return (
        <Box sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            gap: 2.5,
            width: "100%"
        }}>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
                <Typography variant="subtitle2" sx={TITLE_SX}>
                    Target Settings
                </Typography>

                <ConfigCard title={`Mode: ${TARGET_TYPES.find((item) => item.key === target?.type)?.label ?? ""}`}>
                    <RowField
                        label="Target value"
                        value={target?.value}
                        onChange={(v) => updateValue((prev) => ({
                            target: { ...prev.target, value: v === "" ? "" : Number(v) }
                        }))}
                        unit={TARGET_TYPES.find((item) => item.key === target?.type)?.unit}
                    />

                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        {TARGET_TYPES.map((item) => (
                            <Box
                                key={item.key}
                                onClick={() => updateValue((prev) => ({
                                    target: { ...prev.target, type: item.key }
                                }))}
                                sx={{
                                    p: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    cursor: "pointer",
                                    border: "1px solid",
                                    borderRadius: 1.5,
                                    borderColor: target?.type === item.key ? "primary.main" : "divider",
                                    bgcolor: target?.type === item.key ? "action.selected" : "transparent"
                                }}
                            >
                                <Radio
                                    checked={target?.type === item.key}
                                    size="small"
                                    sx={{ p: 0, mr: 1 }}
                                />
                                <Typography variant="body2" sx={{
                                    fontWeight: target?.type === item.key ? 600 : 400
                                }}>
                                    {item.label}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </ConfigCard>

                <ConfigCard title="Solver Settings">

                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={stopAtMaxTemperature}
                                onChange={(e) => updateValue(() => ({
                                    stopAtMaxTemperature: e.target.checked
                                }))}
                            />
                        }
                        label="Stop at maximum temperature"
                        sx={{ mx: 0.5 }}
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={recordHistory}
                                onChange={(e) => updateValue(() => ({
                                    recordHistory: e.target.checked
                                }))}
                            />
                        }
                        label="Record heating history"
                        sx={{ mx: 0.5 }}
                    />

                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        mt: 1,
                        mb: 1,
                        px: 0.5
                    }}>
                        <Typography
                            sx={{
                                whiteSpace: "nowrap",
                            }}
                        >
                            Calculation Accuracy
                        </Typography>
                        <MyTextField
                            select
                            size="small"
                            value={accuracyMode}
                            onChange={(v) => updateValue(() => ({
                                accuracyMode: v
                            }))}
                            sx={{
                                flexGrow: 1,
                                '& .MuiSelect-select': {
                                    py: 0.75, // делает поле визуально более тонким и компактным по высоте
                                    fontSize: "0.85rem"
                                }
                            }}
                        >
                            <MenuItem value="fast" sx={{ fontSize: "0.85rem" }}>Fast</MenuItem>
                            <MenuItem value="optimal" sx={{ fontSize: "0.85rem" }}>Optimal</MenuItem>
                            <MenuItem value="accurate" sx={{ fontSize: "0.85rem" }}>Accurate</MenuItem>
                        </MyTextField>
                    </Box>

                    {/* Переключатель расчета погрешности */}
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={calculateAccuracyError}
                                onChange={(e) => updateValue(() => ({
                                    calculateAccuracyError: e.target.checked
                                }))}
                            />
                        }
                        label="Calculate calculation error"
                        sx={{ mx: 0.5, mt: 1 }}
                    />


                </ConfigCard>

                <ConfigCard title="Workpiece Geometry">
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <ToggleButtonGroup
                            value={dimension}
                            exclusive
                            onChange={handleDimensionChange}
                            size="small"
                        >
                            <ToggleButton value="1d" sx={{
                                px: 1.5, py: 0.5, fontSize: "0.75rem", fontWeight: 600
                            }}>
                                1D
                            </ToggleButton>
                            <ToggleButton value="2d" sx={{
                                px: 1.5, py: 0.5, fontSize: "0.75rem", fontWeight: 600
                            }}>
                                2D
                            </ToggleButton>
                        </ToggleButtonGroup>

                        <RowField
                            label="Sheet half-width"
                            value={widthHalfMm}
                            onChange={(v) => updateValue(() => ({
                                widthHalfMm: v === "" ? "" : Number(v)
                            }))}
                            unit="mm"
                            disabled={dimension === "1d"}
                        />
                    </Box>
                </ConfigCard>
            </Box>

            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 2.5 }}>
                <ConfigCard
                    title="Temperatures"
                    action={
                        <FormControlLabel
                            control={
                                <Switch
                                    size="small"
                                    checked={linkTemps}
                                    onChange={(e) => {
                                        setLinkTemps(e.target.checked);
                                        if (e.target.checked) {
                                            updateValue((prev) => ({
                                                temperatures: {
                                                    ambientC: prev.temperatures?.ambientC,
                                                    ambientRadiationC: prev.temperatures?.ambientC,
                                                    initialC: prev.temperatures?.ambientC
                                                }
                                            }));
                                        }
                                    }}
                                />
                            }
                            label="Link"
                            sx={{
                                m: 0,
                                "& .MuiFormControlLabel-label": {
                                    fontSize: "0.8rem",
                                    fontWeight: 600
                                }
                            }}
                        />
                    }
                >
                    <RowField
                        label="Ambient temperature"
                        value={temperatures?.ambientC}
                        onChange={handleTempChange("ambientC")}
                        unit={String.raw`\,^{\circ}C`}
                    />
                    <RowField
                        label="Ambient radiation temp."
                        value={temperatures?.ambientRadiationC}
                        onChange={handleTempChange("ambientRadiationC")}
                        unit={String.raw`\,^{\circ}C`}
                        disabled={linkTemps}
                    />
                    <RowField
                        label="Initial temperature"
                        value={temperatures?.initialC}
                        onChange={handleTempChange("initialC")}
                        unit={String.raw`\,^{\circ}C`}
                        disabled={linkTemps}
                    />
                </ConfigCard>

                <ConfigCard title="Cooling & Environment">
                    <RowField
                        label="Cooling time"
                        value={cooling?.timeSeconds}
                        onChange={(v) => updateValue((prev) => ({
                            cooling: {
                                ...prev.cooling,
                                timeSeconds: v === "" ? "" : Number(v)
                            }
                        }))}
                        unit="s"
                    />
                    <RowField
                        label="Air convection coefficient"
                        value={cooling?.convectiveHeatTransferCoefficient}
                        onChange={(v) => updateValue((prev) => ({
                            cooling: {
                                ...prev.cooling,
                                convectiveHeatTransferCoefficient: v === "" ? "" : Number(v)
                            }
                        }))}
                        unit={String.raw`\frac{W}{m^2\cdot K}`}
                    />
                    <RowField
                        label="Maximum simulation time"
                        value={maxTimeSeconds}
                        onChange={(v) => updateValue(() => ({
                            maxTimeSeconds: v === "" ? "" : Number(v)
                        }))}
                        unit="s"
                    />
                </ConfigCard>

                <ConfigCard title="Charts Visibility">
                    <FormControlLabel
                        control={<Switch size="small" checked={showVerticalSlice} onChange={handleChartUiChange("showVerticalSlice")} />}
                        label="Vertical slice"
                    />
                    <FormControlLabel
                        control={<Switch size="small" checked={showTimeDynamics} onChange={handleChartUiChange("showTimeDynamics")} />}
                        label="Time dynamics"
                    />
                    <FormControlLabel
                        control={<Switch size="small" checked={showHorizontalWidth} onChange={handleChartUiChange("showHorizontalWidth")} />}
                        label="Distribution by width"
                    />
                    <FormControlLabel
                        control={<Switch size="small" checked={showContours2D} onChange={handleChartUiChange("showContours2D")} />}
                        label="2D Isotherms"
                    />
                </ConfigCard>
            </Box>
        </Box>
    );
}