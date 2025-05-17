import {
    Card,
    Typography,
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
import {Box} from "@mui/system";
import {Skeleton} from "@mui/lab";

function CardUser({ item, setAction }) {

    if (!item) {
        return (
            <Card sx={{ height: "100%", p: 2 }}>
                <Grid container spacing={1}>
                    <Grid size={4}>
                        <Skeleton variant="text" width="60%" height={30} />
                    </Grid>
                    <Grid size={5}>
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="70%" />
                    </Grid>
                    <Grid size={3}>
                        <Skeleton variant="rectangular" width="100%" height={40} />
                    </Grid>
                </Grid>
            </Card>
        );
    }

    return (
        <Card
            //onClick={() => { navigate("/drinksDetails/" + product.id) }}
            sx={{
                height: "100%",
                p: 0,
                wordBreak: 'break-word',
                hyphens: 'auto',
                overflowWrap: 'break-word',
                //display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
            }}
        >
            <Grid
                container
                //justifyContent="end"
                alignItems="center"
                spacing={1}
                sx={{
                    height: '100%',
                    color: item.enabled ? 'text.primary' : 'text.secondary',
                }}
            >
                <Grid minWidth={'15rem'}>
                    <Typography variant="h6" display="flex" alignItems="center">
                        {item.enabled ?
                            <CheckIcon  fontSize={'small'} color="success"  sx={{mx: 1}}/>
                            :
                            <BlockIcon  fontSize={'small'} color="disabled"  sx={{mx: 1}}/>}
                        <Box>
                            {item.username}
                        </Box>
                    </Typography>
                </Grid>
                <Grid size={'grow'} minWidth={'15rem'}>
                    <Grid container alignItems="center" sx={{ display: 'flex' }}>
                        <Grid >
                            <MailOutlineIcon fontSize={'small'} sx={{mx: 1}} color={item.enabled ? 'primary' : 'text.secondary'}/>
                        </Grid>
                        <Grid size={'grow'}>
                            <Typography variant="body1" >
                                {item.email}
                            </Typography>
                        </Grid>
                    </Grid>
                    <Grid container alignItems="center" sx={{ display: 'flex' }}>
                        <Grid >
                            <PhoneIcon fontSize={'small'} sx={{mx: 1, my:0}} color={item.enabled ? 'primary' : 'text.secondary'}/>
                        </Grid>
                        <Grid size={'grow'}>
                            <Typography variant="body1">
                                {item.phone}
                            </Typography>
                        </Grid>
                    </Grid>
                </Grid>

                <Grid minWidth={'6rem'} >
                    <Grid container direction={'column'} justifyContent={'center'} alignContent={'center'}
                          sx={{
                              //pt: 0,
                              height: '100%',
                              border: '1px solid rgba(0, 0, 0, 0.23)',
                              borderRadius: '4px',
                              padding: '0.2rem',
                              margin: '0.2rem',
                          }}
                    >
                        {item.authorities.length > 0 ? (
                            // Если длина массива больше 0, выводим роли
                            item.authorities.map((item,index) => (
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

                <Grid  sx={{ ml: "auto" }}>
                    <ActionGroupButton
                        masActions={[
                            {
                                role: "USER_EDIT",
                                title: "Edit",
                                setNewAction: { action: "edit", item: item },
                                content: <EditIcon sx={{ fontSize: "1.2rem" }} />,
                            },
                            {
                                role: "USER_DEL",
                                title: "Delete",
                                setNewAction: {
                                    action: "delete",
                                    itemId: item.id,
                                    itemName: item.username,
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
