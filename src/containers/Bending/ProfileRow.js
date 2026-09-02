import React, { memo } from "react";
import { Box, IconButton, InputAdornment, TextField } from "@mui/material";
import HeightIcon from "@mui/icons-material/Height";

const SHELF_FIELD_WIDTH = "16ch";
const ANGLE_FIELD_WIDTH = "12ch"; // Вернули 12ch для идеального баланса с крестиком

const SHELF_LABEL = "Schenkel";
const ANGLE_LABEL = "Winkel";

// МОНОЛИТНАЯ СТРУКТУРА: Ровно 3 жесткие колонки для ОБОИХ рядов.
const GRID_STYLE = {
    display: "grid",
    gridTemplateColumns: `${SHELF_FIELD_WIDTH} 34px 34px`,
    alignItems: "center",
    columnGap: 1,
    width: "max-content",
    maxWidth: "100%",
};

// Внутренний мини-грид для второй строки: инпут угла + минималистичный крестик удаления
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
    if (!/^[0-9.,]$/.test(e.key)) {
        e.preventDefault();
        return;
    }
    if ((e.key === "." || e.key === ",") && /[.,]/.test(e.currentTarget.value)) {
        e.preventDefault();
    }
};

const sanitizeNumber = (value) => {
    let result = value.replace(",", ".").replace(/[^0-9.]/g, "");
    const parts = result.split(".");
    if (parts.length > 2) {
        result = parts[0] + "." + parts.slice(1).join("");
    }
    return result;
};

const ProfileRow = memo(({
                             shelf,
                             bend,
                             index,
                             verticalShelf,
                             firstBendIndex,
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
    const isFirstBend = firstBendIndex === index;

    const handleTextChange = (callback, val) => {
        callback(index, sanitizeNumber(val));
    };

    return (
        <React.Fragment>
            {/* РЯД 1: Параметры полки (Schenkel) */}
            <Box sx={GRID_STYLE}>
                {/* Колонка 1 */}
                <TextField
                    label={`${SHELF_LABEL} ${index + 1}`}
                    type="text"
                    inputMode="decimal"
                    value={shelf.length}
                    size="small"
                    sx={{ width: SHELF_FIELD_WIDTH }}
                    onKeyDown={handleNumberKeyDown}
                    onChange={(e) => handleTextChange(onShelfChange, e.target.value)}
                    slotProps={{
                        htmlInput: { min: 0, step: 0.01 },
                        input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> },
                    }}
                />

                {/* Колонка 2: Кнопка стороны размера полки (→ / ←) */}
                <IconButton
                    size="small"
                    color="primary"
                    title={shelf.side === "right" ? "Размер справа (Клик для смены)" : "Размер слева (Клик для смены)"}
                    onClick={() => onShelfSideChange(index, shelf.side === "right" ? "left" : "right")}
                    sx={{
                        borderRadius: "4px",
                        border: "1px solid",
                        borderColor: "divider",
                        width: "34px",
                        height: "34px",
                        p: 0,
                    }}
                >
                    <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                        {shelf.side === "right" ? "→" : "←"}
                    </span>
                </IconButton>

                {/* Колонка 3: Кнопка фиксации вертикальности (↕) */}
                <IconButton
                    size="small"
                    color={isVertical ? "primary" : "default"}
                    onClick={() => onVerticalShelfChange(index)}
                    title="Сделать полку вертикальной"
                    sx={{
                        borderRadius: "4px",
                        border: `1px solid ${isVertical ? "currentColor" : "divider"}`,
                        width: "34px",
                        height: "34px",
                        p: 0,
                    }}
                >
                    <HeightIcon fontSize="small" />
                </IconButton>
            </Box>

            {/* РЯД 2: Параметры угла (Winkel) */}
            {bend && (
                <Box sx={GRID_STYLE}>
                    {/* Колонка 1: Инпут угла + Минималистичный крестик удаления */}
                    <Box sx={BEND_INPUT_INNER_GRID}>
                        <TextField
                            label={`${ANGLE_LABEL} ${index + 1}`}
                            type="text"
                            inputMode="decimal"
                            value={bend.angle}
                            size="small"
                            sx={{ width: ANGLE_FIELD_WIDTH }}
                            onKeyDown={handleNumberKeyDown}
                            onChange={(e) => handleTextChange(onBendChange, e.target.value)}
                            slotProps={{
                                htmlInput: { min: 0, max: 180, step: 0.01 },
                                input: { endAdornment: <InputAdornment position="end">°</InputAdornment> },
                            }}
                        />

                        {/* Минималистичная кнопка удаления в виде аккуратного крестика ✕ */}
                        {canRemove ? (
                            <IconButton
                                size="small"
                                title={`Удалить ${ANGLE_LABEL} ${index + 1}`}
                                onClick={() => onRemoveBend(index)}
                                sx={{
                                    width: "34px",
                                    height: "34px",
                                    p: 0,
                                    color: "text.disabled", // По умолчанию бледный, не отвлекает внимание
                                    borderRadius: "4px",
                                    transition: "all 0.2s",
                                    "&:hover": {
                                        color: "error.main", // Ярко-красный только при наведении
                                        backgroundColor: "error.lighter",
                                    }
                                }}
                            >
                                <span style={{ fontSize: "15px", fontFamily: "sans-serif", lineHeight: 1 }}>✕</span>
                            </IconButton>
                        ) : (
                            <Box sx={{ width: "34px", height: "34px" }} />
                        )}
                    </Box>

                    {/* Колонка 2: Кнопка направления гиба (СТРОГО ПОД кнопкой →/←) */}
                    <IconButton
                        size="small"
                        color="primary"
                        title={bend.direction === "right" ? "По часовой стрелке" : "Против часовой стрелки"}
                        onClick={() => onBendDirectionChange(index, bend.direction === "right" ? "left" : "right")}
                        sx={{
                            borderRadius: "4px",
                            border: "1px solid",
                            borderColor: "divider",
                            width: "34px",
                            height: "34px",
                            p: 0,
                        }}
                    >
                        <span style={{ fontSize: "16px", fontWeight: "bold" }}>
                            {bend.direction === "right" ? "⤾" : "⤿"}
                        </span>
                    </IconButton>

                    {/* Колонка 3: Кнопка первого гиба «①» (СТРОГО ПОД кнопкой ↕) */}
                    <IconButton
                        size="small"
                        color={isFirstBend ? "success" : "default"}
                        title={isFirstBend ? "Первый шаг гибки" : "Сделать этот гиб первым шагом"}
                        onClick={() => onSelectFirstBend(index)}
                        sx={{
                            borderRadius: "4px",
                            border: `1px solid ${isFirstBend ? "currentColor" : "divider"}`,
                            backgroundColor: isFirstBend ? "success.lighter" : "transparent",
                            width: "34px",
                            height: "34px",
                            fontSize: "12px",
                            fontWeight: "bold",
                            p: 0,
                        }}
                    >
                        ①
                    </IconButton>
                </Box>
            )}
        </React.Fragment>
    );
});

export default ProfileRow;
