import {Button, Checkbox, Divider, FormControl, FormGroup, Switch, Typography,} from "@mui/material";
import React from "react";
import {useEffect, useState} from "react";
import SaveIcon from '@mui/icons-material/Save';
import {ID_EL_START, USER_COLUMNS} from "../../CONSTANTS/Constants";
import {useGetLoadRoleListQuery, useUpdateUserPropertyMutation} from "../../services/api/userApi";
import ErrorBox from "../ErrorBoard/ErrorBox";
import Grid from '@mui/material/Grid2';


function UserEditPropertiesCard({user, funcCancel}) {

    const [updateUserProperty, { isLoading: updating, error: errorUpdate, reset }] = useUpdateUserPropertyMutation();
    const { data: roleList, error: errorRoleList } = useGetLoadRoleListQuery();

    const [editedUser, setEditedUser] = useState(user);

    useEffect(() => {    // Перезагрузка при изменении item
        setEditedUser(user)
    }, [user]);

    function resetFunc() {
        setEditedUser(user)
        reset();
    }

    function onCheckBox(role) {
        let newAuthorities = editedUser.authorities

        if (newAuthorities.includes(role)) { // Если роль уже есть в массиве, удаляем ее
            newAuthorities = newAuthorities.filter(authority => authority !== role);
        } else { // Если роли нет в массиве, добавляем ее
            newAuthorities = newAuthorities.concat(role);
        }
        setEditedUser({ ...editedUser, authorities: newAuthorities });
    }


    if(errorRoleList) {
        return (
            <ErrorBox error={errorRoleList}/>
        )
    }

    async function saveClick() {
        const result = await updateUserProperty(editedUser);
        if (!result.error) {
            funcCancel();
        }
    }

    return (
        <form>
            <Grid container spacing={2}>
                <Grid container direction={'column'} size={'grow'} spacing={1}>
                    <Grid container alignItems="center">
                        <Typography variant="caption">
                            {USER_COLUMNS.username.text}:
                            <Typography
                                component={'span'}
                                sx={{
                                    ml: 1,
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {user.username}
                            </Typography>
                        </Typography>
                    </Grid>
                    <Grid container alignItems="center">
                        <Typography variant="caption">
                            {USER_COLUMNS.email.text}:
                            <Typography
                                component={'span'}
                                sx={{
                                    ml: 1,
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {user.email}
                            </Typography>
                        </Typography>
                    </Grid>
                    <Grid container alignItems="center">
                        <Typography variant="caption">
                            {USER_COLUMNS.phone.text}:
                            <Typography
                                component={'span'}
                                sx={{
                                    ml: 1,
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-word',
                                }}
                            >
                                {user.phone}
                            </Typography>
                        </Typography>
                    </Grid>

                    <Grid container alignItems="center">
                        <Typography variant="caption">
                            {USER_COLUMNS.enabled.text}:
                            <Switch
                                sx={{ml: 1}}
                                id={ID_EL_START + "enable"}
                                checked={Boolean(editedUser.enabled)}
                                onChange={()=>setEditedUser({ ...editedUser, enabled: !editedUser.enabled })}
                            />
                        </Typography>
                    </Grid>
                </Grid>

                <Grid size={{ xs: 12, sm: 'auto' }}>
                    <FormControl
                        component="fieldset"
                        margin="normal"
                        sx={{
                            border: '1px solid rgba(0, 0, 0, 0.23)', // Цвет рамки
                            borderRadius: '4px', // Радиус скругления углов
                            p: 1,
                            m: 0,
                            display: 'inline-block',
                        }}
                    >
                        <FormGroup>
                            {roleList?.map((role, index) => (
                                <Grid container alignItems="center" key={index} m={0}>
                                    <Checkbox
                                        id={'roleList-' + role}
                                        onChange={() => onCheckBox(role)}
                                        edge="start"
                                        size="small"
                                        sx={{ py: 0.2 }}
                                        checked={editedUser.authorities.indexOf(role) > -1}
                                    />
                                    <Typography variant="body2" fontSize="0.7rem">{role}</Typography>
                                </Grid>
                            ))}
                        </FormGroup>
                    </FormControl>
                </Grid>

                {errorUpdate &&
                    <Grid container justifyContent="center">
                        <ErrorBox error={errorUpdate} />
                    </Grid>
                }

            </Grid>

            <Divider sx={{my:1}}/>
            <Grid container spacing={2}>
                <Grid size={'grow'}>
                    <Button
                        variant="outlined"
                        onClick={resetFunc}
                    >
                        Reset
                    </Button>
                </Grid>
                {funcCancel &&
                    <Grid>
                        <Button
                            variant="outlined"
                            onClick={funcCancel}
                        >
                            Cancel
                        </Button>
                    </Grid>
                }

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
    );
}

export default UserEditPropertiesCard;








