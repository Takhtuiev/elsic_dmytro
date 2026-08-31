import React from "react";
import {
    Box,
    IconButton,
    InputAdornment,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

const SHELF_FIELD_WIDTH = "16ch";
const ANGLE_FIELD_WIDTH = "12ch";
const FIELD_COLUMN_WIDTH = "16ch";

const SHELF_LABEL = "Schenkel";
const ANGLE_LABEL = "Winkel";

// Только цифры + одна десятичная точка
const handleNumberKeyDown = (e) => {
    const allowedKeys = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Home", "End"];

    if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;

    if (!/^[0-9.,]$/.test(e.key)) {
        e.preventDefault();
        return;
    }

    if ((e.key === "." || e.key === ",") && /[.,]/.test(e.currentTarget.value)) {
        e.preventDefault();
    }
};

// Очистка вставленного значения
const sanitizeNumber = (value) => {
    let result = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const parts = result.split(".");

    if (parts.length > 2) {
        result = parts[0] + "." + parts.slice(1).join("");
    }

    return result;
};

function BendingProfileRow({
                               shelf,
                               bend,
                               index,
                               verticalShelf,
                               onShelfChange,
                               onShelfSideChange,
                               onVerticalShelfChange,
                               onBendChange,
                               onBendDirectionChange,
                               onRemoveBend,
                               canRemove,
                           }) {
    const rowGrid = {
        display: "grid",
        gridTemplateColumns: `${FIELD_COLUMN_WIDTH} max-content max-content max-content`,
        alignItems: "center",
        columnGap: 1,
        width: "max-content",
        maxWidth: "100%",
    };

    return (
        <React.Fragment>

            {/* Полка */}

            <Box sx={rowGrid}>
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
                        input: {
                            endAdornment: <InputAdornment position="end">mm</InputAdornment>,
                        },
                    }}
                />

                <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={shelf.side}
                    onChange={(e, value) => onShelfSideChange(index, value)}
                >
                    <ToggleButton value="left">←</ToggleButton>
                    <ToggleButton value="right">→</ToggleButton>
                </ToggleButtonGroup>

                <IconButton
                    size="small"
                    color={verticalShelf === index + 1 ? "primary" : "default"}
                    onClick={() => onVerticalShelfChange(index)}
                    title="Сделать полку вертикальной"
                    sx={{
                        borderRadius: "4px",
                        border: verticalShelf === index + 1 ? "1px solid" : "1px solid transparent",
                    }}
                >
                    <span style={{ fontSize: "20px", lineHeight: 1 }}>↕</span>
                </IconButton>

                <Box />
            </Box>

            {/* Угол */}

            {bend && (
                <Box sx={rowGrid}>
                    <TextField
                        label={`${ANGLE_LABEL} ${index + 1}`}
                        type="text"
                        inputMode="decimal"
                        value={bend.angle}
                        size="small"
                        sx={{ width: ANGLE_FIELD_WIDTH, justifySelf: "start" }}
                        onKeyDown={handleNumberKeyDown}
                        onChange={(e) => onBendChange(index, sanitizeNumber(e.target.value))}
                        slotProps={{
                            htmlInput: { min: 0, max: 180, step: 0.01 },
                            input: {
                                endAdornment: <InputAdornment position="end">°</InputAdornment>,
                            },
                        }}
                    />

                    <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={bend.direction}
                        onChange={(e, value) => onBendDirectionChange(index, value)}
                    >
                        <ToggleButton value="right">
                            <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>↷</span>
                        </ToggleButton>

                        <ToggleButton value="left">
                            <span style={{ display: "inline-block", transform: "rotate(180deg)" }}>↶</span>
                        </ToggleButton>
                    </ToggleButtonGroup>

                    {canRemove ? (
                        <IconButton
                            color="error"
                            size="small"
                            title={`Удалить ${ANGLE_LABEL} ${index + 1}`}
                            onClick={() => onRemoveBend(index)}
                        >
                            <DeleteIcon />
                        </IconButton>
                    ) : (
                        <Box />
                    )}
                </Box>
            )}
        </React.Fragment>
    );
}

export default BendingProfileRow;