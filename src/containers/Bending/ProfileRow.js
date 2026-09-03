import React, { memo } from "react";
import { Box, IconButton, InputAdornment, TextField, Tooltip } from "@mui/material";
import HeightIcon from "@mui/icons-material/Height";
import DeleteIcon from "@mui/icons-material/Clear";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import AdjustIcon from "@mui/icons-material/Adjust";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

const handleNumberKeyDown = (e) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Home", "End"];
    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
    if (!/^[0-9.,]$/.test(e.key)) { e.preventDefault(); return; }
    if ((e.key === "." || e.key === ",") && /[.,]/.test(e.currentTarget.value)) e.preventDefault();
};

const sanitizeNumber = (value) => {
    let result = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const parts = result.split(".");
    if (parts.length > 2) result = parts[0] + "." + parts.slice(1).join("");
    return result;
};

const ProfileRow = memo(({
                             shelf,
                             bend,
                             index,
                             verticalShelf,
                             firstBendIndex,
                             bendViewMode,
                             onShelfChange,
                             onShelfSideChange,
                             onVerticalShelfChange,
                             onBendChange,
                             onBendDirectionChange,
                             onSelectFirstBend,
                             onRemoveBend,
                             canRemove,
                         }) => {
    const isVertical = verticalShelf === index + 1;
    const isCurrentBendSelected = firstBendIndex === index;

    // Базовый стиль для кнопок управления
    const iconBtnStyle = (isActive, activeColor = "primary.main") => ({
        borderRadius: "6px",
        border: "1px solid",
        borderColor: isActive ? activeColor : "divider",
        backgroundColor: isActive ? `${activeColor}10` : "background.paper",
        color: isActive ? activeColor : "text.secondary",
        width: 36,
        height: 36,
        p: 0,
        flexShrink: 0,
        "&:hover": {
            borderColor: activeColor,
            backgroundColor: `${activeColor}20`,
        }
    });

    return (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>

            {/* 1. БЛОК ПОЛКИ (SCHENKEL) */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    width: "100%",
                    p: 1,
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundColor: "background.paper"
                }}
            >
                <TextField
                    label={`Schenkel ${index + 1}`}
                    type="text"
                    inputMode="decimal"
                    value={shelf.length}
                    size="small"
                    fullWidth
                    onKeyDown={handleNumberKeyDown}
                    onChange={(e) => onShelfChange(index, sanitizeNumber(e.target.value))}
                    slotProps={{
                        htmlInput: { min: 0, step: 0.01 },
                        input: { endAdornment: <InputAdornment position="end" sx={{ fontSize: "0.8rem" }}>mm</InputAdornment> },
                    }}
                />

                <Tooltip title="Seite wechseln">
                    <IconButton
                        size="small"
                        onClick={() => onShelfSideChange(index, shelf.side === "right" ? "left" : "right")}
                        sx={iconBtnStyle(shelf.side === "left")}
                    >
                        {shelf.side === "right" ? <ArrowForwardIcon fontSize="small" /> : <ArrowBackIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>

                <Tooltip title="Als vertikal markieren">
                    <IconButton
                        size="small"
                        onClick={() => onVerticalShelfChange(index)}
                        sx={iconBtnStyle(isVertical)}
                    >
                        <HeightIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* 2. БЛОК ГИБА (WINKEL) — рендерится как связующее звено, если это не последняя полка */}
            {bend && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        position: "relative",
                        // Рисуем сквозную вертикальную линию слева, показывающую последовательность цепочки
                        py: 1.5,
                        pl: 4,
                        boxSizing: "border-box",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            left: "24px",
                            top: 0,
                            bottom: 0,
                            width: "2px",
                            borderLeft: "2px dashed",
                            borderColor: isCurrentBendSelected ? "primary.main" : "divider"
                        }
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            width: "100%",
                            p: 1,
                            borderRadius: "6px",
                            border: "1px solid",
                            borderColor: isCurrentBendSelected ? "primary.light" : "divider",
                            backgroundColor: isCurrentBendSelected ? "action.hover" : "grey.50"
                        }}
                    >
                        <TextField
                            label={`Winkel ${index + 1}`}
                            type="text"
                            inputMode="decimal"
                            value={bend.angle}
                            size="small"
                            fullWidth
                            onKeyDown={handleNumberKeyDown}
                            onChange={(e) => onBendChange(index, sanitizeNumber(e.target.value))}
                            slotProps={{
                                htmlInput: { min: 0, max: 180, step: 0.01 },
                                input: {
                                    endAdornment: <InputAdornment position="end" sx={{ fontSize: "0.8rem" }}>°</InputAdornment>,
                                    startAdornment: canRemove && (
                                        <InputAdornment position="start">
                                            <IconButton
                                                size="small"
                                                onClick={() => onRemoveBend(index)}
                                                sx={{
                                                    width: 22, height: 22, p: 0, color: "text.disabled",
                                                    "&:hover": { color: "error.main" }
                                                }}
                                            >
                                                <DeleteIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                },
                            }}
                        />

                        <Tooltip title="Biegerichtung wechseln">
                            <IconButton
                                size="small"
                                onClick={() => onBendDirectionChange(index, bend.direction === "right" ? "left" : "right")}
                                sx={iconBtnStyle(bend.direction === "left")}
                            >
                                {bend.direction === "right" ? (
                                    <UndoIcon fontSize="small" style={{ transform: "rotate(90deg)" }} />
                                ) : (
                                    <RedoIcon fontSize="small" style={{ transform: "rotate(-90deg)" }} />
                                )}
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Schnittansicht: Klick zum Wechseln">
                            <IconButton
                                size="small"
                                onClick={() => onSelectFirstBend(index)}
                                sx={iconBtnStyle(
                                    isCurrentBendSelected,
                                    isCurrentBendSelected ? (bendViewMode === "toEnd" ? "success.main" : "warning.main") : "primary.main"
                                )}
                            >
                                {isCurrentBendSelected ? (
                                    <AdjustIcon fontSize="small" />
                                ) : (
                                    <RadioButtonUncheckedIcon fontSize="small" />
                                )}
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
            )}
        </Box>
    );
});

export default ProfileRow;