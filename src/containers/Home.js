import React from 'react';
import {
    Button,
    Card,
    CardContent,
    Typography,
    List,
    ListItem,
    ListItemIcon,
    ListItemText, CardMedia, CardActionArea, Chip
} from "@mui/material";
import {Box} from "@mui/system";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';


const heroContent = {
    imageUrl: '/home/hero.jpg',
    title: "Наповнюємо змістом час і простір",
    subtitle: "Дистрибуція пива, сидру, лимонадів, вин і мінеральної води — національні та європейські партнери."
};

const urlCooperation = '/home/cooperation.jpg'

const directions = [
    {
        title: "Дистрибуція напоїв",
        desc: "Пиво, сидр, лимонади, вина, вода — у кегах і пляшках",
        img: '/home/logistic.jpg',
    },
    {
        title: "Імпорт італійських вин",
        desc: "Prosecco, тихі вина, VINO DE BANDEIRA та інше",
        img: '/home/import.jpg',
    },
    {
        title: "Сервіс та обладнання",
        desc: "Монтаж, обслуговування систем розливу та оренда",
        img: '/home/service.jpg',
    },
    {
        title: "Мережа барів",
        desc: "РозлиWine — проекти у Києві",
        img: '/home/chainofbars.jpg',
    },
];

const drinks = [
    { title: "Пиво в кегах", img: "/home/beer_kega.jpg", link: "/drinks/beer/kega" },
    { title: "Пиво в пляшках та банках", img: "/home/beer.jpg", link: "/drinks/page" },
    { title: "Вина в кегах", img: "/home/wine_kega.jpg", link: "/drinks/wine_kega" },
    { title: "Вина в Bag\u202Fin\u202FBox", img: "/home/wine.jpg", link: "/drinks/wine_baginbox" },
    { title: "Мінеральна вода", img: "/home/water.jpg", link: "/drinks/water" },
    { title: "Лимонади / Сидр", img: "/home/lemonade.jpg", link: "/drinks/soft" },
]


const Home = () => {

    return (
        <Box my={2}>

            {/* hero */}
            <Box
                sx={{
                    width: "100%",
                    minHeight: { xs: "40vh", sm: "50vh", md: "60vh", lg: "70vh", xl: "80vh" },
                    backgroundImage: `url(${heroContent.imageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    color: "#fff",
                }}
            >
                {/* Верхний текст */}
                <Box sx={{ background: "rgba(0,0,0,0.5)", p: 2, textAlign: "center" }}>
                    <Typography
                        variant="h3"
                        fontWeight={700}
                        sx={{ textShadow: "0 3px 10px rgba(0,0,0,1)" }}
                    >
                        {heroContent.title}
                    </Typography>
                </Box>

                {/* Нижний текст */}
                <Box sx={{ background: "rgba(0,0,0,0.5)", p: 2, textAlign: "center" }}>
                    <Typography
                        variant="h6"
                        sx={{ mx: "auto", maxWidth: "800px", textShadow: "0 2px 5px rgba(0,0,0,1)" }}
                    >
                        {heroContent.subtitle}
                    </Typography>
                </Box>
            </Box>

            {/* Блок с информацией между баннером и направлениями */}
            <Container maxWidth="md" sx={{ my: 8 }}>
                <Typography
                    variant="h5"
                    sx={{ fontWeight: 500, textAlign: "center", mb: 2 }}
                >
                    Ми об'єднуємо якість, надійність та інновації у сфері дистрибуції напоїв
                </Typography>
                <Typography
                    variant="body1"
                    sx={{ textAlign: "center" }}
                >
                    Наша мета — забезпечити партнерів продуктами найвищої якості та сервісом, який перевищує очікування. Ми завжди відкриті до нових ідей та співпраці.
                </Typography>
            </Container>


            {/* Основные направления */}
            <Container >
                <Typography variant="h3" sx={{ fontWeight: 400, mb: 3 }}>Основні напрямки діяльності</Typography>

                <Grid container spacing={3}>
                    {directions.map((item, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6 }}>
                            <Card
                                variant="outlined"
                                sx={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                }}
                            >
                                <CardActionArea
                                    onClick={() => console.log(item.title)}
                                    //data-active={true}
                                    sx={{
                                        height: '100%',
                                        '&[data-active]': {
                                            backgroundColor: 'action.selected',
                                            '&:hover': {
                                                backgroundColor: 'action.selectedHover',
                                            },
                                        },
                                    }}
                                >
                                    <CardMedia
                                        component="img"
                                        image={item.img}
                                        alt={item.title}
                                        sx={{
                                            height: "8rem",
                                            width: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                    <CardContent>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            {item.title}
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            {item.desc}
                                        </Typography>
                                    </CardContent>
                                </CardActionArea>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            <Container maxWidth="md" sx={{ my: 8 }}>
                <Typography variant="h4" sx={{ fontWeight: 500, mb: 4, textAlign: "center" }}>
                    Про нас
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {[
                        "2007: Компанія ШАНДРУК заснована у Києві як дистриб'ютор пива та напоїв у кегах і пляшках.",
                        "Перші партнери: регіональні пивоварні заводи малої та середньої потужності (Бердичівський, Уманьпиво, Опілля, Микулинецький, Славутський, Хмельпиво, Павлівський).",
                        "2017: Власна ТМ Alt Hopfen стала популярною серед поціновувачів живого пива.",
                        "Розширення асортименту: імпорт Birra Dolomiti, сидр, квас, лимонади, вина в бег-ін-боксах.",
                        "Тривала співпраця з великими мережами супермаркетів та регіональними дистриб'юторами."
                    ].map((fact, i) => (
                        <Typography key={i} variant="body1">
                            • {fact}
                        </Typography>
                    ))}
                </Box>
            </Container>



            {/* Представлені напої */}
            <Container sx={{ my: 8 }}>
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: 500,
                        mb: 4,
                        textAlign: "center",
                    }}
                >
                    Напої, доступні для дистрибуції вже сьогодні
                </Typography>

                <Grid container spacing={3} justifyContent={'center'}>
                    {drinks.map((item, i) => (
                        <Grid key={i} size={{xs:12, sm:6, md:3}}>
                            <Card
                                onClick={() => (window.location.href = item.link)}
                                sx={{
                                    //width: 250,
                                    height: 250,
                                    borderRadius: 3,
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                                    transition: "transform 0.3s ease, box-shadow 0.3s ease",
                                    backgroundImage: `url(${item.img})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                    display: "flex",
                                    alignItems: "flex-end",
                                    "&:hover": {
                                        transform: "translateY(-4px)",
                                        boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: "100%",
                                        background: "rgba(0,0,0,0.5)",
                                        color: "#fff",
                                        p: 2,
                                        textAlign: "center",
                                    }}
                                >
                                    <Typography
                                        variant="h6"
                                        sx={{
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: 1,
                                        }}
                                    >
                                        {item.title}
                                    </Typography>
                                </Box>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Container>


            {/* Чому обирають нас */}
            <Container maxWidth="sm" sx={{my: 8}}>
                <Typography
                    variant="h4"
                    sx={{ fontWeight: 500, mb: 2, textAlign: "center" }}
                >
                    Чому обирають нас
                </Typography>

                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: "auto", mr: 2 }}>
                                    <CheckCircleOutlineIcon  sx={{ color: 'success.main' }} />
                                </ListItemIcon>
                                <ListItemText primary="Надійні постачальники" />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: "auto", mr: 2 }}>
                                    <CheckCircleOutlineIcon  sx={{ color: 'success.main' }} />
                                </ListItemIcon>
                                <ListItemText primary="Європейські партнери" />
                            </ListItem>
                        </List>
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }}>
                        <List>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: "auto", mr: 2 }}>
                                    <CheckCircleOutlineIcon  sx={{ color: 'success.main' }} />
                                </ListItemIcon>
                                <ListItemText primary="Гнучкі умови співпраці" />
                            </ListItem>
                            <ListItem>
                                <ListItemIcon sx={{ minWidth: "auto", mr: 2 }}>
                                    <CheckCircleOutlineIcon  sx={{ color: 'success.main' }} />
                                </ListItemIcon>
                                <ListItemText primary="Мережа барів у Київі" />
                            </ListItem>
                        </List>
                    </Grid>
                </Grid>
            </Container>

            {/* Співпраця */}
            <Container maxWidth="lg" sx={{ my: 8 }}>
                <Card sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, borderRadius: 3, boxShadow: 3, overflow: "hidden" }}>
                    {/* Текстовая часть */}
                    <Box sx={{ flex: 1, p: 4, display: "flex", flexDirection: "column", gap: 3 }}>
                        <Typography variant="h3" sx={{ fontWeight: 500 }}>
                            Співпраця
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                            Ми віримо, що у бізнесі та у житті найвигідніша стратегія — це win-win.
                            Ми завжди готові до будь-якої форми взаємовигідної колаборації зі всіма, хто сповідує цей принцип.
                        </Typography>

                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
                            {[
                                "Поставка продукції",
                                "Імпортні контракти",
                                "Обладнання для розливу",
                                "Оренда обладнання",
                                "Комплексний супровід",
                                "Обладнання LINDR",
                                "Партнерство у барному бізнесі",
                            ].map((item, index) => (
                                <Chip
                                    key={index}
                                    label={item}
                                    sx={{
                                        fontWeight: 500,
                                        fontSize: "1.2rem",
                                        backgroundColor: "background.paper",
                                        border: "1px solid",
                                        borderColor: "divider",
                                        borderRadius: 2,
                                        px: 3,
                                        py: 1.5,
                                        // width не указываем — Chip занимает только ширину текста
                                    }}
                                />
                            ))}
                        </Box>

                        <Button
                            variant="contained"
                            href="/cooperation"
                            sx={{
                                textTransform: "none",
                                px: 4,
                                py: 1.5,
                                borderRadius: 2,
                                fontWeight: 600,
                                alignSelf: "start",
                            }}
                        >
                            Дізнатися більше...
                        </Button>
                    </Box>

                    {/* Изображение справа */}
                    <CardMedia
                        component="img"
                        image={urlCooperation}
                        alt="Співпраця баннер"
                        sx={{
                            width: { xs: "100%", md: 400 },
                            height: { xs: 300, md: "auto" },
                            objectFit: "cover",
                        }}
                    />
                </Card>
            </Container>

        </Box>

    )
}

export default Home;