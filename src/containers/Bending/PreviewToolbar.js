// Файл: PreviewToolbar.jsx
import React from "react";
import { Box, Slider, Tooltip, IconButton } from "@mui/material";
import FlipIcon from "@mui/icons-material/Flip";
import PrintIcon from "@mui/icons-material/Print";

const PreviewToolbar = React.memo(({
                                       rotation,
                                       bendIndex,
                                       mirrored,
                                       onRotationChange,
                                       onRotationCommitted,
                                       onMirror
                                   }) => {
    return (
        <Box
            className="bending-preview-toolbar"
            sx={{ px: 1, py: 0, minHeight: 42, display: "flex", alignItems: "center", flexShrink: 0 }}
        >
            <Slider
                value={rotation}
                min={-180}
                max={180}
                step={1}
                size="small"
                disabled={bendIndex >= 0} // Блокируем ручной поворот, если выбран конкретный гиб
                onChange={(_, value) => onRotationChange(value)}
                onChangeCommitted={(_, value) => onRotationCommitted(value)}
                sx={{
                    flex: 1,
                    minWidth: 80,
                    mx: 1,
                    color: "text.secondary",
                    opacity: 0.7,
                    "& .MuiSlider-thumb": { width: 10, height: 10 }
                }}
            />

            <Tooltip title="Mirror">
                <span>
                    <IconButton size="small" disabled={bendIndex >= 0} onClick={onMirror}>
                        <FlipIcon fontSize="small" sx={{ transform: mirrored ? "scaleX(-1)" : "none" }} />
                    </IconButton>
                </span>
            </Tooltip>

            <Tooltip title="Print">
                <IconButton size="small" onClick={() => window.print()} sx={{ color: "text.secondary" }}>
                    <PrintIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
});

PreviewToolbar.displayName = "PreviewToolbar";
export default PreviewToolbar;
