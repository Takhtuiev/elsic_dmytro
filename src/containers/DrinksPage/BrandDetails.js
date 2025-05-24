import {useNavigate, useParams} from "react-router-dom";
import React from "react";
import {useDeleteBrandMutation, useGetBrandQuery} from "../../services/api/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import {Suspense, useState} from "react";
import DeleteConfirmationModalUI from "../../components/ModalWindow/DeleteConfirmationModal";
import InfoModal from "../../components/ModalWindow/InfoModal";
import BrandCard from "../../components/BrandCard/BrandCard";
import EditBrandCard from "../../components/BrandCard/Edit/EditBrandCard";
import MyDialog from "../../components/MyComponent/MyDialog";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";

function BrandDetails() {

    const navigate = useNavigate();
    const { name } = useParams();
    const { data: brand, error: errorGetBrand, isFetching: loading} = useGetBrandQuery( { name: name} );
    const [deleteBrand, {  isLoading: deleting, error: errorDeleting }] = useDeleteBrandMutation();
    const [action, setAction] = useState(null);


    const setSelectedBrand = (brand) => {
        if (brand !== action?.brand.name) {
            setAction(null);
            navigate('/brand/' + brand);
        }
    };

    const funcDelete = async (id) => {
        const result = await deleteBrand(brand.name);
        return errorDeleting ? {error: errorDeleting} : result;
    };

    if (errorGetBrand) {
        return ( <ErrorCard error={errorGetBrand}/> );
    }

    return (
        <>
            <TopLinearLoading active={loading || deleting}/>

            <BrandCard brand={brand} setAction={setAction} />

            {['info', 'edit', 'copy', 'delete', 'createNew'].includes(action?.action) && (
                <Suspense fallback={<LoadingSpinner/>}>
                    {action?.action === 'info' && (
                        <InfoModal showInfo={action.itemId} setShowInfo={setAction} />
                    )}
                    {['createNew', 'edit', 'copy'].includes(action?.action) && (
                        <MyDialog
                            open={!!action}
                            onClose={() => setAction(null)}
                            title={'Edit'}
                            fullWidth={true}
                        >
                            <EditBrandCard
                                selectedBrandName={action?.brand.name}
                                setSelectedItem={setSelectedBrand}
                                funcCancel={() => setAction(null)}
                            />
                        </MyDialog>
                    )}
                    {action?.action === 'delete' && (
                        <DeleteConfirmationModalUI
                            action={action}
                            setShowDelete={setAction}
                            bodyText={`Are you sure you want to delete "${action?.itemName}" with ID ${action?.itemId}?`}
                            funcDelete={funcDelete}
                        />
                    )}
                </Suspense>
            )}

        </>
    )
}

export default BrandDetails;








