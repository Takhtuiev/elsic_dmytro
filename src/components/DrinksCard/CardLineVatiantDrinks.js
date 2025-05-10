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

function CardLineVariantDrink({ item, setAction }) {
    const navigate = useNavigate();

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + item.product.id + "?variantId=" + item.id)}}
            sx={{alignItems: 'center'}}
        >
            {/* Левая половина - изображение */}
            <CardMedia
                component="img"
                image={item.imageUrl && API_URL + "/" + item.imageUrl + "?ts=" + item.product.lastUpdated}
                alt={`${item.product.name} (${item.volume}л.), ${item.packagingType}`}
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
                        <Typography variant="h6"  component="span">{item.product.name}</Typography>{" "}
                        <Typography variant="body2"  component="span" color="text.secondary">
                            ({item.volume}л.), {item.packagingType}
                        </Typography>
                    </Box>
                    <Rating
                        precision={0.5}
                        value={item.product.rating}
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
                                    navigate("/brand/" + item.product.brand);
                                }}
                                sx={{ textAlign: "left", display: "block" }}
                            >
                                {item.product.brand}
                            </Link>
                            <Typography variant="body2">{item.product.country}</Typography>
                        </Box>

                        <Box sx={{ minWidth: "8rem", flexGrow: 1 }}>
                            <Typography variant="body2">{item.product.productType}</Typography>
                            <Typography variant="body2">{item.product.alcohol}%</Typography>
                            <Typography variant="body2">{item.product.expirationDays} днів</Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <Typography variant="h5" sx={{ whiteSpace: "nowrap" }}>
                            {item.price.toFixed(2)}
                        </Typography>
                        <Typography variant="body1">грн.</Typography>
                    </Box>
                </Box>
                <Divider/>
                {item.product.description && <ExpandableText text={item.product.description}  lines={1}/>}
            </Box>
            <ActionGroupButton masActions={VariantActionsMas(item)} setAction={setAction} orientation={"vertical"}/>
        </MyCard>
    );
}

export default CardLineVariantDrink;
