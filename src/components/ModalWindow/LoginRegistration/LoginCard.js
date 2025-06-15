import {
    Button,
    DialogContent,
    Link,
} from "@mui/material";
import { useUserLoginMutation} from "../../../services/Slice/authApi.js";
import { useJwtUserDetails } from "../../../Providers/JwtProvider";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import MyInputPassword from "../../MyComponent/MyInputPassword";
import React from "react";
import MyTextField from "../../MyComponent/MyTextField";
import {useState} from "react";
import Grid from "@mui/material/Grid";
import {closeDialog, openDialog} from "../../../services/Slice/dialogSlice";
import {useDispatch} from "react-redux";

function LoginCard() {
    const dispatch = useDispatch();

    const [loginUser, { data, error, isLoading, reset }] = useUserLoginMutation();
    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя
    const [logPass, setLogPass] = useState({username:'', password:''});

    const handleClose = () => {
        dispatch(closeDialog());
    };

    const handleRegistration = () => {
        dispatch(openDialog({
            title: "Registration",
            maxWidth: "sm",
            componentKey: "RegistrationCard",
            props: {},
        }));
    };


    const setNewValue = (value, key) => {
        setLogPass(prevState => {
            return {...prevState, [key]: value};
        });
    };

    const handleLogin = async () => {
        const result = await loginUser(logPass);
        if (!result.error) {
            setJwtUserDetails(result.data.userDetails);
            handleClose();
        }
    };

    return (
        <form onSubmit={handleLogin} >
            <Grid container direction={'column'} spacing={2} >
                <Grid>
                    <MyTextField
                        obj={{
                            key: 'username',
                            value: logPass.username,
                            label: 'Name',
                            error: error?.data.username,
                        }}
                        setValue={setNewValue}
                        sx={{width: "100%"}}
                    />
                </Grid>
                <Grid>
                    <MyInputPassword
                        obj={{
                            key: 'password',
                            value: logPass.password,
                            label: 'you password',
                            error: error?.data.password,
                        }}
                        setValue={setNewValue}
                        sx={{width: "100%"}}
                    />
                </Grid>
                {error &&
                    <Grid>
                        <DialogContent>
                            <ErrorBox error={error} textAlign={"center"}/>
                        </DialogContent>
                    </Grid>
                }
                <Grid>
                    <Button
                        fullWidth={true}
                        loading={isLoading}
                        onClick={handleLogin}
                        variant="contained"
                    >
                        Login
                    </Button>
                </Grid>
                <Grid sx={{ textAlign: 'center' }}>
                    <Link
                        style={{cursor: 'pointer'}}
                        onClick={handleRegistration}
                    >
                        Registration
                    </Link>
                </Grid>

            </Grid>
        </form>
    );
}

export default LoginCard;
