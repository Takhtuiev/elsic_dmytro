import {useSearchParams} from "react-router-dom";
import React, {Suspense, useState} from "react";
import {updateSearchParams} from "../../components/Filter/utils";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import {Box} from "@mui/system";
import FiltersSortViewBar from "../../components/Filter/FiltersSortViewBar";
import FiltersAccordion from "../../components/Filter/FiltersAccordion";
import Grid from "@mui/material/Grid2";
import CardVariantDrinks from "../../components/DrinksCard/CardVatiantDrinks";
import CardLineVariantDrink from "../../components/DrinksCard/CardLineVatiantDrinks";
import NotFound from "../NotFoundPage/NotFound";
import WithRoleContent from "../../components/MyComponent/WithRoleContent";
import {Button, Pagination} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import MyDialog from "../../components/MyComponent/MyDialog";
import DeleteConfirmationModal from "../../components/ModalWindow/DeleteConfirmationModal";
import EditBigCardDrinks from "../../components/DrinksCard/Edit/EditBigCardDrinks";


function GenericList({ getPage, getLists, useDeleteMutation, HEAD_PARAMS, FILTER_PARAMS, SORT_LIST }) {

    const [searchParams, setSearchParams] = useSearchParams();
    const params = Object.fromEntries(searchParams.entries()); // Преобразование searchParams в объект

    //const { data: pageProducts, error: errorGetPage, isFetching: isFetchingPageProducts  } = useGetPageQuery( { params: params } );
    //const { data: selectLists, error: errorLoadEditList, isFetching: isFetchingLoadEditList } = useGetListsQuery({ params: params });
    const [deleteItem, { error: errorDeletingVariant }] = useDeleteMutation();

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
        const result = await deleteItem(action.itemId);
        return errorDeletingVariant ? {error: errorDeletingVariant} : result;
    };

    if (getPage.error || getLists.error) {
        return (
            <ErrorCard error={getPage.error || getLists.error}/>
        )
    }

    return (
        <>
            <TopLinearLoading active={getPage.isFetching || getLists.isFetching}/>

            <Box width={"100%"} display={'flex'} flexDirection={'column'} p={1}>
                <FiltersSortViewBar
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    updateParams={updateParams}
                    selectLists={getLists.data}
                    sortList={SORT_LIST}
                    view={viewMode}
                    setView={setViewMode}
                    countProducts={getPage.data?.totalElements}
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
                            selectLists={getLists.data}
                            countProducts={getPage.data?.totalElements}
                        />
                    </Box>

                    <Grid container spacing={1} justifyContent={'center'} height={'100%'} width={'100%'}>
                        {
                            (getPage.isFetching || getPage.data?.content?.length > 0) ?
                                (
                                    getPage.data?.content?.map((item, index) => {

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
                                                            { ...item, product: getPage.data.content[refProduct[item.product]].product }}
                                                        setAction={setAction}
                                                    />
                                                </Grid>
                                            ) : (
                                                <Grid key={index} size={12}>
                                                    <CardLineVariantDrink
                                                        variant={typeof item.product === 'object' ?
                                                            item :
                                                            { ...item, product: getPage.data.content[refProduct[item.product]].product }}
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

                            { getPage.data?.totalPages > 1 &&
                                <Grid container justifyContent="center">
                                    <Pagination     // Пагинация страници...
                                        count={Number(getPage.data?.totalPages) || 0}
                                        page={Number(getPage.data?.number + 1) || 1}
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

export default GenericList;
