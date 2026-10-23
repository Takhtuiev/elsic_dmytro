// Pure profile-view calculations. No React or UI dependencies.

export const getShelfVector=(geometry,index,fromEnd=false)=>{
    const p1=geometry.sideA?.[index];
    const p2=geometry.sideA?.[index+1];

    if(!p1||!p2){
        return null;
    }

    return fromEnd
        ?{
            x:p1.x-p2.x,
            y:p1.y-p2.y
        }
        :{
            x:p2.x-p1.x,
            y:p2.y-p1.y
        };
};


export const getPreferredSide=(shelves,index)=>{
    const before=shelves.slice(0,index+1);
    const after=shelves.slice(index+1);

    const beforeLength=before.reduce(
        (sum,s)=>sum+Number(s.length||0),
        0
    );

    const afterLength=after.reduce(
        (sum,s)=>sum+Number(s.length||0),
        0
    );

    if(beforeLength<afterLength){
        return "fromStart";
    }

    if(beforeLength>afterLength){
        return "toEnd";
    }

    return before.length<=after.length
        ?"fromStart"
        :"toEnd";
};


export const getViewRotation=(
    geometry,
    index,
    side,
    mirrored,
    currentRotation
)=>{
    const shelfIndex=
        side==="fromStart"
            ?index
            :index+1;

    let vector=getShelfVector(
        geometry,
        shelfIndex
    );

    if(!vector){
        return currentRotation;
    }

    if(mirrored){
        vector={
            x:-vector.x,
            y:vector.y
        };
    }

    let angle=
        Math.atan2(
            vector.y,
            vector.x
        )*180/Math.PI;

    if(side==="fromStart"){
        angle+=180;
    }

    return-angle;
};


export const isOppositeShelfDown=(
    geometry,
    index,
    side,
    mirrored,
    rotation
)=>{
    const oppositeIndex=
        side==="fromStart"
            ?index+1
            :index;

    let vector=getShelfVector(
        geometry,
        oppositeIndex,
        side==="toEnd"
    );

    if(!vector){
        return false;
    }

    if(mirrored){
        vector={
            x:-vector.x,
            y:vector.y
        };
    }

    const rad=
        rotation*Math.PI/180;

    const y=
        vector.x*Math.sin(rad)+
        vector.y*Math.cos(rad);

    return y>0;
};


export const calculateBendView=(
    geometry,
    index,
    side,
    mirrored,
    currentRotation
)=>{
    let rotation=getViewRotation(
        geometry,
        index,
        side,
        mirrored,
        currentRotation
    );

    if(
        isOppositeShelfDown(
            geometry,
            index,
            side,
            mirrored,
            rotation
        )
    ){
        mirrored=!mirrored;

        rotation=getViewRotation(
            geometry,
            index,
            side,
            mirrored,
            currentRotation
        );
    }

    return{
        rotation,
        mirrored
    };
};
