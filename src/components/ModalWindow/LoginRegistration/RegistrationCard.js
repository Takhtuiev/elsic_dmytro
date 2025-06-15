import {
    Button,
    Link,
    Typography
} from "@mui/material";
import {useRegisterNewUserMutation} from "../../../services/Slice/userApi";
import ErrorBox from "../../ErrorBoard/ErrorBox";
import React from "react";
import {useState} from "react";
import MyTextField from "../../MyComponent/MyTextField";
import {ID_EL_START} from "../../../CONSTANTS/Constants";
import MyInputPassword from "../../MyComponent/MyInputPassword";
import Grid from "@mui/material/Grid";
import {closeDialog} from "../../../services/Slice/dialogSlice";
import {useDispatch} from "react-redux";

function RegistrationCard() {

    const dispatch = useDispatch();

    const USER_DATA_EMPTY = {username:'', password:'', confirm_password:'', email:'', phone:''}

    const [registerUser, { isLoading, error, reset }] = useRegisterNewUserMutation();
    const [errorConfirmPassword, setErrorConfirmPassword] = useState(null);

    const handleClose = () => {
        dispatch(closeDialog());
    };


    const handleRegistration = async () => {

        const newValue = {};
        for (const key of Object.keys(USER_DATA_EMPTY)) {
            const element = document.getElementById(ID_EL_START+ 'user_registration' + key);

            if (element) {
                newValue[key] = element.textContent || element.value;
            } else {
                newValue[key] = null;
            }

            console.log(newValue)
        }

        if (newValue.password === newValue.confirm_password) {
            setErrorConfirmPassword(null)

            const result = await registerUser( newValue );

            if (!result.error) {
                handleClose();
            }

        } else {
            setErrorConfirmPassword('Passwords do not match')
            reset()
        }

    }

    function createObj(name, label) {
        return {
            key: name,
            value: '',
            field: 'user_registration',
            label: label,
            error: error?.data[name],
        }
    }

    return (
        <form onSubmit={handleRegistration}>
            <Grid container direction={'column'} spacing={2}>
                <Grid>
                    <table style={{width: '100%'}}>
                        <tbody>
                        <tr>
                            <td>
                                <Typography variant="body2"  align="right">Name:</Typography>
                            </td>
                            <td>
                                <MyTextField
                                    obj={createObj('username')}
                                    sx={{width: '100%'}}
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Typography variant="body2"  align="right">E-mail:</Typography>
                            </td>
                            <td>
                                <MyTextField
                                    obj={createObj('email')}
                                    sx={{width: '100%'}}
                                    type="email"
                                />
                            </td>
                        </tr>
                        <tr>
                            <td>
                                <Typography variant="body2"  align="right">Phone:</Typography>
                            </td>
                            <td>
                                <MyTextField
                                    obj={createObj('phone')}
                                    sx={{width: '100%'}}
                                    type="tel"
                                />
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </Grid>
                <Grid container direction={'column'} spacing={1} alignItems={'center'}>
                    <Grid>
                        <MyInputPassword
                            obj={createObj('password', 'password')}
                        />
                    </Grid>
                    <Grid>
                        <MyInputPassword
                            obj={createObj('confirm_password', 'confirm password')}
                        />
                    </Grid>
                </Grid>
                {errorConfirmPassword &&
                    <Grid>
                        <ErrorBox error={errorConfirmPassword} textAlign={"center"}/>
                    </Grid>
                }
                {error &&
                    <Grid>
                        <ErrorBox error={error} textAlign={"center"}/>
                    </Grid>
                }

                <Grid container direction={'column'} >
                    <Grid >
                        <Button
                            fullWidth={true}
                            loading={isLoading}
                            onClick={() => handleRegistration()}
                            variant="contained"
                        >
                            Registration
                        </Button>
                    </Grid>
                    <Grid sx={{ textAlign: 'center' }}>
                        <Link
                            style={{ cursor: 'pointer' }}
                            onClick={handleClose}
                        >
                            Close
                        </Link>
                    </Grid>
                </Grid>
            </Grid>
        </form>
    );
}

export default RegistrationCard;