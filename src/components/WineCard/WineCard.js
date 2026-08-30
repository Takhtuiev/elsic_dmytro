import React from 'react';
import {
    Card,
    CardContent,
    CardMedia,
    Typography,
    Box,
    Stack,
    Divider,
    Chip
} from '@mui/material';

const WineCard = ({ wine, onClick, imageRight = false }) => {
    // Определяем направление в зависимости от пропа imageRight
    const flexDirection = imageRight
        ? { xs: 'row-reverse' }
        : { xs: 'row' };

    return (
        <Card
            onClick={onClick}
            sx={{
                cursor: onClick ? 'pointer' : 'default',
                display: 'flex',
                flexDirection,
                borderRadius: 3,
                height: '100%',
                overflow: 'hidden',
                transition: 'transform 0.3s ease, box-shadow 0.3s ease',
                '&:hover': onClick && {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                },
            }}
        >
            {/* Изображение вина */}
            <CardMedia
                component="img"
                image={wine.img}
                alt={wine.title}
                sx={{
                    maxWidth: { xs: '50%', sm: '240' },
                    height: { xs: 'auto' },
                    objectFit: 'cover',
                    flexShrink: 0,
                }}
            />

            {/* Контент */}
            <CardContent
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    p: 3,
                    gap: 1.5,
                }}
            >
                {/* Заголовок и бренд */}
                <Box>
                    <Typography variant="h6" fontWeight={700}>
                        {wine.title}
                    </Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        {wine.brand}
                    </Typography>
                    <Typography variant="body2">
                        {wine.country}
                    </Typography>
                </Box>

                {/* Теги-характеристики */}
                <Stack direction="column" gap={0.5} sx={{ mt: 1 }}>
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {wine.color && (
                            <Chip
                                label={wine.color}
                                size="small"
                                sx={{ pointerEvents: 'none', fontWeight: 500 }}
                            />
                        )}
                        {wine.type && (
                            <Chip
                                label={wine.type}
                                size="small"
                                sx={{ pointerEvents: 'none' }}
                            />
                        )}
                        {wine.sweetness && (
                            <Chip
                                label={wine.sweetness}
                                size="small"
                                sx={{ pointerEvents: 'none' }}
                            />
                        )}
                    </Stack>

                    {wine.alcohol && (
                        <Stack direction="row">
                            <Chip
                                label={`${wine.alcohol} алкоголю`}
                                size="small"
                                sx={{ pointerEvents: 'none' }}
                            />
                        </Stack>
                    )}
                </Stack>

                <Divider sx={{ my: 1 }} />

                {/* Описание */}
                {wine.description && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            flexGrow: 1,
                            textAlign: 'justify',
                            lineHeight: 1.5,
                        }}
                    >
                        {wine.description}
                    </Typography>
                )}

                {/* Технические характеристики */}
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        mt: 1.5,
                        gap: 0.3,
                    }}
                >
                    {wine.sugar && (
                        <Typography variant="body2" sx={{ fontSize: '0.85rem' }}>
                            Цукор: {wine.sugar}
                        </Typography>
                    )}

                    {wine.packaging && wine.volume && (
                        <Typography variant="body2">
                            Тара:{' '}
                            <Box component="span" fontWeight={600}>
                                {wine.packaging} {wine.volume}л
                            </Box>
                        </Typography>
                    )}
                </Box>
            </CardContent>
        </Card>
    );
};

export default WineCard;
