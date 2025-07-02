import {useLocation, useParams} from "react-router-dom";
import BigCardDrinks from "../../components/DrinksCard/BigCardDrinks";
import {useGetDrinksQuery} from "../../services/Slice/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import PageHeader from "../../components/MyComponent/PageHeader";
import React from "react";
import {parsePackagingVolume} from "../../services/Utils/ParsePackagingVolumeUtils";

function DrinksDetails() {

    const { id, brandSlug, slug, packagingVolume } = useParams();

    const { packaging: packagingSlug, volume: volume } = parsePackagingVolume(packagingVolume) || {};

    const { data: product, error: errorGetProduct, isFetching: loading} = useGetDrinksQuery( { id: id, slug: slug } );

    if (errorGetProduct) {
        return ( <ErrorCard error={errorGetProduct}/> );
    }

    return (
        <>
            <TopLinearLoading active={loading} />

            <PageHeader
                text={'Опис пива.'}
            />

            <BigCardDrinks product={product} packagingSlug={packagingSlug} volume={volume}/>

        </>
    )
}

export default DrinksDetails;








