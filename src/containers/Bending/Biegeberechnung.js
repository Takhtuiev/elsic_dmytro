import React, { useState, useCallback, useEffect } from "react";
import {
 Box,
 Button,
 InputAdornment,
 Paper,
 Stack,
 TextField,
 Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ProfileRow from "./ProfileRow";
import {
 calculateBlankLength,
 calculateDistanceToOuterApexViaNeutral,
 calculateBendingMachineParams
} from "./Calculations";
import ProfileGeometryPreview from "./ProfileGeometryPreview";

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
 firstBendIndex: -1,
 bendViewMode: "toEnd",
 referenceBend: {
  index: -1,
  direction: "right",
  length: null
 }
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

   let nextReferenceBend = { ...prev.referenceBend };

   if (
       arrayKey === "bends" &&
       field === "direction" &&
       prev.firstBendIndex === index
   ) {
    nextReferenceBend.direction = value;
   }

   return {
    ...prev,
    [arrayKey]: nextArray,
    referenceBend: nextReferenceBend
   };
  });
 }, []);

 const handleShelfChange = (i, v) =>
     updateNestedItem("shelves", i, "length", Number(v) || 0);

 const handleShelfSideChange = (i, v) =>
     v !== null && updateNestedItem("shelves", i, "side", v);

 const handleBendChange = (i, v) =>
     updateNestedItem("bends", i, "angle", Number(v) || 0);

 const handleBendDirectionChange = (i, v) =>
     v !== null && updateNestedItem("bends", i, "direction", v);

 const handleVerticalShelfChange = i =>
     updateParam("verticalShelf", i + 1);

 const handleSelectFirstBend = useCallback(index => {
  setState(prev => {
   let nextFirstBendIndex = prev.firstBendIndex;
   let nextViewMode = prev.bendViewMode;

   if (prev.firstBendIndex !== index) {
    nextFirstBendIndex = index;
    nextViewMode = "toEnd";
   } else if (prev.bendViewMode === "toEnd") {
    nextViewMode = "fromStart";
   } else {
    nextFirstBendIndex = -1;
    nextViewMode = "toEnd";
   }

   const currentBend = prev.bends[nextFirstBendIndex];
   const nextDirection = currentBend
       ? currentBend.direction
       : "right";

   return {
    ...prev,
    firstBendIndex: nextFirstBendIndex,
    bendViewMode: nextViewMode,
    referenceBend: {
     index: nextFirstBendIndex,
     direction: nextDirection,
     length: null
    }
   };
  });
 }, []);

 const addBend = () => {
  setState(prev => ({
   ...prev,
   bends: [
    ...prev.bends,
    { angle: 180, direction: "right" }
   ],
   shelves: [
    ...prev.shelves,
    { length: 20, side: "right" }
   ]
  }));
 };

 const removeBend = i => {
  if (state.bends.length <= 1) return;

  const s = i + 1;

  setState(prev => {
   const nextBends = prev.bends.filter((_, x) => x !== i);
   const nextShelves = prev.shelves.filter((_, x) => x !== s);

   const nextVertical =
       prev.verticalShelf === s
           ? Math.max(1, prev.verticalShelf - 1)
           : prev.verticalShelf > s
               ? prev.verticalShelf - 1
               : prev.verticalShelf;

   const nextFirstBend =
       prev.firstBendIndex === i
           ? -1
           : prev.firstBendIndex > i
               ? prev.firstBendIndex - 1
               : prev.firstBendIndex;

   const currentBendAfterRemove =
       nextBends[nextFirstBend];

   const nextRefDirection =
       currentBendAfterRemove
           ? currentBendAfterRemove.direction
           : "right";

   return {
    ...prev,
    bends: nextBends,
    shelves: nextShelves,
    verticalShelf: nextVertical,
    firstBendIndex: nextFirstBend,
    referenceBend: {
     index: nextFirstBend,
     direction: nextRefDirection,
     length: null
    }
   };
  });
 };

 const blankLength = calculateBlankLength(state);

 const selectedBend = state.firstBendIndex >= 0
     ? state.bends[state.firstBendIndex]
     : null;

 const machineParams =
     selectedBend && state.referenceBend.length !== null
         ? calculateBendingMachineParams({
          alpha: selectedBend.angle,
          lInput: state.referenceBend.length,
          isInnerMode: state.bendViewMode === "fromStart" ? 1 : 0,
          t: state.thickness,
          rTool: state.rTool
         })
         : null;

 useEffect(() => {
  if (state.firstBendIndex < 0) {
   if (
       state.referenceBend.length !== null ||
       state.referenceBend.index !== -1
   ) {
    setState(prev => ({
     ...prev,
     referenceBend: {
      index: -1,
      direction: "right",
      length: null
     }
    }));
   }
   return;
  }

  const bend = state.bends[state.firstBendIndex];
  if (!bend) return;

  const length = Number(
      calculateDistanceToOuterApexViaNeutral(state).toFixed(2)
  );

  const direction = bend.direction;

  if (
      state.referenceBend.length !== length ||
      state.referenceBend.direction !== direction ||
      state.referenceBend.index !== state.firstBendIndex
  ) {
   setState(prev => ({
    ...prev,
    referenceBend: {
     index: prev.firstBendIndex,
     direction,
     length
    }
   }));
  }
 }, [
  state.firstBendIndex,
  state.bendViewMode,
  state.bends,
  state.shelves,
  state.thickness,
  state.kFactor,
  state.rTool
 ]);

 return (
     <Box
         sx={{
          display: "flex",
          gap: { xs: 2, md: 3 },
          alignItems: "flex-start",
          width: "100%",
          flexWrap: "wrap",
          p: { xs: 0.5, sm: 1 }
         }}
     >
      {/* БЛОК ЧЕРТЕЖА: На мобильных сверху (order 1), на ПК — справа (order 2) */}
      <Box
          sx={{
           flex: "1 1 400px",
           minWidth: 0,
           maxWidth: 700,
           width: "100%",
           display: "flex",
           flexDirection: "column",
           gap: 2,
           order: { xs: 1, md: 2 }
          }}
      >
       <ProfileGeometryPreview
           profile={state}
           blankLength={blankLength}
           machineParams={machineParams}
       />
      </Box>

      {/* ЕДИНЫЙ ОБЪЕДИНЕННЫЙ БЛОК НАСТРОЕК: На мобильных снизу (order 2), на ПК — слева (order 1) */}
      <Paper
          elevation={2}
          sx={{
           p: { xs: 2, sm: 3 },
           // ИСПРАВЛЕНИЕ: На мобильных 100%, а на ПК жестко фиксируем ширину (например, 420px)
           // Это не даст ProfileRow или инпутам раздувать карточку и выдавливать чертеж
           width: { xs: "100%", md: "420px" },
           maxWidth: "100%",
           boxSizing: "border-box",
           order: { xs: 2, md: 1 },
           flexShrink: 0
          }}
      >

       {/* ЗАГОЛОВОК И УЛЬТРА-КОМПАКТНЫЕ ПАРАМЕТРЫ (ТЕПЕРЬ СВЕРХУ) */}
       <Typography variant="h6" fontWeight="500" sx={{ mb: 1.5 }}>
        Profile Editor
       </Typography>

       {/* Параметры выстроены в один плотный ряд */}
       <Box
           sx={{
            display: "flex",
            // На мобильных переносим инпуты, на ПК (md) — выстраиваем строго в один ряд
            flexWrap: { xs: "wrap", md: "nowrap" },
            gap: 1.5,
            mb: 3,
            pb: 2,
            borderBottom: "1px solid",
            borderColor: "divider",
            width: "100%",
            // Правило для дочерних элементов: на мобильных они делят экран пополам (минус gap), на ПК делятся на 3
            "& > *": {
             flex: { xs: "1 1 calc(50% - 6px)", md: "1 1 0px" },
             minWidth: 0 // Важно, чтобы MUI инпуты могли сжиматься меньше своего дефолтного размера
            }
           }}
       >
        <TextField
            label="Thickness"
            type="number"
            value={state.thickness}
            size="small"
            onChange={e => updateParam("thickness", Number(e.target.value) || 0)}
            slotProps={{
             htmlInput: { min: 0, step: 0.1 },
             input: { endAdornment: <InputAdornment position="end" sx={{ scale: "0.80", ml: 0.25 }}>mm</InputAdornment> }
            }}
        />

        <TextField
            label="K-Factor"
            type="number"
            value={state.kFactor}
            size="small"
            onChange={e => updateParam("kFactor", Number(e.target.value) || 0)}
            slotProps={{ htmlInput: { min: 0, max: 1, step: 0.01 } }}
        />

        <TextField
            label="R_tool"
            type="number"
            value={state.rTool}
            size="small"
            onChange={e => updateParam("rTool", Number(e.target.value) || 0)}
            slotProps={{
             htmlInput: { min: 0, step: .1 },
             input: { endAdornment: <InputAdornment position="end" sx={{ scale: "0.80", ml: 0.25 }}>mm</InputAdornment> }
            }}
        />
       </Box>

       {/* СПИСОК ПОЛОК (PART PROFILE) */}
       <Typography variant="subtitle2" fontWeight="500" color="text.secondary" sx={{ mb: 1.5 }}>
        Shelves & Bends
       </Typography>

       <Stack spacing={1.5}>
        {state.shelves.map((shelf, i) => (
            <ProfileRow
                key={`row-${i}`}
                shelf={shelf}
                bend={state.bends[i] || null}
                index={i}
                verticalShelf={state.verticalShelf}
                firstBendIndex={state.firstBendIndex}
                bendViewMode={state.bendViewMode}
                onShelfChange={handleShelfChange}
                onShelfSideChange={handleShelfSideChange}
                onVerticalShelfChange={handleVerticalShelfChange}
                onBendChange={handleBendChange}
                onBendDirectionChange={handleBendDirectionChange}
                onSelectFirstBend={handleSelectFirstBend}
                onRemoveBend={removeBend}
                canRemove={
                    !!state.bends[i] &&
                    state.bends.length > 1
                }
            />
        ))}
       </Stack>

       <Box sx={{ mt: 2.5 }}>
        <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addBend}
            sx={{
             width: "100%",
             py: 0.75,
             textTransform: "none",
             fontSize: "0.9rem"
            }}
        >
         Add Bend
        </Button>
       </Box>
      </Paper>
     </Box>
 );
}

export default Biegeberechnung;