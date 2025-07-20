import {useParams} from "react-router-dom";
import React from "react";
import {useGetLoadEditListsByIdQuery} from "../../services/Slice/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import BrandCard from "../../components/BrandCard/BrandCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import PageHeader from "../../components/MyComponent/PageHeader";

function BrandDetails() {

    const { id, slug } = useParams();
    const { data: brand, error: errorGetBrand, isFetching: loading} =
        useGetLoadEditListsByIdQuery({ field: "brand", id: id,  slug: slug });

    if (errorGetBrand) {
        return ( <ErrorCard error={errorGetBrand}/> );
    }

    return (
        <>
            <TopLinearLoading active={loading}/>

            <PageHeader
                text={'Опис бренда.'}
            />

            <BrandCard brand={brand}/>
        </>
    )
}

export default BrandDetails;








