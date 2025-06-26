import React, { useState, useCallback, useMemo } from 'react';
import {
    Box,
    Button,
    Drawer,
    ListItemButton,
    Typography,
    Badge
} from "@mui/material";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";

import {
    createObj,
    getSelectedCount,
    renderFieldContent,
    updateObj
} from "./filtersUtils";

const FiltersButton = ({
                           params,
                           updateParams,
                           FILTER_PARAMS,
                           TEXT_COLUMNS,
                           selectLists,
                           minMaxPrice
                       }) => {
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const updateObjCallback = useCallback(
        (newObj, field) => updateObj(newObj, field, FILTER_PARAMS[field], updateParams),
        [updateParams, FILTER_PARAMS]
    );

    const filterInParams = useMemo(
        () => Object.keys(FILTER_PARAMS).some(key => key in params),
        [params, FILTER_PARAMS]
    );

    const appliedFiltersCount = useMemo(() =>
            Object.keys(FILTER_PARAMS).reduce(
                (count, key) => (key in params && params[key] ? count + 1 : count),
                0
            ),
        [params, FILTER_PARAMS]
    );

    const handleReset = () => {
        updateParams(null, null);
        setFiltersOpen(false);
    };

    const renderField = useCallback((field, index) => {
        const obj = createObj(field, params, FILTER_PARAMS[field], selectLists?.[field], minMaxPrice);

        return (
            <ListItemButton
                key={index}
                onClick={() => setExpanded(field)}
                sx={{ p: 1.4 }}
            >
                <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                        {TEXT_COLUMNS[field]}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mx: 0.5 }}>
                        {getSelectedCount(field, obj, FILTER_PARAMS[field])}
                    </Typography>
                    <ChevronRightIcon color="primary" />
                </Box>
            </ListItemButton>
        );
    }, [params, FILTER_PARAMS, selectLists, minMaxPrice, TEXT_COLUMNS]);

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <Button
                variant="outlined"
                color="info"
                size="small"
                onClick={() => setFiltersOpen(true)}
                sx={{
                    borderRadius: 1,
                    textTransform: "none",
                    backgroundColor: "background.paper",
                }}
                startIcon={ <FilterAltIcon /> }
            >
                {`Фільтри${appliedFiltersCount > 0 ? ` (${appliedFiltersCount})` : ""}`}
            </Button>

            <Drawer anchor="left" open={filtersOpen} onClose={() => setFiltersOpen(false)}>
                {/* Верхняя панель */}
                <Box sx={{ display: "flex", alignItems: "center", px: 2, py: 1 }}>
                    <ListItemButton onClick={() => setFiltersOpen(false)} sx={{ px: 0, color: "primary.main", flexGrow: 1 }}>
                        <ChevronLeftIcon sx={{ mr: 1 }} />
                        <Typography variant="h6">Фільтри</Typography>
                    </ListItemButton>

                    {filterInParams && (
                        <Button
                            variant="outlined"
                            size="small"
                            color="error"
                            onClick={handleReset}
                            sx={{ borderRadius: "1rem", ml: 1, whiteSpace: "nowrap" }}
                            endIcon={<CloseIcon fontSize="small" />}
                        >
                            Reset
                        </Button>
                    )}
                </Box>

                {/* Список фильтров */}
                <Box sx={{ flexGrow: 1 }}>
                    {Object.keys(FILTER_PARAMS).map(renderField)}
                </Box>

                {/* Кнопка "Показати" */}
                <Box sx={{ p: 1 }}>
                    <Button variant="contained" color="primary" fullWidth onClick={() => setFiltersOpen(false)}>
                        Показати
                    </Button>
                </Box>

                {/* Вложенный Drawer — отображается только при expanded */}
                {expanded && (
                    <Drawer anchor="left" open onClose={() => setExpanded(false)}>
                        <Box sx={{ minWidth: "18rem", height: "100%", display: "flex", flexDirection: "column" }}>
                            <Box>
                                <ListItemButton onClick={() => setExpanded(false)} sx={{ p: 1, color: "primary.main" }}>
                                    <ChevronLeftIcon sx={{ mr: 1 }} />
                                    <Typography variant="h6">{TEXT_COLUMNS[expanded]}</Typography>
                                </ListItemButton>
                            </Box>

                            <Box sx={{ flexGrow: 1, overflowY: 'auto', borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }}>
                                {renderFieldContent(
                                    expanded,
                                    createObj(expanded, params, FILTER_PARAMS[expanded], selectLists?.[expanded], minMaxPrice),
                                    FILTER_PARAMS[expanded],
                                    updateObjCallback
                                )}
                            </Box>

                            <Box sx={{ display: "flex", gap: 1, p: 1 }}>
                                <Button variant="outlined" size="small" fullWidth onClick={() => setExpanded(false)}>Назад</Button>
                                <Button variant="contained" size="small" fullWidth onClick={() => { setExpanded(false); setFiltersOpen(false); }}>Показати</Button>
                            </Box>
                        </Box>
                    </Drawer>
                )}
            </Drawer>
        </Box>
    );
};

export default FiltersButton;
