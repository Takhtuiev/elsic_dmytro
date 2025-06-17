import {
    CardMedia,
    Typography,
    Skeleton,
    useTheme,
} from "@mui/material";
import React from "react";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {BrandActionsMas} from "./BrandActionsMas";
import {Box} from "@mui/system";
import {getCloudinaryUrl} from "../../services/Utils/CloudinaryUtils";

function BrandCard({ brand }) {
    const theme = useTheme();

    if (!brand) {
        return (
            <Box display="flex" justifyContent="center">
                <Box
                    display="flex"
                    flexDirection="column"
                    sx={{
                        m: 1,
                        p: 1,
                        width: "100%",
                        maxWidth: 'md',
                        backgroundColor: theme.palette.background.paper,
                    }}
                >
                    <Skeleton variant="text" width="60%"  height={40} sx={{ mx: 'auto', mb: 2 }} />
                    <Box sx={{ flexDirection: { xs: 'column', md: 'row' }, display: 'flex' }}>
                        <Box>
                            <Skeleton variant="rectangular" height={150} width={120} />
                        </Box>
                        <Box flex={1} p={1}>
                            <Skeleton variant="text" width="90%" />
                            <Skeleton variant="text" width="100%"  />
                            <Skeleton variant="text" width="90%"  />
                            <Skeleton variant="text" width="40%"  />
                        </Box>

                    </Box>
                </Box>
            </Box>
        );
    }
    return (
        <Box display="flex" justifyContent="center">
            <Box
                display="flex"
                flexDirection={{ xs: 'column', md: 'row' }}
                sx={{
                    m: 1,
                    p: 1,
                    width: "100%",
                    maxWidth: 'md',
                    backgroundColor: theme.palette.background.paper,
                }}
            >
                {/* Имя бренда (мобильная версия) */}
                <Typography
                    variant="h4"
                    sx={{
                        textAlign: 'center',
                        mb: { xs: 1, md: 0 },
                        display: { xs: 'block', md: 'none' }
                    }}
                >
                    {brand.name}
                </Typography>

                {/* Картинка */}
                {brand.imageUrl && (
                    <CardMedia
                        component="img"
                        image={getCloudinaryUrl(brand.imageUrl)}
                        alt={brand.name}
                        sx={{
                            mx: 'auto',
                            maxWidth: { xs: '100%', md: '20%' },
                            maxHeight: '16rem',
                            objectFit: "contain",
                            mb: { xs: 1, md: 0 },
                        }}
                    />
                )}

                <Box
                    display="flex"
                    flexDirection="column"
                    flex="1"
                    gap={2}
                    justifyContent="space-between"
                    sx={{ pl: { md: 2 } }}
                >
                    {/* Имя бренда (десктоп) */}
                    <Typography
                        variant="h4"
                        sx={{
                            textAlign: 'center',
                            display: { xs: 'none', md: 'block' }
                        }}
                    >
                        {brand.name}
                    </Typography>

                    <Typography variant="body1">
                        {brand.description}
                    </Typography>

                    <Box display="flex" justifyContent="flex-end">
                        <ActionGroupButton
                            masActions={BrandActionsMas(brand)}
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}

export default BrandCard;
