import {useNavigate, useParams} from "react-router-dom";
import React, {useEffect} from "react";
import {useGetLoadEditListsByIdQuery} from "../../services/Slice/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import BrandCard from "../../components/BrandCard/BrandCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";
import {useDispatch, useSelector} from "react-redux";
import PageHeader from "../../components/MyComponent/PageHeader";
import {clearDialogDataReturned} from "../../services/Slice/dialogSlice";

function BrandDetails() {

    const dispatch = useDispatch();
    // Получаем lastReturnedData из Redux
    const lastReturnedData = useSelector(state => state.dialog.lastReturnedData);

    const navigate = useNavigate();
    const { id, slug } = useParams();
    const { data: brand, error: errorGetBrand, isFetching: loading} =
        useGetLoadEditListsByIdQuery({ field: "brand", id: id,  slug: slug });

    useEffect(() => {
        if (!lastReturnedData || !brand) return;

        if (lastReturnedData.dialogType === 'EditListItemCard') {
            if (lastReturnedData.data) {
                const field = lastReturnedData.data.field
                const newName = lastReturnedData.data.newValue;
                const oldName = brand?.name;

                if (newName !== oldName && field === "brand") {
                    navigate(`/brand/${brand.id}/${newName}`, { replace: true });
                    dispatch(clearDialogDataReturned());
                }
            }
        }
    }, [lastReturnedData, dispatch]);


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








