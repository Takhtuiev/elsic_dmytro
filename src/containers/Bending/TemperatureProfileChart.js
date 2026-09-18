import React, {memo} from "react";
import {Paper, useTheme} from "@mui/material";

export const formatTime=seconds=>{
    if(!seconds||seconds<0) return "0m 00s";
    const totalSeconds=Math.round(seconds);
    const minutes=Math.floor(totalSeconds/60);
    const secs=totalSeconds%60;
    return `${minutes}m ${String(secs).padStart(2,"0")}s`;
};

export const TemperatureProfileChart=memo(({data})=>{
    const theme=useTheme();

    const temps=data?.temperatureProfile?.temperaturesC;
    const cooldownTemps=data?.temperatureProfile?.cooldownProfileC;
    const dxMm=data?.temperatureProfile?.dxMm;
    const cooldownSec=data?.cooldownSec;
    const heatingSec=formatTime(data?.heatingTimeSeconds);
    const status=data?.status;

    if(!temps?.length||temps.length<2||typeof dxMm!=="number") return null;

    const width=300,height=150;
    const pad={left:36,right:16,top:27,bottom:39};
    const len=temps.length;
    const hasCooldown=cooldownTemps?.length===len;
    const wPlot=width-pad.left-pad.right;
    const hPlot=height-pad.top-pad.bottom;
    const xMax=(len-1)*dxMm;
    const xDelta=xMax||1;
    const xs=x=>pad.left+(x/xDelta)*wPlot;

    let minIdx=0,maxIdx=0,minV=Infinity,maxV=-Infinity;
    let minCoolIdx=0,maxCoolIdx=0,minCoolV=Infinity,maxCoolV=-Infinity;

    for(let i=0;i<len;i++){
        if(temps[i]<minV){minV=temps[i];minIdx=i;}
        if(temps[i]>maxV){maxV=temps[i];maxIdx=i;}
        if(hasCooldown&&cooldownTemps[i]<minCoolV){minCoolV=cooldownTemps[i];minCoolIdx=i;}
        if(hasCooldown&&cooldownTemps[i]>maxCoolV){maxCoolV=cooldownTemps[i];maxCoolIdx=i;}
    }

    const allTemps=hasCooldown?[...temps,...cooldownTemps]:temps;
    const dataMin=Math.min(...allTemps);
    const dataMax=Math.max(...allTemps);

    let tMin=Math.floor(dataMin/10)*10;
    let tMax=Math.ceil(dataMax/10)*10;

    if(tMax===tMin){tMin-=10;tMax+=10;}

    const tDelta=tMax-tMin;
    const ys=t=>pad.top+((tMax-t)/tDelta)*hPlot;
    const xCenter=xs(xMax/2);

    const makePath=values=>{
        let d=`M ${xs(0)} ${ys(values[0])}`;

        for(let i=0;i<values.length-1;i++){
            const t0=values[i>0?i-1:0];
            const t1=values[i];
            const t2=values[i+1];
            const t3=values[Math.min(i+2,values.length-1)];

            const x0=xs((i>0?i-1:0)*dxMm);
            const x1=xs(i*dxMm);
            const x2=xs((i+1)*dxMm);
            const x3=xs(Math.min(i+2,values.length-1)*dxMm);

            const y0=ys(t0),y1=ys(t1),y2=ys(t2),y3=ys(t3);

            d+=` C ${x1+(x2-x0)/6},${y1+(y2-y0)/6} ${x2-(x3-x1)/6},${y2-(y3-y1)/6} ${x2},${y2}`;
        }

        return d;
    };

    const makeCurvePoints=values=>{
        const points=[],steps=10;

        for(let i=0;i<values.length-1;i++){
            const t0=values[i>0?i-1:0];
            const t1=values[i];
            const t2=values[i+1];
            const t3=values[Math.min(i+2,values.length-1)];

            const x0=xs((i>0?i-1:0)*dxMm);
            const x1=xs(i*dxMm);
            const x2=xs((i+1)*dxMm);
            const x3=xs(Math.min(i+2,values.length-1)*dxMm);

            const y0=ys(t0),y1=ys(t1),y2=ys(t2),y3=ys(t3);
            const c1x=x1+(x2-x0)/6,c1y=y1+(y2-y0)/6;
            const c2x=x2-(x3-x1)/6,c2y=y2-(y3-y1)/6;

            for(let s=0;s<steps;s++){
                const u=s/steps,v=1-u;

                points.push({
                    x:v*v*v*x1+3*v*v*u*c1x+3*v*u*u*c2x+u*u*u*x2,
                    y:v*v*v*y1+3*v*v*u*c1y+3*v*u*u*c2y+u*u*u*y2
                });
            }
        }

        points.push({
            x:xs((len-1)*dxMm),
            y:ys(values[len-1])
        });

        return points;
    };

    const dPath=makePath(temps);
    const cooldownPath=hasCooldown?makePath(cooldownTemps):null;
    const mainCurvePoints=makeCurvePoints(temps);
    const cooldownCurvePoints=hasCooldown?makeCurvePoints(cooldownTemps):[];

    const chartColor=status?.type==="error"
        ?theme.palette.error.main
        :status?.type==="warning"
            ?theme.palette.warning.main
            :theme.palette.text.primary;

    const cooldownColor=theme.palette.text.secondary;
    const minColor=theme.palette.info.main;
    const maxColor=theme.palette.error.main;

    const makeLabels=(values,minI,minVal,maxI,maxVal,type)=>{
        const color=type==="cooldown"?cooldownColor:chartColor;

        const raw=[
            {id:maxI,val:maxVal,priority:4},
            {id:minI,val:minVal,priority:4},
            {id:0,val:values[0],priority:2},
            {id:len-1,val:values[len-1],priority:2}
        ];

        const result=[],seen=new Set();

        for(const p of raw.sort((a,b)=>b.priority-a.priority)){
            if(!seen.has(p.id)){
                seen.add(p.id);
                result.push({
                    ...p,
                    type,
                    color,
                    x:xs(p.id*dxMm),
                    y:ys(p.val)
                });
            }
        }

        return result;
    };

    const labels=[
        ...makeLabels(temps,minIdx,minV,maxIdx,maxV,"main"),
        ...(hasCooldown?makeLabels(cooldownTemps,minCoolIdx,minCoolV,maxCoolIdx,maxCoolV,"cooldown"):[])
    ];

    const rectPointDistance=(px,py,r)=>{
        const dx=Math.max(r.left-px,0,px-r.right);
        const dy=Math.max(r.top-py,0,py-r.bottom);
        return Math.hypot(dx,dy);
    };

    const curveHitsLabel=(points,rect,anchor)=>{
        for(const point of points){
            if(Math.hypot(point.x-anchor.x,point.y-anchor.y)<5) continue;
            if(rectPointDistance(point.x,point.y,rect)<2.5) return true;
        }
        return false;
    };

    const candidates=[
        {dx:0,dy:-9},{dx:0,dy:14},
        {dx:-8,dy:-9},{dx:8,dy:-9},
        {dx:-8,dy:14},{dx:8,dy:14},
        {dx:-12,dy:-9},{dx:12,dy:-9},
        {dx:-12,dy:14},{dx:12,dy:14},
        {dx:0,dy:-16},{dx:0,dy:21}
    ];

    const placed=[];

    for(const p of [...labels].sort((a,b)=>b.priority-a.priority)){
        const textWidth=`${Math.round(p.val)}°`.length*5.2;
        const anchor={x:p.x,y:p.y};
        let best=null;

        for(const c of candidates){
            const dx=c.dx,dy=c.dy;
            const x=p.x+dx,y=p.y+dy;
            const textAnchor=p.id===0?"start":p.id===len-1?"end":"middle";

            const left=textAnchor==="start"?x:textAnchor==="end"?x-textWidth:x-textWidth/2;
            const right=textAnchor==="start"?x+textWidth:textAnchor==="end"?x:x+textWidth/2;
            const top=y-8,bottom=y+3;

            const rect={
                left:left-1.5,
                right:right+1.5,
                top:top-1.5,
                bottom:bottom+1.5
            };

            let score=0;

            if(left<pad.left) score+=10000+(pad.left-left)*100;
            if(right>width-pad.right) score+=10000+(right-(width-pad.right))*100;
            if(top<pad.top) score+=10000+(pad.top-top)*100;
            if(bottom>height-pad.bottom) score+=10000+(bottom-(height-pad.bottom))*100;

            for(const q of placed){
                if(rect.left<q.right&&rect.right>q.left&&rect.top<q.bottom&&rect.bottom>q.top) score+=100000;
                else{
                    const gapX=Math.max(q.left-rect.right,rect.left-q.right,0);
                    const gapY=Math.max(q.top-rect.bottom,rect.top-q.bottom,0);

                    if(gapX<5&&gapY<5) score+=1000;
                }
            }

            if(curveHitsLabel(mainCurvePoints,rect,anchor)||(hasCooldown&&curveHitsLabel(cooldownCurvePoints,rect,anchor))) score+=50000;

            score+=Math.abs(dx)*2+Math.abs(dy)*.5;

            if(p.id===0&&dx<0) score+=500;
            if(p.id===len-1&&dx>0) score+=500;

            if(!best||score<best.score) best={dx,dy,score,left,right,top,bottom};
        }

        placed.push({...p,...best});
    }

    return(
        <Paper
            sx={{
                border:"1px solid",
                borderColor:status?.type==="ok"?theme.palette.divider:chartColor,
                p:.5,
                fontFamily:'"Roboto Mono","SF Mono",monospace"',
                boxShadow:"none",
            }}
        >
            <svg
                width={300}
                height={150}
                style={{display:"block"}}
                shapeRendering="geometricPrecision"
            >
                {Array.from({length:Math.floor((tMax-tMin)/10)+1},(_,i)=>tMin+i*10).map((t,i)=>i>0&&(
                    <line
                        key={t}
                        x1={pad.left}
                        y1={ys(t)}
                        x2={width-pad.right}
                        y2={ys(t)}
                        stroke={theme.palette.divider}
                        strokeWidth={1}
                        strokeDasharray="4 2"
                    />
                ))}
                <line
                    x1={xCenter}
                    y1={pad.top}
                    x2={xCenter}
                    y2={height-pad.bottom}
                    stroke={theme.palette.divider}
                    strokeWidth={1}
                    strokeDasharray="4 2"
                />

                <line
                    x1={width-pad.right}
                    y1={pad.top}
                    x2={width-pad.right}
                    y2={height-pad.bottom}
                    stroke={theme.palette.divider}
                    strokeWidth={1}
                    strokeDasharray="4 2"
                />

                <line
                    x1={pad.left}
                    y1={pad.top}
                    x2={pad.left}
                    y2={height-pad.bottom}
                    stroke={theme.palette.text.secondary}
                    strokeWidth={1}
                    opacity=".55"
                />

                <line
                    x1={pad.left}
                    y1={height-pad.bottom}
                    x2={width-pad.right}
                    y2={height-pad.bottom}
                    stroke={theme.palette.text.secondary}
                    strokeWidth={1}
                    opacity=".55"
                />

                {hasCooldown&&(
                    <path
                        d={cooldownPath}
                        fill="none"
                        stroke={cooldownColor}
                        strokeWidth={1}
                        opacity=".5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                <path
                    d={dPath}
                    fill="none"
                    stroke={chartColor}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {placed.map(p=>{
                    const isMin=p.id===(p.type==="cooldown"?minCoolIdx:minIdx);
                    const isMax=p.id===(p.type==="cooldown"?maxCoolIdx:maxIdx);
                    const pointColor=isMin?minColor:isMax?maxColor:p.color;

                    return(
                        <g key={`${p.type}-${p.id}`}>
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={p.type==="cooldown"?2.5:3}
                                fill={pointColor}
                                stroke={theme.palette.background.paper}
                                strokeWidth={1}
                                opacity={p.type==="cooldown"?.5:1}
                            />

                            <text
                                x={p.x}
                                y={p.y+p.dy}
                                textAnchor={p.id===0?"start":p.id===len-1?"end":"middle"}
                                fontSize={p.type==="cooldown"?8.5:9}
                                fontWeight="bold"
                                fill={p.color}
                            >
                                {Math.round(p.val)}°
                            </text>
                        </g>
                    );
                })}

                <text
                    x={xCenter}
                    y={14}
                    textAnchor="middle"
                    fontSize={9.5}
                    fontWeight="bold"
                    fill={chartColor}
                >
                    Heating: {heatingSec} (ΔT = {(maxV-minV).toFixed(1)}°C)
                </text>

                <text
                    x={pad.left-5}
                    y={pad.top+3}
                    textAnchor="end"
                    fontSize={8.5}
                    fill={theme.palette.text.secondary}
                >
                    {tMax}°
                </text>

                <text
                    x={pad.left-5}
                    y={height-pad.bottom+3}
                    textAnchor="end"
                    fontSize={8.5}
                    fill={theme.palette.text.secondary}
                >
                    {tMin}°
                </text>

                <text
                    x={pad.left}
                    y={height-22}
                    textAnchor="middle"
                    fontSize={8.5}
                    fill={theme.palette.text.secondary}
                >
                    0 mm
                </text>

                <text
                    x={width-pad.right}
                    y={height-22}
                    textAnchor="end"
                    fontSize={8.5}
                    fill={theme.palette.text.secondary}
                >
                    {xMax.toFixed(0)} mm
                </text>

                {typeof cooldownSec==="number"&&(
                    <text
                        x={xCenter}
                        y={height-6}
                        textAnchor="middle"
                        fontSize={8.5}
                        fontWeight="500"
                        fill={theme.palette.text.secondary}
                    >
                        Cooling: {cooldownSec}s{hasCooldown&&` (ΔT = ${(maxCoolV-minCoolV).toFixed(1)}°C)`}
                    </text>
                )}
            </svg>
        </Paper>
    );
});