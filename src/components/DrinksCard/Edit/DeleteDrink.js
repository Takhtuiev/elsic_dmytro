import React from "react";
import {Button, DialogActions, DialogContent, Typography} from "@mui/material";
import {useState} from "react";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import {useDeleteDrinksMutation} from "../../../services/Slice/drinksApi";

function DeleteDrink({ itemId, bodyText, onClose }) {

    const [fetching, setFetching] = useState(false);

    const [deleteItem, { error: errorDeleting }] = useDeleteDrinksMutation();

    const handleDelete = async () => {
        setFetching(true);
        await deleteItem(itemId)
        setFetching(false);

        if ( !errorDeleting ) {
            onClose();
        }
    };

    return (
        <>
            <Typography>
                {bodyText}
            </Typography>

            {errorDeleting &&
                <DialogContent sx={{py: 1}}>
                    <ErrorBox error={errorDeleting} />
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
        </>
    );
}

export default DeleteDrink;