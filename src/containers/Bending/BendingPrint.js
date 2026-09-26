import React,{useEffect,useMemo} from "react";
import {Box,useTheme} from "@mui/material";
import {alpha} from "@mui/material/styles";

import BendProfileRender from "./BendProfileRender";
import {prepareSvgLayers} from "./prepareSvgLayers";
import {simulate1DHeating} from "./pvc-1d-transient-heating";
import {
    TemperatureProfileChart
} from "./TemperatureProfileChart";

const BendingPrint=({
                        profile,
                        geometry,
                        blankLength,
                        machineParams,
                        rotationPreview,
                        onClose
                    })=>{
    const theme=useTheme();

    useEffect(()=>{
        const print=()=>{
            window.print();
        };

        const timer=setTimeout(print,100);

        const afterPrint=()=>{
            onClose?.();
        };

        window.addEventListener(
            "afterprint",
            afterPrint
        );

        return()=>{
            clearTimeout(timer);
            window.removeEventListener(
                "afterprint",
                afterPrint
            );
        };
    },[onClose]);


    const dataSimulate=useMemo(()=>{
        if(
            !profile?.thickness||
            !profile?.material||
            !profile?.machine||
            !profile.simulation
        ){
            return null;
        }

        return simulate1DHeating({
            thicknessMm:profile.thickness,
            material:profile.material,
            machine:profile.machine,
            simulation:profile.simulation
        });
    },[
        profile?.thickness,
        profile?.material,
        profile?.machine,
        profile?.simulation
    ]);


    const colors=useMemo(()=>({
        active:{
            line:theme.palette.text.primary,
            fill:alpha(
                theme.palette.text.primary,
                .1
            ),
            annotation:alpha(
                theme.palette.text.primary,
                .75
            )
        },
        ghost:{
            line:theme.palette.text.disabled,
            fill:alpha(
                theme.palette.text.disabled,
                .02
            ),
            annotation:alpha(
                theme.palette.text.disabled,
                .4
            )
        },
        blue:{
            line:theme.palette.primary.main,
            fill:alpha(
                theme.palette.primary.main,
                .08
            ),
            annotation:theme.palette.primary.main
        }
    }),[theme]);


    const svgData=useMemo(()=>{
        if(!profile)
            return null;

        return prepareSvgLayers(
            profile,
            profile.view,
            {
                width:1000,
                height:500
            },
            geometry
        );
    },[profile,geometry]);


    const committedRotation=
        Number(profile?.view?.rotation??0);

    const visualRotation=
        Number(
            rotationPreview??committedRotation
        )-
        committedRotation;


    const viewBoxValues=svgData?.viewBox
        ?.split(/\s+/)
        .map(Number);


    const rotationCenter=
        viewBoxValues?.length===4
            ?{
                x:
                    viewBoxValues[0]+
                    viewBoxValues[2]/2,
                y:
                    viewBoxValues[1]+
                    viewBoxValues[3]/2
            }
            :{
                x:0,
                y:0
            };


    return(
        <Box
            className="bending-print-page"
            sx={{
                display:"none",
                width:"100%",
                background:"#fff",
                color:"#000",
                p:2
            }}
        >
            <Box
                sx={{
                    width:"100%",
                    fontSize:"12px",
                    mb:1
                }}
            >
                <strong>
                    Part: {profile?.name||"—"}
                </strong>
                {"   "}
                Material: {profile?.material?.name||"—"}
                {"   "}
                Thickness: {profile?.thickness??"—"} mm
            </Box>

            <Box
                sx={{
                    width:"100%",
                    height:"120mm",
                    display:"flex",
                    alignItems:"center",
                    justifyContent:"center"
                }}
            >
                {svgData&&(
                    <svg
                        viewBox={svgData.viewBox}
                        width="100%"
                        height="100%"
                        preserveAspectRatio="xMidYMid meet"
                    >
                        <g
                            transform={
                                visualRotation
                                    ?`rotate(${visualRotation},${rotationCenter.x},${rotationCenter.y})`
                                    :undefined
                            }
                        >
                            <BendProfileRender
                                data={svgData.activeData}
                                strokeColor={
                                    colors.active.line
                                }
                                fillColor={
                                    colors.active.fill
                                }
                                annotationColor={
                                    colors.active.annotation
                                }
                            />

                            <BendProfileRender
                                data={svgData.ghostData}
                                strokeColor={
                                    colors.ghost.line
                                }
                                fillColor={
                                    colors.ghost.fill
                                }
                                annotationColor={
                                    colors.ghost.annotation
                                }
                                isGhost
                            />

                            <BendProfileRender
                                data={svgData.blueData}
                                strokeColor={
                                    colors.blue.line
                                }
                                fillColor={
                                    colors.blue.fill
                                }
                                annotationColor={
                                    colors.blue.annotation
                                }
                            />
                        </g>
                    </svg>
                )}
            </Box>

            <Box
                sx={{
                    display:"flex",
                    flexWrap:"wrap",
                    gap:3,
                    alignItems:"flex-start",
                    mt:1
                }}
            >
                <Box sx={{flex:"1 1 250px"}}>
                    <PrintParameters
                        profile={profile}
                        blankLength={blankLength}
                        machineParams={machineParams}
                        data={dataSimulate}
                    />
                </Box>

                <Box
                    sx={{
                        flex:"0 1 auto",
                        maxWidth:"100%"
                    }}
                >
                    <TemperatureProfileChart
                        data={dataSimulate}
                        material={profile?.material}
                    />
                </Box>
            </Box>
        </Box>
    );
};


const PrintParameters=({
                           profile,
                           blankLength,
                           machineParams,
                           data
                       })=>{
    const material=profile?.material;

    const blank=Number(blankLength);
    const width=Number(profile?.width);
    const thickness=Number(profile?.thickness);
    const density=Number(material?.density);

    const mass=
        Number.isFinite(blank)&&
        Number.isFinite(width)&&
        Number.isFinite(thickness)&&
        Number.isFinite(density)
            ?blank*
            width*
            thickness*
            density/
            1e9
            :null;

    return(
        <Box
            sx={{
                display:"flex",
                flexDirection:"column",
                gap:.4,
                fontSize:"11px"
            }}
        >
            <div>
                Blank length:{" "}
                <strong>
                    {Number.isFinite(blank)
                        ?blank.toFixed(2)
                        :"—"} mm
                </strong>
            </div>

            <div>
                Width:{" "}
                <strong>
                    {Number.isFinite(width)
                        ?width
                        :"—"} mm
                </strong>
            </div>

            <div>
                Mass:{" "}
                <strong>
                    {mass!==null
                        ?mass.toFixed(3)
                        :"—"} kg
                </strong>
            </div>

            {machineParams&&(
                <>
                    <div>
                        Stop pos:{" "}
                        <strong>
                            {machineParams.stopPosition} mm
                        </strong>
                    </div>

                    <div>
                        Bar low:{" "}
                        <strong>
                            {machineParams.barLowering} mm
                        </strong>
                    </div>

                    <div>
                        Angle:{" "}
                        <strong>
                            {machineParams.bendAngle}°
                        </strong>
                    </div>
                </>
            )}

            <div>
                Heat temp:{" "}
                <strong>
                    top:{" "}
                    {data?.heaterTemperaturesC?.top??"—"}°C,
                    {" "}bottom:{" "}
                    {data?.heaterTemperaturesC?.bottom??"—"}°C
                </strong>
            </div>

            <div>
                Heating time:{" "}
                <strong>
                    {data?.heatingTimeSeconds??"—"} s
                </strong>
            </div>

            <div>
                Simulation calculation time:{" "}
                <strong>
                    {data?.calculationTimeMs?.toFixed(1)??"—"} ms
                </strong>
            </div>
        </Box>
    );
};


export default BendingPrint;