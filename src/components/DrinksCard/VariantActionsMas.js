import EditIcon from "@mui/icons-material/Edit";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

export const VariantActionsMas = (variant) => [
    {
        role: "PRODUCT_EDIT",
        title: `Edit variant ${variant.product.name} (${variant.volume}л.), ${variant.packagingType}?`,
        maxWidth: 'md',
        componentKey: "EditBigCardDrinks",
        props: {
            itemId: variant?.product?.id,
            selectVariantId: variant.id,
            mode: "editVariant",
        },
        content: <EditIcon />,
    },
    {
        role: "PRODUCT_EDIT",
        title: "New",
        maxWidth: 'md',
        componentKey: "EditBigCardDrinks",
        props: {
            itemId: variant?.product?.id,
            mode: "copy",
        },
        content: <LibraryAddIcon />,
    },
    {
        role: "PRODUCT_DEL",
        title: "Delete variant" + variant?.product?.id,
        componentKey: "DeleteVariant",
        props: {
            itemId: variant?.id,
            bodyText: `Are you sure you want to delete variant ${variant.product.name} (${variant.volume}л.), ${variant.packagingType}?`,
        },
        content: <DeleteForeverIcon color="error" />,
    },

];
