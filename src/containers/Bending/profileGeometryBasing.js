const ARC_RADIUS=12;
const LABEL_OFFSET=12;
const ANGLE_LABEL_OFFSET=12;
const FONT_SIZE=11;
const TEXT_HALF_HEIGHT=FONT_SIZE/2;
const RAD_TO_DEG=180/Math.PI;
const EPSILON=1e-5;

const rotatePoint=(p,rad)=>({
    x:p.x*Math.cos(rad)-p.y*Math.sin(rad),
    y:p.x*Math.sin(rad)+p.y*Math.cos(rad)
});

export const prepareSvgLayers=(geometry,profile,VW,VH,PADDING)=>{
    if(!geometry.sideA||!geometry.sideA.length)return null;

    const firstBendIdx=Number(profile.firstBendIndex);
    const viewMode=profile.bendViewMode||"toEnd";
    const totalShelves=geometry.shelvesData.length;

    let rotationAngle=0;

    if(firstBendIdx>=0){
        const targetGhostShelfIdx=
            viewMode==="toEnd"
                ?firstBendIdx+1
                :firstBendIdx;

        const ghostShelf=geometry.shelvesData[targetGhostShelfIdx];

        if(ghostShelf){
            rotationAngle=
                viewMode==="toEnd"
                    ?ghostShelf.angleRad
                    :ghostShelf.angleRad+Math.PI;
        }
    }

    let rotatedSideA=
        geometry.sideA.map(p=>rotatePoint(p,rotationAngle));

    let rotatedSideB=
        geometry.sideB.map(p=>rotatePoint(p,rotationAngle));

    if(firstBendIdx>=0){
        const vertexIdx=firstBendIdx+1;
        const neighborIdx=
            viewMode==="toEnd"
                ?firstBendIdx
                :firstBendIdx+2;

        const vertexPt=rotatedSideA[vertexIdx];
        const neighborPt=rotatedSideA[neighborIdx];

        if(
            vertexPt&&
            neighborPt&&
            neighborPt.y-vertexPt.y>0
        ){
            rotatedSideA=rotatedSideA.map(p=>({
                x:p.x,
                y:-p.y
            }));

            rotatedSideB=rotatedSideB.map(p=>({
                x:p.x,
                y:-p.y
            }));
        }
    }

    const allPts=[
        ...rotatedSideA,
        ...rotatedSideB
    ];

    const xs=allPts.map(p=>p.x);
    const ys=allPts.map(p=>p.y);

    const minX=Math.min(...xs);
    const maxX=Math.max(...xs);
    const minY=Math.min(...ys);
    const maxY=Math.max(...ys);

    const w=maxX-minX||1;
    const h=maxY-minY||1;

    const scale=Math.min(
        (VW-PADDING*2)/w,
        (VH-PADDING*2)/h
    );

    const ox=(VW-w*scale)/2;
    const oy=(VH-h*scale)/2;

    const cv=p=>({
        x:ox+(p.x-minX)*scale,
        y:oy+(p.y-minY)*scale
    });

    const buildLayer=(startShelfIdx,endShelfIdx)=>{
        const truncatedSideA=
            rotatedSideA.slice(
                startShelfIdx,
                endShelfIdx+1
            );

        const truncatedSideB=
            rotatedSideB.slice(
                startShelfIdx,
                endShelfIdx+1
            );

        const a=truncatedSideA.map(cv);
        const b=truncatedSideB.map(cv);

        const sideAPath=
            a.map(p=>`${p.x} ${p.y}`).join(" L ");

        const sideBPath=
            b.map(p=>`${p.x} ${p.y}`).join(" L ");

        const fillPoints=[
            ...a,
            ...[...b].reverse()
        ]
            .map(p=>`${p.x},${p.y}`)
            .join(" ");

        const labels=[];
        const angles=[];
        const profileBends=profile.bends||[];

        const visibleShelvesData=
            geometry.shelvesData.slice(
                startShelfIdx,
                endShelfIdx
            );

        visibleShelvesData.forEach((sh,localIdx)=>{
            const globalIdx=startShelfIdx+localIdx;
            const cur=sh.isTop?a:b;

            const p1=cur[localIdx];
            const p2=cur[localIdx+1];

            const midX=(p1.x+p2.x)/2;
            const midY=(p1.y+p2.y)/2;

            const dx=p2.x-p1.x;
            const dy=p2.y-p1.y;
            const len=Math.hypot(dx,dy);

            if(len>EPSILON){
                let angle=
                    Math.atan2(dy,dx)*RAD_TO_DEG;

                if(angle>90)angle-=180;
                if(angle<-90)angle+=180;

                const nx=-dy/len;
                const ny=dx/len;

                const opp=sh.isTop?b:a;

                const xOpp=
                    (opp[localIdx].x+
                        opp[localIdx+1].x)/2;

                const yOpp=
                    (opp[localIdx].y+
                        opp[localIdx+1].y)/2;

                const sign=
                    ((midX-xOpp)*nx+
                        (midY-yOpp)*ny)>=0
                        ?1
                        :-1;

                const totalShift=
                    LABEL_OFFSET+
                    TEXT_HALF_HEIGHT;

                labels.push({
                    text:`${sh.length}`,
                    unit:"mm",
                    x:midX+nx*sign*totalShift,
                    y:midY+ny*sign*totalShift,
                    angle
                });
            }

            const bend=profileBends[globalIdx];
            const jointIdx=localIdx+1;

            if(
                bend&&
                jointIdx<a.length-1
            ){
                const isInnerB=
                    bend.direction==="right";

                const pContours=
                    isInnerB?b:a;

                const oppPContours=
                    isInnerB?a:b;

                const q=pContours[jointIdx-1];
                const z=pContours[jointIdx];
                const n=pContours[jointIdx+1];
                const zOpp=oppPContours[jointIdx];

                const v1x=q.x-z.x;
                const v1y=q.y-z.y;
                const v2x=n.x-z.x;
                const v2y=n.y-z.y;

                const l1=Math.hypot(v1x,v1y);
                const l2=Math.hypot(v2x,v2y);

                if(
                    l1>EPSILON&&
                    l2>EPSILON
                ){
                    const u1x=v1x/l1;
                    const u1y=v1y/l1;
                    const u2x=v2x/l2;
                    const u2y=v2y/l2;

                    const arcP1={
                        x:z.x+u1x*ARC_RADIUS,
                        y:z.y+u1y*ARC_RADIUS
                    };

                    const arcP2={
                        x:z.x+u2x*ARC_RADIUS,
                        y:z.y+u2y*ARC_RADIUS
                    };

                    let bx=u1x+u2x;
                    let by=u1y+u2y;
                    let bl=Math.hypot(bx,by);

                    if(bl>EPSILON){
                        bx/=bl;
                        by/=bl;
                    }else{
                        bx=-u1y;
                        by=u1x;
                    }

                    if(
                        bx*(z.x-zOpp.x)+
                        by*(z.y-zOpp.y)<0
                    ){
                        bx=-bx;
                        by=-by;
                    }

                    const rawCross=
                        u1x*u2y-
                        u1y*u2x;

                    let sweep=
                        rawCross>0?1:0;

                    if(
                        rawCross*
                        (isInnerB?-1:1)<0
                    ){
                        sweep=sweep===1?0:1;
                    }

                    const midArcX=
                        (arcP1.x+arcP2.x)/2;

                    const midArcY=
                        (arcP1.y+arcP2.y)/2;

                    const chordToVertexX=
                        z.x-midArcX;

                    const chordToVertexY=
                        z.y-midArcY;

                    const dot=
                        chordToVertexX*bx+
                        chordToVertexY*by;

                    const screenCross=
                        (arcP2.x-arcP1.x)*
                        (z.y-arcP1.y)-
                        (arcP2.y-arcP1.y)*
                        (z.x-arcP1.x);

                    sweep=screenCross>0?1:0;

                    angles.push({
                        text:`${bend.angle}°`,
                        x:
                            z.x+
                            bx*
                            (ARC_RADIUS+
                                ANGLE_LABEL_OFFSET),
                        y:
                            z.y+
                            by*
                            (ARC_RADIUS+
                                ANGLE_LABEL_OFFSET),
                        path:
                            `M ${arcP1.x} ${arcP1.y} `+
                            `A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${sweep} `+
                            `${arcP2.x} ${arcP2.y}`,
                        bx,
                        by,
                        isFirst:firstBendIdx===globalIdx
                    });
                }
            }
        });

        return {
            a,
            b,
            sideAPath,
            sideBPath,
            fillPoints,
            labels,
            angles,
            strokeStartCap:startShelfIdx===0,
            strokeEndCap:endShelfIdx===totalShelves
        };
    };

    let activeStart=0;
    let activeEnd=totalShelves;
    let ghostStart=-1;
    let ghostEnd=-1;

    if(firstBendIdx>=0){
        if(viewMode==="toEnd"){
            activeEnd=firstBendIdx+1;
            ghostStart=firstBendIdx+1;
            ghostEnd=totalShelves;
        }else if(viewMode==="fromStart"){
            ghostStart=0;
            ghostEnd=firstBendIdx+1;
            activeStart=firstBendIdx+1;
        }
    }

    const activeData=
        buildLayer(activeStart,activeEnd);

    const ghostData=
        ghostStart>=0
            ?buildLayer(ghostStart,ghostEnd)
            :null;

    return {
        VW,
        VH,
        activeData,
        ghostData
    };
};