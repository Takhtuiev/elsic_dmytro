import React from 'react';
import {Button, Typography} from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';
import Grid from "@mui/material/Grid2";

const TopStringFilter = ({ params, FILTER_PARAMS, updateParams }) => {
    // Проверяем, что есть хотя бы одно поле из FILTER_PARAMS в params
    const hasActiveFilters = Object.keys(FILTER_PARAMS).some(key => key in params);

    const handleClick = (field, value) => {
        if (!FILTER_PARAMS[field]) return;

        let newValue;
        switch (FILTER_PARAMS[field]) {
            case 'slider':
                newValue = null; // Логика сброса для слайдера (можно изменить)
                break;
            case 'checkbox':
                newValue = params[field]
                    .split(',')
                    .filter(item => item !== value)
                    .join(',');
                break;
            default:
                return;
        }

        updateParams(field, newValue);
    };

    // Функция для создания кнопок
    const renderButton = (field, label, onClick, color) => (
        <Button
            key={`${field}-${label}`}
            size="small"
            variant="outlined"
            color={color}
            onClick={onClick}
            endIcon={color === "error" && <CloseIcon fontSize="small" color="error" />}
            sx={{
                mx: 0.5,
                mt: 0.5,
                borderRadius: '1rem',
                borderColor: 'text.secondary',
                color: 'text.secondary',
                textTransform: 'none',

                '&:hover': {
                    borderColor: 'error.main', // Цвет границы при наведении
                },

                backgroundColor: theme => theme.palette.background.paper,
            }}
        >
            {label}
        </Button>
    );

    return (
        <>
            {/* Генерация кнопок фильтров */}
            {Object.keys(FILTER_PARAMS).map((fieldName) => {
                const fieldType = FILTER_PARAMS[fieldName];
                const fieldValues = params[fieldName]?.split(',');

                if (!fieldValues || fieldValues.length === 0) return null;

                if (fieldType === 'slider') {
                    const rangeLabel = `${fieldValues[0]}-${fieldValues[1]} грн`;
                    return renderButton(fieldName, rangeLabel, () => handleClick(fieldName));
                }

                if (fieldType === 'checkbox') {
                    return fieldValues.map((item) =>
                        renderButton(fieldName, item, () => handleClick(fieldName, item))
                    );
                }

                return null;
            })}

            {/* Кнопка сброса */
                hasActiveFilters &&
                renderButton("resetButton", "Reset", () => updateParams(null, null), "error")
            }

        </>
    );
};

export default TopStringFilter;
