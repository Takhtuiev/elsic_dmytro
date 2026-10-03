import React from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Box,
    useMediaQuery,
    useTheme
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function BendingDialog({
                                          open,
                                          title,
                                          value,
                                          onChange,
                                          renderContent,
                                          onApply,
                                          onClose,
                                          applyDisabled = false
                                      }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const pxSize = isMobile ? 2 : 2.5; // Оставляем хорошие горизонтальные отступы (16px / 20px)

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="md"
            fullScreen={isMobile}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: isMobile ? 0 : 3,
                        boxShadow: theme.palette.mode === "dark"
                            ? "0 24px 48px -12px rgba(0, 0, 0, 0.5)"
                            : "0 24px 48px -12px rgba(0, 0, 0, 0.08)",
                        backgroundColor: theme.palette.background.paper,
                        backgroundImage: "none",
                        display: "flex",
                        flexDirection: "column",
                        height: isMobile ? "auto" : "max-content",
                        maxHeight: isMobile ? "100%" : "calc(100% - 64px)",
                    }
                }
            }}
        >
            {/* Заголовок — МИНИМАЛЬНАЯ ВЫСОТА */}
            <DialogTitle
                sx={{
                    m: 0,
                    px: pxSize,
                    py: 1, // 🌟 Всего 8px сверху и снизу (шапка стала максимально узкой)
                    fontSize: isMobile ? "1.1rem" : "1.2rem", // Размер шрифта не менялся
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    flexShrink: 0,
                    minHeight: "auto", // Сбрасываем системные ограничения MUI по высоте
                }}
            >
                <Box sx={{ flexGrow: 1, pr: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {title}
                </Box>

                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        p: 0.5, // Микро-паддинг, чтобы кнопка не раздувала шапку
                        color: "text.secondary",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                            backgroundColor: "action.hover",
                            color: "text.primary",
                        },
                    }}
                >
                    <CloseIcon fontSize="medium" /> {/* Размер иконки сохранен */}
                </IconButton>
            </DialogTitle>

            {/* Контентная зона — СИММЕТРИЧНЫЕ ОТСТУПЫ */}
            <DialogContent
                sx={{
                    pt: `${theme.spacing(2.5)} !important`,
                    pb: `${theme.spacing(2.5)} !important`,
                    px: pxSize,
                    borderColor: "divider",
                    backgroundColor: theme.palette.mode === "dark"
                        ? "background.default"
                        : "background.paper",
                    flexGrow: isMobile ? 1 : 0,

                    "& > *:first-of-type": {
                        marginTop: 0,
                    },
                    "& > *:last-of-type": {
                        marginBottom: 0,
                    },
                    "&:last-child": {
                        paddingBottom: `${theme.spacing(2.5)} !important`,
                    }
                }}
            >
                {renderContent?.({
                    value,
                    onChange
                })}
            </DialogContent>

            {/* Футер — МИНИМАЛЬНАЯ ВЫСОТА */}
            <DialogActions
                sx={{
                    px: pxSize,
                    py: 1, // 🌟 Всего 8px сверху и снизу (футер стал максимально узким)
                    m: 0,
                    gap: 1,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    flexShrink: 0,
                    minHeight: "auto", // Сбрасываем системные ограничения MUI по высоте
                }}
            >
                <Button
                    onClick={onClose}
                    variant="text"
                    sx={{
                        color: "text.secondary",
                        textTransform: "none",
                        fontWeight: 500,
                        px: 2,
                        py: 0.5, // Высота кнопок осталась прежней и удобной для клика
                        flex: isMobile ? 1 : "none"
                    }}
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    onClick={() => onApply?.(value)}
                    disabled={applyDisabled}
                    disableElevation
                    sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        px: 2.5,
                        py: 0.5,
                        borderRadius: isMobile ? 1.5 : 2,
                        flex: isMobile ? 1 : "none",
                        "&.Mui-disabled": {
                            backgroundColor: theme.palette.mode === "dark"
                                ? "rgba(255, 255, 255, 0.12)"
                                : "rgba(0, 0, 0, 0.12)",
                        }
                    }}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
