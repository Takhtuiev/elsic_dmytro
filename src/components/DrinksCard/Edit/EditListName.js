import Grid from "@mui/material/Grid";
import MyTextField from "../../MyComponent/MyTextField";
import {Button, Tooltip} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import SaveIcon from "@mui/icons-material/Save";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import React, {useState, useEffect} from "react";
import {useUpdateLoadEditListsMutation} from "../../../services/Slice/drinksApi";
import {openDialog} from "../../../services/Slice/dialogSlice";
import {useDispatch} from "react-redux";
import {filterDrinksErrorKey} from "../../ErrorBoard/Utils/FilterDrinksErrorKey";
import {DRINKS_COLUMNS} from "../../../CONSTANTS/Constants";

function EditListName({ editedField, selectedItem, setSelectedItem, funcCancel }) {

    const dispatch = useDispatch();

    const [updateList, { isLoading: updating, error: errorUpdateList}] = useUpdateLoadEditListsMutation();

    const [editedItem, setEditedItem] = useState(selectedItem);

    const [error, setError] = useState(null);

    useEffect(() => {
        if (!selectedItem) {
            setEditedItem(null)
        }
        setError(null);

        setEditedItem(selectedItem)
    }, [selectedItem]);

    const saveItem = async (altValue, newValue) => {

        setSelectedItem(null);

        const result = await updateList({ key: editedField, newItem: newValue, altItem: altValue });

        console.log(result)
        if (!result.error) {
            if (error) {
                setError(null);
            }
            setSelectedItem(newValue)
            if (funcCancel) funcCancel();

        } else {
            setError(filterDrinksErrorKey(altValue, result.error.data));
        }

    };

    const deleteItem = async (obj) => {
        dispatch(
            openDialog({
                title: `Delete ${obj.name}`,
                maxWidth: "md",
                componentKey: "DeleteConfirm",  // ключ твоего компонента в AppDialog.componentMap
                props: {
                    entityType: "ItemList",
                    entityIdentifier: obj,
                    bodyText: `Are you sure you want to delete "${obj.name}"?`,
                },
            })
        );
    };

    return (
        <Grid container direction="column" alignItems="flex-end" spacing={1}>
            <Grid size={12} sx={{ width: "100%" }}>
                <MyTextField
                    obj={{
                        key: 'name',
                        field: editedField,
                        value: editedItem,
                        label: DRINKS_COLUMNS.name,
                        error: errorUpdateList?.data.name,
                    }}
                    multiline={true}
                    setValue={setEditedItem}
                    sx={{ width: "100%" }}
                />
            </Grid>

            {error &&
                <Grid >
                    <ErrorBox error={error} />
                </Grid>
            }


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
                                disabled={updating}
                                color="error"
                                variant="outlined"
                                onClick={() => deleteItem({key: editedField, name: editedItem })}
                            >
                                Delete <DeleteForeverIcon fontSize="small"/>
                            </Button>
                        </Tooltip>
                    </Grid>
                }

                <Grid>
                    <Tooltip title="Save">
                        <Button
                            disabled={updating}
                            variant="contained"
                            onClick={() => saveItem(selectedItem, editedItem)}
                        >
                            Save <SaveIcon fontSize="small" />
                        </Button>
                    </Tooltip>
                </Grid>
            </Grid>

     </Grid>

    )
}

export default EditListName
