import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Pagination } from "@mui/material";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import FiltersSortViewBar from "../../components/Filter/FiltersSortViewBar";
import FiltersAccordion from "../../components/Filter/FiltersAccordion";
import WithRoleContent from "../../components/MyComponent/WithRoleContent";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import NotFound from "../NotFoundPage/NotFound";
import { updateSearchParams } from "../../components/Filter/utils";
import {openDialog} from "../../services/Slice/dialogSlice";
import {useDispatch} from "react-redux";

function GenericList({
                         useGetPage,
                         useGetLists,
                         useDeleteMutation,
                         HEAD_PARAMS,
                         FILTER_PARAMS,
                         TEXT_COLUMNS,
                         SORT_LIST,
                         CREATE_NEW_ROLE,
                         CardComponent,
                         CardLineComponent,
                         EditCard
                     }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const params = Object.fromEntries(searchParams.entries());

    const getPage = useGetPage({ params });
    const getLists = useGetLists({ params });

    const dispatch = useDispatch();

    const [viewMode, setViewModeState] = useState(localStorage.getItem("viewMode") || "module");

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
        if ( currentPage !== newPage ) {
            updateParams("page", newPage);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
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
        const resolvedItem = !item || !item.product || typeof item.product === "object"
            ? item
            : {
                ...item,
                product: getPage.data.content[refProduct[item.product]].product,
            };

        return viewMode === "module" ? (
            <Grid key={resolvedItem?.id || index} size={{xs:12, sm:4, md:4, lg:3 }}>
                <CardComponent item={resolvedItem}/>
            </Grid>
        ) : (
            <Grid key={resolvedItem?.id || index} size={12}>
                <CardLineComponent item={resolvedItem}/>
            </Grid>
        );
    };

    return (
        <>
            <TopLinearLoading active={getPage.isFetching || getLists.isFetching} />

            <Grid container size={12} direction={"column"} spacing={1} alignItems="center" p={1}>

                <FiltersSortViewBar
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    TEXT_COLUMNS={TEXT_COLUMNS}
                    updateParams={updateParams}
                    selectLists={getLists.data}
                    sortList={SORT_LIST}
                    minMaxPrice={getPage.data?.minMaxPrice}
                    view={viewMode}
                    setView={setViewMode}
                    countProducts={getPage.data?.totalElements}
                />

                <Grid container spacing={1} size={12}>
                    {/* Filter panel for larger screens */}
                    <Grid size={{ xs:0, md:2.5}}
                          sx={{
                              display: { xs: "none", md: "block" },
                              minWidth: "14rem",
                              maxWidth: "20%", // чтобы не разрасталась слишком сильно, по желанию
                              flexShrink: 0, // не уменьшалась
                          }}
                    >
                        <FiltersAccordion
                            params={params}
                            updateParams={updateParams}
                            FILTER_PARAMS={FILTER_PARAMS}
                            TEXT_COLUMNS={TEXT_COLUMNS}
                            selectLists={getLists.data}
                            minMaxPrice={getPage.data?.minMaxPrice}
                        />
                    </Grid>

                    <Grid container size={'grow'} spacing={1} justifyContent="center" height={"100%"} >
                        {getPage.isFetching
                            ? Array.from({ length: 12 }).map(renderCard)
                            : getPage.data?.content.length > 0
                                ? getPage.data.content.map(renderCard)
                                : (
                                    <NotFound
                                        message="За заданими параметрами не знайдено..."
                                        sx={{ borderColor: "action.disabled", color: "action.disabled" }}
                                    />
                                )}

                        <Grid size={12}>
                            <WithRoleContent allowedRoles={[CREATE_NEW_ROLE]}>
                                <Grid container justifyContent="flex-end" mb={1}>
                                    <Button
                                        variant="contained"
                                        onClick={() =>
                                            dispatch(
                                                openDialog({
                                                    title: "Create new Drink",
                                                    componentKey: "EditBigCardDrinks", // строка
                                                    props: {
                                                        itemId: 0,
                                                        mode: "createNew",
                                                   },
                                                })
                                            )}

                                     size="small"
                                    >
                                        <AddIcon style={{ fontSize: "1.5rem" }} /> Create new
                                    </Button>
                                </Grid>
                            </WithRoleContent>

                            <Grid container justifyContent="center">
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
                            </Grid>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>
        </>
    );
}

export default GenericList;
