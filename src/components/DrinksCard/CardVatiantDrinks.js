import {
    CardMedia, Divider,
    Link,
    Rating,
    Typography
} from "@mui/material";
import React from "react";
import { API_URL } from "../../config";
import {useNavigate} from "react-router-dom";
import ExpandableText from "../MyComponent/ExpandableText";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {VariantActionsMas} from "./VariantActionsMas";
import {Box} from "@mui/system";
import MyCard from "../MyComponent/MyCard";


function CardVariantDrink({ variant, setAction }) {

    const navigate = useNavigate();

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + variant.product.id + "?variantId=" + variant.id)}}
            sx={{flexDirection: 'column'}}
        >

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: 'center' }}>
                <Typography variant="h5" sx={{ textAlign: 'center' }}>
                    {variant.product.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    ({variant.volume}л.), {variant.packagingType}
                </Typography>
            </Box>

            <Divider/>

            {/* Контейнер для изображения и текста */}
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    p:0,
                }}
            >
                {/* Левая половина - изображение */}
                <CardMedia
                    component="img"
                    image={variant.imageUrl && API_URL + "/" + variant.imageUrl + "?ts=" + variant.product.lastUpdated}
                    alt={`${variant.product.name} (${variant.volume}л.), ${variant.packagingType}`}
                    sx={{
                        width: "48%",
                        height: "auto", // Не растягивает по высоте
                        maxHeight: "10rem", // Ограничивает максимальную высоту
                        objectFit: "contain", // Поддерживает пропорции без обрезки
                        flexShrink: 0, // Запрещает сжатие
                    }}
                />

                {/* Правая половина - текст */}
                <Box sx={{ width: "48%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <Rating
                        precision={0.5}
                        value={variant.product.rating}
                        readOnly
                        sx={{
                            mx: 0,
                            my: 1,
                            fontSize: "small",
                        }}
                    />
                    <Typography variant="body2">{variant.product.productType}</Typography>
                    <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate("/brand/" + variant.product.brand);
                        }}
                        sx={{
                            textAlign: "left",
                            display: "block", // Позволяет тексту занимать всю ширину контейнера
                        }}
                    >
                        {variant.product.brand}
                    </Link>
                    <Typography variant="body2">{variant.product.country}</Typography>
                    <Typography variant="body2">{variant.product.alcohol}%</Typography>
                    <Typography variant="body2">{variant.product.expirationDays} днів</Typography>
                </Box>
            </Box>

            <Divider/>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Цена (первая строка) */}
                <Box sx={{ display: "flex", alignItems: "end" }}>
                    <Typography variant="h5">
                        {variant.price.toFixed(2)}
                    </Typography>
                    <Typography variant="body1">грн.</Typography>
                </Box>

                {variant.product.description && <ExpandableText text={variant.product.description} />}
                <ActionGroupButton masActions={VariantActionsMas(variant)} setAction={setAction} />
            </Box>

        </MyCard>
    );
}

export default CardVariantDrink;

