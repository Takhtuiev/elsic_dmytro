import React, { useEffect, useMemo, useState } from "react";
import {
    Box,
    Paper,
    Typography,
    Radio,
    Divider,
    TextField,
    InputAdornment,
    Button,
    List,
    ListItemButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

const heaterProps = [
    { key: "regulatorTemperatureC", label: "Regulator temperature", unit: "°C" },
    { key: "heaterTemperatureFactor", label: "Temperature factor", unit: "" },
    { key: "heaterEmissivity", label: "Heater emissivity", unit: "" },
    { key: "viewFactor", label: "View factor", unit: "" },
    { key: "radiationGain", label: "Radiation gain", unit: "" },
    { key: "convectiveHeatTransferCoefficient", label: "Heat transfer coefficient", unit: "W/(m²·K)" },
];

const MachineContent = ({ value = {}, machines = {}, onChange }) => {
    const machineEntries = useMemo(() => Object.entries(machines), [machines]);
    const [editMode, setEditMode] = useState(false);
    const [tempValue, setTempValue] = useState(null);

    const selectedIndex = useMemo(() =>
            machineEntries.findIndex(([, item]) => item === value || item?.name === value?.name),
        [machineEntries, value]
    );

    useEffect(() => {
        if (editMode) {
            setTempValue(value);
        }
    }, [editMode, value]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (editMode || !machineEntries.length) return;
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

            event.preventDefault();
            let nextIndex = event.key === "ArrowDown"
                ? (selectedIndex < machineEntries.length - 1 ? selectedIndex + 1 : 0)
                : (selectedIndex > 0 ? selectedIndex - 1 : machineEntries.length - 1);

            const [nextKey, nextMachine] = machineEntries[nextIndex];
            if (!nextMachine) return;

            onChange?.(nextMachine);

            document.getElementById(`machine-card-${nextKey}`)?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedIndex, machineEntries, onChange, editMode]);

    const handleStartEdit = () => {
        setTempValue(value);
        setEditMode(true);
    };

    const handleSave = () => {
        onChange?.(tempValue);
        setEditMode(false);
    };

    const handleCancel = () => {
        setTempValue(null);
        setEditMode(false);
    };

    const formatValue = (val, unit = "") => {
        if (val === undefined || val === null || val === "") return "—";
        return `${val}${unit ? ` ${unit}` : ""}`;
    };

    const handleEditValueChange = (key) => (event) => {
        const nextVal = event.target.value;
        setTempValue(prev => ({
            ...prev,
            [key]: key === "name" ? nextVal : (nextVal === "" ? "" : Number(nextVal))
        }));
    };

    const handleHeaterValueChange = (heaterIndex, key) => (event) => {
        const nextVal = event.target.value === "" ? "" : Number(event.target.value);
        setTempValue(prev => ({
            ...prev,
            heaters: (prev?.heaters || []).map((heater, idx) =>
                idx === heaterIndex ? { ...heater, [key]: nextVal } : heater
            ),
        }));
    };

    const renderHeaterTable = () => {
        const currentData = editMode ? tempValue : value;
        const top = currentData?.heaters?.[0];
        const bottom = currentData?.heaters?.[1];

        return (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1 }}>
                <Box sx={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr",
                    px: 1,
                    pb: 0.5,
                    borderBottom: "2px solid",
                    borderColor: "divider"
                }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary">PARAMETER</Typography>
                    <Typography variant="caption" fontWeight={700} color="primary.main">TOP HEATER</Typography>
                    <Typography variant="caption" fontWeight={700} color="secondary.main">BOTTOM HEATER</Typography>
                </Box>

                {heaterProps.map((prop) => {
                    const topVal = top?.[prop.key];
                    const bottomVal = bottom?.[prop.key] ?? topVal;

                    return (
                        <Box key={prop.key} sx={{
                            display: "grid",
                            gridTemplateColumns: "1.5fr 1fr 1fr",
                            alignItems: "center",
                            gap: 1.5,
                            borderRadius: 1,
                            borderBottom: "1px solid", // Добавляем нижнюю границу
                            borderColor: "divider", // Используем стандартный серый цвет разделителя из темы MUI
                            transition: "background-color 0.2s",
                            "&:hover": { bgcolor: "action.hover" }
                        }}>
                            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                                {prop.label}
                            </Typography>

                            {[0, 1].map((index) => {
                                const heaterData = index === 0 ? top : bottom;
                                const displayVal = index === 0 ? topVal : bottomVal;

                                return editMode ? (
                                    <TextField
                                        key={`${index}-${prop.key}`}
                                        value={heaterData?.[prop.key] ?? ""}
                                        onChange={handleHeaterValueChange(index, prop.key)}
                                        type="number"
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            htmlInput: { min: 0, style: { padding: '4px 8px', fontSize: '0.875rem' } },
                                            input: {
                                                endAdornment: prop.unit ? (
                                                    <InputAdornment position="end" sx={{ '& .MuiTypography-root': { fontSize: '0.75rem' } }}>
                                                        {prop.unit}
                                                    </InputAdornment>
                                                ) : undefined,
                                            },
                                        }}
                                    />
                                ) : (
                                    <Typography key={`${index}-${prop.key}`} variant="body2" color="text.secondary">
                                        {formatValue(displayVal, prop.unit)}
                                    </Typography>
                                );
                            })}
                        </Box>
                    );
                })}
            </Box>
        );
    };

    return (
        <Box sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            borderRadius: 2,
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper",
            boxShadow: "0px 4px 16px rgba(0, 0, 0, 0.04)",
            width: "100%",
        }}>
            {!editMode && (
                <Box sx={{
                    flex: "0 0 260px",
                    borderRight: { md: "1px solid" },
                    borderBottom: { xs: "1px solid", md: "none" },
                    borderColor: "divider",
                    p: 1.5,
                    bgcolor: "background.default",
                    maxHeight: { md: "500px" },
                    overflowY: "auto",
                }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, px: 1, letterSpacing: "0.05em" }}>
                        AVAILABLE MACHINES ({machineEntries.length})
                    </Typography>
                    <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                        {machineEntries.map(([key, item]) => {
                            const isSelected = item === value || item?.name === value?.name;
                            return (
                                <ListItemButton
                                    key={key}
                                    id={`machine-card-${key}`}
                                    onClick={() => onChange?.(item)}
                                    selected={isSelected}
                                    sx={{
                                        p: 0.75,
                                        borderRadius: 1.5,
                                        border: "1px solid",
                                        borderColor: isSelected ? "primary.main" : "transparent",
                                        "&.Mui-selected": {
                                            bgcolor: "action.selected",
                                            "&:hover": { bgcolor: "action.selected" }
                                        },
                                    }}
                                >
                                    <Radio checked={isSelected} size="small" sx={{ p: 0, mr: 1 }} />
                                    <Typography variant="body2" fontWeight={isSelected ? 600 : 400} noWrap>
                                        {item?.name || key}
                                    </Typography>
                                </ListItemButton>
                            );
                        })}
                    </List>
                </Box>
            )}

            <Box sx={{
                flex: 1,
                p: 2,
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.paper",
            }}>
                {value?.name ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 1.5 }}>
                            <Box sx={{ flex: 1, minWidth: "200px" }}>
                                {editMode ? (
                                    <TextField
                                        label="Machine name"
                                        value={tempValue?.name ?? ""}
                                        onChange={handleEditValueChange("name")}
                                        size="small"
                                        fullWidth
                                        slotProps={{
                                            htmlInput: { min: 0, style: { padding: '4px 8px', fontWeight: 700 } },
                                        }}
                                    />
                                ) : (
                                    <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ letterSpacing: "-0.01em" }}>
                                        {value.name}
                                    </Typography>
                                )}
                            </Box>

                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                                {editMode ? (
                                    <Box sx={{ display: "flex", gap: 0.75 }}>
                                        <Button size="small" variant="contained" color="primary" startIcon={<CheckIcon />} onClick={handleSave} sx={{ textTransform: "none" }}>
                                            Save
                                        </Button>
                                        <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />} onClick={handleCancel} sx={{ textTransform: "none" }}>
                                            Cancel
                                        </Button>
                                    </Box>
                                ) : (
                                    <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={handleStartEdit} sx={{ textTransform: "none" }}>
                                        Edit
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        <Divider/>

                        <Box sx={{ width: "fit-content" }}>
                            {editMode ? (
                                <TextField
                                    label="Tool radius"
                                    value={tempValue?.rTool ?? ""}
                                    onChange={handleEditValueChange("rTool")}
                                    type="number"
                                    size="small"
                                    slotProps={{
                                        htmlInput: { min: 0, style: { padding: '4px 8px', fontSize: '0.875rem' } },
                                        input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> }
                                    }}
                                />
                            ) : (
                                <Paper variant="outlined" sx={{ px: 1, py: 0.5, bgcolor: "background.default", borderRadius: 1.5 }}>
                                    <Typography variant="body2" color="text.primary" fontWeight={500}>
                                        Tool radius: <Box component="span" color="text.secondary" fontWeight={600}>{formatValue(value.rTool, "mm")}</Box>
                                    </Typography>
                                </Paper>
                            )}
                        </Box>

                        {renderHeaterTable()}
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, py: 4, gap: 0.5 }}>
                        <Typography color="text.secondary" variant="body2" fontWeight={500}>
                            No machine selected
                        </Typography>
                        <Typography color="text.disabled" variant="caption">
                            Please choose a machine from the left list to view or edit details.
                        </Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default MachineContent;
