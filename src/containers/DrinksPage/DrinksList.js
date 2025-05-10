import React from "react";
import {
    useDeleteDrinksMutation,
    useGetLoadEditListsQuery,
    useGetPageDrinksQuery,
} from "../../services/api/drinksApi";
import CardDrinks from "../../components/DrinksCard/CardDrinks";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import CardLineDrinks from "../../components/DrinksCard/CardLineDrinks";
import GenericList from "./GenericList";


const HEAD_PARAMS = {
    page: null,
    sort: null,
    order: null
};

const FILTER_PARAMS = {
    brand: {type: 'checkbox'},
    country: {type: 'checkbox'},
    productType: {type: 'checkbox'},
};

const SORT_LIST = [
    DRINKS_COLUMNS.name.text,
    DRINKS_COLUMNS.brand.text,
    DRINKS_COLUMNS.country.text,
]

function DrinksList() {

    return (
            <GenericList
                useGetPage={useGetPageDrinksQuery}
                useGetLists={useGetLoadEditListsQuery}
                useDeleteMutation={useDeleteDrinksMutation}
                HEAD_PARAMS={HEAD_PARAMS}
                FILTER_PARAMS={FILTER_PARAMS}
                SORT_LIST={SORT_LIST}
                CardComponent={CardDrinks}
                CardLineComponent={CardLineDrinks}
            />
    )
}

export default DrinksList;
