import {
    Box, Button, Divider, Paper, Typography,
} from "@mui/material";
import React, {useState} from "react";
import SaveIcon from '@mui/icons-material/Save';
import MyTextField from "../MyComponent/MyTextField";
import {USER_COLUMNS} from "../../CONSTANTS/Constants";
import {useUpdateMyAccountMutation} from "../../services/api/userApi";
import MyInputPassword from "../MyComponent/MyInputPassword";
import ErrorBox from "../ErrorBoard/ErrorBox";
import {useEffect} from "react";
import Grid from '@mui/material/Grid2';


function AccountEditCard({user}) {

    const [updateAccount, { error: errorUpdate, isLoading: updating, reset}] = useUpdateMyAccountMutation();
    const [editedUser, setEditedUser] = useState({...user, password: ''});
    const [error, setError] = useState(null);

    useEffect(() => {    // Перезагрузка при изменении item
        setEditedUser({...user, password: editedUser.password})
    }, [user]);

    function resetFunc() {
        setEditedUser({...user, password: ''})
        setError(null)
        reset();
    }

    async function saveClick() {

        const result = await updateAccount(editedUser);

        if (!result.error) {
            setEditedUser(prevState => {
                return {...prevState, 'password': ''};
            })
            setError(null)
        } else {
            const allKeys = Object.keys(user).concat('password');
            // Фильтруем ключи из `result.error.data`, оставляя только те, которых нет в `allKeys`
            const newErrorObj = Object.entries(result.error.data).reduce((acc, [key, value]) => {
                if (!allKeys.includes(key)) {
                    acc[key] = value;
                }
                return acc;
            }, {});

            setError(newErrorObj)
        }
    }

    const setNewValue = (value, key) => {
        // Обновляем значение непосредственно в editedItem
        setEditedUser(prevState => {
            return {...prevState, [key]: value};
        })
    }

    function createObj(name, label) {
        return {
            key: name,
            value: editedUser && editedUser[name],
            label: label ? label : USER_COLUMNS[name]?.text,
            error: errorUpdate?.data[name],
        }
    }

    return (
        <Paper sx={{p:1,m:1}}>
            <form>
                <Grid container spacing={2} >
                    <Grid container direction={'column'} size={'grow'}>
                        <MyTextField
                            obj={createObj('username')}
                            setValue={setNewValue}
                            multiline={true}
                            sx={{width: '100%'}}
                        />
                        <MyTextField
                            obj={createObj('email')}
                            type="email"
                            setValue={setNewValue}
                            multiline={true}
                            sx={{width: '100%'}}
                        />
                        <MyTextField
                            obj={createObj('phone')}
                            type="tel"
                            setValue={setNewValue}
                            multiline={true}
                            sx={{width: '100%'}}
                        />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 'auto' }} sx={{color: 'text.secondary'}}>
                        <Typography variant="body2">Authorities:</Typography>
                        <Box sx={{
                            minWidth: "6rem",
                            border: (theme) => `1px solid ${theme.palette.divider}`,
                            borderRadius: '4px', // Радиус скругления углов
                            padding: '8px', // Отступ внутри рамки
                            display: 'inline-block',
                        }}
                        >
                            {user?.authorities.length > 0 ? (
                                // Если длина массива больше 0, выводим роли
                                user.authorities.map((item,index) => (
                                    <Typography key={index} variant={'body2'} fontSize={'0.6rem'}>
                                        {item}
                                    </Typography>
                                ))
                            ) : (
                                // Если длина массива 0, выводим текст "no authority..."
                                <Typography variant={'body2'} fontSize={'0.7rem'}
                                            sx={{
                                                color: 'text.secondary',
                                                fontStyle: 'italic',
                                            }}
                                >
                                    no authority...
                                </Typography>
                            )}
                        </Box>
                        <Typography variant="body2">Enable: {user?.enabled.toString()}</Typography>
                    </Grid>
                </Grid>
                <Divider sx={{my:1}}/>
                <Grid container spacing={2} alignItems="center">
                    {error &&
                        <Grid container justifyContent="center">
                            <ErrorBox error={error} />
                        </Grid>
                    }
                    <Grid size={'grow'}>
                        <Button
                            onClick={resetFunc}
                            variant="outlined"
                        >
                            Reset
                        </Button>
                    </Grid>
                    <Grid>
                        <MyInputPassword
                            obj={createObj('password', 'you password')}
                            setValue={setNewValue}
                        />
                    </Grid>
                    <Grid>
                        <Button
                            variant="contained"
                            loading={updating}
                            onClick={saveClick}
                            size="sm"
                            sx={{ mb: 'auto'}}
                        >
                            <SaveIcon sx={{ marginRight: '1rem' }} />Save
                        </Button>
                    </Grid>
                </Grid>
            </form>
        </Paper>

    );
}

export default AccountEditCard;








