import React, { useEffect, useMemo } from "react";
import { Box, Typography, Radio, Divider, Button, List, ListItemButton } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import { useDispatch, useSelector } from "react-redux";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { openDialog, selectCurrentDialog, selectLastReturnedData, clearDialogDataReturned } from "../../Store/dialogSlice";

const UNIT_FONT_SIZE = "0.75rem";
const FRACTION_FONT_SIZE = "0.70rem";
const GRID_TEMPLATE = "2fr 1fr 0.7fr";

const physicalProps = [
    { key: "density", label: "Density", unit: String.raw`\text{kg/m}^3`, color: "#7b1fa2" },
    { key: "thermalConductivity", label: "Thermal conductivity", unit: String.raw`\text{W/(m}\cdot\text{K)}`, color: "#2e7d32" },
    { key: "specificHeat", label: "Specific heat", unit: String.raw`\text{J/(kg}\cdot\text{K)}`, color: "#0288d1" }
];

const transitionProps = [
    { key: "tgSpecificHeatJumpFactor", label: "Tg heat capacity jump", unit: String.raw`\times`, color: "#0288d1" },
    { key: "tgTransitionWidthC", label: "Tg transition width", unit: String.raw`\,^{\circ}C`, color: "#0288d1" }
];

const surfaceProps = [
    { key: "emissivity", label: "Emissivity", unit: "", color: "#f57c00" },
    { key: "surfaceReflectance", label: "Surface reflectance", unit: "", color: "#757575" }
];

const tempProps = [
    { key: "glassTransitionTemp", label: "Glass transition temp.", unit: String.raw`\,^{\circ}C`, color: "#0288d1" },
    { key: "minFormingTemp", label: "Min. forming temp.", unit: String.raw`\,^{\circ}C`, color: "#2e7d32" },
    { key: "maxFormingTemp", label: "Max. forming temp.", unit: String.raw`\,^{\circ}C`, color: "#2e7d32" },
    { key: "decompositionTemp", label: "Decomposition temp.", unit: String.raw`\,^{\circ}C`, color: "#d32f2f" }
];

const bendingProps = [
    { key: "kFactor", label: "K-factor", unit: "", color: "#6a1b9a" }
];

export default function MaterialContent({ value, materials = {}, onChange }) {
    const dispatch = useDispatch();
    const currentDialog = useSelector(selectCurrentDialog);
    const lastReturnedData = useSelector(selectLastReturnedData);
    const materialEntries = useMemo(() => Object.entries(materials), [materials]);
    const selectedIndex = useMemo(() => materialEntries.findIndex(([, item]) => item === value || item?.name === value?.name), [materialEntries, value]);

    useEffect(() => {
        if (lastReturnedData?.dialogType !== "material-edit") return;
        const updatedMaterial = lastReturnedData?.data?.value;
        if (updatedMaterial) onChange?.(updatedMaterial);
        dispatch(clearDialogDataReturned());
    }, [lastReturnedData, onChange, dispatch]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (currentDialog || !materialEntries.length) return;
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();

            const nextIndex = event.key === "ArrowDown"
                ? (selectedIndex < materialEntries.length - 1 ? selectedIndex + 1 : 0)
                : (selectedIndex > 0 ? selectedIndex - 1 : materialEntries.length - 1);

            const [nextKey, nextMaterial] = materialEntries[nextIndex];
            if (!nextMaterial) return; // Исправлено: теперь корректно проверяется на существование материала

            onChange?.(nextMaterial);
            document.getElementById(`material-card-${nextKey}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentDialog, selectedIndex, materialEntries, onChange]);

    const formatValue = (val) => (val === undefined || val === null || val === "") ? "—" : val;

    const renderPropRow = p => {
        if (value?.[p.key] === undefined || value?.[p.key] === null) return null;
        const isFraction = p.unit.includes("/");

        return (
            <Box key={p.key} sx={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, alignItems: "center", borderBottom: "1px dashed", borderColor: "divider", py: 0.2, gap: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75, p: 0.1, lineHeight: 1.15, minWidth: 0 }}>
                    <span style={{ color: p.color, fontSize: "0.6rem" }}>●</span>{p.label}
                </Typography>

                <Typography variant="caption" fontWeight={600} sx={{ p: 0.1, lineHeight: 1.15, textAlign: "right", pr: 2 }}>
                    {formatValue(value[p.key])}
                </Typography>

                <Box sx={{ display: "inline-flex", alignItems: "center", height: 18, color: "text.secondary" }}>
                    {p.unit ? (
                        <Box sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            "& .katex-display": { margin: 0, fontSize: isFraction ? FRACTION_FONT_SIZE : UNIT_FONT_SIZE, display: "inline-flex", alignItems: "center" },
                            "& .katex": { lineHeight: 1, display: "inline-flex", alignItems: "center" },
                            "& .katex-html": { display: "inline-flex", alignItems: "center" }
                        }}><BlockMath math={p.unit} /></Box>
                    ) : <Typography variant="caption" sx={{ fontSize: "0.7rem" }} color="text.disabled">—</Typography>}
                </Box>
            </Box>
        );
    };

    const renderSection = (items, index) => (
        <React.Fragment key={index}>
            {index > 0 && <Divider sx={{ my: 0.4, borderStyle: "dashed" }} />}
            {items.map(renderPropRow)}
        </React.Fragment>
    );

    const handleEdit = () => dispatch(openDialog({ id: "material-edit", dialogType: "material-edit", title: "Edit material", data: { value } }));

    return (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" } }}>
            <Box sx={{ flex: { md: "0 0 260px" }, borderRight: { md: "1px solid" }, borderBottom: { xs: "1px solid", md: "none" }, borderColor: "divider", p: 1.5, pb: { xs: 2.5, md: 1.5 }, bgcolor: "background.default", maxHeight: { md: "500px" }, overflowY: "auto" }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1, px: 1, letterSpacing: "0.05em" }}>AVAILABLE MATERIALS ({materialEntries.length})</Typography>
                <List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                    {materialEntries.map(([key, item]) => {
                        const isSelected = item === value || item?.name === value?.name;
                        return (
                            <ListItemButton key={key} id={`material-card-${key}`} onClick={() => onChange?.(item)} selected={isSelected} sx={{ p: 0.75, borderRadius: 1.5, border: "1px solid", borderColor: isSelected ? "primary.main" : "transparent", "&.Mui-selected": { bgcolor: "action.selected", "&:hover": { bgcolor: "action.selected" } } }}>
                                <Radio checked={isSelected} size="small" sx={{ p: 0, mr: 1 }} />
                                <Typography variant="body2" fontWeight={isSelected ? 600 : 400} noWrap>{item?.name || key}</Typography>
                            </ListItemButton>
                        );
                    })}
                </List>
            </Box>
            <Box sx={{ flex: 1, p: 2, display: "flex", flexDirection: "column", bgcolor: "background.paper" }}>
                {value?.name ? (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: 1.5 }}>
                            <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ letterSpacing: "-0.01em" }}>{value.name}</Typography>
                            <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={handleEdit} sx={{ textTransform: "none" }}>Edit</Button>
                        </Box>
                        <Divider />
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.1 }}>
                            {renderSection(physicalProps, 0)}
                            {renderSection(transitionProps, 1)}
                            {renderSection(surfaceProps, 2)}
                            {renderSection(tempProps, 3)}
                            {renderSection(bendingProps, 4)}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, py: 4, gap: 0.5 }}>
                        <Typography color="text.secondary" variant="body2" fontWeight={500}>No material selected</Typography>
                        <Typography color="text.disabled" variant="caption">Please choose a material from the left list to view details.</Typography>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
