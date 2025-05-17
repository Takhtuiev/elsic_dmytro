import React, { useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    MenuItem,
    Typography
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ContentSlider from "./ContentSlider";
import ContentCheckBoxList from "./ContentCheckBoxList";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FilterDrawerField from "./FilterDrawerField";

const FiltersAccordion = ({ params, updateParams, FILTER_PARAMS, TEXT_COLUMNS, selectLists, mode, closeDrawer }) => {
    const [expanded, setExpanded] = useState(false);

    // Создание объекта один раз
    const createObj = (field) => {
        const selectedArr = params[field]?.split(','); // Преобразуем строку в массив

        switch (FILTER_PARAMS[field]) {
            case 'slider':
                return {
                    value: selectedArr?.map(Number), // Преобразуем строковые значения в числа
                    range: selectLists?.minMaxPrice || [0, 0] // Минимум и максимум для слайдера
                };
            case 'checkbox':
                if (!selectLists) return {}; // Если нет selectLists, возвращаем пустой объект

                return selectLists[field].reduce((acc, item) => {
                    acc[item] = selectedArr?.includes(String(item)); // Отмечаем, выбран ли элемент
                    return acc;
                }, {});
            default:
                return null; // Если тип не найден, возвращаем null
        }
    };

    // Получаем выбранное количество из obj
    const getSelectedCount = (field, obj) => {
        if (!FILTER_PARAMS[field]) return "";

        switch (FILTER_PARAMS[field]) {
            case 'checkbox':
                const total = Object.keys(obj).length;
                const selected = Object.values(obj).filter(Boolean).length;
                return `${selected}/${total}`;
            case 'slider': {
                const [min, max] = obj.value || [0, 0];
                return params[field] !== obj[field] ? `${min} - ${max}` : "";
            }
            default:
                return "";
        }
    };

    // Обновление параметров
    const updateObj = (newObj, field) => {
        let newValue = [];

        switch (FILTER_PARAMS[field]) {
            case 'slider':
                newValue = newObj.join(',');
                break;
            case 'checkbox':
                newValue = Object.entries(newObj)
                    .filter(([key, value]) => value) // Фильтруем только те пары, где value === true
                    .map(([key]) => key).join(','); // Извлекаем ключи
                break;
            default:
                return null;
        }

        updateParams(field, newValue);
    };

    if (mode === 'drawer') {
        return (
            <>
                {Object.keys(FILTER_PARAMS).map((field, index) => {
                    const obj = createObj(field); // Создаем obj один раз для каждого поля
                    return (
                        <MenuItem key={index} onClick={() => setExpanded(field)} sx={{ p: 1.4 }}>
                            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                                <Typography variant="body1" sx={{ flexGrow: 1 }}>
                                    {TEXT_COLUMNS[field]}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mx: 0.5 }}>
                                    {getSelectedCount(field, obj)}
                                </Typography>
                                <ChevronRightIcon color="primary" />
                            </Box>
                        </MenuItem>
                    );
                })}

                <FilterDrawerField
                    expanded={Boolean(expanded)}
                    setExpanded={setExpanded}
                    headText={TEXT_COLUMNS[expanded]}
                    closeFilters={closeDrawer}
                >
                    {FILTER_PARAMS[expanded] === 'slider' ? (
                        <ContentSlider
                            field={expanded}
                            obj={createObj(expanded)}
                            updateObj={updateObj}
                        />
                    ) : ( FILTER_PARAMS[expanded] === 'checkbox' ? (
                            <ContentCheckBoxList
                                field={expanded}
                                obj={createObj(expanded)}
                                updateObj={updateObj}
                            />
                        ) : null
                    )}
                </FilterDrawerField>
            </>
        );
    } else {
        return (
            <>
                {Object.keys(FILTER_PARAMS).map((field, index) => {
                    const obj = createObj(field); // Создаем obj один раз для каждого поля
                    return (
                        <Accordion
                            key={index}
                            defaultExpanded
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="body1" sx={{ flexGrow: 1 }}>
                                    {TEXT_COLUMNS[field]}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mx: 0.5 }}>
                                    {getSelectedCount(field, obj)} {/* Передаем obj в getSelectedCount */}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails
                                sx={{
                                    p: 0,
                                    maxHeight: '12rem', // Максимальная высота
                                    overflowY: 'auto',  // Вертикальная прокрутка
                                }}
                            >
                                {FILTER_PARAMS[field] === 'slider' ? (
                                    <ContentSlider
                                        field={field}
                                        obj={createObj(field)}
                                        updateObj={updateObj}
                                    />
                                ) : ( FILTER_PARAMS[field] === 'checkbox' ? (
                                        <ContentCheckBoxList
                                            field={field}
                                            obj={createObj(field)}
                                            updateObj={updateObj}
                                        />
                                    ) : null
                                )}
                            </AccordionDetails>
                        </Accordion>
                    );
                })}
            </>
        );
    }
};

export default FiltersAccordion;
