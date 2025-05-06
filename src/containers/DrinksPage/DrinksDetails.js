import {useParams} from "react-router-dom";
import BigCardDrinks from "../../components/DrinksCard/BigCardDrinks";
import React, {lazy} from "react";
import {useDeleteDrinksMutation, useGetDrinksQuery} from "../../services/api/drinksApi";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import {Suspense, useState} from "react";
import DeleteConfirmationModalUI from "../../components/ModalWindow/DeleteConfirmationModal";
import InfoModal from "../../components/ModalWindow/InfoModal";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";

const EditBigCardDrinks = lazy(() => import("../../components/DrinksCard/Edit/EditBigCardDrinks"))
const MyDialog = lazy(() => import('../../components/MyComponent/MyDialog'))

function DrinksDetails() {

    const { id } = useParams();
    const { data: product, error: errorGetProduct, isFetching: loading} = useGetDrinksQuery( { id: id}, );
    const [deleteProduct, { error: errorDeleting, isFetching: deleting }] = useDeleteDrinksMutation();
    const [action, setAction] = useState(null);


    const funcDelete = async (item) => {
        const result = await deleteProduct(item.id);
        return errorDeleting ? {error: errorDeleting} : result;
    };

    if (errorGetProduct) {
        return ( <ErrorCard error={errorGetProduct}/> );
    }

    return (
        <>
            <TopLinearLoading active={loading || deleting}/>

            <BigCardDrinks product={product} setAction={setAction} />

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
                        >
                            <EditBigCardDrinks
                                action={action}
                                funcCancel={() => setAction(null)}
                                copy={action.action === 'copy'}
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

export default DrinksDetails;








