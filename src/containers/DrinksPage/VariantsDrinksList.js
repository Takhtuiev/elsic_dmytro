import React from "react";
import {
    useDeleteVariantDrinksMutation,
    useGetLoadEditListsQuery,
    useGetPageVariantsDrinksQuery
} from "../../services/api/drinksApi";
import CardVariantDrinks from "../../components/DrinksCard/CardVatiantDrinks";
import CardLineVariantDrink from "../../components/DrinksCard/CardLineVatiantDrinks";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import GenericList from "./GenericList";
import EditBigCardDrinks from "../../components/DrinksCard/Edit/EditBigCardDrinks";


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
        <GenericList
            useGetPage={useGetPageVariantsDrinksQuery}
            useGetLists={useGetLoadEditListsQuery}
            HEAD_PARAMS={HEAD_PARAMS}
            FILTER_PARAMS={FILTER_PARAMS}
            TEXT_COLUMNS={DRINKS_COLUMNS}
            SORT_LIST={SORT_LIST}
            useDeleteMutation={useDeleteVariantDrinksMutation}
            CardComponent={CardVariantDrinks}
            CardLineComponent={CardLineVariantDrink}
            EditCard={EditBigCardDrinks}
        />
    )
}

export default VariantsDrinksList;
