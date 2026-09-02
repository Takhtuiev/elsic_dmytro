import React, { memo } from "react";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import HeightIcon from "@mui/icons-material/Height";

const SHELF_FIELD_WIDTH = "16ch";
const ANGLE_FIELD_WIDTH = "12ch";

const SHELF_LABEL = "Schenkel";
const ANGLE_LABEL = "Winkel";

const GRID_STYLE = {
    display: "grid",
    gridTemplateColumns: `${SHELF_FIELD_WIDTH} 34px 34px`,
    alignItems: "center",
    columnGap: 1,
    width: "max-content",
    maxWidth: "100%",
};

const BEND_INPUT_INNER_GRID = {
    display: "grid",
    gridTemplateColumns: `${ANGLE_FIELD_WIDTH} 34px`,
    alignItems: "center",
    columnGap: 1,
    width: "100%",
};

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
                             bendViewMode, // Получаем режим обрыва
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

    // Меняем иконку: ① для прямого обрыва, ❶ для обратного обрыва
    const buttonIcon = isCurrentBendSelected
        ? (bendViewMode === "toEnd" ? "①" : "❶")
        : "①";

    return (
        <React.Fragment>
            <Box sx={GRID_STYLE}>
                <TextField
                    label={`${SHELF_LABEL} ${index + 1}`}
                    type="text"
                    inputMode="decimal"
                    value={shelf.length}
                    size="small"
                    sx={{ width: SHELF_FIELD_WIDTH }}
                    onKeyDown={handleNumberKeyDown}
                    onChange={(e) => onShelfChange(index, sanitizeNumber(e.target.value))}
                    slotProps={{
                        htmlInput: { min: 0, step: 0.01 },
                        input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> },
                    }}
                />
                <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onShelfSideChange(index, shelf.side === "right" ? "left" : "right")}
                    sx={{ borderRadius: "4px", border: "1px solid", borderColor: "divider", width: "34px", height: "34px", p: 0 }}
                >
                    <span style={{ fontSize: "16px", fontWeight: "bold" }}>{shelf.side === "right" ? "→" : "←"}</span>
                </IconButton>
                <IconButton
                    size="small"
                    color={isVertical ? "primary" : "default"}
                    onClick={() => onVerticalShelfChange(index)}
                    sx={{ borderRadius: "4px", border: `1px solid ${isVertical ? "currentColor" : "divider"}`, width: "34px", height: "34px", p: 0 }}
                >
                    <HeightIcon fontSize="small" />
                </IconButton>
            </Box>

            {bend && (
                <Box sx={GRID_STYLE}>
                    <Box sx={BEND_INPUT_INNER_GRID}>
                        <TextField
                            label={`${ANGLE_LABEL} ${index + 1}`}
                            type="text"
                            inputMode="decimal"
                            value={bend.angle}
                            size="small"
                            sx={{ width: ANGLE_FIELD_WIDTH }}
                            onKeyDown={handleNumberKeyDown}
                            onChange={(e) => onBendChange(index, sanitizeNumber(e.target.value))}
                            slotProps={{
                                htmlInput: { min: 0, max: 180, step: 0.01 },
                                input: { endAdornment: <InputAdornment position="end">°</InputAdornment> },
                            }}
                        />
                        {canRemove ? (
                            <IconButton
                                size="small"
                                onClick={() => onRemoveBend(index)}
                                sx={{
                                    width: "34px", height: "34px", p: 0, color: "text.disabled", borderRadius: "4px",
                                    "&:hover": { color: "error.main", backgroundColor: "error.lighter" }
                                }}
                            >
                                <span style={{ fontSize: "15px", fontFamily: "sans-serif", lineHeight: 1 }}>✕</span>
                            </IconButton>
                        ) : (
                            <Box sx={{ width: "34px", height: "34px" }} />
                        )}
                    </Box>

                    <IconButton
                        size="small"
                        color="primary"
                        onClick={() => onBendDirectionChange(index, bend.direction === "right" ? "left" : "right")}
                        sx={{ borderRadius: "4px", border: "1px solid", borderColor: "divider", width: "34px", height: "34px", p: 0 }}
                    >
                        <span style={{ fontSize: "16px", fontWeight: "bold" }}>{bend.direction === "right" ? "⤾" : "⤿"}</span>
                    </IconButton>

                    {/* ТРЕХПОЗИЦИОННЫЙ ПЕРЕКЛЮЧАТЕЛЬ ОБРЫВА ЧЕРТЕЖА */}
                    <IconButton
                        size="small"
                        color={isCurrentBendSelected ? (bendViewMode === "toEnd" ? "success" : "warning") : "default"}
                        title="Клик: До угла ➔ После угла ➔ Сброс"
                        onClick={() => onSelectFirstBend(index)}
                        sx={{
                            borderRadius: "4px",
                            border: `1px solid ${isCurrentBendSelected ? "currentColor" : "divider"}`,
                            backgroundColor: isCurrentBendSelected
                                ? (bendViewMode === "toEnd" ? "success.lighter" : "warning.lighter")
                                : "transparent",
                            width: "34px",
                            height: "34px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            p: 0,
                        }}
                    >
                        {buttonIcon}
                    </IconButton>
                </Box>
            )}
        </React.Fragment>
    );
});

export default ProfileRow;
