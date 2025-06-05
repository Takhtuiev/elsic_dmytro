import React from "react";
import {
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    Box
} from "@mui/material";
import { getCloudinaryUrl } from "../../services/Utils/CloudinaryUtils";

function CardDrinkSelectVariant({ variants, varIndex, setVarIndex, displayFields }) {
    const isBig = displayFields[0] === "imageUrl";

    const handleChange = (event, newIndex) => {
        if (newIndex !== null) {
            event.stopPropagation();
            setVarIndex(newIndex);
        }
    };

    const formatFieldValue = (field, value) => {
        switch (field) {
            case "volume":
                return `${value} л`;
            case "price":
                return `${value} грн`;
            case "imageUrl":
                return (
                    <img
                        src={getCloudinaryUrl(value)}
                        alt=""
                        style={{
                            width: 48,
                            height: 48,
                            borderRadius: 4,
                            objectFit: "contain",
                            display: "block"
                        }}
                    />
                );
            default:
                return value;
        }
    };



    return (
        <ToggleButtonGroup
            orientation="vertical"
            exclusive
            value={varIndex}
            onChange={handleChange}
            fullWidth
            sx={{
                gap: 0.25,
                '& .MuiToggleButton-root': {
                    justifyContent: "start",
                    textTransform: "none",
                    px: 1,
                    py: 0.25,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    '&.Mui-selected': {
                        backgroundColor: 'action.selected',
                        fontWeight: "bold",
                        '&:hover': {
                            backgroundColor: 'action.selected', // Отключаем hover для активной
                        }

                    },
                    '&:hover': {
                        backgroundColor: "action.hover",
                    },
                },
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
                            gap: 1,
                            whiteSpace: "nowrap",
                        }}
                    >
                        {displayFields.map((field, idx) => {
                            const content = formatFieldValue(field, variant[field]);
                            return (
                                <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                    {typeof content === "string" || typeof content === "number" ? (
                                        <Typography variant={isBig ? "body1" : "caption"} fontWeight={index === varIndex ? "bold" : "normal"}>
                                            {content}
                                        </Typography>
                                    ) : content}
                                </Box>
                            );
                        })}
                    </Box>
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}

export default CardDrinkSelectVariant;
