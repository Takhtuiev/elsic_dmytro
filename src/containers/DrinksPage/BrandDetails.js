import {useNavigate, useParams} from "react-router-dom";
import React from "react";
import {useGetBrandByNameQuery} from "../../services/Slice/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import BrandCard from "../../components/BrandCard/BrandCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";

function BrandDetails() {

    const navigate = useNavigate();
    const { name } = useParams();
    const { data: brand, error: errorGetBrand, isFetching: loading} = useGetBrandByNameQuery( { name: name} );


    const setBrand = (brand) => {
        if (brand !== name) {
            navigate('/brand/' + brand);
        }
    };

    if (errorGetBrand) {
        return ( <ErrorCard error={errorGetBrand}/> );
    }

    return (
        <>
            <TopLinearLoading active={loading}/>

            <BrandCard brand={brand} setBrand={setBrand} />
        </>
    )
}

export default BrandDetails;








