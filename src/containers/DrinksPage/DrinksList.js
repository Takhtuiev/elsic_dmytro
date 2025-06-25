import React, {Suspense} from "react";
import {
    useDeleteDrinksMutation,
    useGetLoadEditListsQuery,
    useGetPageDrinksQuery,
} from "../../services/Slice/drinksApi";
import CardDrinks from "../../components/DrinksCard/CardDrinks";
import CardLineDrinks from "../../components/DrinksCard/CardLineDrinks";
import GenericList from "./GenericList";
import {DRINKS_COLUMNS} from "../../CONSTANTS/Constants";
import EditBigCardDrinks from "../../components/DrinksCard/Edit/EditBigCardDrinks";
import {Box} from "@mui/system";
import {Paper, Typography} from "@mui/material";
import PageHeader from "../../components/MyComponent/PageHeader";


const HEAD_PARAMS = {
    page: null,
    sort: null,
    order: null
};

const FILTER_PARAMS = {
    brand: 'checkbox',
    country: 'checkbox',
    productType: 'checkbox',
};

const SORT_LIST = [
    DRINKS_COLUMNS.name,
    DRINKS_COLUMNS.brand,
    DRINKS_COLUMNS.country,
]

function DrinksList() {

    return (
        <Box>
            <PageHeader
                text={'Сорти пива. Усі доступні варіанти упаковки згруповані всередині.'}
            />

            <GenericList
                useGetPage={useGetPageDrinksQuery}
                useGetLists={useGetLoadEditListsQuery}
                useDeleteMutation={useDeleteDrinksMutation}
                HEAD_PARAMS={HEAD_PARAMS}
                FILTER_PARAMS={FILTER_PARAMS}
                TEXT_COLUMNS={DRINKS_COLUMNS}
                CREATE_NEW_ROLE={"PRODUCT_EDIT"}
                SORT_LIST={SORT_LIST}
                CardComponent={CardDrinks}
                CardLineComponent={CardLineDrinks}
                EditCard={(props) => (
                    <Suspense fallback={<div>Loading EditCard...</div>}>
                        <EditBigCardDrinks {...props} />
                    </Suspense>)}
            />
        </Box>
    )
}

export default DrinksList;
