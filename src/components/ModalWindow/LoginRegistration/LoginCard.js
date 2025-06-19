import React, { useState } from "react";
import {
    Button,
    DialogContent,
    Link,
    Grid,
} from "@mui/material";
import { useDispatch } from "react-redux";
import { useUserLoginMutation } from "../../../services/Slice/authApi.js";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import MyInputPassword from "../../MyComponent/MyInputPassword";
import MyTextField from "../../MyComponent/MyTextField";
import { closeDialog, openDialog } from "../../../services/Slice/dialogSlice";
import { setJwtUserDetails } from "../../../services/Slice/jwtUserSlice"; // Импорт action для установки пользователя в Redux

function LoginCard() {
    const dispatch = useDispatch();

    const [loginUser, { error, isLoading }] = useUserLoginMutation();
    const [logPass, setLogPass] = useState({ username: "", password: "" });

    const handleClose = () => {
        dispatch(closeDialog());
    };

    const handleRegistration = () => {
        dispatch(
            openDialog({
                title: "Registration",
                maxWidth: "sm",
                componentKey: "RegistrationCard",
                props: {},
            })
        );
    };

    const setNewValue = (value, key) => {
        setLogPass((prevState) => {
            return { ...prevState, [key]: value };
        });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const result = await loginUser(logPass);
        if (!result.error) {
            // Устанавливаем данные пользователя в Redux
            dispatch(setJwtUserDetails(result.data.userDetails));
            handleClose();
        }
    };

    return (
        <form onSubmit={handleLogin}>
            <Grid container direction={"column"} spacing={2}>
                <Grid item pt={1}>
                    <MyTextField
                        obj={{
                            key: "username",
                            value: logPass.username,
                            label: "Name",
                            error: error?.data?.username,
                        }}
                        setValue={setNewValue}
                        sx={{ width: "100%" }}
                    />
                </Grid>
                <Grid item>
                    <MyInputPassword
                        obj={{
                            key: "password",
                            value: logPass.password,
                            label: "Your password",
                            error: error?.data?.password,
                        }}
                        setValue={setNewValue}
                        sx={{ width: "100%" }}
                    />
                </Grid>
                {error && (
                    <Grid item>
                        <DialogContent>
                            <ErrorBox error={error} textAlign={"center"} />
                        </DialogContent>
                    </Grid>
                )}
                <Grid item>
                    <Button
                        fullWidth={true}
                        disabled={isLoading}
                        type="submit"
                        variant="contained"
                    >
                        Login
                    </Button>
                </Grid>
                <Grid item sx={{ textAlign: "center" }}>
                    <Link
                        style={{ cursor: "pointer" }}
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
