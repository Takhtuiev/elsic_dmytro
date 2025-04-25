import {Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';

function InfoModal({ showInfo, setShowInfo }) {

    const onHide = () => {
        setShowInfo(null)
    }

    return (
        <Dialog
            maxWidth="sm"
            open={showInfo.title !== ""}
            onClose={onHide}
            scroll="body"
        >
            <DialogTitle>
                {showInfo.title}
                <IconButton
                    aria-label="close"
                    onClick={onHide}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: 8,
                        color: (theme) => theme.palette.grey[500],
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                {showInfo.message}
            </DialogContent>
            <DialogActions>
                <Button
                    variant="contained"
                    onClick={onHide}
                >
                    Ok
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default InfoModal;