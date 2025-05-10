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


const HEAD_PARAMS = {
    page: null,
    sort: null,
    order: null
};

const FILTER_PARAMS = {
    price: {type: 'slider'},
    brand: {type: 'checkbox'},
    country: {type: 'checkbox'},
    productType: {type: 'checkbox'},
    packagingType: {type: 'checkbox'}
};

const SORT_LIST = [
    DRINKS_COLUMNS.name.text,
    DRINKS_COLUMNS.brand.text,
    DRINKS_COLUMNS.country.text,
    DRINKS_COLUMNS.price.text
]

function VariantsDrinksList() {

    return (
        <GenericList
            useGetPage={useGetPageVariantsDrinksQuery}
            useGetLists={useGetLoadEditListsQuery}
            HEAD_PARAMS={HEAD_PARAMS}
            FILTER_PARAMS={FILTER_PARAMS}
            SORT_LIST={SORT_LIST}
            useDeleteMutation={useDeleteVariantDrinksMutation}
            CardComponent={CardVariantDrinks}
            CardLineComponent={CardLineVariantDrink}
        />
    )
}

export default VariantsDrinksList;
