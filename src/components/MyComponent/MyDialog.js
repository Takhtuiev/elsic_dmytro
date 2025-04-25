import React from "react";
import { Dialog, DialogContent, DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

function MyDialog({ open, onClose, title, children, maxWidth = "md", fullWidth}) {

    const handleClose = (event, reason) => {
        if (reason && reason === "backdropClick") return;
        onClose();
    };

    return (
        <Dialog
            fullWidth={fullWidth}
            maxWidth={maxWidth}
            sx={{width:'100%'}}
            open={open}
            onClose={handleClose}
            scroll="body"
            aria-labelledby="custom-dialog-title"
        >
            <DialogTitle id="custom-dialog-title">
                {title}
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        position: "absolute",
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.text.secondary,
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>{children}</DialogContent>
        </Dialog>
    );
}

export default MyDialog;
