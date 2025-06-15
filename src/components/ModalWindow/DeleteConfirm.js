import { useDispatch} from 'react-redux';

import { DialogContent, DialogActions } from '@mui/material';
import Button from '@mui/material/Button';
import {closeDialog, dialogDataReturned} from "../../services/Slice/dialogSlice";
import React, {useState} from "react";
import {useDeleteDrinksMutation, useDeleteItemListMutation} from "../../services/Slice/drinksApi";
import {useDeleteUserMutation} from "../../services/Slice/userApi";
import ErrorBox from "../ErrorBoard/ErrorBox";


// Карта действий
const actionsMap = {
    drink: useDeleteDrinksMutation,
    user: useDeleteUserMutation,

    brand: useDeleteItemListMutation,
    country: useDeleteItemListMutation,
    productType: useDeleteItemListMutation,
    packagingType: useDeleteItemListMutation,

};


function DeleteConfirm({ entityType, entityIdentifier, bodyText }) {

    const dispatch = useDispatch();

    const [fetching, setFetching] = useState(false);

    if (!actionsMap[entityType]) {
        throw new Error(`No delete mutation hook defined for entity: ${entityType}`);
    }

    const [deleteItem, { error: errorDeleting }] = actionsMap[entityType]();

    const onClose = () => {
        dispatch(closeDialog());
    }

    const handleDelete = async () => {
        setFetching(true);
        const result = await deleteItem({key: entityType, name: entityIdentifier})

         if ( !result.error ) {
            dispatch(dialogDataReturned({
                dialogType: 'DeleteConfirm',
                data: true,
            }));

            onClose()
        }

        setFetching(false);
    };

    return (
        <>
            <DialogContent>
                {bodyText}
            </DialogContent>

            {errorDeleting &&
                <DialogContent sx={{py: 1}}>
                    <ErrorBox error={errorDeleting} />
                </DialogContent>
            }

            <DialogActions>
                <Button
                    variant="contained"
                    loading={fetching}
                    onClick={() => onClose()}
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

export default DeleteConfirm;
