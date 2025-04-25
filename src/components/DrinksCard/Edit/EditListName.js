import Grid from "@mui/material/Grid2";
import MyTextField from "../../MyComponent/MyTextField";
import {DRINKS_COLUMNS} from "../../../CONSTANTS/Constants";
import {Button, Tooltip} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SaveIcon from "@mui/icons-material/Save";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import React, {lazy, Suspense, useState, useEffect} from "react";
import {useDeleteItemListMutation, useUpdateLoadEditListsMutation} from "../../../services/api/drinksApi";
import LoadingSpinner from "../../MyComponent/LoadingSpinnerBoard/LoadingSpinner";

const DeleteConfirmationModalUI = lazy(() => import("../../ModalWindow/DeleteConfirmationModal"));

function EditListName({ editedField, selectedItem, setSelectedItem }) {

    const [updateList, { isLoading: updating, error: errorUpdateList, reset: resetUpdateList }] = useUpdateLoadEditListsMutation();
    const [deleteList, { isLoading: deleting, error: errorDeleteList}] = useDeleteItemListMutation();

    const [editedItem, setEditedItem] = useState(selectedItem);
    const [showDelete, setShowDelete] = useState(null);

    const addNew = 'Add new ' + editedField

    useEffect(() => {
        setEditedItem(selectedItem)
        resetUpdateList()
    }, [selectedItem]);

    const saveItem = async (altValue, newValue) => {
        const result = await updateList({ key: editedField, newItem: newValue, altItem: altValue });

        console.log(result)
        if (!result.error) {
            setSelectedItem(newValue)
        }

    };

    const deleteItem = async (name) => {
        const result = await deleteList({ key: editedField, name: name });

        if (!result.error) {
            setSelectedItem(null);
        }

        return result
    };

    return (
        <Grid container direction="column" alignItems="flex-end" spacing={1}>
            <Grid size={12} sx={{ width: "100%" }}>
                <MyTextField
                    obj={{
                        key: 'name',
                        field: editedField,
                        value: editedItem,
                        label: selectedItem || addNew,
                        error: errorUpdateList?.data.name,
                    }}
                    multiline={true}
                    setValue={setEditedItem}
                    sx={{ width: "100%" }}
                />
            </Grid>

            {/* Кнопки Сохранить и Удалить */}
            <Grid size={12} container justifyContent="flex-end" spacing={1} >
                <Grid  size={'grow'}>
                    <Button
                        loading={updating}
                        onClick={() => {setEditedItem(selectedItem)}}
                        variant="outlined"
                    >
                        Reset
                    </Button>
                </Grid>
                {selectedItem &&
                    <Grid>
                        <Tooltip title="Delete">
                            <Button
                                disabled={updating || deleting}
                                color="error"
                                variant="outlined"
                                onClick={() => setShowDelete(selectedItem)}
                            >
                                Delete <DeleteForeverIcon fontSize="small"/>
                            </Button>
                        </Tooltip>
                    </Grid>
                }

                <Grid>
                    <Tooltip title="Save">
                        <Button
                            disabled={updating || deleting}
                            variant="contained"
                            onClick={() => saveItem(selectedItem, editedItem)}
                        >
                            Save <SaveIcon fontSize="small" />
                        </Button>
                    </Tooltip>
                </Grid>
            </Grid>

            <Grid size={12} sx={{ flexGrow: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {errorUpdateList && <ErrorBox error={errorUpdateList} />}
            </Grid>


            {showDelete && (
                <Suspense fallback={<LoadingSpinner />}>
                    <DeleteConfirmationModalUI
                        action={showDelete}
                        setShowDelete={setShowDelete}
                        bodyText={`Are you sure you want to delete ${showDelete}?`}
                        funcDelete={() => deleteItem(showDelete)}
                    />
                </Suspense>
            )}
        </Grid>

    )
}

export default EditListName
