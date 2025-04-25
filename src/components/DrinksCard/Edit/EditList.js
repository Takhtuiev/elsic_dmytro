import {
    List,
    ListItemButton,
    ListItemText,
    Button
} from "@mui/material";
import React, {useState, useCallback} from "react";
import Grid from "@mui/material/Grid2";
import EditListName from "./EditListName";
import EditBrandCard from "../../BrandCard/Edit/EditBrandCard";

function EditList({ editedField, listItem, setDialogEditList }) {

    const [selectedItem, setSelectedItem] = useState('');

    const addNew = 'Add new ' + editedField;

    const handleClose = useCallback(() => {
        setDialogEditList(null);
    }, [setDialogEditList]);

    const handleSelectItem = useCallback((item) => {
        setSelectedItem(item);
    }, []);

    if (!editedField) {
        return null;
    }

    return (
        <Grid container spacing={1} py={1} direction={'row'} minHeight={'10rem'}>
            {/* Первый Grid - Список элементов */}
            <Grid
                sx={{
                    maxHeight: '80vh', // Ограничиваем высоту списка по высоте текста
                    overflowY: "auto", // Прокрутка, если список больше
                    minWidth: '20%',
                    maxWidth: '40%', // Ограничение по ширине
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: '4px',
                }}
            >
                <List sx={{ overflowY: 'auto', maxHeight: '100%' }}>
                    {["", ...listItem].map((item, index) => (
                        <ListItemButton
                            key={index}
                            selected={selectedItem === item}
                            onClick={() => handleSelectItem(item)}
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

            {/* Второй Grid - Формирует высоту */}
            <Grid container size={'grow'} direction="column" justifyContent={'space-between'}>
                <Grid >
                    {editedField === "brand" ? (
                        <EditBrandCard
                            selectedBrandName={selectedItem}
                            setSelectedItem={setSelectedItem}
                        />
                    ) : (
                        <EditListName
                            editedField={editedField}
                            selectedItem={selectedItem}
                            setSelectedItem={setSelectedItem}
                        />
                    )}
                </Grid>

                {/* Кнопка закрытия */}
                <Grid container justifyContent="flex-end">
                    <Button onClick={handleClose} variant="text">
                        Close dialog
                    </Button>
                </Grid>
            </Grid>
        </Grid>

    );
}

export default EditList;