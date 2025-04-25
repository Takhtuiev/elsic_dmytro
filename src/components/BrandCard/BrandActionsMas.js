import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

export const BrandActionsMas = (brand) => [
    {
        role: "PRODUCT_EDIT",
        title: "Edit",
        setNewAction: {
            action: "edit",
            brand: brand,
        },
        content: <EditIcon />,
    },
    {
        role: "PRODUCT_DEL",
        title: "Delete",
        setNewAction: {
            action: "delete",
            itemId: brand.id,
            itemName: brand.name
        },
        content: <DeleteForeverIcon color="error" />,
    },
];
