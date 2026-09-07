import buildProfileGeometry from "./BuildProfileGeometry";
import {
    calculateOuterLengthToEnd
} from "./Calculations";
import {
    ARC_RADIUS,
    LABEL_OFFSET,
    ANGLE_LABEL_OFFSET,
    FONT_SIZE,
    PADDING
} from "./svgConstants";

const RAD_TO_DEG=180/Math.PI;
const EPSILON=1e-5;

const getLabelScale=(geometrySize,containerSize)=>{
    if(
        !geometrySize?.width||
        !geometrySize?.height||
        !containerSize?.width||
        !containerSize?.height
    ){
        return 1;
    }

    const scale=Math.max(
        geometrySize.width/containerSize.width,
        geometrySize.height/containerSize.height
    )*1.15;

    return Math.min(
        2.5,
        Math.max(.6,scale)
    );
};

const rotatePoint=(p,rad)=>{
    const cos=Math.cos(rad);
    const sin=Math.sin(rad);

    return {
        x:p.x*cos-p.y*sin,
        y:p.x*sin+p.y*cos
    };
};

const createPathData=(a,b)=>({
    a,
    b,

    sideAPath:a
        .map(p=>`${p.x} ${p.y}`)
        .join(" L "),

    sideBPath:b
        .map(p=>`${p.x} ${p.y}`)
        .join(" L "),

    fillPoints:[
        ...a,
        ...b.slice().reverse()
    ]
        .map(p=>`${p.x},${p.y}`)
        .join(" ")
});

const calculateShelfLabel=(
    start,
    end,
    oppStart,
    oppEnd,
    lengthText,
    scale=1
)=>{
    const dx=end.x-start.x;
    const dy=end.y-start.y;
    const len=Math.hypot(dx,dy);

    if(len<=EPSILON)return null;

    let angle=Math.atan2(dy,dx)*RAD_TO_DEG;

    if(angle>90)angle-=180;
    if(angle<-90)angle+=180;

    const midX=(start.x+end.x)/2;
    const midY=(start.y+end.y)/2;

    const oppMidX=(oppStart.x+oppEnd.x)/2;
    const oppMidY=(oppStart.y+oppEnd.y)/2;

    let bx=-dy/len;
    let by=dx/len;

    if(
        bx*(midX-oppMidX)+
        by*(midY-oppMidY)<0
    ){
        bx=-bx;
        by=-by;
    }

    const fontSize=FONT_SIZE*scale;

    const offset=
        LABEL_OFFSET*scale+
        fontSize/2;

    return {
        text:`${lengthText}`,
        unit:"mm",
        x:midX+bx*offset,
        y:midY+by*offset,
        angle,
        fontSize
    };
};

const calculateBendAngle=(
    vertex,
    prevPoint,
    nextPoint,
    oppVertex,
    bendText,
    scale=1
)=>{
    const v1={
        x:prevPoint.x-vertex.x,
        y:prevPoint.y-vertex.y
    };

    const v2={
        x:nextPoint.x-vertex.x,
        y:nextPoint.y-vertex.y
    };

    const l1=Math.hypot(v1.x,v1.y);
    const l2=Math.hypot(v2.x,v2.y);

    if(
        l1<=EPSILON||
        l2<=EPSILON
    ){
        return null;
    }

    const u1={
        x:v1.x/l1,
        y:v1.y/l1
    };

    const u2={
        x:v2.x/l2,
        y:v2.y/l2
    };

    const arcRadius=ARC_RADIUS*scale;

    const p1={
        x:vertex.x+u1.x*arcRadius,
        y:vertex.y+u1.y*arcRadius
    };

    const p2={
        x:vertex.x+u2.x*arcRadius,
        y:vertex.y+u2.y*arcRadius
    };

    const tx=vertex.x-oppVertex.x;
    const ty=vertex.y-oppVertex.y;
    const tLen=Math.hypot(tx,ty);

    const [bx,by]=tLen>EPSILON
        ?[
            tx/tLen,
            ty/tLen
        ]
        :[
            -u1.y,
            u1.x
        ];

    const sweep=
        (p2.x-p1.x)*by-
        (p2.y-p1.y)*bx<0
            ?1
            :0;

    const fontSize=FONT_SIZE*scale;

    const textWidth=
        bendText.length*
        fontSize*
        .6;

    const textRadius=
        Math.abs(bx)*textWidth/2+
        Math.abs(by)*fontSize/2;

    const offset=
        arcRadius+
        ANGLE_LABEL_OFFSET*scale+
        textRadius;

    return {
        text:bendText,

        x:vertex.x+bx*offset,
        y:vertex.y+by*offset,

        path:
            `M ${p1.x} ${p1.y} `+
            `A ${arcRadius} ${arcRadius} 0 0 ${sweep} `+
            `${p2.x} ${p2.y}`,

        bx,
        by,
        fontSize
    };
};

const calculateBlueRawData=(
    profile,
    selectedBendIndex,
    viewMode,
    blueLength,
    sideA,
    sideB
)=>{
    if(
        selectedBendIndex<0||
        blueLength<=0
    ){
        return null;
    }

    const vertexIndex=
        selectedBendIndex+1;

    const bend=
        profile.bends?.[selectedBendIndex];

    if(!bend)return null;

    const isToEnd=
        viewMode==="toEnd";

    const isInnerRight=
        bend.direction==="right";

    const outerSide=
        isInnerRight
            ?sideA
            :sideB;

    const innerSide=
        isInnerRight
            ?sideB
            :sideA;

    const outerApex=
        outerSide[vertexIndex];

    const targetIndex=
        isToEnd
            ?vertexIndex+1
            :vertexIndex-1;

    const targetPoint=
        outerSide[targetIndex];

    if(
        !outerApex||
        !targetPoint
    ){
        return null;
    }

    const dx=
        targetPoint.x-outerApex.x;

    const dy=
        targetPoint.y-outerApex.y;

    const len=Math.hypot(dx,dy);

    if(len<=EPSILON)return null;

    const ux=dx/len;
    const uy=dy/len;

    const nx=-uy;
    const ny=ux;

    const innerApex=
        innerSide[vertexIndex];

    if(!innerApex)return null;

    const sideSign=
        (innerApex.x-outerApex.x)*nx+
        (innerApex.y-outerApex.y)*ny>=0
            ?1
            :-1;

    const thickness=
        Number(profile.thickness)||0;

    const outerEnd={
        x:outerApex.x+ux*blueLength,
        y:outerApex.y+uy*blueLength
    };

    const innerEnd={
        x:outerEnd.x+
            nx*sideSign*thickness,

        y:outerEnd.y+
            ny*sideSign*thickness
    };

    return {
        endPointA:
            isInnerRight
                ?outerEnd
                :innerEnd,

        endPointB:
            isInnerRight
                ?innerEnd
                :outerEnd,

        lengthSide:
            isInnerRight
                ?"A"
                :"B"
    };
};

const addPointToBounds=(bounds,p)=>{
    if(!p)return;

    bounds.minX=Math.min(
        bounds.minX,
        p.x
    );

    bounds.maxX=Math.max(
        bounds.maxX,
        p.x
    );

    bounds.minY=Math.min(
        bounds.minY,
        p.y
    );

    bounds.maxY=Math.max(
        bounds.maxY,
        p.y
    );
};

const addTextToBounds=(bounds,text)=>{
    if(!text)return;

    const fontSize=
        Number(text.fontSize)||
        FONT_SIZE;

    const value=
        `${text.text??""}${text.unit??""}`;

    const width=
        value.length*
        fontSize*
        .6;

    const height=fontSize;

    const angle=
        (Number(text.angle)||0)*
        Math.PI/180;

    const halfW=width/2;
    const halfH=height/2;

    const rx=
        Math.abs(Math.cos(angle))*halfW+
        Math.abs(Math.sin(angle))*halfH;

    const ry=
        Math.abs(Math.sin(angle))*halfW+
        Math.abs(Math.cos(angle))*halfH;

    bounds.minX=Math.min(
        bounds.minX,
        text.x-rx
    );

    bounds.maxX=Math.max(
        bounds.maxX,
        text.x+rx
    );

    bounds.minY=Math.min(
        bounds.minY,
        text.y-ry
    );

    bounds.maxY=Math.max(
        bounds.maxY,
        text.y+ry
    );
};

const addAngleToBounds=(bounds,angle)=>{
    if(!angle)return;

    const fontSize=
        Number(angle.fontSize)||
        FONT_SIZE;

    const halfW=
        `${angle.text??""}`.length*
        fontSize*
        .3;

    const halfH=fontSize/2;

    bounds.minX=Math.min(
        bounds.minX,
        angle.x-halfW
    );

    bounds.maxX=Math.max(
        bounds.maxX,
        angle.x+halfW
    );

    bounds.minY=Math.min(
        bounds.minY,
        angle.y-halfH
    );

    bounds.maxY=Math.max(
        bounds.maxY,
        angle.y+halfH
    );
};

const addLayerToBounds=(bounds,layer)=>{
    if(!layer)return;

    layer.a?.forEach(
        p=>addPointToBounds(bounds,p)
    );

    layer.b?.forEach(
        p=>addPointToBounds(bounds,p)
    );

    layer.labels?.forEach(
        t=>addTextToBounds(bounds,t)
    );

    layer.angles?.forEach(
        a=>addAngleToBounds(bounds,a)
    );
};

export const buildLayer=({
                             start,
                             end,
                             ctxSideA,
                             ctxSideB,
                             ctxShelves,
                             ctxBends,
                             showCutAngle=false,
                             labelScale=1
                         })=>{
    const a=
        ctxSideA.slice(start,end+1);

    const b=
        ctxSideB.slice(start,end+1);

    const labels=[];
    const angles=[];

    ctxShelves
        .slice(start,end)
        .forEach((shelf,j)=>{
            const g=start+j;

            const current=
                shelf.isTop
                    ?a
                    :b;

            const opposite=
                shelf.isTop
                    ?b
                    :a;

            const label=
                calculateShelfLabel(
                    current[j],
                    current[j+1],
                    opposite[j],
                    opposite[j+1],
                    shelf.length,
                    labelScale
                );

            if(label)
                labels.push(label);

            const bend=ctxBends[g];

            if(!bend)return;

            const inner=
                bend.direction==="right";

            const side=
                inner?b:a;

            const oppositeSide=
                inner?a:b;

            const i=j+1;

            if(
                !side[i-1]||
                !side[i]||
                !side[i+1]||
                !oppositeSide[i]
            ){
                return;
            }

            const angle=
                calculateBendAngle(
                    side[i],
                    side[i-1],
                    side[i+1],
                    oppositeSide[i],
                    `${bend.angle}°`,
                    labelScale
                );

            if(angle)
                angles.push(angle);
        });

    if(showCutAngle){
        const cutIndex=
            start>0
                ?start
                :end;

        const bend=
            ctxBends[cutIndex-1];

        if(
            bend&&
            ctxSideA[cutIndex-1]&&
            ctxSideA[cutIndex]&&
            ctxSideA[cutIndex+1]&&
            ctxSideB[cutIndex]
        ){
            const inner=
                bend.direction==="right";

            const side=
                inner
                    ?ctxSideB
                    :ctxSideA;

            const opposite=
                inner
                    ?ctxSideA
                    :ctxSideB;

            const angle=
                calculateBendAngle(
                    side[cutIndex],
                    side[cutIndex-1],
                    side[cutIndex+1],
                    opposite[cutIndex],
                    `${bend.angle}°`,
                    labelScale
                );

            if(angle)
                angles.push(angle);
        }
    }

    return {
        ...createPathData(a,b),

        labels,
        angles,

        strokeStartCap:start===0,
        strokeEndCap:end===ctxShelves.length
    };
};

export const prepareSvgLayers=(
    profile,
    containerSize
)=>{
    const geometry=
        buildProfileGeometry(profile);

    if(!geometry.sideA?.length)
        return null;

    const shelves=
        geometry.shelvesData;

    const bends=
        profile.bends||[];

    const totalShelves=
        shelves.length;

    const selectedBendIndex=
        Number(
            profile.selectedBendIndex??-1
        );

    const viewMode=
        profile.bendViewMode||"toEnd";

    const blueLength=
        selectedBendIndex>=0
            ?Number(
                calculateOuterLengthToEnd(profile)
                    .toFixed(2)
            )
            :0;

    const rotationAngle=
        Number(profile.profileRotation||0)*
        Math.PI/180;

    /*
     * Сначала зеркалим исходную геометрию,
     * затем применяем сохранённый поворот.
     */
    const mirrorPoint=p=>
        profile.profileMirrored
            ?{
                x:-p.x,
                y:p.y
            }
            :p;

    const mirroredSideA=
        geometry.sideA.map(
            mirrorPoint
        );

    const mirroredSideB=
        geometry.sideB.map(
            mirrorPoint
        );

    const rotatedSideA=
        mirroredSideA.map(
            p=>rotatePoint(
                p,
                rotationAngle
            )
        );

    const rotatedSideB=
        mirroredSideB.map(
            p=>rotatePoint(
                p,
                rotationAngle
            )
        );

    const allPoints=[
        ...rotatedSideA,
        ...rotatedSideB
    ];

    const xs=
        allPoints.map(p=>p.x);

    const ys=
        allPoints.map(p=>p.y);

    const detailSize={
        width:
            Math.max(...xs)-
            Math.min(...xs),

        height:
            Math.max(...ys)-
            Math.min(...ys)
    };

    const labelScale=
        getLabelScale(
            detailSize,
            containerSize
        );

    let activeStart=0;
    let activeEnd=totalShelves;

    let ghostStart=-1;
    let ghostEnd=-1;

    if(selectedBendIndex>=0){
        if(viewMode==="toEnd"){
            activeEnd=
                selectedBendIndex+1;

            ghostStart=
                selectedBendIndex+1;

            ghostEnd=
                totalShelves;
        }else{
            ghostStart=0;

            ghostEnd=
                selectedBendIndex+1;

            activeStart=
                selectedBendIndex+1;
        }
    }

    const layerOptions={
        ctxSideA:rotatedSideA,
        ctxSideB:rotatedSideB,
        ctxShelves:shelves,
        ctxBends:bends,
        labelScale
    };

    const activeData=
        buildLayer({
            ...layerOptions,
            start:activeStart,
            end:activeEnd
        });

    const ghostData=
        ghostStart>=0
            ?buildLayer({
                ...layerOptions,
                start:ghostStart,
                end:ghostEnd
            })
            :null;

    const blueRaw=
        calculateBlueRawData(
            profile,
            selectedBendIndex,
            viewMode,
            blueLength,
            rotatedSideA,
            rotatedSideB
        );

    let blueData=null;

    if(blueRaw){
        const i=
            selectedBendIndex+1;

        const bendA=
            rotatedSideA[i];

        const bendB=
            rotatedSideB[i];

        const adjacentA=
            rotatedSideA[
                viewMode==="toEnd"
                    ?i-1
                    :i+1
                ];

        const adjacentB=
            rotatedSideB[
                viewMode==="toEnd"
                    ?i-1
                    :i+1
                ];

        if(
            bendA&&
            bendB&&
            adjacentA&&
            adjacentB
        ){
            const isToEnd=
                viewMode==="toEnd";

            const blueSideA=
                isToEnd
                    ?[
                        adjacentA,
                        bendA,
                        blueRaw.endPointA
                    ]
                    :[
                        blueRaw.endPointA,
                        bendA,
                        adjacentA
                    ];

            const blueSideB=
                isToEnd
                    ?[
                        adjacentB,
                        bendB,
                        blueRaw.endPointB
                    ]
                    :[
                        blueRaw.endPointB,
                        bendB,
                        adjacentB
                    ];

            const blueShelf={
                ...shelves[
                selectedBendIndex+1
                    ],

                length:blueLength,

                isTop:
                    blueRaw.lengthSide==="A"
            };

            blueData=
                buildLayer({
                    start:isToEnd?1:0,
                    end:isToEnd?2:1,

                    ctxSideA:blueSideA,
                    ctxSideB:blueSideB,

                    ctxShelves:
                        isToEnd
                            ?[
                                shelves[
                                    selectedBendIndex
                                    ],
                                blueShelf
                            ]
                            :[
                                blueShelf,
                                shelves[
                                    selectedBendIndex
                                    ]
                            ],

                    ctxBends:[
                        bends[selectedBendIndex]
                    ],

                    showCutAngle:true,
                    labelScale
                });

            if(blueData){
                blueData.strokeStartCap=
                    !isToEnd;

                blueData.strokeEndCap=
                    isToEnd;
            }
        }
    }

    const bounds={
        minX:Infinity,
        minY:Infinity,
        maxX:-Infinity,
        maxY:-Infinity
    };

    addLayerToBounds(
        bounds,
        activeData
    );

    addLayerToBounds(
        bounds,
        ghostData
    );

    addLayerToBounds(
        bounds,
        blueData
    );

    if(
        !Number.isFinite(bounds.minX)||
        !Number.isFinite(bounds.minY)||
        !Number.isFinite(bounds.maxX)||
        !Number.isFinite(bounds.maxY)
    ){
        return null;
    }

    return {
        activeData,
        ghostData,
        blueData,

        viewBox:[
            bounds.minX-PADDING,
            bounds.minY-PADDING,

            bounds.maxX-
            bounds.minX+
            PADDING*2,

            bounds.maxY-
            bounds.minY+
            PADDING*2
        ].join(" ")
    };
};