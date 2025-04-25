import {
    Card,
    Paper, Typography, useTheme,
} from "@mui/material";
import React from "react";
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import PhoneIcon from '@mui/icons-material/Phone';
import EditIcon from "@mui/icons-material/Edit";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import ActionGroupButton from "../MyComponent/ActionGroupButton";
import Grid from "@mui/material/Grid2";

function CardUser({ user, setAction }) {

    return (
        <Card
            //onClick={() => { navigate("/drinksDetails/" + product.id) }}
            sx={{
                p: 0,
                wordBreak: 'break-word',
                hyphens: 'auto',
                overflowWrap: 'break-word',
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
            }}
        >
            <Grid container columnSpacing={1} justifyContent={'end'} alignItems={'center'}
                  sx={{
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                  }}
            >
                <Grid >
                    <Typography variant="body1">{user.enabled ? <CheckIcon color={'success'}/> : <BlockIcon color={'disabled'}/> }</Typography>
                </Grid>

                <Grid minWidth={'15rem'}>
                    <Typography variant="h6" >
                        {user.username}
                    </Typography>
                </Grid>
                <Grid size={'grow'} minWidth={'15rem'}>
                    <Grid container alignItems="center" sx={{ display: 'flex' }}>
                        <Grid >
                            <MailOutlineIcon fontSize={'small'} color={user.enabled ? 'primary' : 'text.secondary'} sx={{mx: 1}}/>
                        </Grid>
                        <Grid size={'grow'}>
                            <Typography variant="body1" >
                                {user.email}
                            </Typography>
                        </Grid>
                    </Grid>
                    <Grid container alignItems="center" sx={{ display: 'flex' }}>
                        <Grid >
                            <PhoneIcon fontSize={'small'} color={user.enabled ? 'primary' : 'text.secondary'} sx={{mx: 1, my:0}}/>
                        </Grid>
                        <Grid size={'grow'}>
                            <Typography variant="body1">
                                {user.phone}
                            </Typography>
                        </Grid>
                    </Grid>
                </Grid>

                <Grid minWidth={'6rem'} >
                    <Grid container direction={'column'} justifyContent={'center'} alignContent={'center'}
                          sx={{
                              pt: 0,
                              height: '100%',
                              border: '1px solid rgba(0, 0, 0, 0.23)',
                              borderRadius: '4px',
                              padding: '0.2rem',
                          }}
                    >
                        {user.authorities.length > 0 ? (
                            // Если длина массива больше 0, выводим роли
                            user.authorities.map((item,index) => (
                                <Typography key={index} variant={'body2'} fontSize={'0.6rem'}>
                                    {item}
                                </Typography>
                            ))
                            ) : (
                            // Если длина массива 0, выводим текст "Нет ролей"
                            <Typography variant={'body2'} fontSize={'0.5rem'}
                                        sx={{
                                            color: 'text.secondary',
                                            fontStyle: 'italic',
                                        }}
                            >
                                no authority...
                            </Typography>
                        )}
                    </Grid>
                </Grid>

                <Grid >
                    <ActionGroupButton
                        masActions={[
                            {
                                role: "USER_EDIT",
                                title: "Edit",
                                setNewAction: { action: "edit", item: user },
                                content: <EditIcon sx={{ fontSize: "1.2rem" }} />,
                            },
                            {
                                role: "USER_DEL",
                                title: "Delete",
                                setNewAction: {
                                    action: "delete",
                                    itemId: user.id,
                                    itemName: user.username,
                                },

                                content: <DeleteForeverIcon sx={{ fontSize: "1.2rem" }} color="error" />,
                            },
                        ]}
                        setAction={setAction}
                        orientation={"vertical"}
                    />
                </Grid>
            </Grid>
        </Card>
    );
}

export default CardUser;
