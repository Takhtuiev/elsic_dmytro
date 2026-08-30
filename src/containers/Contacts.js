import React from "react";
import {
    Box,
    Container,
    Typography,
    Grid,
    Card,
    CardContent,
    CardActions,
    Button,
    IconButton,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/LocalPhone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import MapIcon from "@mui/icons-material/Map";
import FacebookIcon from "@mui/icons-material/Facebook";
import InstagramIcon from "@mui/icons-material/Instagram";

const offices = [
    {
        city: "Київ",
        email: "office@shandruk.com.ua",
        phone: "+38 067 544 64 45",
        address: "04052, м.Київ, вул. Глибочицька, 17 оф.417",
    },
    {
        city: "Львів",
        email: "office_lviv@shandruk.com.ua",
        phone: "+38 067 544 64 45",
        address: "Львів",
    },
];

const Contacts = () => {
    return (
        <Box my={2}>
            <Container sx={{ py: 4 }}>
                {/* Верхний баннер */}
                <Box
                    sx={{
                        position: "relative",
                        height: { xs: 220, md: 320 },
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 6,
                        borderRadius: 3,
                        overflow: "hidden",
                        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                >
                    {/* Фоновое изображение */}
                    <Box
                        component="img"
                        src="/contacts.jpg" // ← сюда положи баннер (может быть фото офиса или пива)
                        alt="Контакти"
                        sx={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            filter: "brightness(0.5)",
                        }}
                    />

                    {/* Текст */}
                    <Typography
                        variant="h2"
                        sx={{
                            color: "white",
                            fontWeight: 700,
                            textShadow: "0 4px 12px rgba(0,0,16,1)",
                            textAlign: "center",
                            zIndex: 1,
                        }}
                    >
                        Контакти
                    </Typography>
                    <Typography
                        variant="body1"
                        color="text.secondary"
                        sx={{
                            color: "white",
                            maxWidth: 700,
                            //mx: "auto",
                            textShadow: "0 4px 12px rgba(0,0,16,1)",
                            textAlign: "center",
                            zIndex: 1,
                        }}
                    >
                        Ми завжди раді спілкуванню — звертайтеся з питань співпраці, постачання, сервісу або будь-яких інших запитів.
                        Наша команда допоможе вам швидко та зручно отримати потрібну інформацію.
                    </Typography>

                </Box>


                {/* Карточки офисов */}
                <Grid container spacing={4}>
                    {offices.map((office, index) => (
                        <Grid key={index} size={{ xs: 12, md: 6 }}>
                            <Card
                                sx={{
                                    height: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                  }}
                            >
                                <CardContent>
                                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
                                        {office.city}
                                        {office.city === "Київ" && (
                                            <Typography
                                                component="span"
                                                variant="body2"
                                                color="text.secondary"
                                                sx={{ fontStyle: "italic", ml: 1 }}
                                            >
                                                (Головний офіс)
                                            </Typography>
                                        )}
                                    </Typography>

                                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                                        <EmailIcon color="primary" sx={{ mr: 1 }} />
                                        <Typography
                                            component="a"
                                            href={`mailto:${office.email}`}
                                            variant="body1"
                                            sx={{
                                                color: "text.primary",
                                                textDecoration: "none",
                                                "&:hover": { textDecoration: "underline" },
                                            }}
                                        >
                                            {office.email}
                                        </Typography>
                                    </Box>

                                    <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                                        <PhoneIcon color="primary" sx={{ mr: 1 }} />
                                        <Typography variant="body1">{office.phone}</Typography>
                                    </Box>

                                    <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                                        <LocationOnIcon color="primary" sx={{ mr: 1 }} />
                                        <Typography variant="body1">{office.address}</Typography>
                                    </Box>
                                </CardContent>

                                <CardActions sx={{ mt: "auto" }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        startIcon={<MapIcon />}
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                            office.address
                                        )}`}
                                        target="_blank"
                                        sx={{
                                            textTransform: "none",
                                            borderRadius: 2,
                                        }}
                                    >
                                        Відкрити на карті
                                    </Button>
                                </CardActions>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Нижний блок - соцсети и действие */}
                <Box
                    sx={{
                        textAlign: "center",
                        mt: 8,
                    }}
                >
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Слідкуйте за нами у соцмережах
                    </Typography>
                    <Box>
                        <IconButton color="primary">
                            <FacebookIcon />
                        </IconButton>
                        <IconButton color="primary">
                            <InstagramIcon />
                        </IconButton>
                    </Box>

                </Box>
            </Container>
        </Box>
    );
};

export default Contacts;
