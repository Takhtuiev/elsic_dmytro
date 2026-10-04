import React, { memo, useState, useEffect } from "react";
import { TextField, InputAdornment, Box } from "@mui/material";
import { BlockMath } from "react-katex";

// Универсальный оптимизированный инпут с поддержкой KaTeX-юнитов
const MyTextField = memo(({
                              value,
                              onChange,
                              unit,
                              isFraction,
                              unitFontSize = "0.75rem",
                              fractionFontSize = "0.55rem",
                              slotProps,
                              ...rest
                          }) => {
    const [localValue, setLocalValue] = useState(value);

    // Синхронизируем внутренний стейт при изменении данных снаружи
    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleChange = (e) => {
        setLocalValue(e.target.value); // Мгновенный ввод без лагов
    };

    const handleBlur = () => {
        if (localValue !== value) {
            onChange(localValue); // Обновляем тяжелый общий стейт только при выходе из фокуса
        }
    };

    // Стили для инпута (размер шрифта и внутренние отступы)
    const inputHtmlStyle = {
        padding: "4px 4px 4px 8px",
        fontSize: "0.875rem",
        ...slotProps?.htmlInput?.style
    };

    return (
        <TextField
            {...rest}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            slotProps={{
                ...slotProps,
                htmlInput: {
                    min: 0,
                    ...slotProps?.htmlInput,
                    style: inputHtmlStyle
                },
                input: {
                    ...slotProps?.input,
                    endAdornment: unit ? (
                        <InputAdornment position="end">
                            <Box
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    height: "100%",
                                    color: "text.secondary",
                                    "& .katex-display": {
                                        margin: 0,
                                        fontSize: isFraction ? fractionFontSize : unitFontSize,
                                        display: "flex",
                                        alignItems: "center"
                                    },
                                    "& .katex": {
                                        lineHeight: 1,
                                        display: "flex",
                                        alignItems: "center"
                                    },
                                    "& .katex-html": {
                                        display: "flex",
                                        alignItems: "center"
                                    }
                                }}
                            >
                                <BlockMath math={unit} />
                            </Box>
                        </InputAdornment>
                    ) : slotProps?.input?.endAdornment
                }
            }}
        />
    );
});

export default MyTextField;
