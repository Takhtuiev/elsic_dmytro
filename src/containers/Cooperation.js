// src/pages/Cooperation.jsx
import React from "react";
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia, Button,
} from "@mui/material";

const coop = [
    {
        id: "01",
        title: "Поставка",
        img: "/logistic.jpg",
        text: (
            <>
                Ми здійснюємо <strong>постачання, імпорт та дистрибуцію</strong> продукції
                від національних, регіональних та міжнародних виробників алкогольних і безалкогольних напоїв.
                <br /><br />
                До нашого асортименту входять:
                <ul style={{ marginTop: 8, marginBottom: 8 }}>
                    <li>пиво — у кегах та пляшках</li>
                    <li>сидри та лимонади</li>
                    <li>вина — ігристі у кегах, тихі у бег-ін-боксах, кріплені</li>
                    <li>вода у пляшках</li>
                </ul>
                <br />
                <strong>Надійна логістика</strong> та гнучка система співпраці гарантують безперебійне постачання продукції для вашого бізнесу.
            </>
        ),
    },

    {
        id: "02",
        title: "Технічний імпорт",
        img: "/import.jpg",
         text: "Імпорт продукції ваших європейських партнерів під замовлення."
    },
    {
        id: "03",
        title: "Обладнання та сервіс",
        img: "/service.jpg",
        text: "Ми пропонуємо повний комплекс послуг від підбору й встановлення у вашому закладі обладнання " +
            "для розливу напоїв до поставки балонів з газом і регулярної промивки системи. " +
            "Крім того, ми можемо придбати й поставити вам обладнання від відомого чеського виробника LINDR."
    },
    {
        id: "04",
        title: "Оренда обладнання",
        img: "/bar_rental.jpg",
        text: "Оренда обладнання для розливу напоїв на заходах — від масштабних презентацій і виставок " +
            "до весіль, корпоративів чи приватних вечірок. Це дозволяє організаторам зосередитися на гостях, " +
            "довіривши нам технічні деталі."
    },
    {
        id: "05",
        title: "Прямі імпортні контракти",
        img: "/import_wine.jpg",
        text: "Прямі імпортні контракти з європейськими партнерами на вина у пляшках " +
            "та бег-ін-боксах, каву, сири, прошутто, пасту, оливкову олію та інше."
    },
    {
        id: "06",
        title: "Мережа барів",
        img: "/chainofbars.jpg",
        text: (
            <>
                Розвиток в Україні мережі prosecco/винних барів <strong>RozliWine</strong> на умовах партнерства, що обговорюються.
                <br /><br />
                <strong>Діючі локації:</strong>
                <ul style={{ marginTop: 8, marginBottom: 8 }}>
                    <li>Київ, вул. Драгоманова, 2А</li>
                    <li>Київ, вул. Олеся Олеся, 6Б (ЖК Варшавський)</li>
                </ul>
                Ми запрошуємо нових партнерів приєднатися до розвитку мережі <strong>RozliWine</strong> у різних регіонах України.
            </>
        ),
    }
]


const Cooperation = () => {

    return (
        <Box my={2} >
            <Container sx={{ py:4 }}>
                <Typography
                    variant="h3"
                    sx={{ fontWeight: 700, textAlign: "center", pb: 4 }}
                >
                    Пропозиції для співпраці
                </Typography>
                <Typography variant="body1" sx={{ mx: 'auto', mb: 6,  textAlign: "center"  }}>
                    Ми завжди готові надати вам консультації щодо можливих варіантів співпраці з нами.
                 </Typography>


                <Grid container spacing={4} my={6}>
                    {coop.map((item, idx) => (
                        <Grid key={idx} size={{ xs: 12, md: 6 }}>
                            <Card variant="outlined" sx={{ height: "100%" }}>
                                <CardMedia
                                    component="img"
                                    height="180"
                                    image={item.img}
                                    alt={item.title}
                                />
                                <CardContent>
                                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
                                        {item.id}. {item.title}
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        {item.text}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>


                <Box
                    sx={(theme) => ({
                        backgroundColor: theme.palette.divider,
                        py: 4,
                        mt: 6,
                    })}
                >
                    <Container maxWidth="md" sx={{ textAlign: "center" }}>
                        <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                            Готові розпочати співпрацю?
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                            Зв’яжіться з нашою командою вже сьогодні, і ми допоможемо вам обрати найкращий формат партнерства.
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            href="/contacts"
                            sx={{ textTransform: "none", mr: 2 }}
                        >
                            Зв’язатися з нами
                        </Button>
                    </Container>
                </Box>

            </Container>

        </Box>
    );
};

export default Cooperation;
