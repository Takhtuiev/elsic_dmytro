import {
    CardMedia, Divider,
    Link,
    Rating, Typography
} from "@mui/material";
import React from "react";
import { API_URL } from "../../config";
import { useNavigate } from "react-router-dom";
import ExpandableText from "../MyComponent/ExpandableText";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {Box} from '@mui/system';
import { VariantActionsMas } from "./VariantActionsMas";
import MyCard from "../MyComponent/MyCard";

function CardLineVariantDrink({ variant, setAction }) {
    const navigate = useNavigate();

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + variant.product.id + "?variantId=" + variant.id)}}
            sx={{alignItems: 'center'}}
        >
            {/* Левая половина - изображение */}
            <CardMedia
                component="img"
                image={variant.imageUrl && API_URL + "/" + variant.imageUrl + "?ts=" + variant.product.lastUpdated}
                alt={`${variant.product.name} (${variant.volume}л.), ${variant.packagingType}`}
                sx={{
                    height: "8rem",
                    width: "6rem",
                    maxHeight: "10rem", // Ограничивает максимальную высоту
                    objectFit: "contain", // Поддерживает пропорции без обрезки
                    flexShrink: 0, // Запрещает сжатие
                }}
            />
            <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%"}} >
                <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                    <Box sx={{ display: "inline", whiteSpace: "normal", wordBreak: "break-word" }}>
                        <Typography variant="h6"  component="span">{variant.product.name}</Typography>{" "}
                        <Typography variant="body2"  component="span" color="text.secondary">
                            ({variant.volume}л.), {variant.packagingType}
                        </Typography>
                    </Box>
                    <Rating
                        precision={0.5}
                        value={variant.product.rating}
                        readOnly
                        sx={{
                            ml: "auto", // Прижимает рейтинг к правому краю
                            px: 1,
                            fontSize: "small",
                        }}
                    />
                </Box>
                <Divider/>
                <Box sx={{display: "flex", flexGrow: 1, justifyContent: "space-between", alignItems: "center", gap:1}}>
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap", // Позволяет перенос на новую строку
                            columnGap: 2, // Отступ между элементами в строку (горизонтальный)
                            rowGap: 0, // Отступ между строками (вертикальный)
                            justifyContent: "space-between",
                        }}
                    >
                        <Box sx={{ minWidth: "8rem", flexGrow: 1 }}>
                            <Link
                                component="button"
                                variant="body2"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate("/brand/" + variant.product.brand);
                                }}
                                sx={{ textAlign: "left", display: "block" }}
                            >
                                {variant.product.brand}
                            </Link>
                            <Typography variant="body2">{variant.product.country}</Typography>
                        </Box>

                        <Box sx={{ minWidth: "8rem", flexGrow: 1 }}>
                            <Typography variant="body2">{variant.product.productType}</Typography>
                            <Typography variant="body2">{variant.product.alcohol}%</Typography>
                            <Typography variant="body2">{variant.product.expirationDays} днів</Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <Typography variant="h5" sx={{ whiteSpace: "nowrap" }}>
                            {variant.price.toFixed(2)}
                        </Typography>
                        <Typography variant="body1">грн.</Typography>
                    </Box>
                </Box>
                <Divider/>
                {variant.product.description && <ExpandableText text={variant.product.description}  lines={1}/>}
            </Box>
            <ActionGroupButton masActions={VariantActionsMas(variant)} setAction={setAction} orientation={"vertical"}/>
        </MyCard>
    );
}

export default CardLineVariantDrink;
