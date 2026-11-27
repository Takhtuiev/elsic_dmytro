// Общие элементы интерфейса расчёта гибки: заголовки секций, плитки результатов,
// поля выбора из справочника, карточки графиков. Один стиль для всей страницы.
import React, { memo } from "react";
import { Box, IconButton, InputAdornment, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

// Моноширинные цифры с табличной шириной — значения не «пляшут» при пересчёте
export const MONO_FONT = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const NUMERIC_SX = { fontFamily: MONO_FONT, fontVariantNumeric: "tabular-nums" };

// Заголовок секции: мелкие прописные, разрядка, линия до края
export const SectionHeader = memo(({ title, action, sx }) => (
    <Box
        sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            pt: 1.5,
            pb: 0.75,
            ...sx
        }}
    >
        <Typography
            component="h3"
            sx={{
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "text.secondary",
                whiteSpace: "nowrap"
            }}
        >
            {title}
        </Typography>
        <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
        {action}
    </Box>
));
SectionHeader.displayName = "SectionHeader";

// Плитка результата: подпись сверху, значение крупно моноширинным, единица мельче
// extra — вторичное значение в той же строке (например, «/ 4.4 required»), span — ширина в колонках сетки
export const ValueTile = memo(({ label, value, unit, hint, tone, emphasis = false, extra, span }) => (
    <Box
        sx={(theme) => ({
            minWidth: 0,
            gridColumn: span ? `span ${span}` : undefined,
            px: 1.25,
            py: 0.75,
            borderRadius: 1,
            border: "1px solid",
            borderColor: tone ? alpha(theme.palette[tone].main, 0.5) : "divider",
            bgcolor: tone
                ? alpha(theme.palette[tone].main, 0.06)
                : emphasis
                    ? alpha(theme.palette.primary.main, 0.05)
                    : "transparent"
        })}
    >
        <Typography
            noWrap
            sx={{
                fontSize: "0.68rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "text.secondary",
                lineHeight: 1.4
            }}
        >
            {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", columnGap: 0.5, minWidth: 0 }}>
            <Typography
                noWrap
                sx={{
                    ...NUMERIC_SX,
                    fontSize: emphasis ? "1.15rem" : "1rem",
                    fontWeight: 600,
                    color: tone ? `${tone}.main` : "text.primary",
                    lineHeight: 1.35
                }}
            >
                {value ?? "—"}
            </Typography>
            {unit && value != null && value !== "—" && (
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{unit}</Typography>
            )}
            {extra && (
                <Typography sx={{ ...NUMERIC_SX, fontSize: "0.75rem", color: "text.secondary", ml: 0.5, whiteSpace: "nowrap" }}>{extra}</Typography>
            )}
        </Box>
        {hint && (
            <Typography sx={{ ...NUMERIC_SX, fontSize: "0.7rem", color: "text.secondary", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                {hint}
            </Typography>
        )}
    </Box>
));
ValueTile.displayName = "ValueTile";

// Поле «выбор из справочника»: только чтение, клик по всему полю открывает диалог
export const SelectorField = memo(({ label, value, onOpen, icon }) => (
    <TextField
        label={label}
        value={value || ""}
        onClick={onOpen}
        onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen();
            }
        }}
        size="small"
        fullWidth
        slotProps={{
            htmlInput: { readOnly: true },
            input: {
                endAdornment: (
                    <InputAdornment position="end">
                        <IconButton
                            size="small"
                            edge="end"
                            aria-label={`Select ${label}`}
                            tabIndex={-1}
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpen();
                            }}
                        >
                            {icon}
                        </IconButton>
                    </InputAdornment>
                )
            }
        }}
        sx={{
            "& .MuiInputBase-root, & .MuiInputBase-input": { cursor: "pointer" },
            "& .MuiInputBase-input": { userSelect: "none", textOverflow: "ellipsis" }
        }}
    />
));
SelectorField.displayName = "SelectorField";

// Карточка графика: заголовок и (необязательно) пояснение справа
export const ChartCard = memo(({ title, note, tone, children }) => (
    <Box
        sx={{
            minWidth: 0,
            border: "1px solid",
            borderColor: tone ? `${tone}.main` : "divider",
            borderRadius: 1,
            bgcolor: "background.paper",
            overflow: "hidden",
            breakInside: "avoid"
        }}
    >
        <Box
            sx={{
                display: "flex",
                alignItems: "baseline",
                gap: 1,
                px: 1.25,
                py: 0.5,
                borderBottom: "1px solid",
                borderColor: "divider",
                bgcolor: "action.hover"
            }}
        >
            <Typography noWrap sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.primary" }}>
                {title}
            </Typography>
            {note && (
                <Typography noWrap sx={{ ml: "auto", fontSize: "0.7rem", color: "text.secondary" }}>
                    {note}
                </Typography>
            )}
        </Box>
        <Box sx={{ px: 0.5, pt: 0.5 }}>{children}</Box>
    </Box>
));
ChartCard.displayName = "ChartCard";
