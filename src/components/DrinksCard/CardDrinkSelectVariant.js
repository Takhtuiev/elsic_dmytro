import {Tab, Tabs} from "@mui/material";
import {Box} from "@mui/system";
import React from "react";

function CardDrinkSelectVariant({ product, selectedVariant, setSelectedVariant }) {


    return (
        <Tabs
            value={selectedVariant}
            onChange={(event, newIndex) => {
                event.stopPropagation();
                setSelectedVariant(newIndex);
            }}
            orientation="vertical"
            variant="scrollable"
            slotProps={{ indicator: { style: { left: 0, right: "auto", } } }}
        >
            {product.variants.map((variant, index) => (
                <Tab
                    key={index}
                    label={
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                width: "100%",
                                gap: 1,
                                whiteSpace: "nowrap", // ❗ Запрещает перенос текста
                            }}                        >
                            <span>{`${variant.packagingType}`}</span>
                            <span>{`${variant.volume} л.`}</span>
                        </Box>
                    }
                    sx={{
                        minHeight: "1.4rem", // Минимальная высота строки
                        padding: "0 0.5rem", // Уменьшаем отступы
                        textTransform: "none",
                        "&:hover:not(.Mui-selected)": {
                            backgroundColor: "action.hover", // Цвет фона при наведении, если элемент не выбран
                        },
                        "&.Mui-selected": {
                            fontWeight: "bold",
                            color: "primary.main",
                        },
                    }}
                />
            ))}
        </Tabs>

    )
}

export default CardDrinkSelectVariant;