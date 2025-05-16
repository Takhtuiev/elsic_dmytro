import {
    CardMedia,
    Divider, Link,
    Rating, Typography
} from "@mui/material";
import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import ExpandableText from "../MyComponent/ExpandableText";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {DrinkActionsMas} from "./DrinkActionsMas";
import {Box} from "@mui/system";
import CardDrinkSelectVariant from "./CardDrinkSelectVariant";
import MyCard from "../MyComponent/MyCard";
import {API_URL} from "../../config";
import Grid from "@mui/material/Grid2";

function CardLineDrinks({ item, setAction }) {

const [varItem, setVarItem] = useState(0);
const navigate = useNavigate();

return (
    <MyCard
        onClick={() => { navigate("/drinksDetails/" + item.id)}}
        sx={{alignItems: 'center'}}
    >

        {/* Левая половина - изображение */}
        <CardMedia
            component="img"
            image={item.variants[varItem].imageUrl && API_URL + "/" + item.variants[varItem].imageUrl + '?ts=' + item.lastUpdated}
            alt={item.name}
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
                    <Typography variant="h6"  component="span">{item.name}</Typography>{" "}
                </Box>
                <Rating
                    precision={0.5}
                    value={item.rating}
                    readOnly
                    sx={{
                        ml: "auto", // Прижимает рейтинг к правому краю
                        px: 1,
                        fontSize: "small",
                    }}
                />
            </Box>
            <Divider/>
            <Grid container spacing={2} alignItems="center" justifyContent={"space-between"}>
                {/* Селектор вариантов */}
                <Grid >
                    <CardDrinkSelectVariant
                        product={item}
                        selectedVariant={varItem}
                        setSelectedVariant={setVarItem}
                    />
                </Grid>

                {/* Бренд и страна + Тип, алкоголь, срок годности */}
                <Grid container spacing={2} size={"grow"} minWidth={"10rem"}>
                    <Grid size={{ xs: 12, sm:6 }} sx={{ textAlign: { xs: "left", sm: "right" } }}>
                        <Link
                            component="button"
                            variant="body2"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate("/brand/" + item.brand);
                            }}
                            sx={{ textAlign: { xs: "left", sm: "right" } }}
                        >
                            {item.brand}
                        </Link>
                        <Typography variant="body2">{item.country}</Typography>
                    </Grid>

                    <Grid  size={{ xs: 12, sm:6 }}>
                        <Typography variant="body2">{item.productType}</Typography>
                        <Typography variant="body2">{item.alcohol}%</Typography>
                        <Typography variant="body2">{item.expirationDays} днів</Typography>
                    </Grid>
                </Grid>

                {/* Цена */}
                <Grid
                    sx={{
                        flexShrink: 0,
                        whiteSpace: "nowrap",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    <Typography variant="h5">
                        {item.variants[varItem].price.toFixed(2)}
                    </Typography>
                    <Typography variant="body1">грн.</Typography>
                </Grid>
            </Grid>

            <Divider/>
            {item.description && <ExpandableText text={item.description}  lines={1}/>}
        </Box>
        <ActionGroupButton
            masActions={DrinkActionsMas(item)}
            setAction={setAction}
            orientation={"vertical"}
        />
    </MyCard>
);


}

export default CardLineDrinks;
