import React from "react";
import { ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { Box } from "@mui/system";
import {getCloudinaryUrl} from "../../services/Utils/CloudinaryUtils";

function CardDrinkSelectVariant({
                                    variants,
                                    selectedVariant,
                                    setSelectedVariant,
                                    displayFields
                                }) {

    const sizeBig = displayFields[0] === "imageUrl"

    const handleChange = (event, newIndex) => {
        if (newIndex !== null) {
            event.stopPropagation();
            setSelectedVariant(newIndex);
        }
    };

    // Локальная функция для форматирования значения по полю
    const formatFieldValue = (field, value) => {
        switch (field) {
            case "volume":
                return `${value} л`;
            case "price":
                return `${value} грн`;
            case "imageUrl":
                return <img
                    src={getCloudinaryUrl(value)}
                    alt=""
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 4,
                        objectFit: "contain",
                        display: "block"
                    }}/>;
            default:
                return value;
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
                                <Typography variant={ sizeBig ? "body1" : "caption"}>
                                    {formatFieldValue(field, variant[field])}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

export default CardDrinkSelectVariant;
