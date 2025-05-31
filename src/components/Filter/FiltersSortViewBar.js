import React from 'react';
import {ToggleButton, ToggleButtonGroup, Typography, useTheme} from "@mui/material";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";
import TopStringFilter from "./TopStringFilter";
import SortBar from "./SortBar";
import FiltersDrawer from "./FiltersDrawer";
import Grid from "@mui/material/Grid2";

const FiltersSortViewBar = ({
                                params,
                                FILTER_PARAMS,
                                TEXT_COLUMNS,
                                updateParams,
                                selectLists,
                                sortList,
                                view,
                                setView,
                                countProducts,
                                minMaxPrice,
                            }) => {
    const theme = useTheme();

    const sortValue = params.sort ? TEXT_COLUMNS[params.sort] : '';

    const updateSort = (newSortValue) => {
        const newValue = Object.keys(TEXT_COLUMNS).find(key => TEXT_COLUMNS[key] === newSortValue);
        updateParams('sort', newValue);
    };

    return (
        <Grid container size={12} spacing={2} alignItems="flex-end"
              sx={{
                  my: 1,
                  flexWrap: {
                      xs: 'wrap',  // по умолчанию — обертывание
                      md: 'nowrap' // только на md и выше — без обертывания
                  }
              }}
        >
            {/* Фильтр (мобильная версия) */}
            <Grid sx={{ display: { xs: 'block', md: 'none' } }}>
                <FiltersDrawer
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    TEXT_COLUMNS={TEXT_COLUMNS}
                    updateParams={updateParams}
                    selectLists={selectLists}
                    minMaxPrice={minMaxPrice}
                />
            </Grid>

            {/* количество найденных */}
            {countProducts &&
                <Grid  flexShrink={0} >
                    <Typography
                        variant="body2"
                        component="span"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            py: 0.5,
                            px: 1,
                            backgroundColor: theme => theme.palette.background.paper,
                        }}
                    >
                        знайдено {countProducts}
                    </Typography>
                </Grid>
            }

            {/* Фильтр (десктоп) */}
            <Grid  sx={{ display: { xs: 'none', md: 'block' } }}>
                <TopStringFilter
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    updateParams={updateParams}
                />
            </Grid>

            <Grid container spacing={1} justifyContent="flex-end" flexShrink={0} ml={"auto"}>
                {/* Сортировка */}
                    <SortBar
                        sortList={sortList}
                        sortValue={sortValue}
                        updateSort={updateSort}
                        sx={{ minWidth: '8rem' }}
                    />

                {/* Переключение вида */}
                    <ToggleButtonGroup
                        value={view}
                        exclusive
                        size="small"
                        onChange={(e, val) => val && setView(val)}
                        sx={{
                            backgroundColor: theme.palette.background.paper,
                        }}
                    >
                        <ToggleButton value="module" aria-label="module">
                            <ViewModuleIcon />
                        </ToggleButton>
                        <ToggleButton value="list" aria-label="list">
                            <ViewListIcon />
                        </ToggleButton>
                    </ToggleButtonGroup>

            </Grid>
        </Grid>
    );
};

export default React.memo(FiltersSortViewBar);
