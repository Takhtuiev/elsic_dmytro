import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";


function MySelect({ obj, setValue, sx, editable=false}) {

    const valueIndex = obj.valueList?.indexOf(obj.value) ?? -1;

    const idElement = obj.indexVariant !== undefined
        ? `select-${obj.field}${obj.key}-${obj.indexVariant}`
        : `select-${obj.field}${obj.key}`;

    const label = obj.label || "Select"

    const handleChange = (event) => {
        const newIndex = event.target.value;
        if (newIndex === -2) {
            setValue(obj.valueList?.[valueIndex], obj.key, obj.indexVariant, "EditList");
        } else {
            setValue(obj.valueList?.[newIndex], obj.key, obj.indexVariant);
        }
    };

    return (
        <FormControl size="small" sx={sx} fullWidth>
            <InputLabel id={`${idElement}-label`}>
                {label}
            </InputLabel>
            <Select
                id={idElement}
                variant="outlined"
                label={label}
                labelId={`${idElement}-label`}
                value={valueIndex !== -1 ? valueIndex : ""}
                onChange={handleChange}
            >
                {obj.valueList?.map((item, index) => (
                    <MenuItem key={index} value={index}>
                        {String(item)}
                    </MenuItem>
                ))}
                {editable && (
                    <MenuItem value={-2}
                              sx={{ fontStyle: "italic", color: "text.disabled" }}
                    >
                        Edit list...
                        <EditIcon color="disabled" sx={{ ml: "auto" }} />
                    </MenuItem>
                )}
            </Select>
        </FormControl>
    );
}

export default MySelect;
