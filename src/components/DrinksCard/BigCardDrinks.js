import {
    CardMedia, Link, Skeleton,
    ToggleButton, ToggleButtonGroup,
    Typography
} from "@mui/material";
import React, {useState} from "react";
import { API_URL } from "../../config";
import { Rating } from '@mui/material';
import ModalImage from "../MyComponent/Image/ModalImage";
import {Box} from "@mui/system";
import WithRoleContent from "../MyComponent/WithRoleContent";
import {useLocation, useNavigate} from "react-router-dom";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import {DrinkActionsMas} from "./DrinkActionsMas";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import {getCloudinaryUrl} from "../../services/Utils/CloudinaryUtils";

function BigCardDrinks({ product, setAction }) {

    const location = useLocation();
    const navigate = useNavigate();

    const queryParams = new URLSearchParams(location.search);
    const findInitialIndex = () => {
        if (product){
            const variantId = parseInt(queryParams.get('variantId'));
            const varIndex = product.variants.findIndex(variant => variant.id === variantId);
            return varIndex !== -1 ? varIndex : 0;
        }
        return 0;
   };

    const [varItem, setVarItem] = useState(findInitialIndex());
    const [viewImage, setViewImage] = useState(null);

    if (!product) {
        return (
            <Box display="flex" justifyContent="center">
                <Box
                    sx={(theme) => ({
                        m: 1,
                        p: 1,
                        width: "100%",
                        maxWidth: 'md',
                        height: "100%",
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 2
                    })}
                >
                    {/* Название */}
                    <Box mb={2}>
                        <Skeleton variant="text" width="60%" height={40} sx={{ mx: 'auto' }} />
                    </Box>

                    <Box display="flex" flexDirection="row" gap={2}>
                        {/* Левая часть: рейтинг и картинка */}
                        <Box display="flex" flexDirection="column" alignItems="center" minWidth="20%" gap={1}>
                            <Skeleton variant="text" width="60%" height={20} />
                            <Skeleton variant="rectangular" width="100%" height={190} />
                        </Box>

                        {/* Правая часть: таблица */}
                        <Box
                            flex={1}
                            sx={(theme) => ({
                                border: `1px solid ${theme.palette.divider}`,
                                borderRadius: 2,
                                overflow: 'hidden'
                            })}
                        >
                            {[...Array(5)].map((_, i) => (
                                <Box key={i} display="flex" flexDirection="row" alignItems="center">
                                    <Box sx={{ minWidth: 150, p: 1 }}>
                                        <Skeleton variant="text" width="100%" height={20} />
                                    </Box>
                                    <Box sx={{ flex: 1, p: 1 }}>
                                        <Skeleton variant="text" width="80%" height={20} />
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* Описание */}
                    <Box display="flex" flexDirection="column" gap={1} mt={2}>
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

                <Box display="flex" flexDirection={'row'} gap={2}>
                    <Box display="flex" flexDirection="column" alignItems="center" minWidth={'20%'}>
                        <Rating name="read-only" readOnly precision={0.5} value={product.rating} />
                        <CardMedia
                            component="img"
                            image={getCloudinaryUrl(product.variants[varItem].imageUrl)}
                            alt={product.name}
                            onClick={() => showImage(API_URL + "/" + product.variants[varItem].imageUrl)}
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

                    <Box
                        display="flex"
                        flexDirection="column"
                        sx={(theme) => ({
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            overflow: 'hidden'
                        })}
                    >
                        {/* Строка 1 */}
                        <Box display="flex" flexDirection="row" alignItems="center">
                            <Box sx={{ minWidth: 150, p: 1, textAlign: 'right'}}>
                                <Typography variant="body2" color="text.secondary">{DRINKS_COLUMNS['brand']}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, p: 1 }}>
                                <Link
                                    component="button"
                                    variant="body1"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigate("/brand/" + product.brand);
                                    }}
                                    sx={{ textAlign: 'left'}}
                                >
                                    {product.brand}
                                </Link>
                            </Box>
                        </Box>

                        {/* Строка 2 */}
                        <Box display="flex" flexDirection="row" alignItems="center">
                            <Box sx={{ minWidth: 150, p: 1, textAlign: 'right'}}>
                                <Typography variant="body2" color="text.secondary">{DRINKS_COLUMNS['country']}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, p: 1 }}>
                                <Typography variant="body1">{product.country}</Typography>
                            </Box>
                        </Box>

                        {/* Строка 3 */}
                        <Box display="flex" flexDirection="row" alignItems="center">
                            <Box sx={{ minWidth: 150, p: 1, textAlign: 'right'}}>
                                <Typography variant="body2" color="text.secondary">{DRINKS_COLUMNS['productType']}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, p: 1 }}>
                                <Typography variant="body1">{product.productType}</Typography>
                            </Box>
                        </Box>

                        {/* Строка 4 */}
                        <Box display="flex" flexDirection="row" alignItems="center">
                            <Box sx={{ minWidth: 150, p: 1, textAlign: 'right'}}>
                                <Typography variant="body2" color="text.secondary">{DRINKS_COLUMNS['alcohol']}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, p: 1 }}>
                                <Typography variant="body1">{product.alcohol} %</Typography>
                            </Box>
                        </Box>

                        {/* Строка 5 */}
                        <Box display="flex" flexDirection="row" alignItems="center">
                            <Box sx={{ minWidth: 150, p: 1, textAlign: 'right'}}>
                                <Typography variant="body2" color="text.secondary">{DRINKS_COLUMNS['expirationDays']}</Typography>
                            </Box>
                            <Box sx={{ flex: 1, p: 1 }}>
                                <Typography variant="body1">{product.expirationDays} днів</Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box>

                <Box flex={2} display="flex" flexDirection="column" gap={1} p={2}>
                    <Typography variant="body1">{product.description}</Typography>
                    <Typography variant='body1'>{product.specifications}</Typography>
                </Box>

                <ToggleButtonGroup
                    value={varItem}
                    fullWidth
                    exclusive
                    orientation="vertical"
                    onChange={(event, newIndex) => { setVarItem(newIndex); }}
                >
                    {product.variants.map((variant, index) => (
                        <ToggleButton
                            key={index}
                            value={index}
                            disabled={varItem === index}
                            onClick={() => setVarItem(index)}
                            sx={{
                                justifyContent: 'space-between',
                                px: 1,
                                py: 0.5,
                                textAlign: 'center',
                                textTransform: 'none',
                            }}
                        >
                            <Box component="img"
                                 sx={{ width: '3rem', height: '3rem', objectFit: 'contain' }}
                                 src={getCloudinaryUrl(variant.imageUrl)}
                                 alt={product.name}
                            />
                            <span>{variant.packagingType}</span>
                            <span>{variant.volume} л.</span>
                            <span><strong>{variant.price}</strong> грн.</span>
                            <span>{variant.stockQuantity} шт.</span>
                        </ToggleButton>
                    ))}
                </ToggleButtonGroup>

                <WithRoleContent allowedRoles={['PRODUCT_EDIT', 'PRODUCT_DEL']}>
                    <Box display="flex" justifyContent="center" mt={2}>
                        <ActionGroupButton
                            masActions={DrinkActionsMas(product)}
                            setAction={setAction}
                        />
                    </Box>
                </WithRoleContent>
            </Box>

            <ModalImage openImage={viewImage} closeImageFunc={closeShowImage} sx={(theme) => ({background: theme.palette.background.paper})} />
        </Box>
    );
}

export default BigCardDrinks;
