import React from 'react';
import { Button, Box } from "@mui/material";
import CloseIcon from '@mui/icons-material/Close';

const TopStringFilter = ({ params, FILTER_PARAMS, updateParams }) => {
    // Проверяем, что есть хотя бы одно поле из FILTER_PARAMS в params
    const hasActiveFilters = Object.keys(FILTER_PARAMS).some(key => key in params);
    if (!hasActiveFilters) return null;

    const handleClick = (field, value) => {
        if (!FILTER_PARAMS[field]) return;

        let newValue;
        switch (FILTER_PARAMS[field].type) {
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
                mr: 1,
                mb: 1,
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
        <Box display="flex" flexWrap="wrap" justifyContent="flex-start">
            {/* Кнопка сброса */}
            {renderButton("resetButton", "Reset", () => updateParams(null, null), "error")}

            {/* Генерация кнопок фильтров */}
            {Object.keys(FILTER_PARAMS).map((fieldName) => {
                const fieldType = FILTER_PARAMS[fieldName].type;
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
        </Box>
    );
};

export default TopStringFilter;
