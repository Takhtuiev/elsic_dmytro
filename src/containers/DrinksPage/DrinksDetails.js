import {useLocation, useParams} from "react-router-dom";
import BigCardDrinks from "../../components/DrinksCard/BigCardDrinks";
import {useGetDrinksQuery} from "../../services/Slice/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";

function DrinksDetails() {

    const { id } = useParams();

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);

    const variantIdParam = queryParams.get('variant');
    const selectedVariantId = /^\d+$/.test(variantIdParam ?? '') ? Number(variantIdParam) : 0;

    const { data: product, error: errorGetProduct, isFetching: loading} = useGetDrinksQuery( { id: id}, );

    if (errorGetProduct) {
        return ( <ErrorCard error={errorGetProduct}/> );
    }

    return (
        <>
            <TopLinearLoading active={loading} />

            <BigCardDrinks product={product} selectedVariantId = {selectedVariantId}/>

        </>
    )
}

export default DrinksDetails;








