import React, {useEffect} from 'react';
import {Suspense, useState} from "react";
import {useDeleteUserMutation, useGetPageUserListQuery} from "../../services/api/userApi";
import {Pagination, Stack} from "@mui/material";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import {useJwtUserDetails} from "../../Providers/JwtProvider";
import {useNavigate, useParams} from "react-router-dom";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import CardUser from "../../components/UserCard/CardUser";
import {lazy} from "react";
import Grid from '@mui/material/Grid2';
import UserEditPropertiesCard from "../../components/UserCard/UserEditPropertiesCard";
import MyDialog from "../../components/MyComponent/MyDialog";


const InfoModal = lazy(() => import('../../components/ModalWindow/InfoModal'))
const DeleteConfirmationModal = lazy(() => import('../../components/ModalWindow/DeleteConfirmationModal'))


function UserList() {

    const { page } = useParams();

    const searchParams = new URLSearchParams(document.location.search);
    const sort = searchParams.get("sort")
    const order = searchParams.get("order");
    const { data: pageUser, error: errorGetPage, isError, isFetching, refetch } = useGetPageUserListQuery({ page: page, sort: sort, order: order });
    const [deleteUser, { error: errorDeleting }] = useDeleteUserMutation();

    const [action, setAction] = useState(null);

    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя
    useEffect(() => {    // Перезагрузка при изменении имени авторизации
        if (!(errorGetPage?.errorReAuth && !jwtUserDetails)) {
            refetch();
        }
    }, [jwtUserDetails]);

    const navigate = useNavigate();

    const funcDelete = async (userId) => {
        const result = await deleteUser(userId);
        return errorDeleting ? {error: errorDeleting} : result;
    };

    return (
        <>
            {isError ?
                <ErrorCard error={errorGetPage}/>
                :
                <LoadingSpinner active={(isFetching || pageUser === undefined)}>

                    <Grid container spacing={2}>
                        {pageUser?.content?.map((user, index) => {
                            return (
                                <Grid size={12} key={index}>
                                    <CardUser user={user}  setAction={setAction}/>
                                </Grid>
                            )
                        })}
                    </Grid>

                    <Stack direction="row" justifyContent="center" mt={2}>
                        <Pagination     // Пагинация страници...
                            count={pageUser ? Number(pageUser.totalPages) : 0}
                            page={Number(page) || 1}
                            siblingCount={2}
                            onChange={(event, page) =>
                                navigate('/drinks/page/' + page + (sort ? ("?sort=" + sort) : ''))}
                            color="primary"
                            variant="outlined"
                            shape="rounded"
                        />
                    </Stack>
                    <br/>
                </LoadingSpinner>
            }

            {['info', 'edit', 'delete'].includes(action?.action) && (
                <Suspense fallback={<LoadingSpinner/>}>
                    {action?.action === 'info' && (
                        <InfoModal showInfo={action.item} setShowInfo={setAction} />
                    )}
                    {action?.action === 'edit' && (
                        <MyDialog
                            open={!!action}
                            onClose={() => setAction(null)}
                            title={'Edit user properties'}
                        >
                            <UserEditPropertiesCard
                                user={action?.item}
                                funcCancel={() => setAction(null)}
                            />
                        </MyDialog>
                    )}
                    {action?.action === 'delete' && (
                        <DeleteConfirmationModal
                            action={action}
                            setShowDelete={setAction}
                            bodyText={`Are you sure you want to delete user ${action?.itemName} with ID ${action?.itemId}?`}
                            funcDelete={funcDelete}
                        />
                    )}
                </Suspense>
            )}

        </>
    )
}

export default UserList;
