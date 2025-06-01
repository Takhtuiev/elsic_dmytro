import {Button, Typography} from "@mui/material";
import React, {useEffect, useState, Suspense} from "react";
import {useDeleteBrandMutation, useGetBrandQuery, useUpdateBrandMutation} from "../../../services/api/drinksApi";
import MyTextField from "../../MyComponent/MyTextField";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import LoadingSpinner from "../../MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import SaveIcon from "@mui/icons-material/Save";
import {DRINKS_COLUMNS} from "../../../CONSTANTS/Constants";
import {filterDrinksErrorKey} from "../../ErrorBoard/Utils/FilterDrinksErrorKey";
import Grid from '@mui/material/Grid2';
import ImageUpload from "../../MyComponent/Image/ImageUpload";
import {uploadBlobFile} from "../../../services/Utils/Utils";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import DeleteConfirmationModal from "../../ModalWindow/DeleteConfirmationModal";


function EditBrandCard({ selectedBrandName, setSelectedItem, funcCancel }) {

    const { data: brand, error: errorGetProduct, isFetching: loading, reset: resetBrand } = useGetBrandQuery( { name: selectedBrandName}, { skip: !selectedBrandName } );

    const [updateBrand, { error: errorUpdate, isLoading: updating, reset: resetUpdateBrand }] = useUpdateBrandMutation();
    const [deleteBrand, {   error: errorDeleting, isLoading: deleting }] = useDeleteBrandMutation();

    const [editedItem, setEditedItem] = useState(brand);

    const [showDelete, setShowDelete] = useState(null);

    const [error, setError] = useState(null);


    useEffect(() => {
        setEditedItem(brand)
    }, [brand]);

    useEffect(() => {
        if (!selectedBrandName) {
            setEditedItem(null)
        }
        setError(null);
        resetUpdateBrand();
    }, [selectedBrandName]);

    // Сохранение изменений
    const saveItem = async () => {
        let result;
        if (editedItem.imageUrl && editedItem.imageUrl.startsWith('blob:')) {
            try {
                const file = await uploadBlobFile(editedItem.imageUrl, `brand_img`);
                if (file) {
                    //imageFiles.push(file);
                    editedItem.imageUrl = file.name;  // Меняем imageUrl после загрузки
                }

                result = await updateBrand({newBrand: editedItem, altName: brand?.name, image: file});
            } catch (error) {
                console.error("Ошибка загрузки изображения для ", editedItem.name, error);
            }
        } else {
            result = await updateBrand({newBrand: editedItem, altName: brand?.name});
        }

        if (!result.error) {
            setError(null)
            setSelectedItem(editedItem.name)
            if (funcCancel) {
                funcCancel();
            }
        } else {
            setError(filterDrinksErrorKey(brand, result.error.data))
        }
    }

    const deleteItem = async (name) => {
        const result = await deleteBrand(name);

        if (!result.error) {
            setSelectedItem(null);
            setError(null);
        }

        return result
    };

    // Функция изменяет editedItem, если в элементах ввода произошли изменения
    const setNewValue = (value, key ) => {
        setEditedItem(prevState => {
                // Обновляем значение в editedItem
                return { ...prevState, [key]: value };
        });
    };

    const TimeStampToString = (timestamp) => {
        return new Date(timestamp).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });
    };

    const createObj = (name) => {
        return {
            key: name,
            field: 'brand',
            value: editedItem && editedItem[name],
            label: DRINKS_COLUMNS[name]?.text,
            error: errorUpdate?.data[ name ],
        };
    }

    return (
        <LoadingSpinner active={loading }>
            <Grid container size={12} direction="column" spacing={2}>
                <Grid>
                    <MyTextField
                        obj={createObj('name')}
                        setValue={setNewValue}
                        sx={{mt:2, width: '100%'}}
                        sxInput={{fontSize: '1.5rem'}}
                        multiline={true}
                    />
                    {editedItem && editedItem.lastUpdated && (
                        <Typography variant="body2">
                            останнє оновлення {TimeStampToString(editedItem.lastUpdated)}
                        </Typography>
                    )}
                </Grid>
                <Grid container size={12} spacing={2}>

                    <Grid  >
                        <ImageUpload
                            obj={createObj('imageUrl')}
                            setValue={setNewValue}
                            lastUpdated={brand?.lastUpdated}
                        />
                    </Grid>
                    <Grid size={12}>
                        <MyTextField
                            obj={createObj('description')}
                            setValue={setNewValue}
                            sx={{width: '100%'}}
                            sxInput={{fontSize: '0.9rem'}}
                            multiline={true}
                        />
                    </Grid>
                </Grid>

                {error &&
                    <Grid >
                        <ErrorBox error={error || errorGetProduct} />
                    </Grid>
                }

                <Grid  container spacing={1}>

                    <Grid size={'grow'}>
                        <Button
                            loading={updating}
                            onClick={() => {setEditedItem(brand)}}
                            variant="outlined"
                        >
                            Reset
                        </Button>
                    </Grid>

                    <Grid >
                        {selectedBrandName &&
                            <Button
                                disabled={updating || deleting}
                                color="error"
                                variant="outlined"
                                onClick={() => setShowDelete(brand.name)}
                                sx={{ mr: 1 }}
                            >
                                Delete <DeleteForeverIcon fontSize="small"/>
                            </Button>
                        }
                        <Button
                            loading={updating || deleting}
                            onClick={() => saveItem()}
                            variant="contained"
                        >
                            <SaveIcon sx={{marginRight: '1rem'}}/>
                            Save
                        </Button>
                    </Grid>
                </Grid>
            </Grid>
            {
//                JSON.stringify(editedItem)
            }

            {showDelete && (
                <Suspense fallback={<LoadingSpinner />}>
                    <DeleteConfirmationModal
                        action={showDelete}
                        setShowDelete={setShowDelete}
                        bodyText={`Are you sure you want to delete ${showDelete}?`}
                        funcDelete={() => deleteItem(showDelete)}
                    />
                </Suspense>
            )}
        </LoadingSpinner>
    );
}

export default EditBrandCard;