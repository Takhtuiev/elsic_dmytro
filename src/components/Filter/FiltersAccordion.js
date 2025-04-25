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
import { DRINKS_COLUMNS } from "../../CONSTANTS/Constants";
import ContentSlider from "./ContentSlider";
import ContentCheckBoxList from "./ContentCheckBoxList";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import FilterDrawerField from "./FilterDrawerField";

const FiltersAccordion = ({ params, FILTER_PARAMS, updateParams, selectLists, countProducts, mode, closeDrawer }) => {
    const [expanded, setExpanded] = useState(false);

    // Создание объекта один раз
    const createObj = (field) => {
        const selectedArr = params[field]?.split(','); // Преобразуем строку в массив

        switch (FILTER_PARAMS[field]?.type) {
            case 'slider':
                return {
                    value: selectedArr?.map(Number), // Преобразуем строковые значения в числа
                    range: selectLists?.minMaxPrice || [0, 0] // Минимум и максимум для слайдера
                };
            case 'checkbox':
                if (!selectLists) return {}; // Если нет selectLists, возвращаем пустой объект

                return selectLists[field].reduce((acc, item) => {
                    acc[item] = selectedArr?.includes(item); // Отмечаем, выбран ли элемент
                    return acc;
                }, {});
            default:
                return null; // Если тип не найден, возвращаем null
        }
    };

    // Получаем выбранное количество из obj
    const getSelectedCount = (field, obj) => {
        if (!FILTER_PARAMS[field]) return "";

        switch (FILTER_PARAMS[field]?.type) {
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

        switch (FILTER_PARAMS[field].type) {
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
                                    {DRINKS_COLUMNS[field].text}
                                </Typography>
                                <Typography variant="body2" color="textSecondary" sx={{ mx: 0.5 }}>
                                    {getSelectedCount(field, obj)} {/* Передаем obj в getSelectedCount */}
                                </Typography>
                                <ChevronRightIcon color="primary" />
                            </Box>
                        </MenuItem>
                    );
                })}

                <FilterDrawerField
                    expanded={Boolean(expanded)}
                    setExpanded={setExpanded}
                    headText={DRINKS_COLUMNS[expanded]?.text}
                    closeFilters={closeDrawer}
                >
                    {FILTER_PARAMS[expanded]?.type === 'slider' ? (
                        <ContentSlider
                            field={expanded}
                            obj={createObj(expanded)}
                            updateObj={updateObj}
                        />
                    ) : ( FILTER_PARAMS[expanded]?.type === 'checkbox' ? (
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
                <Box display={'flex'} justifyContent={'center'}>
                    <Typography variant="body1">
                        знайдено {countProducts} товарів
                    </Typography>
                </Box>

                {Object.keys(FILTER_PARAMS).map((field, index) => {
                    const obj = createObj(field); // Создаем obj один раз для каждого поля
                    return (
                        <Accordion
                            key={index}
                            defaultExpanded
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="body1" sx={{ flexGrow: 1 }}>
                                    {DRINKS_COLUMNS[field].text}
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
                                {FILTER_PARAMS[field]?.type === 'slider' ? (
                                    <ContentSlider
                                        field={field}
                                        obj={createObj(field)}
                                        updateObj={updateObj}
                                    />
                                ) : ( FILTER_PARAMS[field]?.type === 'checkbox' ? (
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
