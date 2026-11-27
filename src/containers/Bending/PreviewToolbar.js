import React from "react";
import { Box, Divider, IconButton, Slider, Tooltip, Typography } from "@mui/material";
import FlipIcon from "@mui/icons-material/Flip";
import PrintIcon from "@mui/icons-material/Print";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { NUMERIC_SX } from "./uiKit";

const formatAngle = (value) => {
    const v = Math.round(Number(value) || 0);
    return `${v > 0 ? "+" : ""}${v}°`;
};

// Панель вида: поворот (с числовым значением), сброс, зеркало, печать.
// Пока выбран гиб, вид задаётся гибом — поворот и зеркало недоступны.
const PreviewToolbar = React.memo(({
    rotation,
    bendIndex,
    mirrored,
    onRotationChange,
    onRotationCommitted,
    onMirror
}) => {
    const locked = bendIndex >= 0;

    return (
        <Box
            className="bending-preview-toolbar"
            sx={{
                px: 1.25,
                minHeight: 40,
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexShrink: 0,
                borderBottom: "1px solid",
                borderColor: "divider"
            }}
        >
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "text.secondary" }}>
                {locked ? `Bend ${bendIndex + 1} view` : "Rotation"}
            </Typography>

            <Slider
                value={Number(rotation) || 0}
                min={-180}
                max={180}
                step={1}
                size="small"
                disabled={locked}
                aria-label="Profile rotation"
                onChange={(_, value) => onRotationChange(value)}
                onChangeCommitted={(_, value) => onRotationCommitted(value)}
                sx={{
                    flex: 1,
                    minWidth: 60,
                    mx: 0.5,
                    color: "text.secondary",
                    "& .MuiSlider-thumb": { width: 12, height: 12 },
                    "& .MuiSlider-rail": { opacity: 0.25 }
                }}
            />

            <Typography sx={{ ...NUMERIC_SX, fontSize: "0.8rem", minWidth: 44, textAlign: "right", color: locked ? "text.disabled" : "text.primary" }}>
                {formatAngle(rotation)}
            </Typography>

            <Tooltip title="Reset rotation">
                <span>
                    <IconButton
                        size="small"
                        aria-label="Reset rotation"
                        disabled={locked || !Number(rotation)}
                        onClick={() => onRotationCommitted(0)}
                    >
                        <RestartAltIcon fontSize="small" />
                    </IconButton>
                </span>
            </Tooltip>

            <Tooltip title={mirrored ? "Mirrored — click to restore" : "Mirror"}>
                <span>
                    <IconButton
                        size="small"
                        aria-label="Mirror"
                        aria-pressed={mirrored}
                        disabled={locked}
                        onClick={onMirror}
                        color={mirrored ? "primary" : "default"}
                    >
                        <FlipIcon fontSize="small" sx={{ transform: mirrored ? "scaleX(-1)" : "none" }} />
                    </IconButton>
                </span>
            </Tooltip>

            <Divider orientation="vertical" flexItem sx={{ my: 1 }} />

            <Tooltip title="Print">
                <IconButton size="small" aria-label="Print" onClick={() => window.print()}>
                    <PrintIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
});

PreviewToolbar.displayName = "PreviewToolbar";
export default PreviewToolbar;
