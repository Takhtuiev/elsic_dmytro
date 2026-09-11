import React, { useEffect, useState, forwardRef } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Typography, Radio, Divider, Slide } from "@mui/material";

const physicalProps = [
    { key: "lambda", label: "Thermal conductivity", unit: "W/(m·K)", color: "#ed6c02" },
    { key: "density", label: "Density", unit: "kg/m³", color: "#0288d1" },
    { key: "specificHeat", label: "Specific heat", unit: "J/(kg·K)", color: "#2e7d32" }
];

const tempProps = [
    { key: "defaultTSurf", label: "Surface temp.", unit: "°C", color: "#d32f2f" },
    { key: "defaultTCenter", label: "Center temp.", unit: "°C", color: "#c62828" }
];

const Transition = forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props}>{props.children}</Slide>;
});

const MaterialDialog = ({ open, materialKey, materials = {}, onSelect, onClose }) => {
    const [selectedKey, setSelectedKey] = useState(materialKey);
    const materialKeys = Object.keys(materials);

    useEffect(() => { if (open) setSelectedKey(materialKey); }, [open, materialKey]);

    useEffect(() => {
        if (!open) return;

        const handleKeyDown = (event) => {
            const currentIndex = materialKeys.indexOf(selectedKey);

            if (event.key === "Enter" && selectedKey) {
                event.preventDefault();
                onSelect(selectedKey);
            }
            else if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = currentIndex < materialKeys.length - 1 ? currentIndex + 1 : 0;
                const nextKey = materialKeys[nextIndex];
                if (nextKey) {
                    setSelectedKey(nextKey);
                    document.getElementById(`mat-card-${nextKey}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
            }
            else if (event.key === "ArrowUp") {
                event.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : materialKeys.length - 1;
                const prevKey = materialKeys[prevIndex];
                if (prevKey) {
                    setSelectedKey(prevKey);
                    document.getElementById(`mat-card-${prevKey}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [open, selectedKey, materialKeys, onSelect]);

    const current = materials[selectedKey];

    const renderPropRow = (p) => (
        <Box key={p.key} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px dashed", borderColor: "grey.300", pb: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <span style={{ color: p.color }}>●</span> {p.label}
            </Typography>
            <Typography variant="body2" fontWeight={600}>{current[p.key]} {p.unit}</Typography>
        </Box>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            // ИСПРАВЛЕНО: Используем slots.transition согласно стандартам MUI v6/v7 вместо TransitionComponent
            slots={{ transition: Transition }}
            sx={{
                '& .MuiDialog-paper': {
                    width: '100%',
                    m: { xs: 0, sm: 2 },
                    maxHeight: { xs: '100%', sm: 'calc(100% - 64px)' },
                    borderRadius: { xs: 0, sm: 2 }
                }
            }}
        >
            <DialogTitle sx={{ fontWeight: 600, pb: 1.5 }}>Select Material</DialogTitle>

            <DialogContent dividers sx={{ p: 0, display: "flex", flexDirection: { xs: "column", md: "row" }, height: { xs: "auto", md: 400 } }}>

                {/* Left Column */}
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", borderRight: { md: "1px solid" }, borderBottom: { xs: "1px solid", md: "none" }, borderColor: "divider", p: 2, overflowY: "auto" }}>
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {Object.entries(materials).map(([key, item]) => {
                            const isSel = key === selectedKey;
                            return (
                                <Paper
                                    key={key}
                                    id={`mat-card-${key}`}
                                    variant="outlined"
                                    onClick={() => setSelectedKey(key)}
                                    sx={{ p: 1.5, display: "flex", alignItems: "center", cursor: "pointer", borderRadius: 1.5, borderColor: isSel ? "primary.main" : "divider", bgcolor: isSel ? "action.selected" : "background.paper", "&:hover": { bgcolor: "action.hover" } }}
                                >
                                    <Radio checked={isSel} size="small" sx={{ p: 0, mr: 1 }} />
                                    <Typography variant="body2" fontWeight={isSel ? 600 : 400}>{item.name}</Typography>
                                </Paper>
                            );
                        })}
                    </Box>
                </Box>

                {/* Right Column */}
                <Box sx={{ flex: 1, bgcolor: "grey.50", p: 3, display: "flex", flexDirection: "column", justifyContent: current ? "flex-start" : "center", overflowY: "auto" }}>
                    {current ? (
                        <>
                            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>{current.name}</Typography>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                                {physicalProps.map(renderPropRow)}
                                <Divider sx={{ my: 1, borderStyle: "dashed" }} />
                                {tempProps.map(renderPropRow)}
                            </Box>
                        </>
                    ) : (
                        <Typography variant="body2" color="text.secondary" align="center">Select a material from the list to view its properties</Typography>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, bgcolor: "background.paper" }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button variant="contained" disabled={!selectedKey} onClick={() => onSelect(selectedKey)} disableElevation sx={{ borderRadius: 1.5 }}>
                    Select
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default MaterialDialog;
