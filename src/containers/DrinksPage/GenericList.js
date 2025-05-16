import React, { Suspense, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Button, Pagination } from "@mui/material";
import Grid from "@mui/material/Grid2";
import AddIcon from "@mui/icons-material/Add";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import FiltersSortViewBar from "../../components/Filter/FiltersSortViewBar";
import FiltersAccordion from "../../components/Filter/FiltersAccordion";
import WithRoleContent from "../../components/MyComponent/WithRoleContent";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import MyDialog from "../../components/MyComponent/MyDialog";
import DeleteConfirmationModal from "../../components/ModalWindow/DeleteConfirmationModal";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import NotFound from "../NotFoundPage/NotFound";
import { updateSearchParams } from "../../components/Filter/utils";
import CardVariantDrinkSkeleton from "../../components/DrinksCard/CardVariantDrinkSkeleton";

function GenericList({
                         useGetPage,
                         useGetLists,
                         useDeleteMutation,
                         HEAD_PARAMS,
                         FILTER_PARAMS,
                         TEXT_COLUMNS,
                         SORT_LIST,
                         CardComponent,
                         CardLineComponent,
                         EditCard
                     }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const params = Object.fromEntries(searchParams.entries());

    const getPage = useGetPage({ params });
    const getLists = useGetLists({ params });
    const [deleteItem, { error: errorDeletingVariant }] = useDeleteMutation();

    const [viewMode, setViewModeState] = useState(localStorage.getItem("viewMode") || "module");
    const [action, setAction] = useState(null);

    const setViewMode = (mode) => {
        setViewModeState(mode);
        mode === "module"
            ? localStorage.removeItem("viewMode")
            : localStorage.setItem("viewMode", mode);
    };

    const updateParams = (updatedKey, newValue) => {
        updateSearchParams(params, updatedKey, newValue, setSearchParams, HEAD_PARAMS, FILTER_PARAMS);
    };

    const handlePageChange = (event, newPage) => {
        const currentPage = Number(getPage.data?.number + 1) || 1; // текущая страница (начинается с 1)

        // Условие: не на первой и переход не на первую
        if ( !(currentPage === 1 && newPage === 1) ) {
            updateParams("page", newPage);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const funcDelete = async (action) => {
        const result = await deleteItem(action.itemId);
        return errorDeletingVariant ? { error: errorDeletingVariant } : result;
    };

    const refProduct = useMemo(() => {
        const map = {};
        getPage.data?.content?.forEach((item, index) => {
            if (typeof item.product === "object" && item.product?.id !== undefined) {
                map[item.product.id] = index;
            }
        });
        return map;
    }, [getPage.data]);

    if (getPage.error || getLists.error) {
        return <ErrorCard error={getPage.error || getLists.error} />;
    }

    const renderCard = (item, index) => {
        const resolvedItem = !item.product || typeof item.product === "object"
            ? item
            : {
                ...item,
                product: getPage.data.content[refProduct[item.product]].product,
            };

        return viewMode === "module" ? (
            <Grid key={resolvedItem.id} size={{xs:6, sm:4, md:4, lg:3 }}>
                <CardComponent item={resolvedItem} setAction={setAction} />
            </Grid>
        ) : (
            <Grid key={resolvedItem.id} size={12}>
                <CardLineComponent item={resolvedItem} setAction={setAction} />
            </Grid>
        );
    };

    return (
        <>
            <TopLinearLoading active={getPage.isFetching || getLists.isFetching} />

            <Box width="100%" display="flex" flexDirection="column" p={1}>
                <FiltersSortViewBar
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    TEXT_COLUMNS={TEXT_COLUMNS}
                    updateParams={updateParams}
                    selectLists={getLists.data}
                    sortList={SORT_LIST}
                    view={viewMode}
                    setView={setViewMode}
                    countProducts={getPage.data?.totalElements}
                />

                <Box display="flex" flexDirection="row" gap={1}>
                    {/* Filter panel for larger screens */}
                    <Box
                        sx={{
                            display: { xs: "none", md: "block" },
                            minWidth: "20%",
                            maxWidth: "30%",
                        }}
                    >
                        <FiltersAccordion
                            params={params}
                            FILTER_PARAMS={FILTER_PARAMS}
                            TEXT_COLUMNS={TEXT_COLUMNS}
                            updateParams={updateParams}
                            selectLists={getLists.data}
                            countProducts={getPage.data?.totalElements}
                        />
                    </Box>

                    <Grid container spacing={1} justifyContent="center" width="100%" height="100%">
                        {getPage.isFetching
                            ? Array.from({ length: 12 }).map((_, index) =>
                                <Grid key={index} size={{xs:6, sm:4, md:4, lg:3 }}>
                                    <CardVariantDrinkSkeleton/>
                                </Grid>
                            )
                            : getPage.data?.content.length > 0
                                ? getPage.data.content.map(renderCard)
                                : (
                                    <NotFound
                                        message="За заданими параметрами не знайдено..."
                                        sx={{ borderColor: "action.disabled", color: "action.disabled" }}
                                    />
                                )}

                        <Grid size={12}>
                            <WithRoleContent allowedRoles={["PRODUCT_EDIT"]}>
                                <Box display="flex" justifyContent="flex-end" mb={1}>
                                    <Button
                                        variant="contained"
                                        onClick={() => setAction({ action: "createNew", itemId: "0" })}
                                        size="small"
                                    >
                                        <AddIcon style={{ fontSize: "1.5rem" }} /> Create new
                                    </Button>
                                </Box>
                            </WithRoleContent>

                            <Box display="flex" justifyContent="center">
                                <Pagination
                                    count={Number(getPage.data?.totalPages) || 0}
                                    page={Number(getPage.data?.number + 1) || 1}
                                    siblingCount={2}
                                    onChange={handlePageChange}
                                    color="primary"
                                    variant="outlined"
                                    shape="rounded"
                                    sx={{
                                        "& .MuiPaginationItem-root": {
                                            backgroundColor: (theme) => theme.palette.background.paper,
                                        },
                                    }}
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
            </Box>

            {["info", "edit", "copy", "delete", "createNew"].includes(action?.action) && (
                <Suspense fallback={<LoadingSpinner />}>
                    {["createNew", "edit", "copy"].includes(action?.action) && (
                        <MyDialog open={!!action} onClose={() => setAction(null)} title="Edit">
                            <EditCard action={action} funcCancel={() => setAction(null)} />
                        </MyDialog>
                    )}
                    {action?.action === "delete" && (
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
    );
}

export default GenericList;
