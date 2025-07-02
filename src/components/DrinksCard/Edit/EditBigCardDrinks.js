import {alpha, Button, Collapse, Typography} from "@mui/material";
import React, {useEffect, useState} from "react";
import {useGetDrinksQuery, useGetLoadEditListsQuery, useUpdateDrinksMutation} from "../../../services/Slice/drinksApi";
import MyTextField from "../../MyComponent/MyTextField";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import LoadingSpinner from "../../MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import SaveIcon from "@mui/icons-material/Save";
import {DRINKS_COLUMNS} from "../../../CONSTANTS/Constants";
import MyRating from "../../MyComponent/MyRating";
import MySelect from "../../MyComponent/MySelect";
import EditVariantContent from "./EditVariantContent";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MenuItem from "@mui/material/MenuItem";
import Grid from '@mui/material/Grid';
import {uploadBlobFile} from "../../../services/Utils/BlobFileUtils";
import {openDialog, updateDialogProps} from "../../../services/Slice/dialogSlice";
import {useDispatch, useSelector} from "react-redux";
import {filterItemErrorKey} from "../../ErrorBoard/Utils/FilterDrinksErrorKey";

function EditBigCardDrinks({ itemId, selectVariantId, mode, onClose}) {

    const { data: product, error: errorGetProduct, isLoading: loadingProduct} = useGetDrinksQuery( { id: itemId} );
    const { data: loadEditLists, error: errorLoadEditList, isLoading: loadingEditList} = useGetLoadEditListsQuery({});
    const [updateDrink, { error: errorUpdate, isLoading: updating}] = useUpdateDrinksMutation();

    const dispatch = useDispatch();
    const dialogStack = useSelector((state) => state.dialog.stack);

    // Получаем lastReturnedData из Redux
    const lastReturnedData = useSelector(state => state.dialog.lastReturnedData);

    const createCopy = (product) => {
        if (product) {
            return {
                ...product,
                id: null,
                lastUpdated: null,
                variants: product.variants.map(variant => ({
                    ...variant,
                    id: null,
                    imageUrl: null
                }))
            };
        } else {
            return null
        }
    }

    const [editedItem, setEditedItem] = useState();
    const [allVariant, setAllVariant] = useState(mode !== 'editVariant');

    const findIndexVariant = (variantId) => {
        if (product?.variants?.length === 1 || mode === 'copy' || mode === 'createNew') return 0;
        return  product?.variants?.findIndex(variant => variant.id === variantId);
    }
    const [indexActiveVariant, setIndexActiveVariant] = useState()

    const [error, setError] = useState(null);

    const resetFunc = () => {
        setEditedItem(mode === 'copy' ? createCopy(product) : product);
        setIndexActiveVariant(findIndexVariant(selectVariantId));
        if (error) {
            setError(null);
        }
    }

    useEffect(() => {    // Перезагрузка при изменении product
        resetFunc();
    }, [product]);

    useEffect(() => {
        if (!lastReturnedData) return;

         if (lastReturnedData.dialogType === 'EditList') {
            if (lastReturnedData.data) {
                const { field, newValue, index } = lastReturnedData.data;
                setNewValue(newValue, field, index)
            }
        }
    }, [lastReturnedData, dispatch]);

    //Обновление пропсов верхнего диалога
    useEffect(() => {
        const targetKey = "EditList"; // componentKey нужного диалога
        const index = dialogStack.findIndex(d => d.componentKey === targetKey);
        if (index !== -1) {
            const field = dialogStack[index]?.props?.editedObj?.field;

            if (field && loadEditLists[field]) {
                dispatch(updateDialogProps({
                    index: index,
                    newProps: { listItem: loadEditLists[field] },
                }));
            }
        }
    }, [loadEditLists]);

    // Добавляет новый вариант с пустыми полями
    const addNewVariant = () => {
        setEditedItem(prevState => {
            // Создаем новый вариант на основе первого варианта
            const newVariant = { ...prevState.variants[0] };
            // Обнуляем значения всех свойств нового варианта
            Object.keys(newVariant).forEach(key => {
                if( key === 'id' ) {
                    newVariant['id'] = null
                } else {
                    newVariant[key] = typeof newVariant[key] === 'number' ? 0 : ''; // Обнуляем числовые свойства или присваиваем пустую строку
                }
            });
            // Добавляем новый вариант к списку вариантов в editedItem
            return { ...prevState, variants: [...prevState.variants, newVariant] };
        });
    }


    // Сохранение изменений
    const saveItem = async () => {

        // Массив файлов изображений
        const imageFiles = [];

        // Перебираем все варианты
        await Promise.all(editedItem.variants.map(async (variant, index) => {
            if (variant.imageUrl && variant.imageUrl.startsWith('blob:')) {
                try {
                    // Загрузить изображение и добавить его в массив файлов
                    const file = await uploadBlobFile(variant.imageUrl, `variant_${index}`);
                    if (file) {
                        imageFiles.push(file);
                        variant.imageUrl = file.name;  // Меняем imageUrl после загрузки
                    }
                } catch (error) {
                    console.error("Ошибка загрузки изображения для варианта", index, error);
                }
            }
            return variant;  // Возвращаем обновленный вариант
        }));

        const result = await updateDrink({newDrinkItem: editedItem, images: imageFiles});

        if (!result.error) {
            setError(null)
            onClose()
        } else {
            setError(filterItemErrorKey(product, result.error.data))
        }
    }

    // Функция изменяет editedItem, если в элементах ввода произошли изменения
    const setNewValue = (value, field, index, action) => {

        if(action === "EditList") {
            dispatch(
                openDialog({
                    title: `Edit ${field} list`,
                    maxWidth: "md",
                    componentKey: action,  // ключ твоего компонента в AppDialog.componentMap
                    props: {
                        editedObj: { field: field, selected: value, index: index },
                        listItem: loadEditLists[field],
                    },
                })
            );
        } else {
            setEditedItem(prevState => {
                if (index === undefined) {
                    // Обновляем значение непосредственно в editedItem
                    return { ...prevState, [field]: value };
                } else {
                    // Обработка варианта. Возвращаем обновленное состояние с измененным массивом вариантов
                    if (field === null && value === null) {
                        if (index === indexActiveVariant) {
                            setIndexActiveVariant(-1);
                        } else if (index < indexActiveVariant) {
                            setIndexActiveVariant(prev => prev - 1);
                        }                }
                    return { ...prevState, variants: (field === null && value === null)
                            ? prevState.variants.filter((_, i) => i !== index) // Удаление варианта
                            : prevState.variants.map((variant, i) =>
                                i === index ? { ...variant, [field]: value } : variant // Обновление варианта
                            )
                    };
                }
            });
        }
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
            value: editedItem && editedItem[name],
            valueList: loadEditLists ? loadEditLists[name] : null,
            label: DRINKS_COLUMNS[name],
            error: errorUpdate?.data[ name ],
        };
    }

    if (errorGetProduct || errorLoadEditList ) {
        return (
            <Grid container spacing={2}>
                <Grid size={12}>
                    <ErrorBox error={errorGetProduct || errorLoadEditList || error}/>
                </Grid>
                {onClose &&
                    <Grid container size={12} justifyContent="flex-end">
                        <Button onClick={onClose} >
                            Cancel
                        </Button>
                    </Grid>
                }
            </Grid>
    )}

    return (
        <LoadingSpinner active={updating || editedItem===undefined || loadingProduct || loadingEditList}>
            <Grid
                container size={12}
                direction="column"
                spacing={2}
            >
                <Grid>
                    <MyTextField
                        obj={createObj('name')}
                        setValue={setNewValue}
                        sx={{mt:2, width: '100%'}}
                        sxInput={{fontSize: '1.5rem'}}
                        multiline={true}
                    />
                    {(mode === 'editDrink' || mode === 'editVariant') && (
                        <Typography variant="body2">
                            останнє оновлення {TimeStampToString(editedItem?.lastUpdated)}
                        </Typography>
                    )}
                </Grid>
                <Grid container size={12} spacing={2}>
                    <Grid  container size={{xs:12, sm:3}} spacing={2}>
                        <Grid  size={12}>
                            <MySelect
                                obj={createObj('brand')}
                                setValue={setNewValue}
                                sx={{width: '100%'}}
                                editable={true}
                            />
                        </Grid>
                        <Grid  size={12}>
                            <MySelect
                                obj={createObj('country')}
                                setValue={setNewValue}
                                sx={{width: '100%'}}
                                editable={true}
                            />
                        </Grid>
                        <Grid  size={12}>
                            <MySelect
                                obj={createObj('productType')}
                                setValue={setNewValue}
                                sx={{width: '100%'}}
                                editable={true}
                            />
                        </Grid>
                        <Grid  size={12}>
                            <MyRating
                                obj={createObj('rating')}
                                setValue={setNewValue}
                                sx={{width: '100%'}}
                            />
                        </Grid>
                    </Grid>

                    <Grid  container size={{ xs:12, sm:9 }} spacing={2}>
                        <Grid size={12}>
                            <MyTextField
                                obj={createObj('description')}
                                setValue={setNewValue}
                                sx={{width: '100%'}}
                                sxInput={{fontSize: '0.9rem'}}
                                multiline={true}
                            />
                        </Grid>
                        <Grid size={12}>
                            <MyTextField
                                obj={createObj('specifications')}
                                setValue={setNewValue}
                                sx={{width: '100%'}}
                                sxInput={{fontSize: '0.9rem'}}
                                multiline={true}
                            />

                        </Grid>
                        <Grid size={12}>
                            <MyTextField
                                obj={createObj('alcohol')}
                                setValue={setNewValue}
                                sx={{width: '14rem'}}
                                type={'number'}
                            />
                        </Grid>
                        <Grid size={12}>
                            <MyTextField
                                obj={createObj('expirationDays')}
                                setValue={setNewValue}
                                sx={{width: '14rem'}}
                                sxInput={{fontSize: '0.9rem'}}
                                type={'number'}
                            />
                        </Grid>
                    </Grid>
                </Grid>

                <Grid >
                    {indexActiveVariant >= 0 &&
                        <MenuItem
                            onClick={() => setAllVariant(!allVariant)}
                            sx={{
                                justifyContent: 'space-between',
                                color: 'primary.main',
                            }}
                        >
                            <Typography variant="body2">
                                {allVariant ? 'Приховати інші варіанти' : `Показати усі варіанти: (${editedItem?.variants.length} шт.)`}
                            </Typography>

                            <ExpandMoreIcon
                                style={{
                                    transition: 'transform 0.8s ease',
                                    transform: allVariant ? 'rotate(180deg)' : 'rotate(0)',
                                }}
                            />
                        </MenuItem>
                    }
                    {indexActiveVariant >= 0 && (
                        <>
                            <Collapse in={allVariant} timeout={800} >
                                {editedItem?.variants.slice(0, indexActiveVariant).map((variant, index) => (
                                    <EditVariantContent key={index}
                                                        index={index}
                                                        variant={variant}
                                                        loadEditLists={loadEditLists}
                                                        lastUpdated={editedItem?.lastUpdated}
                                                        setNewValue={setNewValue}
                                                        errorData={errorUpdate?.data}
                                                        isDeletable={editedItem?.variants.length > 1}
                                    />
                                ))}
                            </Collapse>

                            <EditVariantContent index={indexActiveVariant}
                                                variant={editedItem?.variants[indexActiveVariant]}
                                                loadEditLists={loadEditLists}
                                                lastUpdated={editedItem?.lastUpdated}
                                                setNewValue={setNewValue}
                                                errorData={errorUpdate?.data}
                                                isDeletable={editedItem?.variants.length > 1}
                                                sx={(theme) => ({
                                                    borderLeft: `2px solid ${alpha(theme.palette.primary.main, 0.8)}`,
                                                    borderRight: `2px solid ${alpha(theme.palette.primary.main, 0.8)}`,
                                                    borderRadius: '0.5rem',
                                                })}
                            />
                        </>
                    )}
                    <Collapse in={allVariant} timeout={800}>
                        {editedItem?.variants.slice(indexActiveVariant+1).map((variant, index) => (
                            <EditVariantContent key={index}
                                                index={indexActiveVariant+1+index}
                                                variant={variant}
                                                loadEditLists={loadEditLists}
                                                lastUpdated={editedItem?.lastUpdated}
                                                setNewValue={setNewValue}
                                                errorData={errorUpdate?.data}
                                                isDeletable={editedItem?.variants.length > 1}
                            />
                        ))}

                        <Button
                            onClick={() => addNewVariant()}
                            variant="outlined"
                        >
                            Add new Variant
                        </Button>
                    </Collapse>
                </Grid>

                {error &&
                    <Grid >
                        <ErrorBox error={error} />
                    </Grid>
                }

                <Grid container justifyContent="flex-end" spacing={1}>
                    <Grid  size={'grow'}>
                        <Button
                            loading={updating}
                            onClick={() => {resetFunc()}}
                            variant="outlined"
                        >
                            Reset
                        </Button>
                    </Grid>
                    {onClose &&
                        <Grid >
                            <Button
                                variant="outlined"
                                onClick={()=>onClose()}
                            >
                                Cancel
                            </Button>
                        </Grid>
                    }
                    <Grid >
                        <Button
                            loading={updating}
                            onClick={() => saveItem()}
                            variant="contained"
                        >
                            <SaveIcon sx={{marginRight: '1rem'}}/>Save
                        </Button>
                    </Grid>
                </Grid>
            </Grid>
        </LoadingSpinner>
    );
}

export default EditBigCardDrinks;