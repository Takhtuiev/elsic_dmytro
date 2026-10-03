import React, { useEffect, useRef } from "react";
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

    const historyAdded = useRef(false);
    const onCloseRef = useRef(onClose);
    const onApplyRef = useRef(onApply);

    const pxSize = isMobile ? 2 : 2.5;

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        onApplyRef.current = onApply;
    }, [onApply]);

    // На мобильном добавляем отдельную запись в history.
    // Системная кнопка Back тогда сначала закрывает Dialog.
    useEffect(() => {
        if (!open || !isMobile) return;

        window.history.pushState({ bendingDialog: true }, "");
        historyAdded.current = true;

        const handlePopState = () => {
            historyAdded.current = false;
            onCloseRef.current?.();
        };

        window.addEventListener("popstate", handlePopState);

        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [open, isMobile]);

    // Обычное закрытие Dialog.
    const handleClose = () => {
        if (isMobile && historyAdded.current) {
            historyAdded.current = false;
            window.history.back();
            return;
        }

        onClose?.();
    };

    // Enter = Save.
    const handleKeyDown = (event) => {
        if (event.key !== "Enter" || event.shiftKey) return;

        // В textarea Enter должен оставаться обычным переносом строки.
        if (event.target.tagName === "TEXTAREA") return;

        // Не срабатываем на disabled Save.
        if (applyDisabled) return;

        event.preventDefault();
        onApplyRef.current?.(value);
    };

    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                // Клик мышью вне окна ничего не делает.
                if (reason === "backdropClick") return;

                handleClose();
            }}
            onKeyDown={handleKeyDown}
            fullWidth
            maxWidth="md"
            fullScreen={isMobile}
            slotProps={{
                paper: {
                    sx: {
                        borderRadius: isMobile ? 0 : 3,
                        backgroundImage: "none",
                        display: "flex",
                        flexDirection: "column",
                        height: isMobile ? "auto" : "max-content",
                        maxHeight: isMobile ? "100%" : "calc(100% - 64px)",
                    }
                }
            }}
        >
            <DialogTitle
                sx={{
                    m: 0,
                    px: pxSize,
                    py: 1,
                    fontSize: isMobile ? "1.1rem" : "1.2rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    flexShrink: 0,
                    minHeight: "auto",
                }}
            >
                <Box
                    sx={{
                        flexGrow: 1,
                        pr: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {title}
                </Box>

                <IconButton
                    aria-label="close"
                    onClick={handleClose}
                    sx={{
                        p: 0.5,
                        color: "text.secondary",
                        transition: "all 0.2s ease-in-out",
                        "&:hover": {
                            backgroundColor: "action.hover",
                            color: "text.primary",
                        },
                    }}
                >
                    <CloseIcon fontSize="medium" />
                </IconButton>
            </DialogTitle>

            <DialogContent
                sx={{
                    pt: `${theme.spacing(2.5)} !important`,
                    pb: `${theme.spacing(2.5)} !important`,
                    px: pxSize,
                    borderColor: "divider",
                    backgroundColor:
                        theme.palette.mode === "dark"
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

            <DialogActions
                sx={{
                    px: pxSize,
                    py: 1,
                    m: 0,
                    gap: 1,
                    borderTop: `1px solid ${theme.palette.divider}`,
                    backgroundColor: theme.palette.background.paper,
                    flexShrink: 0,
                    minHeight: "auto",
                }}
            >
                <Button
                    onClick={handleClose}
                    variant="text"
                    sx={{
                        color: "text.secondary",
                        textTransform: "none",
                        fontWeight: 500,
                        px: 2,
                        py: 0.5,
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
                            backgroundColor:
                                theme.palette.mode === "dark"
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