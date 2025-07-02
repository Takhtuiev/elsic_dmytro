import React, {useState, useCallback, useEffect} from "react";
import {
    List, ListItemButton, ListItemText,
    Grid, Button
} from "@mui/material";
import {useDispatch, useSelector} from "react-redux";
import {clearDialogDataReturned, closeDialog, dialogDataReturned} from "../../../services/Slice/dialogSlice";
import EditListItemCard from "./EditListItemCard";

function EditList({ editedObj, listItem }) {
    const dispatch = useDispatch();
    // Получаем lastReturnedData из Redux
    const lastReturnedData = useSelector(state => state.dialog.lastReturnedData);

    const [selectedItem, setSelectedItem] = useState(editedObj.selected || '');

    const addNew = 'Add new ' + editedObj.field;

    // Закрытие диалога и передача результата, если нужно
    const onClose = (updatedObj) => {
        if (updatedObj) {
            dispatch(dialogDataReturned({
                dialogType: 'EditList',
                data: updatedObj,
            }));
        }
        dispatch(closeDialog());
    };

    useEffect(() => {
        if (!lastReturnedData) return;

        if (lastReturnedData.dialogType === 'EditListItemCard') {
            setSelectedItem(lastReturnedData.data.newValue)
            dispatch(clearDialogDataReturned());
        }

        if (lastReturnedData.dialogType === 'DeleteConfirm') {
            setSelectedItem(null)
            dispatch(clearDialogDataReturned());
        }

    }, [lastReturnedData, dispatch]);


    const updateSelectItem = useCallback((item) => {
            setSelectedItem(item);
    }, []);

    if (!editedObj.field) return null;

    return (
        <Grid container spacing={1} py={1} direction="row" minHeight="10rem">
            {/* Список */}
            <Grid
                sx={{
                    maxHeight: '80vh',
                    overflowY: "auto",
                    minWidth: '20%',
                    maxWidth: '40%',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '4px',
                }}
            >
                <List sx={{ overflowY: 'auto', maxHeight: '100%' }}>
                    {[null, ...listItem].map((item, index) => (
                        <ListItemButton
                            key={index}
                            selected={selectedItem ? selectedItem === item : index === 0}
                            onClick={() => updateSelectItem(item)}
                            sx={{
                                px: 1,
                                py: 0,
                                "& .MuiTypography-root": { fontSize: "0.8rem" },
                            }}
                        >
                            <ListItemText
                                sx={{
                                    color: item ? "inherit" : "text.disabled",
                                    fontStyle: item ? "normal" : "italic",
                                }}
                                primary={item || addNew}
                            />
                        </ListItemButton>
                    ))}
                </List>
            </Grid>

            {/* Правая часть */}
            <Grid container flex={1} direction="column" justifyContent="space-between">
                <Grid>
                    <EditListItemCard
                        field={editedObj.field}
                        selectedItemName={selectedItem}
                        variantId={editedObj.index}
                        saveAndClose={false}
                     />
                </Grid>

                {/* Кнопки */}
                <Grid container justifyContent="flex-end" spacing={1} mt={2}>
                    <Button onClick={() => onClose(null)} variant="text">
                        Close dialog
                    </Button>
                    <Button onClick={() => onClose({
                        field: editedObj.field,
                        newValue: selectedItem,
                        index: editedObj.index
                    })} variant="contained">
                        Select and close
                    </Button>
                </Grid>
            </Grid>
        </Grid>
    );
}

export default EditList;
