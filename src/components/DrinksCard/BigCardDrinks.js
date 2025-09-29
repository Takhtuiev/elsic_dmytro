import {
    CardMedia, Link, Skeleton, Table, TableBody, TableCell, TableRow,
    Typography
} from "@mui/material";
import React, {useEffect, useState} from "react";
import { Rating } from '@mui/material';
import ModalImage from "../MyComponent/Image/ModalImage";
import {Box} from "@mui/system";
import WithRoleContent from "../MyComponent/WithRoleContent";
import {useNavigate} from "react-router-dom";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {DrinkActionsMas} from "./DrinkActionsMas";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import {getCloudinaryUrl} from "../../services/Utils/CloudinaryUtils";
import CardDrinkSelectVariant from "./CardDrinkSelectVariant";

function BigCardDrinks({ product, packagingSlug, volume }) {

    const navigate = useNavigate();

    const [variantIndex, setVariantIndex] = useState(0);

    const [viewImage, setViewImage] = useState(null);

    useEffect(() => {
        if (!product?.variants?.length) return;

        // Найти нужный вариант по упаковке и объему
        const index = product.variants.findIndex(
            (v) =>
                v.packagingTypeSlug === packagingSlug &&
                parseFloat(v.volume) === parseFloat(volume)
        );

        setVariantIndex(index >= 0 ? index : 0);
    }, [product, packagingSlug, volume]);


    if (!product) {
        return (
            <Box display="flex" justifyContent="center">
                <Box
                    sx={(theme) => ({
                        m: 1,
                        p: 1,
                        width: "100%",
                        maxWidth: 'md',
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2,
                    })}
                >
                    {/* Заголовок */}
                    <Skeleton variant="text" width="60%" height={40} sx={{ mx: 'auto', mb: 2 }} />

                    {/* Контент: изображение + таблица */}
                    <Box
                        display="flex"
                        sx={{
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2,
                        }}
                    >
                        {/* Левая часть: рейтинг + картинка */}
                        <Box display="flex" flexDirection="column" alignItems="center" minWidth="20%" gap={1}>
                            <Skeleton variant="text" width="60%" height={24} />
                            <Skeleton variant="rectangular" width="100%" height="12rem" />
                        </Box>

                        {/* Правая часть: таблица */}
                        <Box flex={1}>
                            {[...Array(5)].map((_, i) => (
                                <Box key={i} display="flex" flexDirection="row">
                                    <Skeleton variant="text" width="40%" height={20} sx={{ px: 1, py: 0 }} />
                                    <Skeleton variant="text" width="60%" height={20} sx={{ px: 1, py: 0 }} />
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* Описание */}
                    <Box mt={2} display="flex" flexDirection="column" gap={1}>
                        <Skeleton variant="text" width="100%" height={20} />
                        <Skeleton variant="text" width="90%" height={20} />
                        <Skeleton variant="text" width="95%" height={20} />
                    </Box>

                    {/* Переключатели вариантов */}
                    <Box mt={2}>
                        {[...Array(2)].map((_, i) => (
                            <Skeleton
                                key={i}
                                variant="rectangular"
                                width="100%"
                                height={50}
                                sx={{ mb: 1 }}
                            />
                        ))}
                    </Box>
                </Box>
            </Box>
        );
    }


    function showImage(src) {
        setViewImage(src);
    }
    function closeShowImage() {
        setViewImage(null);
    }

    return (
        <Box display="flex" justifyContent="center">
            <Box
                sx={(theme) => ({
                    m: 1,
                    p: 1,
                    width: "100%",
                    maxWidth: 'md',
                    height: "100%",
                    backgroundColor: theme.palette.background.paper
                })}
            >
                <Box>
                    <Typography variant="h4" sx={{ textAlign: 'center' }}>
                        {product.name}
                    </Typography>
                </Box>

                <Box
                    display="flex"
                    sx={{
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 1,
                    }}
                >
                    <Box display="flex" flexDirection="column" alignItems="center" minWidth={'20%'}>
                        <Rating name="read-only" readOnly precision={0.5} value={product.rating} />
                        <CardMedia
                            component="img"
                            image={getCloudinaryUrl(product.variants[variantIndex].imageUrl)}
                            alt={product.name}
                            onClick={() => showImage(getCloudinaryUrl(product.variants[variantIndex].imageUrl))}
                            sx={{
                                width: '100%',
                                maxHeight: '12rem',
                                objectFit: "contain",
                                zIndex: 99,
                                cursor: 'pointer',
                                transition: 'transform 0.3s ease-in-out',
                                '&:hover': { transform: 'scale(1.2)' },
                            }}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Table
                        size="small"
                        sx={(theme) => ({
                            width: 'auto',
                            p: 1,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            borderCollapse: 'separate',
                            overflow: 'hidden',
                            '& td, & th': {
                                px: 1,
                                py: 0,
                                m: 'auto',
                                borderBottom: 'none',
                            },
                        })}
                    >
                        <TableBody>
                            {/* Строка 1 */}
                            <TableRow>
                                <TableCell
                                    sx={{ textAlign: 'right'}}
                                    component="th"
                                    scope="row"
                                    //variant="head"
                                >
                                    <Typography variant="body2" color="text.secondary">
                                        {DRINKS_COLUMNS['brand']}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Link
                                        component="button"
                                        variant="body1"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/brand/${product.brand.id}/${product.brand.slug}`);
                                        }}
                                        sx={{ textAlign: 'left' }}
                                    >
                                        {product.brand.name}
                                    </Link>
                                </TableCell>
                            </TableRow>

                            {/* Строка 2 */}
                            <TableRow>
                                <TableCell sx={{ textAlign: 'right'}}>
                                    <Typography variant="body2" color="text.secondary">
                                        {DRINKS_COLUMNS['country']}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body1">{product.country}</Typography>
                                </TableCell>
                            </TableRow>

                            {/* Строка 3 */}
                            <TableRow>
                                <TableCell sx={{ textAlign: 'right'}}>
                                    <Typography variant="body2" color="text.secondary">
                                        {DRINKS_COLUMNS['productType']}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body1">{product.productType}</Typography>
                                </TableCell>
                            </TableRow>

                            {/* Строка 4 */}
                            <TableRow>
                                <TableCell sx={{ textAlign: 'right'}}>
                                    <Typography variant="body2" color="text.secondary">
                                        {DRINKS_COLUMNS['alcohol']}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body1">{product.alcohol} %</Typography>
                                </TableCell>
                            </TableRow>

                            {/* Строка 5 */}
                            <TableRow>
                                <TableCell sx={{ textAlign: 'right'}}>
                                    <Typography variant="body2" color="text.secondary">
                                        {DRINKS_COLUMNS['expirationDays']}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body1">{product.expirationDays} днів</Typography>
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                    </Box>

                </Box>

                <Box flex={2} display="flex" flexDirection="column" gap={1} p={2}>
                    <Typography variant="body1">{product.description}</Typography>
                    <Typography variant='body1'>{product.specifications}</Typography>
                </Box>


                <CardDrinkSelectVariant
                    variants={product.variants}
                    varIndex={variantIndex}
                    setVarIndex={setVariantIndex}
                    displayFields={["imageUrl", "packagingType", "volume", "price"]}
                />


                <WithRoleContent allowedRoles={['PRODUCT_EDIT', 'PRODUCT_DEL']}>
                    <Box display="flex" justifyContent="center" mt={2}>
                        <ActionGroupButton
                            masActions={DrinkActionsMas(product, product.variants[variantIndex].id)}
                         />
                    </Box>
                </WithRoleContent>
            </Box>

            <ModalImage openImage={viewImage} closeImageFunc={closeShowImage} sx={(theme) => ({background: theme.palette.background.paper})} />
        </Box>
    );
}

export default BigCardDrinks;
