import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Container,
    List,
    ListItem,
    ListItemText,
} from '@mui/material';
import React from "react";
import WineCard from "../components/WineCard/WineCard";

export default function WineKega() {

    const heroContent = {
        title: "Вино, яке створює атмосферу",
        subtitle: "Італійські сухі ігристі вина та Spritz у кегах від SERENA WINES 1881" +
            " — для професіоналів HoReCa, які цінують якість, ефективність і стиль.",
        image: "/winekega/hero_wine_kega.jpg",
    };


    const WINES = [
        {
            title: 'BIANCO PIU FIZZ',
            brand: 'SERENA WINES 1881',
            country: 'Італія',
            description: 'Ігристе сухе біле вино із сортів білого винограду, включаючи сорт GLERA. Характерний фруктовий аромат, сухий округлий смак.',
            alcohol: '10,5%',
            sugar: '9–13 г/л',
            volume: '24',
            packaging: 'кега',
            color: 'біле',
            type: 'ігристе',
            sweetness: 'сухе',
            img: '/winekega/BIANCO_PIU_FIZZ.jpg'
        },
        {
            title: 'BIANCO GLERA',
            brand: 'SERENA WINES 1881',
            country: 'Італія',
            description: 'Ігристе сухе біле вино із сорту винограду GLERA. Характерний фруктовий аромат, сухий округлий смак.',
            alcohol: '10,5%',
            sugar: '11–16 г/л',
            volume: '24',
            packaging: 'кега',
            color: 'біле',
            type: 'ігристе',
            sweetness: 'сухе',
            img: '/winekega/BIANCO_GLERA.jpg'
        },
        {
            title: 'ROSATO PIU RESTINO',
            brand: 'SERENA WINES 1881',
            country: 'Італія',
            description: 'Ігристе сухе рожеве вино із сортів винограду GLERA та PINOT NOIR. Фруктово-ягідний аромат, насичений округлий смак.',
            alcohol: '10,5%',
            sugar: '10–14 г/л',
            volume: '24',
            packaging: 'кега',
            color: 'рожеве',
            type: 'ігристе',
            sweetness: 'сухе',
            img: '/winekega/ROSATO_PIU_RESTINO.jpg'
        },
        {
            title: 'COCKTAIL PIU SPRITZ',
            brand: 'SERENA WINES 1881',
            country: 'Італія',
            description: 'Ігристе ароматизоване коктейльне вино з виноматеріалів, основа для Spritz. Характерний аромат, насичений округлий смак.',
            alcohol: '8,0%',
            sugar: '70–75 г/л',
            volume: '20',
            packaging: 'кега',
            color: 'рожеве',
            type: 'коктейльне',
            sweetness: 'полусладке',
            img: '/winekega/COCKTAIL_PIU_SPRITZ.jpg'
        }
    ];



    const COCKTAILS = [
        {
            title: 'Белліні',
            image: '/winekega/bellini.jpg',
            description:
                'Алкогольний коктейль, винайдений у Венеції в першій половині XX століття. Поєднання ігристого вина (традиційно просекко) та персикового пюре. Один із найпопулярніших коктейлів Італії, офіційно визнаний IBA у категорії «Сучасна класика».',
        },
        {
            title: 'Мімоза',
            image: '/winekega/mimosa.jpg',
            description:
                'Свіжість апельсинового соку і витонченість ігристого вина. Класичний сніданковий коктейль, популярний у всьому світі. Також входить до списку офіційних коктейлів IBA.',
        },
        {
            title: 'Спрітц (Венеціанський)',
            image: '/winekega/spritz.jpg',
            description:
                'Легкий аперитив із суміші ігристого вина, Аперолю або Кампарі та содової води. Один із символів Венеції та офіційний коктейль IBA у категорії «Напої нової ери».',
        },
    ];


    const importCard =
        {
            img: '/winekega/prosecco_kega.jpg',
            title: 'Імпорт від лідера у виробництві просекко.',
            subtitle: 'Від прямого імпортера ігристих вин у кегах.',
            list: [
                'Ми, як дистриб’ютор італійських ігристих вин у кегах, постачаємо українські ресторани, бари та кафе високоякісним продуктом. Пропонуємо сухе ігристе вино у кегах на розлив, але його виробник не використовує назву «просекко у кегах», хоча воно виготовлене з того ж сорту винограду Глера (GLERA).',
                'Чому воно не називається розливним просекко? За італійським та міжнародним законодавством, Prosecco може називатися лише вино, розлите у скляні пляшки.',
                'Тому, якщо ви бачите пропозиції «просекко у кегах» в Україні, радимо враховувати юридичні нюанси при формуванні меню для свого ресторану, бару або кафе.'
            ]
        }

    const bisnesCard =
        {
            img: '/winekega/prosecco_kran.jpg',
            title: 'Вино, що працює на ваш бізнес.',
            subtitle: 'Прямо з Італії — у келих ваших гостей',
            list: [
                'Ми працюємо безпосередньо з компанією SERENA WINES 1881 — світовим лідером з виробництва просекко.',
                'Ми — офіційний імпортер і постачальник розливних ігристих та тихих вин у кегах від SERENA WINES 1881. Це гарантує оригінальність, стабільну якість і мінімальну націнку.',
                'Кеги пластикові та одноразові — не потрібно здавати або обліковувати. Просто передайте їх нашому водію під час наступної поставки.',
                'Вино у кегах знижує витрати закладу: немає втрат від відкритих пляшок, напої завжди охолоджені та готові до подачі.'
            ]
        }



    return (
        <Container >

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


            <Box
                my={10}
                textAlign="center"
                maxWidth="850px"
                mx="auto"
            >
                <Typography variant="h5" fontWeight={500} gutterBottom>
                    Ігристе, що створює настрій вашого закладу
                </Typography>

                <Typography variant="body1" color="text.secondary" my={2}>
                    Ми віримо, що хороше ігристе — це не просто напій, а частина атмосфери закладу.
                    Наші вина у кегах зберігають свіжість, смак і стабільність до останнього келиха —
                    забезпечуючи швидке обслуговування, мінімальні втрати і максимум задоволення для гостей.
                </Typography>
            </Box>


            {/* Перший інформаційний банер */}
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
                    image={importCard.img}
                    alt={importCard.title}
                    sx={{ width: { xs: '100%', md: 300 }, objectFit: 'cover' }}
                />
                <CardContent sx={{ flex: 1, px: 4, py: 3 }}>
                    <Box textAlign="center" mb={2}>
                        <Typography variant="h4" fontWeight={700} gutterBottom>
                            {importCard.title}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            {importCard.subtitle}
                        </Typography>
                    </Box>
                    <List sx={{ listStyleType: 'decimal', pl: 3 }}>
                        {importCard.list.map((text, idx) => (
                            <ListItem key={idx} sx={{ display: 'list-item', py: 1 }}>
                                <ListItemText primary={<Typography variant="body1">{text}</Typography>} />
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
            </Card>

            {/* Блок — Особливості співпраці з нами */}
            <Box
                my={10}
                textAlign="center"
                maxWidth="850px"
                mx="auto"
            >
                <Typography variant="h5" fontWeight={500} gutterBottom>
                    Особливості співпраці з нами
                </Typography>

                <Typography variant="body1" color="text.secondary" my={2}>
                    Ми створюємо рішення для HoReCa — барів, ресторанів, кав’ярень і готелів,
                    що цінують стабільність, ефективність і бездоганний сервіс.
                </Typography>

                <Typography variant="body1" color="text.secondary" my={2}>
                    Наш підхід — комплексний: ми підбираємо оптимальні ігристі та тихі вина у кегах,
                    забезпечуємо обладнання для розливу, встановлення й сервіс.
                    Це зменшує втрати, оптимізує витрати та гарантує стабільну якість у кожному келиху.
                </Typography>
            </Box>

            {/* Другий інформаційний банер */}
            <Card
                sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    my: 6,
                    borderRadius: 2,
                    boxShadow: 3
                }}
            >
                <CardMedia
                    component="img"
                    image={bisnesCard.img}
                    alt={bisnesCard.title}
                    sx={{ width: { xs: '100%', md: 300 }, objectFit: 'cover' }}
                />
                <CardContent sx={{ flex: 1, px: 4, py: 3 }}>
                    <Box textAlign="center" mb={2}>
                        <Typography variant="h4" fontWeight={700} gutterBottom>
                            {bisnesCard.title}
                        </Typography>
                        <Typography variant="h6" color="text.secondary">
                            {bisnesCard.subtitle}
                        </Typography>
                    </Box>
                    <List sx={{ listStyleType: 'decimal', pl: 3 }}>
                        {bisnesCard.list.map((text, idx) => (
                            <ListItem key={idx} sx={{ display: 'list-item', py: 1 }}>
                                <ListItemText primary={<Typography variant="body1">{text}</Typography>} />
                            </ListItem>
                        ))}
                    </List>
                </CardContent>
            </Card>

            {/* Обладнання для розливу */}
            <Box my={8} textAlign="center" maxWidth="800px" mx="auto">
                <Typography variant="h5" fontWeight={500} gutterBottom>
                    Обладнання для розливу ігристих вин
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Для розливу наших ігристих вин не потрібне спеціальне устаткування — підходить звичайна система для розливу пива.
                    Використовується <strong>забірна головка типу A (Флеш)</strong>.
                </Typography>
                <Typography variant="body1" color="text.secondary" mt={2}>
                    Для коктейлю <strong>Spritz</strong> застосовується <strong>забірна головка типу S (Корб)</strong>.
                    Усе обладнання легко інтегрується у вже наявну систему вашого бару або ресторану.
                </Typography>
            </Box>

            {/* Заголовок перед картками вин */}
            <Box textAlign="center" mt={8} mb={2}>
                <Typography variant="h4" fontWeight={500} gutterBottom>
                    Італійські ігристі вина у кегах
                </Typography>
                <Typography variant="body1" color="text.secondary" maxWidth="650px" mx="auto">
                    Асортимент від <strong>SERENA WINES 1881</strong> — це поєднання автентичного італійського смаку,
                    практичності формату кегів та стабільної якості для HoReCa.
                </Typography>
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


            {/* Традиційні коктейлі */}
            <Box my={10} textAlign="center">
                <Typography variant="h4" fontWeight={500} gutterBottom>
                    Традиційні коктейлі з ігристим вином
                </Typography>
                <Typography variant="body1" color="text.secondary" maxWidth="800px" mx="auto" mb={4}>
                    Наші ігристі вина у кегах — чудова основа для класичних коктейлів, які підкорили світ.
                    Створюйте автентичні смаки Італії у своєму закладі.
                </Typography>

                <Grid container spacing={4}>
                    {COCKTAILS.map((cocktail) => (
                        <Grid size={{xs:12, md:4}} key={cocktail.title}>
                            <Card
                                sx={{
                                    borderRadius: 3,
                                    height: '100%',
                                }}
                            >
                                <CardMedia
                                    component="img"
                                    image={cocktail.image}
                                    alt={cocktail.title}
                                    sx={{
                                        height: 200,
                                        width: '100%',
                                        objectFit: 'cover',
                                        borderTopLeftRadius: 12,
                                        borderTopRightRadius: 12,
                                    }}
                                />
                                <CardContent>
                                    <Typography
                                        variant="h6"
                                        fontWeight={600}
                                        gutterBottom
                                        sx={{ color: 'primary.main' }}
                                    >
                                        {cocktail.title}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {cocktail.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Container>
    );
}
