import React from "react";
import {Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import {useState} from "react";
import ErrorBox from "../ErrorBoard/ErrorBox";

function DeleteConfirmationModal({ action, setShowDelete, bodyText, funcDelete }) {

    const [error, setError] = useState(null);
    const [fetching, setFetching] = useState(false);

    const onClose = () => {
        setShowDelete(null);
        setError(null)
    };

    const handleDelete = async () => {
        setFetching(true);
        const result =  await funcDelete(action)
        setFetching(false);
        if ( !result.error ) {
            onClose();
        } else {
            setError(result.error);
        }
    };

    return (
        <Dialog
            open={!!action}
            onClose={() => onClose()}
            scroll="body"
        >
            <DialogTitle
//                sx={{backgroundColor: 'rgba(0, 0, 0, 0.1)'}}
            >
                Confirm Deletion
                <IconButton
                    aria-label="close"
                    onClick={onClose}
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
                {bodyText}
            </DialogContent>
            {error &&
                <DialogContent sx={{py: 1}}>
                    <ErrorBox error={error} />
                </DialogContent>
            }
            <DialogActions>
                <Button
                    variant="contained"
                    onClick={onClose}
                >
                    Cancel
                </Button>
                <Button
                    color="error"
                    loading={fetching}
                    onClick={handleDelete}
                    variant="contained"
                >
                    Delete
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default DeleteConfirmationModal;