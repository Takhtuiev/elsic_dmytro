import {
    CardMedia,
    Divider, Link,
    Rating, Typography,
} from "@mui/material";
import React, {useState} from "react";
import { API_URL } from "../../config";
import {useNavigate} from "react-router-dom";
import ExpandableText from "../MyComponent/ExpandableText";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {DrinkActionsMas} from "./DrinkActionsMas";
import {Box} from "@mui/system";
import CardDrinkSelectVariant from "./CardDrinkSelectVariant";
import MyCard from "../MyComponent/MyCard";

function CardDrinks({ item, setAction }) {

    const [varItem, setVarItem] = useState(0);
    const navigate = useNavigate();

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + item.id )}}
            sx={{flexDirection: 'column'}}
        >
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: 'center' }}>
                <Typography variant="h5" sx={{ textAlign: 'center' }}>{item.name}</Typography>
            </Box>

            <Divider/>

            {/* Контейнер для изображения и текста */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p:0 }}>
                {/* Левая половина - изображение */}
                <CardMedia
                    component="img"
                    image={item.variants[varItem].imageUrl && API_URL + "/" + item.variants[varItem].imageUrl + '?ts=' + item.lastUpdated}
                    alt={item.name}
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
                        value={item.rating}
                        readOnly
                        sx={{
                            mx: 0,
                            my: 1, // Исправлено "mY" → "my"
                            fontSize: "small",
                        }}
                    />
                    <Typography variant="body2">{item.productType}</Typography>
                    <Link
                        component="button"
                        variant="body2"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate("/brand/" + item.brand);
                        }}
                        sx={{
                            textAlign: "left",
                            display: "block", // Позволяет тексту занимать всю ширину контейнера
                        }}
                    >
                        {item.brand}
                    </Link>
                    <Typography variant="body2">{item.country}</Typography>
                    <Typography variant="body2">{item.alcohol}%</Typography>
                    <Typography variant="body2">{item.expirationDays} днів</Typography>
                </Box>
            </Box>

            <Divider/>
            <CardDrinkSelectVariant
                product={item}
                selectedVariant={varItem}
                setSelectedVariant={setVarItem}
            />


            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                {/* Цена (первая строка) */}
                <Box sx={{ display: "flex", alignItems: "end" }}>
                    <Typography variant="h5">
                        {item.variants[varItem].price.toFixed(2)}
                    </Typography>
                    <Typography variant="body1">грн.</Typography>
                </Box>

                {item.description && <ExpandableText text={item.description} />}

                <ActionGroupButton
                    masActions={DrinkActionsMas(item)}
                    setAction={setAction}
                />
            </Box>
        </MyCard>
    );
}

export default CardDrinks;
