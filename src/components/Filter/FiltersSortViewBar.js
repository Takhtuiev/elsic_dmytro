import React from 'react';
import Box from '@mui/material/Box';
import TopStringFilter from "./TopStringFilter";
import SortBar from "./SortBar";
import FiltersDrawer from "./FiltersDrawer";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import ViewListIcon from "@mui/icons-material/ViewList";

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
    // Получаем значение для сортировки из параметров
    const sortValue = params.sort ? TEXT_COLUMNS[params.sort] : '';

    // Обновление параметра сортировки
    const updateSort = (newSortValue) => {
        const newValue = Object.keys(TEXT_COLUMNS).find(key => TEXT_COLUMNS[key] === newSortValue);
        updateParams('sort', newValue); // Обновляем параметры сортировки
    };

    return (
        <Box display="flex" gap={2} width={'100%'} my={1}>
            {/* Фильтры */}
            <Box sx={{ display: { xs: 'flex', md: 'none' }, flexGrow: 1 }}> {/* малый экран */}
                <FiltersDrawer
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    updateParams={updateParams}
                    selectLists={selectLists}
                    minMaxPrice={minMaxPrice}
                    countProducts={countProducts}
                />
            </Box>
            <Box flexGrow={1} sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1  }}> {/* Большой экран */}
                <TopStringFilter
                    params={params}
                    FILTER_PARAMS={FILTER_PARAMS}
                    updateParams={updateParams}
                />
            </Box>

            {/* Панель сортировки */}
            <Box>
                <SortBar
                    sortList={sortList}
                    sortValue={sortValue}
                    updateSort={updateSort}
                    sx={{ minWidth: '8rem' }}
                />
            </Box>

            {/* Переключение видов (модульный и список) */}
            <Box>
                <ToggleButtonGroup
                    value={view}
                    exclusive size="small"
                    sx={{
                        backgroundColor: theme => theme.palette.background.paper,
                    }}
                >
                    <ToggleButton value="module" aria-label="module" onClick={() => setView('module')}>
                        <ViewModuleIcon />
                    </ToggleButton>
                    <ToggleButton value="list" aria-label="list" onClick={() => setView('list')}>
                        <ViewListIcon />
                    </ToggleButton>
                </ToggleButtonGroup>
            </Box>
        </Box>
    );
};

export default React.memo(FiltersSortViewBar);
