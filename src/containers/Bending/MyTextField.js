import React, { memo } from "react";
import { TextField, InputAdornment, Box } from "@mui/material";
import { BlockMath } from "react-katex";

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
    const inputHtmlStyle = {
        padding: "4px 4px 4px 8px",
        fontSize: "0.875rem",
        ...slotProps?.htmlInput?.style
    };

    return (
        <TextField
            {...rest}
            value={value ?? ""}
            onChange={(e) => onChange?.(e.target.value)}
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
                            <Box sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                height: "100%",
                                color: "text.secondary",
                                "& .katex-display": {
                                    margin: 0,
                                    fontSize: isFraction
                                        ? fractionFontSize
                                        : unitFontSize,
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
                            }}>
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
