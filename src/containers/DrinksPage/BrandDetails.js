import {useNavigate, useParams} from "react-router-dom";
import React, {useEffect} from "react";
import {useGetLoadEditListsByNameQuery} from "../../services/Slice/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import BrandCard from "../../components/BrandCard/BrandCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import {useDispatch, useSelector} from "react-redux";
import PageHeader from "../../components/MyComponent/PageHeader";

function BrandDetails() {

    const dispatch = useDispatch();
    // Получаем lastReturnedData из Redux
    const lastReturnedData = useSelector(state => state.dialog.lastReturnedData);

    const navigate = useNavigate();
    const { name } = useParams();
    const { data: brand, error: errorGetBrand, isFetching: loading} =
        useGetLoadEditListsByNameQuery({ field: "brand", name: name });

    useEffect(() => {
        if (!lastReturnedData) return;

        if (lastReturnedData.dialogType === 'EditListItemCard') {
            if (lastReturnedData.data) {
                const newName = lastReturnedData.data.name;
                if (newName !== brand) {
                    setBrand(newName)
                }
            }
        }
    }, [lastReturnedData, dispatch]);


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

            <PageHeader
                text={'Опис бренда.'}
            />

            <BrandCard brand={brand}/>
        </>
    )
}

export default BrandDetails;








