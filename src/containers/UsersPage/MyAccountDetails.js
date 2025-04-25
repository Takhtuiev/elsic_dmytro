import React from "react";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import {useGetMyAccountQuery} from "../../services/api/userApi";
import AccountEditCard from "../../components/UserCard/AccountEditCard";
import {useEffect} from "react";
import {useJwtUserDetails} from "../../Providers/JwtProvider";

function MyAccountDetails() {

    const { data: user, error: errorGetUser, isFetching: loading, refetch  } = useGetMyAccountQuery();

    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя
    useEffect(() => {    // Перезагрузка при изменении имени авторизации
        if (!(errorGetUser?.errorReAuth && !jwtUserDetails)) {
            refetch();
        }
    }, [jwtUserDetails]);


    if (errorGetUser) {
        return ( <ErrorCard error={errorGetUser}/> );
    }


    return (
        <LoadingSpinner active={loading}>
            <AccountEditCard user={user}/>
        </LoadingSpinner>
    )
}

export default MyAccountDetails;








