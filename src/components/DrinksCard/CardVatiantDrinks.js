import {
    CardMedia, Divider,
    Link,
    Rating,
    Typography,
    Skeleton
} from "@mui/material";
import React from "react";
import {useNavigate} from "react-router-dom";
import ExpandableText from "../MyComponent/ExpandableText";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {VariantActionsMas} from "./VariantActionsMas";
import {Box} from "@mui/system";
import MyCard from "../MyComponent/MyCard";
import {getCloudinaryUrl} from "../../services/Utils/CloudinaryUtils";


function CardVariantDrink({ item }) {

    const navigate = useNavigate();

    if (!item) {
        return (
            <MyCard sx={{ flexDirection: 'column' }}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: 'center' }}>
                    <Skeleton width="60%" height={32} />
                    <Skeleton width="40%" height={20} />
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Skeleton variant="rectangular" width="48%" height={120} />
                    <Box sx={{ width: "48%" }}>
                        <Skeleton width="60%" />
                        <Skeleton width="40%" />
                        <Skeleton width="80%" />
                        <Skeleton width="50%" />
                        <Skeleton width="40%" />
                    </Box>
                </Box>

                <Divider sx={{ my: 1 }} />

                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Skeleton width="30%" height={30} />
                    <Skeleton width="90%" height={20} />
                    <Skeleton width="90%" height={20} />
                </Box>
            </MyCard>
        );
    }

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + item.product.id + "?variant=" + item.id)}}
            sx={{flexDirection: 'column'}}
        >

            <Box sx={{ display: "flex", flexDirection: "column", alignItems: 'center' }}>
                <Typography variant="h5" sx={{ textAlign: 'center' }}>
                    {item.product.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    ({item.volume}л.), {item.packagingType}
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
                    image={getCloudinaryUrl(item.imageUrl)}
                    alt={`${item.product.name} (${item.volume}л.), ${item.packagingType}`}
                    loading="lazy"
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
                        value={item.product.rating}
                        readOnly
                        sx={{
                            mx: 0,
                            my: 1,
                            fontSize: "small",
                        }}
                    />
                    <Typography variant="body2">{item.product.productType}</Typography>
                    <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate("/brand/" + item.product.brand);
                        }}
                        sx={{
                            textAlign: "left",
                            display: "block", // Позволяет тексту занимать всю ширину контейнера
                        }}
                    >
                        {item.product.brand}
                    </Link>
                    <Typography variant="body2">{item.product.country}</Typography>
                    <Typography variant="body2">{item.product.alcohol}%</Typography>
                    <Typography variant="body2">{item.product.expirationDays} днів</Typography>
                </Box>
            </Box>

            <Divider/>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Цена (первая строка) */}
                <Box sx={{ display: "flex", alignItems: "end" }}>
                    <Typography variant="h5">
                        {item.price.toFixed(2)}
                    </Typography>
                    <Typography variant="body1">грн.</Typography>
                </Box>

                {item.product.description && <ExpandableText text={item.product.description} />}

                <ActionGroupButton
                    masActions={VariantActionsMas(item)}
                />
            </Box>

        </MyCard>
    );
}

export default CardVariantDrink;

