import {
    CardMedia,
    Divider, Link,
    Rating, Typography
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

function CardLineDrinks({ product, setAction }) {

    const [varItem, setVarItem] = useState(0);
    const navigate = useNavigate();

    return (
        <MyCard
            onClick={() => { navigate("/drinksDetails/" + product.id)}}
            sx={{alignItems: 'center'}}
        >

            {/* Левая половина - изображение */}
            <CardMedia
                component="img"
                image={product.variants[varItem].imageUrl && API_URL + "/" + product.variants[varItem].imageUrl + '?ts=' + product.lastUpdated}
                alt={product.name}
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
                        <Typography variant="h6"  component="span">{product.name}</Typography>{" "}
                    </Box>
                    <Rating
                        precision={0.5}
                        value={product.rating}
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
                        }}
                    >
                        <CardDrinkSelectVariant
                            product={product}
                            selectedVariant={varItem}
                            setSelectedVariant={setVarItem}
                        />
                    </Box>
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap", // Позволяет перенос на новую строку
                            gap: 1, // Отступы между блоками
                            justifyContent: "space-between",
                        }}
                    >

                        <Box  sx={{ minWidth: "8rem", flexGrow: 1 }}>
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
                        </Box>

                        <Box  sx={{ minWidth: "8rem", flexGrow: 1}}>
                            <Typography variant="body2">{product.productType}</Typography>
                            <Typography variant="body2">{product.alcohol}%</Typography>
                            <Typography variant="body2">{product.expirationDays} днів</Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center"}}>
                        <Typography variant="h5" sx={{ whiteSpace: "nowrap" }}>
                            {product.variants[varItem].price.toFixed(2)}
                        </Typography>
                        <Typography variant="body1">грн.</Typography>
                    </Box>
                </Box>
                <Divider/>
                {product.description && <ExpandableText text={product.description}  lines={1}/>}
            </Box>
            <ActionGroupButton
                masActions={DrinkActionsMas(product)}
                setAction={setAction}
                orientation={"vertical"}
            />
        </MyCard>
    );
}

export default CardLineDrinks;
