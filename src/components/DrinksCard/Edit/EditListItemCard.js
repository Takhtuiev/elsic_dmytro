import React, { useEffect, useState } from "react";
import {
    Button, Grid, Typography
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

import { useDispatch } from "react-redux";
import {
    useGetLoadEditListsByNameQuery,
    useUpdateLoadEditListsMutation
} from "../../../services/Slice/drinksApi";
import {
    closeDialog,
    dialogDataReturned, openDialog
} from "../../../services/Slice/dialogSlice";

import MyTextField from "../../MyComponent/MyTextField";
import ImageUpload from "../../MyComponent/Image/ImageUpload";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import LoadingSpinner from "../../MyComponent/LoadingSpinnerBoard/LoadingSpinner";

import { uploadBlobFile } from "../../../services/Utils/BlobFileUtils";
import { DRINKS_COLUMNS } from "../../../CONSTANTS/Constants";
import {filterItemErrorKey} from "../../ErrorBoard/Utils/FilterDrinksErrorKey";


function EditListItemCard({ field, selectedItemName, variantId, saveAndClose = false, deletable = true }) {
    const dispatch = useDispatch();

    const { data: item, error: errorGetItem, isFetching: loading } =
        useGetLoadEditListsByNameQuery({ field: field, name: selectedItemName });

    const [updateItem, { error: errorUpdate, isLoading: updating, reset: resetUpdaring }] =
        useUpdateLoadEditListsMutation();

    const [editedItem, setEditedItem] = useState();
    const [error, setError] = useState(null);

    useEffect(() => {
        if (error) setError(null);
        if (errorUpdate) resetUpdaring();
    }, [selectedItemName]);

    // Синхронизация состояния
    useEffect(() => {
        if (item) setEditedItem(item);
    }, [item]);

    useEffect(() => {
        setError(errorGetItem);
        if (errorGetItem) setEditedItem(null);
    }, [errorGetItem]);


    const setNewValue = (value, key) => {
        setEditedItem(prev => ({ ...prev, [key]: value }));
    };

    const reset = () => {
        setEditedItem(item);
        if (error) setError(null);
        if (errorUpdate) resetUpdaring();
    };

    const saveItem = async () => {
        if (!editedItem) return;
        let file = null;
        const newItem = { ...editedItem };

        if (newItem.imageUrl?.startsWith('blob:')) {
            try {
                file = await uploadBlobFile(newItem.imageUrl, `${field}_img`);
                if (file) newItem.imageUrl = file.name;
            } catch (err) {
                console.error("Image upload failed for:", newItem.name, err);
                return;
            }
        }

        try {
            const result = await updateItem({
                field,
                newItem,
                altName: selectedItemName,
                image: file
            });

            if (!result.error) {
                setError(null);

                // передача результата, если нужно
                dispatch(dialogDataReturned({
                    dialogType: 'EditListItemCard',
                    data: {
                        field: field,
                        newValue: newItem.name,
                        index: variantId,
                    },
                }));

                if (saveAndClose) {
                    // Закрытие диалога если нужно
                    dispatch(closeDialog());
                }
            } else {
                setError(filterItemErrorKey(item, result.error.data));
            }
        } catch (err) {
            console.error(`Update error for ${field}:`, err);
        }
    };

    const deleteItem = (name) => {
        dispatch(openDialog({
            title: `Delete ${name}`,
            maxWidth: "md",
            componentKey: "DeleteConfirm",
            props: {
                entityType: field,
                entityIdentifier: name,
                bodyText: `Are you sure you want to delete ${capitalize(field)} "${name}"?`,
            },
        }));
    };

    const createObj = (name) => ({
        key: name,
        field,
        value: editedItem?.[name],
        label: DRINKS_COLUMNS[name],
        error: errorUpdate?.data?.[name],
    });

    if (error && !editedItem) {
        return <ErrorBox error={error} />;
    }

    if (!editedItem) return null;

    return (
        <LoadingSpinner active={loading || updating}>
            <Grid container direction="column" spacing={2}>
                <Grid>
                    <MyTextField
                        obj={createObj('name')}
                        setValue={setNewValue}
                        sx={{ mt: 2, width: '100%' }}
                        sxInput={{ fontSize: '1.5rem' }}
                        multiline
                    />
                    {editedItem.lastUpdated && (
                        <Typography variant="body2">
                            останнє оновлення {formatTimestamp(editedItem.lastUpdated)}
                        </Typography>
                    )}
                </Grid>

                <Grid>
                    {'imageUrl' in editedItem && (
                        <Grid>
                            <ImageUpload
                                obj={createObj('imageUrl')}
                                setValue={setNewValue}
                                lastUpdated={item?.lastUpdated}
                            />
                        </Grid>
                    )}
                </Grid>
                <Grid>
                    {'description' in editedItem && (
                        <Grid xs={12}>
                            <MyTextField
                                obj={createObj('description')}
                                setValue={setNewValue}
                                sx={{ width: '100%' }}
                                sxInput={{ fontSize: '0.9rem' }}
                                multiline
                            />
                        </Grid>
                    )}
                </Grid>

                {error &&
                    <Grid>
                        <ErrorBox error={error} />
                    </Grid>
                }

                <Grid container spacing={1}>
                    <Grid>
                        <Button
                            disabled={loading || updating}
                            onClick={reset}
                            variant="outlined"
                        >
                            Reset
                        </Button>
                    </Grid>
                    <Grid>
                        {selectedItemName && (
                            <Button
                                disabled={loading || updating || !deletable}
                                color="error"
                                variant="outlined"
                                onClick={() => deleteItem(item?.name)}
                                sx={{ mr: 1 }}
                            >
                                Delete <DeleteForeverIcon fontSize="small" />
                            </Button>
                        )}
                        <Button
                            disabled={loading || updating}
                            onClick={saveItem}
                            variant="contained"
                        >
                            <SaveIcon sx={{ marginRight: '1rem' }} />
                            Save
                        </Button>
                    </Grid>
                </Grid>
            </Grid>
        </LoadingSpinner>
    );
}

// Вспомогательные функции
const formatTimestamp = (timestamp) =>
    new Date(timestamp).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

export default EditListItemCard;
