//@ts-check
class CharacterAnimator{
    constructor(mesh){
        this.inputVelocity=new THREE.Vector3(0,0,0);
        this.inputGroundHeight=0;
        this.isJumping=false;

        //this.mesh=THREE.SkeletonUtils.clone(assets.get("soldier"));
        this.mesh=mesh;
        this.mixer=new THREE.AnimationMixer(this.mesh);

        this.locomotions={};
        for(var key of ["idle","starfeL","starfeR","run","walk","walkB","jump"]){
            this.locomotions[key]=this.mixer.clipAction(assets.get(key));
            this.locomotions[key].play();
        }
        this.locomotions.jump.paused=true;
        this.actions={};
        for(var key of ["shoot","hit","throw","reload"]){
            this.actions[key]=this.mixer.clipAction(assets.get(key));
            this.actions[key].loop=THREE.LoopOnce;
            this.actions[key].clampWhenFinished=true;
        }
        this.playingAction=null;
        var scope=this;
        this.mixer.addEventListener("finished",info=>{
            if(info.action==scope.playingAction)scope.playingAction=null}
            );
    }
    setJump(){this.isJumping=true;}
    action(actionName){
        for(var key of Object.keys(this.actions))
            this.actions[key].enabled=false;
        if(this.actions[actionName]){
            this.actions[actionName].reset();
            this.actions[actionName].play();
            this.playingAction=this.actions[actionName];
        }
    }
    update(dt){
        //=====动作层=====
        var actionWeight=this.playingAction?1:0;
        for(var key of Object.keys(this.actions))
            if(this.actions[key]!=this.playingAction)
                this.actions[key].enabled=false;
        //=====跳跃层=====
        if(this.inputGroundHeight<=0)
            this.isJumping=false;
        var h=Math.max(0,Math.min(1,this.inputGroundHeight/1));
        var jumpWeight=Math.max(0,Math.min(1,this.inputGroundHeight/0.2));
        if(!this.isJumping)
            jumpWeight=0;
        this.locomotions.jump.time=this.locomotions.jump.getClip().duration*(this.inputVelocity.y>0?h/2:1-h/2);
        this.locomotions.jump.weight=jumpWeight;
        //=====移动层=====
        this.inputVelocity2=this.inputVelocity.clone();this.inputVelocity2.y=0;
        var v=this.inputVelocity2.clone().multiplyScalar(1).clampLength(0.3,1);
        var v2=this.inputVelocity2.clone().multiplyScalar(1).clampLength(0,2);
        var d=this.inputVelocity2.length()<0.01?5:v.length()/this.inputVelocity2.length()/(.5+.7*Math.min(1,Math.max(0,2-v2.z)));
        var movementWeight=Math.max(0,this.inputVelocity2.length()<0.1?1-actionWeight-jumpWeight:1-jumpWeight);
        this.locomotions.starfeL.weight=movementWeight*Math.max(0,v.x);
        this.locomotions.starfeL.setDuration(d);
        this.locomotions.starfeR.weight=movementWeight*Math.max(0,-v.x);
        this.locomotions.starfeR.setDuration(d);
        this.locomotions.walk.weight=movementWeight*Math.max(0,v.z-Math.max(0,v2.z-1));
        this.locomotions.walk.setDuration(d);
        this.locomotions.walkB.weight=movementWeight*Math.max(0,-v.z);
        this.locomotions.walkB.setDuration(d);
        this.locomotions.idle.weight=movementWeight*Math.max(0,1-v.length());
        this.locomotions.run.weight=movementWeight*Math.max(0,v2.z-1);
        this.locomotions.run.setDuration(d);
        //=====更新动画=====
        this.mixer.update(dt);
        //=====简单的物理=====
        /*
        this.mesh.translateX(this.inputVelocity.x*dt).translateZ(this.inputVelocity.z*dt);
        this.mesh.position.y+=this.inputVelocity.y*dt;
        this.inputVelocity.y-=10*dt;
        if(this.mesh.position.y<=0 && this.inputVelocity.y<0)this.inputVelocity.y=0;
        this.mesh.position.x=(this.mesh.position.x+15)%10-5
        this.mesh.position.z=(this.mesh.position.z+15)%10-5
        this.inputGroundHeight=this.mesh.position.y;
        */
    }
}