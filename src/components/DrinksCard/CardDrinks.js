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

    // Безопасное извлечение варианта
    const variant = item?.variants?.[varItem];

    // Если нет данных — не отображаем карточку
    if (!item || !variant) {
        return <Typography  variant="caption" sx={{ p: 2, color: 'gray' }}>Вариант недоступен</Typography>;
    }

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
                    image={
                        variant.imageUrl
                            ? `${API_URL}/${variant.imageUrl}?ts=${item.lastUpdated}`
                            : "/default-image.png"
                    }
                    alt={item.name}
                    sx={{
                        width: "48%",
                        height: "auto",
                        maxHeight: "10rem",
                        objectFit: "contain",
                        flexShrink: 0,
                    }}
                />

                {/* Правая половина - текст */}
                <Box sx={{ width: "48%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                    <Rating
                        precision={0.5}
                        value={item.rating || 0}
                        readOnly
                        sx={{
                            mx: 0,
                            my: 1,
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
                        sx={{ textAlign: "left", display: "block" }}
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
                {/* Цена */}
                <Box sx={{ display: "flex", alignItems: "end" }}>
                    <Typography variant="h5">
                        {typeof variant.price === "number" ? variant.price.toFixed(2) : '—'}
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
