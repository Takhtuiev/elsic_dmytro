import EditIcon from "@mui/icons-material/Edit";
//import DeleteForeverIcon from "@mui/icons-material/DeleteForever";

export const BrandActionsMas = (brand) => [
    {
        role: "PRODUCT_EDIT",
        title: "Edit " + brand.name,
        maxWidth: "md",
        componentKey: "EditListItemCard",
        props: {
            field: 'brand',
            selectedItemName: brand.name,
            setSelectedItemName: null,
            funcCancel: null,
            deletable: false,
        },
        content: <EditIcon />,
    },

    /*
    {
        role: "PRODUCT_DEL",
        title: "Delete " + brand,
        componentKey: "DeleteConfirm",
        props: {
            entityType: 'brand',
            entityIdentifier: brand.name,
            bodyText: `Are you sure you want to delete "${brand.name}"?`,
       },
        content: <DeleteForeverIcon color="error" />,
    },
     */

];
