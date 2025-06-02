import React from "react";
import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Box } from "@mui/system";

function CardDrinkSelectVariant({
                                    variants,
                                    selectedVariant,
                                    setSelectedVariant,
                                    displayFields,
                                    formatFieldValue
                                }) {
    const handleChange = (event, newIndex) => {
        if (newIndex !== null) {
            event.stopPropagation();
            setSelectedVariant(newIndex);
        }
    };

    return (
        <ToggleButtonGroup
            orientation="vertical"
            exclusive
            value={selectedVariant}
            onChange={handleChange}
            fullWidth
            sx={{
                '& .MuiToggleButton-root': {
                    justifyContent: "start",
                    textTransform: "none",
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                        fontWeight: "bold",
                    },
                    '&:hover': {
                        backgroundColor: "action.hover",
                    },
                },
                gap: 0.5,
            }}
        >
            {variants.map((variant, index) => (
                <ToggleButton key={index} value={index}>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            whiteSpace: "nowrap",
                            gap: 1,
                        }}
                    >
                        {displayFields.map((field, fieldIndex) => (
                            <Box
                                key={fieldIndex}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 0.5,
                                }}
                            >
                                {formatFieldValue
                                    ? (() => {
                                        const content = formatFieldValue(field, variant[field]);
                                        return (typeof content === "string" || typeof content === "number")
                                            ? <Typography variant="caption">{content}</Typography>
                                            : content;
                                    })()
                                    : <Typography variant="caption">{variant[field]}</Typography>}
                            </Box>
                        ))}
                    </Box>
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

export default CardDrinkSelectVariant;
