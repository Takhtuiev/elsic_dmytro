import {
    Button,
    DialogContent,
    Link,
} from "@mui/material";
import { useUserLoginMutation} from "../../../services/api/authApi.js";
import { useJwtUserDetails } from "../../../Providers/JwtProvider";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import MyInputPassword from "../../MyComponent/MyInputPassword";
import React from "react";
import MyTextField from "../../MyComponent/MyTextField";
import {useState} from "react";
import Grid from "@mui/material/Grid2";

function LoginCard({ close, logReg }) {

    const [loginUser, { data, error, isLoading, reset }] = useUserLoginMutation();
    const { jwtUserDetails, setJwtUserDetails } = useJwtUserDetails(); // Детали авторизованного пользователя
    const [logPass, setLogPass] = useState({username:'', password:''});

    const handleClose = () => {
        close();
//        reset();
    };

    const setNewValue = (value, key) => {
        setLogPass(prevState => {
            return {...prevState, [key]: value};
        });
    };

    const handleLogin = async () => {
        const result = await loginUser(logPass);
        if (result.error) {
            console.error("login error ", result.error);
        } else {
            setJwtUserDetails(result.data.userDetails);
            handleClose();
        }
    };

    return (
        <form onSubmit={handleLogin} style={{ minWidth: '33vw' }}>
            <Grid container direction={'column'} spacing={1} sx={{pt: 1}}>
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
                            onClick={logReg}
                        >
                            Registration
                        </Link>
                    </Grid>

                </Grid>
            </Grid>
        </form>
    );
}

export default LoginCard;
