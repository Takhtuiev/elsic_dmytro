import {
    CardMedia,
    Divider, Link,
    Rating, Typography,
} from "@mui/material";
import React, {useState} from "react";
import { API_URL } from "../../CONSTANTS/EndPoints";
import {useNavigate} from "react-router-dom";
import ExpandableText from "../MyComponent/ExpandableText";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {DrinkActionsMas} from "./DrinkActionsMas";
import {Box} from "@mui/system";
import CardDrinkSelectVariant from "./CardDrinkSelectVariant";
import MyCard from "../MyComponent/MyCard";

function CardDrinks({ product, setAction }) {

    const [varItem, setVarItem] = useState(0);
    const navigate = useNavigate();

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + product.id )}}
            sx={{flexDirection: 'column'}}
        >
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: 'center' }}>
                <Typography variant="h5" sx={{ textAlign: 'center' }}>{product.name}</Typography>
            </Box>

            <Divider/>

            {/* Контейнер для изображения и текста */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p:0 }}>
                {/* Левая половина - изображение */}
                <CardMedia
                    component="img"
                    image={product.variants[varItem].imageUrl && API_URL + "/" + product.variants[varItem].imageUrl + '?ts=' + product.lastUpdated}
                    alt={product.name}
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
                        value={product.rating}
                        readOnly
                        sx={{
                            mx: 0,
                            my: 1, // Исправлено "mY" → "my"
                            fontSize: "small",
                        }}
                    />
                    <Typography variant="body2">{product.productType}</Typography>
                    <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate("/brand/" + product.brand);
                        }}
                        sx={{
                            textAlign: "left",
                            display: "block", // Позволяет тексту занимать всю ширину контейнера
                        }}
                    >
                        {product.brand}
                    </Link>
                    <Typography variant="body2">{product.country}</Typography>
                    <Typography variant="body2">{product.alcohol}%</Typography>
                    <Typography variant="body2">{product.expirationDays} днів</Typography>
                </Box>
            </Box>

            <Divider/>
            <CardDrinkSelectVariant
                product={product}
                selectedVariant={varItem}
                setSelectedVariant={setVarItem}
            />


            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Цена (первая строка) */}
                <Box sx={{ display: "flex", alignItems: "end" }}>
                    <Typography variant="h5">
                        {product.variants[varItem].price.toFixed(2)}
                    </Typography>
                    <Typography variant="body1">грн.</Typography>
                </Box>

                {product.description && <ExpandableText text={product.description} />}

                <ActionGroupButton
                    masActions={DrinkActionsMas(product)}
                    setAction={setAction}
                />
            </Box>
        </MyCard>
    );
}

export default CardDrinks;
