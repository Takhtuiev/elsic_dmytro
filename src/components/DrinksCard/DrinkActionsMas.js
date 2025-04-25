import EditIcon from "@mui/icons-material/Edit";
import LibraryAddIcon from "@mui/icons-material/LibraryAdd";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

export const DrinkActionsMas = (product) => [
    {
        role: "PRODUCT_EDIT",
        title: "Edit",
        setNewAction: {
            action: "edit",
            itemId: product.id
        },
        content: <EditIcon />,
    },
    {
        role: "PRODUCT_EDIT",
        title: "Add copy",
        setNewAction: {
            action: "copy",
            itemId: product.id
        },
        content: <LibraryAddIcon />,
    },
    {
        role: "PRODUCT_DEL",
        title: "Delete",
        setNewAction: {
            action: "delete",
            itemId: product.id,
            itemName: product.name
        },
        content: <DeleteForeverIcon color="error" />,
    },
];
