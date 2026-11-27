import React, { memo, useCallback, useState } from "react";
import {
    Box, IconButton, InputAdornment, Menu, MenuItem, TextField, Tooltip
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DeleteIcon from "@mui/icons-material/Clear";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { NUMERIC_SX } from "./uiKit";

const ANGLE_PRESETS = [90, 120, 135, 150, 180];
const BUTTON_SIZE = 34;

const BendSelectIcon = ({ isSelected, bendSide }) => (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" style={{ display: "block", flexShrink: 0 }}>
        <path d="M2.25 7 L10 20.42 L25.5 20.42" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 20.42 A7 7 0 0 0 6.5 14.36" stroke="currentColor" strokeWidth=".8" strokeLinecap="round" />
        {isSelected && (
            <path
                d={bendSide === "toEnd" ? "M10 5 L14 9 L18 5" : "M10 9 L14 5 L18 9"}
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        )}
    </svg>
);

const VerticalIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ display: "block", flexShrink: 0 }}>
        <path d="M11 1V23M13 1V23" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
);

const ALLOWED_KEYS = new Set(["Backspace", "Delete", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab", "Home", "End", "Enter", "Escape"]);

const handleNumberKeyDown = (e) => {
    if (ALLOWED_KEYS.has(e.key) || e.ctrlKey || e.metaKey) return;
    const hasSeparator = /[.,]/.test(e.currentTarget.value);
    if (!/^[0-9.,]$/.test(e.key) || (/[.,]/.test(e.key) && hasSeparator)) e.preventDefault();
};

// Только цифры и одна точка (запятая → точка); вставка из буфера тоже чистится
const sanitizeNumber = (value) => {
    const result = String(value).replace(/,/g, ".").replace(/[^0-9.]/g, "");
    const [first, ...rest] = result.split(".");
    return rest.length ? `${first}.${rest.join("")}` : result;
};

// Метка строки: L1, B1 …
const RowTag = ({ children, active }) => (
    <Box
        sx={{
            ...NUMERIC_SX,
            width: 26,
            flexShrink: 0,
            textAlign: "center",
            fontSize: "0.7rem",
            fontWeight: 700,
            color: active ? "primary.main" : "text.secondary"
        }}
    >
        {children}
    </Box>
);

const toolButtonSx = (active = false, tone = "primary") => (theme) => ({
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    p: 0,
    flexShrink: 0,
    borderRadius: 1,
    border: "1px solid",
    borderColor: active ? theme.palette[tone].main : theme.palette.divider,
    color: active ? theme.palette[tone].main : theme.palette.text.secondary,
    bgcolor: active ? alpha(theme.palette[tone].main, 0.08) : "transparent",
    "&:hover": {
        borderColor: theme.palette[tone].main,
        color: theme.palette[tone].main,
        bgcolor: alpha(theme.palette[tone].main, 0.08)
    },
    "&.Mui-disabled": {
        borderColor: theme.palette.divider,
        color: theme.palette.text.disabled,
        bgcolor: theme.palette.action.hover
    }
});

const NumberField = ({ label, value, onChange, unit, error, helperText }) => (
    <TextField
        label={label}
        type="text"
        value={value ?? ""}
        size="small"
        fullWidth
        error={error}
        title={helperText || undefined}
        onKeyDown={handleNumberKeyDown}
        onChange={(e) => onChange(sanitizeNumber(e.target.value))}
        slotProps={{
            htmlInput: { inputMode: "decimal", style: { ...NUMERIC_SX } },
            input: {
                endAdornment: unit && <InputAdornment position="end">{unit}</InputAdornment>
            }
        }}
    />
);

const UnitText = ({ children }) => <Box component="span" sx={{ fontSize: "0.8rem", color: "text.secondary" }}>{children}</Box>;

const ProfileRow = memo(({
    shelf,
    bend,
    index,
    thickness,
    bendIndex,
    bendSide,
    onUpdate,
    onVerticalShelfChange,
    isVertical,
    onSelectBend,
    onRemoveBend,
    canRemove
}) => {
    const [angleMenuAnchor, setAngleMenuAnchor] = useState(null);
    const isSelected = bendIndex === index;
    const viewLocked = bendIndex !== -1;

    const updateShelf = useCallback((field, value) => onUpdate({ path: ["shelves", index, field], value }), [onUpdate, index]);
    const updateBend = useCallback((field, value) => onUpdate({ path: ["bends", index, field], value }), [onUpdate, index]);

    const length = Number(shelf.length);
    const lengthError = shelf.length === "" || !Number.isFinite(length) || length < Number(thickness || 0);
    const angle = Number(bend?.angle);
    const angleError = bend && (bend.angle === "" || !Number.isFinite(angle) || angle < 90 || angle > 180);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", width: "100%" }}>
            {/* Полка */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.5 }}>
                <RowTag>L{index + 1}</RowTag>
                <NumberField
                    label={`Leg ${index + 1}`}
                    value={shelf.length}
                    onChange={(value) => updateShelf("length", value)}
                    unit={<UnitText>mm</UnitText>}
                    error={lengthError}
                    helperText={lengthError ? `At least ${thickness} mm` : ""}
                />

                <Tooltip title={`Leg side: ${shelf.side === "right" ? "right" : "left"} — click to switch`}>
                    <IconButton
                        size="small"
                        aria-label="Switch leg side"
                        onClick={() => updateShelf("side", shelf.side === "right" ? "left" : "right")}
                        sx={toolButtonSx(false)}
                    >
                        {shelf.side === "right" ? <ArrowForwardIcon fontSize="small" /> : <ArrowBackIcon fontSize="small" />}
                    </IconButton>
                </Tooltip>

                <Tooltip title={viewLocked ? "Unavailable while a bend view is selected" : isVertical ? "Leg is vertical — click to flip" : "Make leg vertical"}>
                    <span style={{ display: "inline-flex" }}>
                        <IconButton
                            size="small"
                            aria-label="Make leg vertical"
                            aria-pressed={isVertical}
                            onClick={() => onVerticalShelfChange(index)}
                            disabled={viewLocked}
                            sx={toolButtonSx(isVertical)}
                        >
                            <VerticalIcon />
                        </IconButton>
                    </span>
                </Tooltip>
            </Box>

            {/* Гиб */}
            {bend && (
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        alignItems: "center",
                        gap: 0.75,
                        mx: 1,
                        my: 0.25,
                        px: 0,
                        py: 0.75,
                        borderRadius: 1,
                        borderLeft: "3px solid",
                        borderLeftColor: isSelected ? theme.palette.primary.main : theme.palette.divider,
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : theme.palette.action.hover
                    })}
                >
                    <RowTag active={isSelected}>B{index + 1}</RowTag>
                    <NumberField
                        label={`Angle ${index + 1}`}
                        value={bend.angle}
                        onChange={(value) => updateBend("angle", value)}
                        error={angleError}
                        helperText={angleError ? "Allowed range 90°–180°" : ""}
                        unit={
                            <Box sx={{ display: "flex", alignItems: "center" }}>
                                <UnitText>°</UnitText>
                                <IconButton
                                    size="small"
                                    aria-label="Angle presets"
                                    onClick={(e) => setAngleMenuAnchor(e.currentTarget)}
                                    sx={{ p: 0.25, ml: 0.25, color: "text.secondary" }}
                                >
                                    <KeyboardArrowDownIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        }
                    />

                    <Menu anchorEl={angleMenuAnchor} open={Boolean(angleMenuAnchor)} onClose={() => setAngleMenuAnchor(null)}>
                        {ANGLE_PRESETS.map((preset) => (
                            <MenuItem
                                key={preset}
                                dense
                                selected={angle === preset}
                                onClick={() => {
                                    updateBend("angle", String(preset));
                                    setAngleMenuAnchor(null);
                                }}
                                sx={NUMERIC_SX}
                            >
                                {preset}°
                            </MenuItem>
                        ))}
                    </Menu>

                    <Tooltip title={`Bend direction: ${bend.direction} — click to switch`}>
                        <IconButton
                            size="small"
                            aria-label="Switch bend direction"
                            onClick={() => updateBend("direction", bend.direction === "right" ? "left" : "right")}
                            sx={toolButtonSx(false)}
                        >
                            {bend.direction === "right"
                                ? <RedoIcon fontSize="small" style={{ transform: "rotate(-90deg)" }} />
                                : <UndoIcon fontSize="small" style={{ transform: "rotate(90deg)" }} />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={isSelected ? "Bend view — click to switch side or close" : "Show bend view with machine settings"}>
                        <IconButton
                            size="small"
                            aria-label="Bend view"
                            aria-pressed={isSelected}
                            onClick={() => onSelectBend(index)}
                            sx={toolButtonSx(isSelected)}
                        >
                            <BendSelectIcon isSelected={isSelected} bendSide={bendSide} />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={canRemove ? "Delete bend" : "A profile needs at least one bend"}>
                        <span style={{ display: "inline-flex", marginRight: 6 }}>
                            <IconButton
                                size="small"
                                aria-label="Delete bend"
                                disabled={!canRemove}
                                onClick={() => onRemoveBend(index)}
                                sx={toolButtonSx(false, "error")}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            )}
        </Box>
    );
});

ProfileRow.displayName = "ProfileRow";
export default ProfileRow;
