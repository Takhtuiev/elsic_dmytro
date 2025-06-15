import EditIcon from "@mui/icons-material/Edit";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

export const DrinkActionsMas = (product, selectVariantId) => [
    {
        role: "PRODUCT_EDIT",
        title: "Edit " + product?.name,
        maxWidth: "md",
        componentKey: "EditBigCardDrinks",
        props: {
            itemId: product?.id,
            selectVariantId: selectVariantId,
            mode: "editDrink",
        },
        content: <EditIcon />,
    },
    {
        role: "PRODUCT_EDIT",
        title: "Copy " + product?.name,
        maxWidth: 'md',
        componentKey: "EditBigCardDrinks",
        props: {
            itemId: product?.id,
            mode: "copy",
        },
        content: <LibraryAddIcon />,
    },
    {
        role: "PRODUCT_DEL",
        title: "Delete " + product?.name,
        componentKey: "DeleteDrink",
        props: {
            itemId: product?.id,
            bodyText: `Are you sure you want to delete "${product?.name}" with ID ${product?.id}?`,
        },
        content: <DeleteForeverIcon color="error" />,
    },
];
