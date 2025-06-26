import React, { useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Drawer,
    ListItemButton,
    Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import CloseIcon from "@mui/icons-material/Close";

import ContentSlider from "./ContentSlider";
import ContentCheckBoxList from "./ContentCheckBoxList";
import FilterAltIcon from "@mui/icons-material/FilterAlt";

const FiltersAccordion = ({
                              params,
                              updateParams,
                              FILTER_PARAMS,
                              TEXT_COLUMNS,
                              selectLists,
                              minMaxPrice,
                              mode,
                          }) => {
    const [expanded, setExpanded] = useState(false);
    const isDrawerMode = mode === 'drawer';

    const filterInParams = Object.keys(FILTER_PARAMS).some(key => key in params);

    const [filtersOpen, setFiltersOpen] = useState(false);

    const appliedFiltersCount = Object.keys(FILTER_PARAMS).reduce(
        (count, key) => (key in params && params[key] ? count + 1 : count),
        0
    );
    const handleReset = () => {
        updateParams(null, null);
        setFiltersOpen(false);
    };

    const createObj = (field) => {
        const selectedArr = params[field]?.split(',');

        switch (FILTER_PARAMS[field]) {
            case 'slider':
                return {
                    value: selectedArr?.map(Number),
                    range: minMaxPrice || [undefined, undefined]
                };
            case 'checkbox':
                if (!selectLists || !selectLists[field]) return {};
                return selectLists[field].reduce((acc, item) => {
                    acc[item] = selectedArr?.includes(String(item));
                    return acc;
                }, {});
            default:
                return null;
        }
    };

    const getSelectedCount = (field, obj) => {
        if (!FILTER_PARAMS[field]) return "";
        switch (FILTER_PARAMS[field]) {
            case 'checkbox': {
                const selected = Object.values(obj).filter(Boolean).length;
                const total = Object.keys(obj).length;
                return `${selected}/${total}`;
            }

            case 'slider': {
                if (!obj?.value) return "";

                const [min, max] = obj?.value || [];
                const [rangeMin, rangeMax] = obj?.range || [];

                // Если ничего не выбрано или значения равны диапазону по умолчанию — ничего не отображаем
                const isDefault = min === rangeMin && max === rangeMax;

                return !isDefault ? `${min} - ${max}` : "";
            }

            default:
                return "";
        }
    };

    const updateObj = (newObj, field) => {
        let newValue;
        switch (FILTER_PARAMS[field]) {
            case 'slider':
                newValue = newObj.join(',');
                break;
            case 'checkbox':
                newValue = Object.entries(newObj)
                    .filter(([, value]) => value)
                    .map(([key]) => key)
                    .join(',');
                break;
            default:
                return;
        }
        updateParams(field, newValue);
    };

    const renderFieldContent = (field) => {
        const obj = createObj(field);
        const type = FILTER_PARAMS[field];

        if (type === 'slider') {
            return <ContentSlider field={field} obj={obj} updateObj={updateObj} />;
        }

        if (type === 'checkbox') {
            return <ContentCheckBoxList field={field} obj={obj} updateObj={updateObj} />;
        }

        return null;
    };

    const renderField = (field, index) => {
        const obj = createObj(field);

        if (isDrawerMode) {
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
                            {getSelectedCount(field, obj)}
                        </Typography>
                        <ChevronRightIcon color="primary" />
                    </Box>
                </ListItemButton>
            );
        }

        return (
            <Accordion key={index} defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                        {TEXT_COLUMNS[field]}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mx: 0.5 }}>
                        {getSelectedCount(field, obj)}
                    </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0, maxHeight: '12rem', overflowY: 'auto' }}>
                    {renderFieldContent(field)}
                </AccordionDetails>
            </Accordion>
        );
    };

    return (
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {isDrawerMode && (
                <>
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
                        startIcon={<FilterAltIcon />}
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

                        {/* Поля фильтра */}
                        <Box sx={{ flexGrow: 1 }}>
                            {Object.keys(FILTER_PARAMS).map(renderField)}
                        </Box>

                        {/* Кнопка "Показати" */}
                        <Box sx={{ p: 1 }}>
                            <Button variant="contained" color="primary" fullWidth onClick={() => setFiltersOpen(false)}>
                                Показати
                            </Button>
                        </Box>

                        {/* Внутренний Drawer по конкретному фильтру */}
                        <Drawer anchor="left" open={!!expanded} onClose={() => setExpanded(false)}>
                            <Box sx={{ minWidth: "18rem", height: "100%", display: "flex", flexDirection: "column" }}>
                                <Box>
                                    <ListItemButton onClick={() => setExpanded(false)} sx={{ p: 1, color: "primary.main" }}>
                                        <ChevronLeftIcon sx={{ mr: 1 }} />
                                        <Typography variant="h6">{TEXT_COLUMNS[expanded]}</Typography>
                                    </ListItemButton>
                                </Box>

                                <Box sx={{ flexGrow: 1, overflowY: 'auto', borderTop: '1px solid #E0E0E0', borderBottom: '1px solid #E0E0E0' }}>
                                    {renderFieldContent(expanded)}
                                </Box>

                                <Box sx={{ display: "flex", gap: 1, p: 1 }}>
                                    <Button variant="outlined" size="small" fullWidth onClick={() => setExpanded(false)}>Назад</Button>
                                    <Button variant="contained" size="small" fullWidth onClick={() => { setExpanded(false); setFiltersOpen(false); }}>Показати</Button>
                                </Box>
                            </Box>
                        </Drawer>
                    </Drawer>
                </>
            )}

            {!isDrawerMode && Object.keys(FILTER_PARAMS).map(renderField)}
        </Box>
    );
};

export default FiltersAccordion;
