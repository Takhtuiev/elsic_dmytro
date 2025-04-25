import React from "react";
import {Alert, AlertTitle} from "@mui/material";
import {useJwtUserDetails} from "../../Providers/JwtProvider";
import {useEffect} from "react";

function ErrorBox({error}) {

    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя

//    console.log("error BOX start "+JSON.stringify(error))

    useEffect(() => { // если ошибка авторизации сбрасываем пользователя
        if(error.errorReAuth === true) {
            setJwtUserDetails(null)
        }
    }, [error.errorReAuth]);

    function errorContent(data) {
        if (data) {
            switch  (typeof data) {
                case "string" : return(
                        data
                )
                case "object" :
                    if (Array.isArray(data)) {
                        return (
                            Object.keys(data).map(key => (
                                <div key={key}>
                                    {data[key]}
                                </div>
                            ))
                        )
                    } else {
                        return (
                            Object.keys(data).map(key => (
                                <div key={key}>
                                    {key}: {data[key]}
                                </div>
                            ))
                        )
                    }
                default: return(
                        'Не обрабатываемый тип'
                )
            }
        } else {
            return(
                    'No error data'
            )
        }
    }

    return (
        <Alert severity="error" sx={{width:'100%'}}>
            <AlertTitle>Error {error?.originalStatus && error.originalStatus + '. '} {error.status} </AlertTitle>
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
    )
}

export default ErrorBox
