import React from "react";
import ErrorCard from "../../components/ErrorBoard/ErrorCard";
import LoadingSpinner from "../../components/MyComponent/LoadingSpinnerBoard/LoadingSpinner";
import {useGetMyAccountQuery} from "../../services/Slice/userApi";
import AccountEditCard from "../../components/UserCard/AccountEditCard";
import {useEffect} from "react";
import {useJwtUserDetails} from "../../Providers/JwtProvider";
import {Box} from "@mui/system";
import TopLinearLoading from "../../components/MyComponent/LoadingSpinnerBoard/TopLinearLoading";

function MyAccountDetails() {

    const { data: user, error: errorGetUser, isFetching: loading, refetch  } = useGetMyAccountQuery();

    const { jwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя
    useEffect(() => {    // Перезагрузка при изменении имени авторизации
        if (!(errorGetUser?.errorReAuth && !jwtUserDetails)) {
            refetch();
        }
    }, [jwtUserDetails]);


    if (errorGetUser) {
        return ( <ErrorCard error={errorGetUser}/> );
    }


    return (
        <>
            <TopLinearLoading active={loading} />
            <LoadingSpinner active={loading}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                    }}
                >
                    <AccountEditCard user={user}/>
                </Box>

            </LoadingSpinner>
        </>
    )
}

export default MyAccountDetails;








