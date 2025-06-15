import React from "react";
import {Alert, AlertTitle, Typography} from "@mui/material";
import {useJwtUserDetails} from "../../Providers/JwtProvider";
import {useEffect} from "react";
import {Box} from "@mui/system";

function ErrorBox({error}) {

    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя


    useEffect(() => { // если ошибка авторизации сбрасываем пользователя
        if(error.errorReAuth === true) {
            setJwtUserDetails(null)
        }
    }, [error.errorReAuth]);

    function errorContent(data) {
        if (!data) return 'No error data';

        if (typeof data === "string") {
            return <Typography variant="body2">{data}</Typography>;
        }

        if (Array.isArray(data)) {
            return (
                <Box component="ul" sx={{ pl: 2, m: 0 }}>
                    {data.map((item, index) => (
                        <Typography variant="body2" key={index}>{item}</Typography>
                    ))}
                </Box>
            );
        }

        if (typeof data === "object") {
            return (
                Object.entries(data).map(([key, value]) => (
                    <Typography variant="body2" key={key}>
                        {key}: {value}
                    </Typography>
                ))
            );
        }

        return 'Не обрабатываемый тип';
    }

    return (
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
            <Alert severity="error">
                <AlertTitle>
                    Error {error?.originalStatus && error.originalStatus + '. '} {error.status}
                </AlertTitle>
                {error?.data
                    ?
                    errorContent(error.data)
                    :
                    error.error ?
                        errorContent(error.error)
                        :
                        errorContent(error)
                }
            </Alert>
        </Box>
    )
}

export default ErrorBox
