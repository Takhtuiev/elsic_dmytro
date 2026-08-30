import React from "react";
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Divider
} from "@mui/material";
import WineCard from "../components/WineCard/WineCard";

/* =========================
   ДАННЫЕ / КОНСТАНТЫ
   ========================= */

const heroContent = {
    title: "Знамениті італійські вина в Bag-in-Box",
    subtitle:
        "Від регіонів Фріулі, Венето, Абруццо та Апулія — у зручному форматі для ресторанів, барів, готелів, кейтерингу та приватних вечірок.",
    image: "/winebaginbox/bag_in_box_hero.jpg",
};

const quote = {
        text:
            "«Хороше вино — як хороший фільм: воно швидко закінчується, залишаючи чудовий післясмак; з кожним ковтком в ньому відкривається щось нове…»",
        author: "Федеріко Фелліні, режисер",
    };


const GOALS_SECTION = {
    title: "До чого ми прагнемо",
    image: "/winebaginbox/wine_3.jpg",
    items: [
        "Зробити відомі італійські вина доступними українському споживачу без компромісів у якості.",
        "Дати закладам змогу пропонувати преміальні вина побокально — без втрат і залишків.",
        "Розвивати культуру розливного вина у форматі Bag-in-Box в HoReCa сегменті."
    ]
};
const ADVANTAGES = [
    {
        title: "Якість",
        text: "Ми співпрацюємо з провідними італійськими виноробнями, що дотримуються традицій DOC та IGT. Кожне вино проходить контроль якості — від збору винограду до фасування у Bag-in-Box."
    },
    {
        title: "Обʼєм",
        text: "10-літровий Bag-in-Box ≈ 13+ пляшок по 0,75 л; 3-літровий ≈ 4 пляшки. Більше вина — менше логістики.",
    },
    {
        title: "Зручність",
        text: "Не потрібне спеціальне обладнання: відкрив, підніс келих до краника — і готово. Простота зберігання та експлуатації.",
    },
    {
        title: "Герметичність",
        text: "Вино не окислюється завдяки відсутності контакту з повітрям — смак стабільний до останньої порції.",
    },
    {
        title: "Екологічність",
        text: "1 мішок + 1 кран + 1 коробка ≈ 200 г пакування — значно легше та екологічніше, ніж десятки порожніх пляшок.",
    },
    {
        title: "Ціна",
        text: "Вигідний перерахунок на 0,75 л: часто у 2–4 рази дешевше за аналогічні роздрібні вина при тій же якості.",
    }
];

export const WINES = [
    {
        title: "PINOT GRIGIO DOC",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Класичне біле вино з ароматом зеленого яблука, груші та білого перцю. Свіже, збалансоване, з приємною кислотністю.",
        alcohol: "12%",
        sugar: "3–5 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "біле",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "FRIULANO DOC",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Типове біле вино з Фріулі з ароматом мигдалю, білих квітів і стиглої груші. Насичене тіло та гармонійний післясмак.",
        alcohol: "12.5%",
        sugar: "3–6 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "біле",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "MALVASIA ISTRIANA",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Витончене біле вино з ароматом цитрусових, жасмину та трав'яних нот. Свіжа кислотність і м’який, довгий післясмак.",
        alcohol: "12%",
        sugar: "4–7 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "біле",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "MOSCATO GIALLO",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Ароматне напівсолодке вино з нотами персика, абрикоса й мускатного горіха. Легке, освіжаюче, з приємною солодкістю.",
        alcohol: "11%",
        sugar: "35–45 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "біле",
        type: "тихе",
        sweetness: "напівсолодке",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "RIBOLLA GIALLA",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Свіже біле вино з ароматами цитрусових та білих квітів. Легке, мінеральне, з делікатною кислотністю.",
        alcohol: "12%",
        sugar: "3–6 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "біле",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "MALBECH",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Насичене рубінове вино з нотами чорної смородини, сливи та шоколаду. М’які таніни, оксамитова текстура.",
        alcohol: "13%",
        sugar: "4–7 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "червоне",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "PRIMITIVO DI PUGLIA",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Густе, насичене вино зі стиглих ягід, чорної вишні та спецій. Повнотіле, теплий і тривалий післясмак.",
        alcohol: "13.5%",
        sugar: "4–8 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "червоне",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "PINOT NERO",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Елегантне вино з ароматами вишні, малини та пряних нот. Легке тіло, м’які таніни, чистий фруктовий післясмак.",
        alcohol: "12.5%",
        sugar: "4–7 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "червоне",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "TRAMINER AROMATICO",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Складний аромат троянди, лічи, меду та спецій. Гармонійний смак, легка маслянистість.",
        alcohol: "12%",
        sugar: "8–12 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "біле",
        type: "тихе",
        sweetness: "напівсухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "ROSSO TERRE DI CHIETI",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "Соковите, гармонійне вино з ароматами червоних ягід, спецій і легких деревних нот. М’який післясмак.",
        alcohol: "13%",
        sugar: "4–8 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "червоне",
        type: "тихе",
        sweetness: "сухе",
        img: "/winebaginbox/wine_2.jpg"
    },
    {
        title: "STRAROSSO",
        brand: "SERENA WINES 1881",
        country: 'Італія',
        description: "М’яке червоне напівсухе вино з ароматом вишні, сливи та ванілі. Добре збалансований смак і приємний післясмак.",
        alcohol: "12.5%",
        sugar: "10–15 г/л",
        volume: "3/5/10",
        packaging: "Bag-in-Box",
        color: "червоне",
        type: "тихе",
        sweetness: "напівсухе",
        img: "/winebaginbox/wine_2.jpg"
    }
];


export default function BagInBoxPage() {
    return (
        <Container maxWidth="lg">

            {/* hero */}
            <Box
                sx={{
                    width: "100%",
                    minHeight: { xs: "40vh", sm: "50vh", md: "60vh", lg: "70vh", xl: "80vh" },
                    backgroundImage: `url(${heroContent.image})`,
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


            {/* Intro + Quote */}
            <Box my={6}>
                <Grid container spacing={4} alignItems="center">
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Typography variant="h5" fontWeight={600} gutterBottom>
                            Торгова компанія Шандрук — бег-ін-бокси для професіоналів і подій
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Ми пропонуємо італійські вина високої якості у форматі Bag-in-Box — зручному, економному й надійному рішенні для ресторанів, барів, готелів, кейтерингу та приватних подій.
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Беги постачаються у форматах 3, 5 і 10 літрів — від романтичної вечері до масштабного банкету.
                        </Typography>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Card elevation={2} sx={{ bgcolor: "background.paper" }}>
                            <CardContent>
                                <Typography variant="subtitle1" fontStyle="italic" gutterBottom>
                                    {quote.text}
                                </Typography>
                                <Divider sx={{ my: 1 }} />
                                <Typography variant="caption" color="text.secondary">
                                    {quote.author}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>

            {/* Цели */}
            <Card
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row-reverse' },
                    my: 6,
                    borderRadius: 2,
                    boxShadow: 3
                }}
            >
                <CardMedia
                    component="img"
                    image={GOALS_SECTION.image}
                    alt={GOALS_SECTION.title}
                    sx={{
                        width: { xs: '100%', md: '50%' },
                        objectFit: 'cover'
                    }}
                />
                <CardContent sx={{ flex: 1, px: 4, py: 3 }}>
                    <Typography variant="h5" fontWeight={600} textAlign="center">
                        {GOALS_SECTION.title}
                    </Typography>
                    <Grid container spacing={2} py={3}>
                        {GOALS_SECTION.items.map((goal, i) => (
                            <Grid key={i} xs={12}>
                                <Box sx={{ display: "flex", alignItems: "flex-start", gap: 3, mb: 1 }}>
                                    <Typography
                                        variant="h5"
                                        sx={{ fontWeight: 700, color: "primary.main", flexShrink: 0 }}
                                    >
                                        {`0${i + 1}`.slice(-2)}
                                    </Typography>
                                    <Typography variant="body1">{goal}</Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>
                </CardContent>
            </Card>

            {/* Преимущества */}
            <Box my={10}>
                <Typography variant="h4" fontWeight={600} textAlign="center" mb={5} sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                    Переваги наших вин у Bag-in-Box
                </Typography>

                <Grid container spacing={4}>
                    {ADVANTAGES.map((item, i) => (
                        <Grid size={{ xs: 12, sm: 6 }} key={i}>
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, pl: { sm: 1 }, borderLeft: { sm: "3px solid" }, borderColor: "primary.main" }}>
                                <Typography variant="h6" fontWeight={700} sx={{ color: "primary.main" }}>
                                    {item.title}
                                </Typography>
                                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                    {item.text}
                                </Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
            </Box>

            {/* Карточки вин */}
            <Grid container spacing={4}>
                {WINES.map((wine, index) => (
                    <Grid size={{ xs: 12, md: 6 }} key={index}>
                        <WineCard
                            wine={wine}
                            imageRight={index % 2 !== 0} // правая карточка в ряду
                        />
                    </Grid>
                ))}
            </Grid>

            {/* Footer Note */}
            <Box mt={6} mb={4} textAlign="center">
                <Typography variant="body2" color="text.secondary" paragraph>
                    Наш асортимент Bag-in-Box — практичне та економне рішення для HoReCa і приватних подій. Зв’яжіться з нами для індивідуальної пропозиції та умов співпраці.
                </Typography>
            </Box>
        </Container>
    );
}
