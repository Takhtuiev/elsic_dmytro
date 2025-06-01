import ImageUpload from "../../MyComponent/Image/ImageUpload";
import MySelect from "../../MyComponent/MySelect";
import MyTextField from "../../MyComponent/MyTextField";
import Tooltip from "@mui/material/Tooltip";
import {IconButton} from "@mui/material";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import React from "react";
import {DRINKS_COLUMNS} from "../../../CONSTANTS/Constants";
import Grid from '@mui/material/Grid2';


function EditVariantContent({index, variant, loadEditLists, lastUpdated, setNewValue, dialogEditOptions, errorData, isDeletable, sx} ) {

    const updateVariant = (value, key) => {
        setNewValue(value, key, index);
    };

    function createObj(name, indexVariant) {
        return {
            key: name,
            value: variant && variant[name],
            valueList: loadEditLists ? loadEditLists[name] : null,
            label: DRINKS_COLUMNS[name],
            error: errorData && errorData[ (indexVariant === undefined) ? name : `${indexVariant}-${name}`],
            indexVariant: indexVariant
        };
    }

    return (
        <Grid container spacing={1} alignItems={'center'} my={1} sx={sx} >
            <Grid >
                <ImageUpload
                    obj={createObj('imageUrl', index)}
                    setValue={updateVariant}
                    lastUpdated={lastUpdated}
                />
            </Grid>

            <Grid  container size={'grow'} direction="column" spacing={1} >
                <Grid  container spacing={1}>

                    <Grid  size={{ xs:12, sm:6, md:3 }}>
                        <MySelect
                            obj={createObj('packagingType', index)}
                            setValue={updateVariant}
                            sx={{width: '100%'}}
                            editOptions={dialogEditOptions}
                        />
                    </Grid>
                    <Grid  size={{ xs:12, sm:6, md:3 }}>
                        <MyTextField
                            obj={createObj('volume', index)}
                            setValue={updateVariant}
                            sx={{minWidth: '100%'}}
                            type={'number'}
                        />
                    </Grid>
                    <Grid  size={{ xs:12, sm:6, md:3 }}>
                        <MyTextField
                            obj={createObj('price', index)}
                            setValue={updateVariant}
                            type={'number'}
                            sx={{minWidth: '100%'}}
                        />
                    </Grid>
                    <Grid  size={{ xs:12, sm:6, md:3 }}>
                        <MyTextField
                            obj={createObj('stockQuantity', index)}
                            setValue={updateVariant}
                            type={'number'}
                            sx={{minWidth: '100%'}}
                        />
                    </Grid>
                </Grid>
                <Grid  >
                    <MyTextField
                        obj={createObj('promotionsAndDiscounts', index)}
                        setValue={updateVariant}
                        sx={{ width: '100%' }}
                        sxInput={{fontSize: '0.8rem'}}
                        multiline={true}
                    />
                </Grid>
            </Grid>
            <Grid >
                <Tooltip title="Delete variant">
                    <span>
                        <IconButton
                            variant={'outlined'}
                            color="error"
                            onClick={() => setNewValue(null, null, index) }
                            //деактивируем, если последний не удаленный
                            disabled={!isDeletable}
                            sx={{
                                minWidth: 1,
                                p: '0.2rem',
                            }}
                        >
                            <DeleteForeverIcon/>
                        </IconButton>
                    </span>
                </Tooltip>
            </Grid>

        </Grid>
    );
}

export default EditVariantContent;
