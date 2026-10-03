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

export default function MyDialog({
                                          open,
                                          title,
                                          value,
                                          onChange,
                                          renderContent,
                                          onApply,
                                          onClose,
                                          saveDisabled = false
                                      }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    const pxSize = isMobile ? 2 : 2.5;

    const handleKeyDown = event => {
        if (event.key !== "Enter" || event.shiftKey) return;

        if (event.target.tagName === "TEXTAREA") return;

        if (saveDisabled) return;

        event.preventDefault();
        onApply?.(value);
    };

    return (
        <Dialog
            open={open}
            onClose={(event, reason) => {
                if (reason === "backdropClick") return;
                onClose?.();
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
                    onClick={onClose}
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
                    onClick={onClose}
                    variant="text"
                    sx={{
                        color: "text.secondary",
                        textTransform: "none",
                        fontWeight: 500,
                        px: 2,
                        py: 0.5,
                        borderRadius: isMobile ? 1.5 : 2,
                        flex: isMobile ? 1 : "none"
                    }}
                >
                    Cancel
                </Button>

                <Button
                    variant="contained"
                    onClick={() => onApply?.(value)}
                    disabled={saveDisabled}
                    disableElevation
                    sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        px: 2.5,
                        py: 0.5,
                        borderRadius: isMobile ? 1.5 : 2,
                        flex: isMobile ? 1 : "none",
                    }}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}