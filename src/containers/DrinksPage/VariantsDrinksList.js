import React, {Suspense} from "react";
import {
    useDeleteVariantDrinksMutation,
    useGetLoadEditListsQuery,
    useGetPageVariantsDrinksQuery
} from "../../services/Slice/drinksApi";
import CardVariantDrinks from "../../components/DrinksCard/CardVatiantDrinks";
import CardLineVariantDrink from "../../components/DrinksCard/CardLineVatiantDrinks";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import GenericList from "./GenericList";
import EditBigCardDrinks from "../../components/DrinksCard/Edit/EditBigCardDrinks";
import PageHeader from "../../components/MyComponent/PageHeader";
import {Box} from "@mui/system";


const HEAD_PARAMS = {
    page: null,
    sort: null,
    order: null
};

const FILTER_PARAMS = {
    price: 'slider',
    brand: 'checkbox',
    country: 'checkbox',
    productType: 'checkbox',
    packagingType: 'checkbox',
};

const SORT_LIST = [
    DRINKS_COLUMNS.name,
    DRINKS_COLUMNS.brand,
    DRINKS_COLUMNS.country,
    DRINKS_COLUMNS.price
]

function VariantsDrinksList() {

    return (
        <Box>
            <PageHeader
                text={'Усі товари. Кожен варіант пива з різною тарою — окрема позиція у списку.'}
            />


            <GenericList
                useGetPage={useGetPageVariantsDrinksQuery}
                useGetLists={useGetLoadEditListsQuery}
                useDeleteMutation={useDeleteVariantDrinksMutation}
                HEAD_PARAMS={HEAD_PARAMS}
                FILTER_PARAMS={FILTER_PARAMS}
                TEXT_COLUMNS={DRINKS_COLUMNS}
                SORT_LIST={SORT_LIST}
                CREATE_NEW_ROLE={"PRODUCT_EDIT"}
                CardComponent={CardVariantDrinks}
                CardLineComponent={CardLineVariantDrink}
                EditCard={(props) => (
                    <Suspense fallback={<div>Loading EditCard...</div>}>
                        <EditBigCardDrinks {...props} />
                    </Suspense>)}
            />
        </Box>
    )
}

export default VariantsDrinksList;
