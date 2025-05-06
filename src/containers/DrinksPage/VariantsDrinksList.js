import {
    Button,
    Pagination,
} from "@mui/material";
import Grid from '@mui/material/Grid2';
import {useSearchParams} from 'react-router-dom';
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import React, {useState, lazy, Suspense} from "react";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import AddIcon from "@mui/icons-material/Add";
import {
    useDeleteVariantDrinksMutation,
    useGetLoadEditListsQuery,
    useGetPageVariantsDrinksQuery
} from "../../services/api/drinksApi";
import WithRoleContent from "../../components/MyComponent/WithRoleContent";
import CardVariantDrinks from "../../components/DrinksCard/CardVatiantDrinks";
import CardLineVariantDrink from "../../components/DrinksCard/CardLineVatiantDrinks";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import FiltersSortViewBar from "../../components/Filter/FiltersSortViewBar";
import {updateSearchParams} from "../../components/Filter/utils";
import FiltersAccordion from "../../components/Filter/FiltersAccordion";
import {Box} from "@mui/system";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import NotFound from "../NotFoundPage/NotFound";

const MyDialog = lazy(() => import('../../components/MyComponent/MyDialog'))
const EditBigCardDrinks = lazy(() => import('../../components/DrinksCard/Edit/EditBigCardDrinks'))
const DeleteConfirmationModal = lazy(() => import('../../components/ModalWindow/DeleteConfirmationModal'))


const HEAD_PARAMS = {
    page: null,
    sort: null,
    order: null
};

const FILTER_PARAMS = {
    price: {type: 'slider'},
    brand: {type: 'checkbox'},
    country: {type: 'checkbox'},
    productType: {type: 'checkbox'},
    packagingType: {type: 'checkbox'}
};

const SORT_LIST = [
    DRINKS_COLUMNS.name.text,
    DRINKS_COLUMNS.brand.text,
    DRINKS_COLUMNS.country.text,
    DRINKS_COLUMNS.price.text
]

function VariantsDrinksList() {

    const [searchParams, setSearchParams] = useSearchParams();
    const params = Object.fromEntries(searchParams.entries()); // Преобразование searchParams в объект

    const { data: pageProducts, error: errorGetPage, isFetching: isFetchingPageProducts  } = useGetPageVariantsDrinksQuery( { params: params } );
    const { data: selectLists, error: errorLoadEditList, isFetching: isFetchingLoadEditList } = useGetLoadEditListsQuery({ params: params });
    const [deleteVariant, { error: errorDeletingVariant }] = useDeleteVariantDrinksMutation();

    const [action, setAction] = useState(null);

    const [viewMode, setViewModeState] = useState(localStorage.getItem("viewMode") || "module");


    const setViewMode = (mode) => {
        setViewModeState(mode)
        if (mode === 'module') {
            localStorage.removeItem("viewMode");
        } else {
            localStorage.setItem("viewMode", mode);
        }
    };

    // ключи - id продуктов, а значения - их индексы в массиве pageProducts.content
    const refProduct = {}

    const updateParams = (updatedKey, newValue) => {
        updateSearchParams(params, updatedKey, newValue, setSearchParams, HEAD_PARAMS, FILTER_PARAMS)
    };

    const funcDelete = async (action) => {
        const result = await deleteVariant(action.itemId);
        return errorDeletingVariant ? {error: errorDeletingVariant} : result;
    };

    if (errorGetPage || errorLoadEditList) {
        return (
            <ErrorCard error={errorGetPage || errorLoadEditList}/>
        )
    }

    return (
        <>
            <TopLinearLoading active={isFetchingPageProducts || isFetchingLoadEditList}/>

            <Box width={"100%"} display={'flex'} flexDirection={'column'} p={1}>
                <FiltersSortViewBar
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    updateParams={updateParams}
                    selectLists={selectLists}
                    sortList={SORT_LIST}
                    view={viewMode}
                    setView={setViewMode}
                    countProducts={pageProducts?.totalElements}
                />

                <Box display={'flex'} flexDirection={'row'} gap={1}>
                    {/* Панель фильтров для широких экранов */}
                    <Box
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            minWidth: '20%',
                            maxWidth: '30%',
                        }}
                    >
                        <FiltersAccordion
                            params={params}
                            FILTER_PARAMS={FILTER_PARAMS}
                            updateParams={updateParams}
                            selectLists={selectLists}
                            countProducts={pageProducts?.totalElements}
                        />
                    </Box>

                    <Grid container spacing={1} justifyContent={'center'} height={'100%'} width={'100%'}>
                        {
                            (isFetchingPageProducts || pageProducts?.content?.length > 0) ?
                                (
                                    pageProducts?.content?.map((item, index) => {

                                        if (typeof item.product === 'object') {
                                            refProduct[item.product.id] = index; // Заполняем refProduct во время перебора
                                        }

                                        return (
                                            viewMode === 'module' ? (
                                                <Grid
                                                    key={index}
                                                    size={{xs:6, sm:4, md:4, lg:3 }}
                                                >
                                                    <CardVariantDrinks
                                                        variant={typeof item.product === 'object' ?
                                                            item :
                                                            { ...item, product: pageProducts.content[refProduct[item.product]].product }}
                                                        setAction={setAction}
                                                    />
                                                </Grid>
                                            ) : (
                                                <Grid key={index} size={12}>
                                                    <CardLineVariantDrink
                                                        variant={typeof item.product === 'object' ?
                                                            item :
                                                            { ...item, product: pageProducts.content[refProduct[item.product]].product }}
                                                        setAction={setAction}
                                                    />
                                                </Grid>
                                            )
                                        );
                                    })
                                ) :
                                (<NotFound
                                    message="За заданими параметрами не знайдено жодного товару..."
                                    sx={{borderColor: 'action.disabled',color: 'action.disabled'}}
                                />)

                        }
                        <Grid size={12}>
                            <WithRoleContent allowedRoles={['PRODUCT_EDIT']}>
                                <Grid container justifyContent="flex-end">
                                    <Button variant="contained"
                                            onClick={() => {setAction({action: 'createNew', itemId: '0'})}}
                                            size="small"
                                    >
                                        <AddIcon style={{fontSize: '1.5rem'}}/> Create new
                                    </Button>
                                </Grid>
                            </WithRoleContent>

                            { pageProducts?.totalPages > 1 &&
                                <Grid container justifyContent="center">
                                    <Pagination     // Пагинация страници...
                                        count={Number(pageProducts?.totalPages) || 0}
                                        page={Number(pageProducts?.number + 1) || 1}
                                        siblingCount={2}
                                        onChange={(event, page) => updateParams('page', page)}
                                        color="primary"
                                        variant="outlined"
                                        shape="rounded"
                                        sx={{
                                            "& .MuiPaginationItem-root": { // Стиль для всех кнопок
                                                backgroundColor: theme => theme.palette.background.paper,
                                            }
                                        }}
                                    />
                                </Grid>
                            }
                        </Grid>
                    </Grid>
                </Box>
            </Box>

            {['info', 'edit', 'copy', 'delete', 'createNew'].includes(action?.action) && (
                <Suspense fallback={<LoadingSpinner/>}>
                    {['createNew', 'edit', 'copy'].includes(action?.action) && (
                        <MyDialog
                            open={!!action}
                            onClose={() => setAction(null)}
                            title={'Edit'}
                        >
                            <EditBigCardDrinks
                                action={action}
                                funcCancel={() => setAction(null)}
                            />
                        </MyDialog>
                    )}
                    {action?.action === 'delete' && (
                        <DeleteConfirmationModal
                            action={action}
                            setShowDelete={setAction}
                            bodyText={`Are you sure you want to delete "${action?.itemName}" with ID ${action?.itemId}?`}
                            funcDelete={funcDelete}
                        />
                    )}
                </Suspense>
            )}
        </>
    )
}

export default VariantsDrinksList;
