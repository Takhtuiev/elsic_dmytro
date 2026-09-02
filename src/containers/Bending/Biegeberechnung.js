import React, { useState, useCallback } from "react";
import { Box, Button, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ProfilePreview from "./ProfilePreview";
import ProfileRow from "./ProfileRow";
import { calculateBlankLength } from "./Calculations";
import ProfileGeometryPreview from "./ProfileGeometryPreview";

// Возвращаем referenceBend в стейт, чтобы не ломать логику внешних превью
const INITIAL_STATE = {
 thickness: 4.0,
 kFactor: 0.32,
 rTool: 1.2,
 shelves: [
  { length: 20, side: "right" },
  { length: 20, side: "right" },
 ],
 bends: [
  { angle: 180, direction: "right" },
 ],
 verticalShelf: 1,
 firstBendIndex: -1, // Индекс первого технологического гиба
 referenceBend: { index: -1, direction: "right" } // Связанная переменная для совместимости
};

function Biegeberechnung() {
 const [state, setState] = useState(INITIAL_STATE);

 const updateParam = useCallback((key, value) => {
  setState(prev => ({ ...prev, [key]: value }));
 }, []);

 const updateNestedItem = useCallback((arrayKey, index, field, value) => {
  setState(prev => {
   const nextArray = [...prev[arrayKey]];
   nextArray[index] = { ...nextArray[index], [field]: value };

   // Если пользователь меняет НАПРАВЛЕНИЕ изгиба, и этот изгиб сейчас выбран первым,
   // синхронно обновляем направление и в переменной referenceBend
   let nextReferenceBend = { ...prev.referenceBend };
   if (arrayKey === "bends" && field === "direction" && prev.firstBendIndex === index) {
    nextReferenceBend.direction = value;
   }

   return {
    ...prev,
    [arrayKey]: nextArray,
    referenceBend: nextReferenceBend
   };
  });
 }, []);

 const handleShelfChange = (i, v) => updateNestedItem("shelves", i, "length", Number(v) || 0);
 const handleShelfSideChange = (i, v) => v !== null && updateNestedItem("shelves", i, "side", v);
 const handleBendChange = (i, v) => updateNestedItem("bends", i, "angle", Number(v) || 0);
 const handleBendDirectionChange = (i, v) => v !== null && updateNestedItem("bends", i, "direction", v);
 const handleVerticalShelfChange = i => updateParam("verticalShelf", i + 1);

 // Управление первым технологическим гибом с жесткой привязкой к referenceBend
 const handleSelectFirstBend = useCallback((index) => {
  setState(prev => {
   const isAlreadySelected = prev.firstBendIndex === index;
   const nextIndex = isAlreadySelected ? -1 : index;

   // Находим направление изгиба из массива, чтобы прописать его в referenceBend
   const currentBend = prev.bends[index];
   const nextDirection = currentBend ? currentBend.direction : "right";

   return {
    ...prev,
    firstBendIndex: nextIndex,
    // Намертво связываем старую переменную с новыми кнопками ①
    referenceBend: {
     index: nextIndex,
     direction: nextDirection
    }
   };
  });
 }, []);

 const addBend = () => {
  setState(prev => ({
   ...prev,
   bends: [...prev.bends, { angle: 180, direction: "right" }],
   shelves: [...prev.shelves, { length: 20, side: "right" }]
  }));
 };

 const removeBend = i => {
  if (state.bends.length <= 1) return;
  const s = i + 1;

  setState(prev => {
   const nextBends = prev.bends.filter((_, x) => x !== i);
   const nextShelves = prev.shelves.filter((_, x) => x !== s);

   const nextVertical = prev.verticalShelf === s ? Math.max(1, prev.verticalShelf - 1) : prev.verticalShelf > s ? prev.verticalShelf - 1 : prev.verticalShelf;

   // Синхронный сдвиг или сброс индексов для обеих переменных при удалении рядов
   const nextFirstBend = prev.firstBendIndex === i ? -1 : prev.firstBendIndex > i ? prev.firstBendIndex - 1 : prev.firstBendIndex;

   const currentBendAfterRemove = nextBends[nextFirstBend];
   const nextRefDirection = currentBendAfterRemove ? currentBendAfterRemove.direction : "right";

   return {
    ...prev,
    bends: nextBends,
    shelves: nextShelves,
    verticalShelf: nextVertical,
    firstBendIndex: nextFirstBend,
    referenceBend: {
     index: nextFirstBend,
     direction: nextRefDirection
    }
   };
  });
 };

 const blankLength = calculateBlankLength(state);

 return (
     <Box sx={{ display: "flex", gap: 3, alignItems: "flex-start", width: "100%", flexWrap: "wrap", p: 1 }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, width: "fit-content", maxWidth: "100%", flexShrink: 0 }}>

       <Paper elevation={2} sx={{ p: 3, width: "fit-content", maxWidth: "100%", boxSizing: "border-box" }}>
        <Typography variant="h6" fontWeight="500" sx={{ mb: 3 }}>Part Profile</Typography>
        <Stack spacing={2}>
         {state.shelves.map((shelf, i) => (
             <ProfileRow
                 key={`row-${i}`}
                 shelf={shelf}
                 bend={state.bends[i] || null}
                 index={i}
                 verticalShelf={state.verticalShelf}
                 firstBendIndex={state.firstBendIndex}
                 onShelfChange={handleShelfChange}
                 onShelfSideChange={handleShelfSideChange}
                 onVerticalShelfChange={handleVerticalShelfChange}
                 onBendChange={handleBendChange}
                 onBendDirectionChange={handleBendDirectionChange}
                 onSelectFirstBend={handleSelectFirstBend}
                 onRemoveBend={removeBend}
                 canRemove={!!state.bends[i] && state.bends.length > 1}
             />
         ))}
        </Stack>
        <Box sx={{ mt: 3 }}>
         <Button variant="outlined" startIcon={<AddIcon />} onClick={addBend} sx={{ width: "100%", py: 1, textTransform: "none" }}>
          Add Bend
         </Button>
        </Box>
       </Paper>

       <Paper elevation={2} sx={{ p: 3, width: "100%", boxSizing: "border-box" }}>
        <Typography variant="h6" fontWeight="500" sx={{ mb: 3 }}>Parameters</Typography>
        <Stack spacing={2}>
         <TextField label="Thickness" type="number" value={state.thickness} size="small" sx={{ width: "16ch" }}
                    onChange={e => updateParam("thickness", Number(e.target.value) || 0)}
                    slotProps={{ htmlInput: { min: 0, step: .01 }, input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }} />
         <TextField label="K-Factor" type="number" value={state.kFactor} size="small" sx={{ width: "16ch" }}
                    onChange={e => updateParam("kFactor", Number(e.target.value) || 0)}
                    slotProps={{ htmlInput: { min: 0, max: 1, step: .01 } }} />
         <TextField label="R_tool" type="number" value={state.rTool} size="small" sx={{ width: "16ch" }}
                    onChange={e => updateParam("rTool", Number(e.target.value) || 0)}
                    slotProps={{ htmlInput: { min: 0, step: .01 }, input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }} />
        </Stack>
        <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
         <Typography variant="body2" color="text.secondary" sx={{ mb: .5 }}>Blank Length</Typography>
         <Typography variant="h5" fontWeight="bold" color="primary.main">
          {blankLength !== null ? `${blankLength.toFixed(2)} mm` : "—"}
         </Typography>
        </Box>
       </Paper>
      </Box>

      <Box sx={{ flex: "1 1 400px", minWidth: 0, maxWidth: 700, display: "flex", flexDirection: "column", gap: 2 }}>
       <ProfileGeometryPreview profile={state} />
       {/* Проп восстановлен в исходном виде! ProfilePreview получит старую родную структуру */}
       <ProfilePreview profile={state} verticalShelf={state.verticalShelf} referenceBend={state.referenceBend} />
      </Box>
     </Box>
 );
}

export default Biegeberechnung;
