const ARC_RADIUS=12,LABEL_OFFSET=12,ANGLE_LABEL_OFFSET=12,FONT_SIZE=11;
const TEXT_HALF_HEIGHT=FONT_SIZE/2,RAD_TO_DEG=180/Math.PI,EPSILON=1e-5;

const rotatePoint=(p,rad)=>({
    x:p.x*Math.cos(rad)-p.y*Math.sin(rad),
    y:p.x*Math.sin(rad)+p.y*Math.cos(rad)
});

const createPathData=(a,b)=>({
    a,b,
    sideAPath:a.map(p=>`${p.x} ${p.y}`).join(" L "),
    sideBPath:b.map(p=>`${p.x} ${p.y}`).join(" L "),
    fillPoints:[...a,...[...b].reverse()].map(p=>`${p.x},${p.y}`).join(" ")
});

const calculateShelfLabel=(p1,p2,oppP1,oppP2,lengthText)=>{
    const dx=p2.x-p1.x,dy=p2.y-p1.y,len=Math.hypot(dx,dy);
    if(len<=EPSILON)return null;

    let angle=Math.atan2(dy,dx)*RAD_TO_DEG;
    if(angle>90)angle-=180;
    if(angle<-90)angle+=180;

    const nx=-dy/len,ny=dx/len;
    const xOpp=(oppP1.x+oppP2.x)/2,yOpp=(oppP1.y+oppP2.y)/2;
    const sign=(
        ((p1.x+p2.x)/2-xOpp)*nx+
        ((p1.y+p2.y)/2-yOpp)*ny
    )>=0?1:-1;

    const shift=LABEL_OFFSET+TEXT_HALF_HEIGHT;

    return{
        text:`${lengthText}`,
        unit:"mm",
        x:(p1.x+p2.x)/2+nx*sign*shift,
        y:(p1.y+p2.y)/2+ny*sign*shift,
        angle
    };
};

const calculateBendAngle=(pc,oc,k,bend,isFirst)=>{
    if(k<=0||k>=pc.length-1)return null;

    const q=pc[k-1],z=pc[k],n=pc[k+1],zo=oc[k];
    const v1={x:q.x-z.x,y:q.y-z.y},v2={x:n.x-z.x,y:n.y-z.y};
    const l1=Math.hypot(v1.x,v1.y),l2=Math.hypot(v2.x,v2.y);

    if(l1<=EPSILON||l2<=EPSILON)return null;

    const u1={x:v1.x/l1,y:v1.y/l1};
    const u2={x:v2.x/l2,y:v2.y/l2};

    const p1={
        x:z.x+u1.x*ARC_RADIUS,
        y:z.y+u1.y*ARC_RADIUS
    };

    const p2={
        x:z.x+u2.x*ARC_RADIUS,
        y:z.y+u2.y*ARC_RADIUS
    };

    let bx=u1.x+u2.x,by=u1.y+u2.y,bl=Math.hypot(bx,by);

    if(bl>EPSILON){
        bx/=bl;
        by/=bl;
    }else{
        bx=-u1.y;
        by=u1.x;
    }

    if(bx*(z.x-zo.x)+by*(z.y-zo.y)<0){
        bx=-bx;
        by=-by;
    }

    const sweep=
        (p2.x-p1.x)*(z.y-p1.y)-
        (p2.y-p1.y)*(z.x-p1.x)>0?1:0;

    return{
        text:`${bend.angle}°`,
        x:z.x+bx*(ARC_RADIUS+ANGLE_LABEL_OFFSET),
        y:z.y+by*(ARC_RADIUS+ANGLE_LABEL_OFFSET),
        path:`M ${p1.x} ${p1.y} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 ${sweep} ${p2.x} ${p2.y}`,
        bx,by,isFirst
    };
};

export const prepareSvgLayers=(
    geometry,
    profile,
    VW,
    VH,
    PADDING,
    referenceBend
)=>{
    if(!geometry.sideA?.length)return null;

    const firstBendIdx=Number(referenceBend?.index??-1);
    const viewMode=profile.bendViewMode||"toEnd";
    const totalShelves=geometry.shelvesData.length;
    const blueLength=Number(referenceBend?.length)||0;

    let rotationAngle=0;

    if(firstBendIdx>=0){
        const i=viewMode==="toEnd"?firstBendIdx+1:firstBendIdx;
        const s=geometry.shelvesData[i];

        if(s){
            rotationAngle=viewMode==="toEnd"
                ?s.angleRad
                :s.angleRad+Math.PI;
        }
    }

    let rotatedSideA=geometry.sideA.map(p=>rotatePoint(p,rotationAngle));
    let rotatedSideB=geometry.sideB.map(p=>rotatePoint(p,rotationAngle));

    if(firstBendIdx>=0){
        const v=rotatedSideA[firstBendIdx+1];
        const n=rotatedSideA[
            viewMode==="toEnd"
                ?firstBendIdx
                :firstBendIdx+2
            ];

        if(v&&n&&n.y-v.y>0){
            rotatedSideA=rotatedSideA.map(p=>({...p,y:-p.y}));
            rotatedSideB=rotatedSideB.map(p=>({...p,y:-p.y}));
        }
    }

    let blueRawData=null;

    if(firstBendIdx>=0&&blueLength>0){
        const bendVertexIdx=firstBendIdx+1;
        const isToEnd=viewMode==="toEnd";

        const shelf=geometry.shelvesData[
            isToEnd
                ?firstBendIdx+1
                :firstBendIdx
            ];

        if(shelf){
            const A=shelf.isTop?rotatedSideA:rotatedSideB;
            const B=shelf.isTop?rotatedSideB:rotatedSideA;

            const outerApex=A[bendVertexIdx];
            const innerApex=B[bendVertexIdx];

            const targetIdx=isToEnd
                ?bendVertexIdx+1
                :bendVertexIdx-1;

            const d=A[targetIdx];

            if(outerApex&&innerApex&&d){
                const dx=d.x-outerApex.x;
                const dy=d.y-outerApex.y;
                const l=Math.hypot(dx,dy);

                if(l>EPSILON){
                    const ux=dx/l;
                    const uy=dy/l;

                    const nx=-uy;
                    const ny=ux;

                    const tx=innerApex.x-outerApex.x;
                    const ty=innerApex.y-outerApex.y;

                    const sideSign=
                        tx*nx+ty*ny>=0?1:-1;

                    const thickness=
                        Number(profile.thickness)||0;

                    const outerEnd={
                        x:outerApex.x+ux*blueLength,
                        y:outerApex.y+uy*blueLength
                    };

                    const innerEnd={
                        x:outerEnd.x+nx*sideSign*thickness,
                        y:outerEnd.y+ny*sideSign*thickness
                    };

                    blueRawData={
                        outerApex,
                        innerApex,
                        outerEnd,
                        innerEnd,
                        shelfIsTop:shelf.isTop,
                        bendVertexIdx
                    };
                }
            }
        }
    }

    const allPts=[
        ...rotatedSideA,
        ...rotatedSideB,
        ...(blueRawData
            ?[blueRawData.outerEnd,blueRawData.innerEnd]
            :[])
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

    const buildLayer=(start,end)=>{
        const a=rotatedSideA
            .slice(start,end+1)
            .map(cv);

        const b=rotatedSideB
            .slice(start,end+1)
            .map(cv);

        const labels=[];
        const angles=[];
        const profileBends=profile.bends||[];

        geometry.shelvesData
            .slice(start,end)
            .forEach((sh,j)=>{
                const g=start+j;
                const cur=sh.isTop?a:b;
                const opp=sh.isTop?b:a;

                const lbl=calculateShelfLabel(
                    cur[j],
                    cur[j+1],
                    opp[j],
                    opp[j+1],
                    sh.length
                );

                if(lbl)labels.push(lbl);

                const bend=profileBends[g];

                if(bend){
                    const inner=bend.direction==="right";

                    const ang=calculateBendAngle(
                        inner?b:a,
                        inner?a:b,
                        j+1,
                        bend,
                        firstBendIdx===g
                    );

                    if(ang)angles.push(ang);
                }
            });

        return{
            ...createPathData(a,b),
            labels,
            angles,
            strokeStartCap:start===0,
            strokeEndCap:end===totalShelves
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
        }else{
            ghostStart=0;
            ghostEnd=firstBendIdx+1;
            activeStart=firstBendIdx+1;
        }
    }

    const activeData=buildLayer(
        activeStart,
        activeEnd
    );

    const ghostData=ghostStart>=0
        ?buildLayer(ghostStart,ghostEnd)
        :null;

    let blueData=null;

    if(blueRawData){
        const a=[
            cv(blueRawData.outerApex),
            cv(blueRawData.outerEnd)
        ];

        const b=[
            cv(blueRawData.innerApex),
            cv(blueRawData.innerEnd)
        ];

        const scrA=rotatedSideA.map(cv);
        const scrB=rotatedSideB.map(cv);

        const lbl=calculateShelfLabel(
            a[0],
            a[1],
            b[0],
            b[1],
            blueLength
        );

        const bend=(profile.bends||[])[firstBendIdx];
        const inner=bend?.direction==="right";

        const ang=bend
            ?calculateBendAngle(
                inner?scrB:scrA,
                inner?scrA:scrB,
                blueRawData.bendVertexIdx,
                bend,
                true
            )
            :null;

        blueData={
            ...createPathData(a,b),
            labels:lbl?[lbl]:[],
            angles:ang?[ang]:[],
            strokeStartCap:false,
            strokeEndCap:true
        };
    }

    return{
        VW,
        VH,
        activeData,
        ghostData,
        blueData
    };
};