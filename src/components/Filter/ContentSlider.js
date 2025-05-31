import {Box, Button, Skeleton, Slider, TextField, Typography} from "@mui/material";
import React, { useState, useEffect } from "react";


const ContentSlider = ({ field, obj, updateObj }) => {
    const [priceRange, setPriceRange] = useState(obj.value || obj.range);

    // Обновляем priceRange при изменении obj
    useEffect(() => {
        setPriceRange(obj.value || obj.range);
    }, [obj]);

    const handlePriceChange = (event, newValue) => {
        setPriceRange(newValue);
    };

    const handleMinInputChange = (event) => {
        setPriceRange([Number(event.target.value), priceRange[1]]);
    };

    const handleMaxInputChange = (event) => {
        setPriceRange([priceRange[0], Number(event.target.value)]);
    };

    const handleInputBlur = () => {
        let [min, max] = priceRange[0] <= priceRange[1] ? priceRange : [priceRange[1], priceRange[0]];
        min = Math.max(min, obj.range[0]);
        max = Math.min(max, obj.range[1]);
        updateObj([min, max], field);
    };

    const handlePriceChangeCommitted = (event, newValue) => {
        if (newValue[0] === obj.range[0] && newValue[1] === obj.range[1]) {
            updateObj([], field);
        } else {
            updateObj(newValue, field);
        }
    };

    const textFieldStyles = {
        minWidth: '3rem',
        '& input': {
            padding: '0.3rem',
            // Скрываем стрелочки вверх-вниз
            '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0
            },
            '&[type=number]': {
                MozAppearance: 'textfield'
            }
        }
    };

    // Пока obj не загружен — рендерим скелетон
    if (!obj || obj.range[1] === 0) {
       return (
            <Box maxWidth="18rem" m={0} p={1}>
                <Skeleton height={40} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={30} />
            </Box>
        );
    }

    return (
        <Box maxWidth="18rem" m={0} p={1}>
            {/* Поля ввода и кнопка OK */}
            <Box display="flex" gap={1} >
                <Box flex="1">
                    <TextField
                        type="number"
                        label="Min"
                        size="small"
                        value={priceRange[0]}
                        onChange={handleMinInputChange}
                        onBlur={handleInputBlur}
                        sx={textFieldStyles}
                    />
                </Box>
                <Box flex="1">
                    <TextField
                        type="number"
                        label="Max"
                        size="small"
                        value={priceRange[1]}
                        onChange={handleMaxInputChange}
                        onBlur={handleInputBlur}
                        sx={textFieldStyles}
                    />
                </Box>
                <Box flex="none">
                    <Button
                        variant="outlined"
                        size="small"
                        sx={{
                            width: '100%',
                            p: 0,
                            minWidth: '1rem',
                            height: '100%',
                        }}
                    >
                        OK
                    </Button>
                </Box>
            </Box>

            {/* Слайдер */}
            <Box px={1.6} mx={-1} pt={1} overflow="hidden">
                <Slider
                    value={priceRange}
                    onChange={handlePriceChange}
                    onChangeCommitted={handlePriceChangeCommitted}
                    valueLabelDisplay="off"
                    size="small"
                    min={obj.range[0]}
                    max={obj.range[1]}
                    step={0.1}
                />
                {/* Подписи для слайдера */}
                <Box display="flex" justifyContent="space-between" mt={-2} mx={-1}>
                    <Typography variant="caption" color="textSecondary">
                        {obj.range[0]}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                        {obj.range[1]}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

export default ContentSlider;
