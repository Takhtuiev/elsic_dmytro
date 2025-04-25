import EditIcon from "@mui/icons-material/Edit";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

export const VariantActionsMas = (variant) => [
    {
        role: "PRODUCT_EDIT",
        title: "Edit",
        setNewAction: {
            action: "edit",
            itemId: variant.product.id,
            variantId: variant.id,
        },
        content: <EditIcon />,
    },
    {
        role: "PRODUCT_EDIT",
        title: "Add copy",
        setNewAction: {
            action: "copy",
            itemId: variant.product.id,
            variantId: variant.id,
        },
        content: <LibraryAddIcon />,
    },
    {
        role: "PRODUCT_DEL",
        title: "Delete",
        setNewAction: {
            action: "delete",
            itemId: variant.id,
            itemName: `${variant.product.name} (${variant.volume}л.), ${variant.packagingType}`,
        },
        content: <DeleteForeverIcon color="error" />,
    },
];
