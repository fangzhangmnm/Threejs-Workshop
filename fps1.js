//@ts-check
if(false){/* just to enable the code snippers*/
    var THREE=require("three");
    var CANNON=require("cannon");
    require("./client");
    require("./CharacterController");
    require("./assets");
}
/*必须要做的事情
fpscontroller互联
射击事件
重生
游戏流程
音效*/
/*TODO
跳跃动画重做
跳跃的碰撞箱
fps的client特例
rb延迟的问题
鼠标单击bug
*/
//==========基本设定==========
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);
renderer.gammaFactor=2.2;
renderer.gammaOutput=true;
const camera=new THREE.PerspectiveCamera(45,1,.01,10000);
camera.position.set(6,9,12);
camera.lookAt(0,0,0);
const listener=new THREE.AudioListener();
camera.add(listener);
let renderFactor=0.5;
function resize(){
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setDrawingBufferSize(window.innerWidth*renderFactor, window.innerHeight*renderFactor,window.devicePixelRatio);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize",resize);
const world=new CANNON.World();
world.gravity.set(0,-10,0);
//==========主循环==========
let gamestate="loading";
const clock=new THREE.Clock();
const bodyToMesh=new Map();
class BodyW{
    constructor(body,mesh){
        this.body=body;this.mesh=mesh;
        bodyToMesh.set(body,mesh)
    }
    dispose(){
        world.remove(this.body);
        bodyToMesh.delete(this.body);
    }
    update(dt){
        if(this.body.type==CANNON.Body.DYNAMIC){
            this.mesh.position.copy(this.body.position);
            this.mesh.quaternion.copy(this.body.quaternion);
        }
    }
}
const updates=[];
function loop(){
    let dt=clock.getDelta();
    if(gamestate!="loading"){
        world.step(Math.max(0.001,Math.min(0.1,dt)));
        //for(let [body,mesh] of bodyToMesh)
        //    mesh.userData.BodyW.update(dt);
        for(let handler of updates)handler(dt);
    }
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(loop);
//==========插件==========
const stats=new Stats();
document.body.appendChild(stats.dom);
updates.push(dt=>stats.update());
const worldVisualizer=new THREE.CannonDebugRenderer(scene,world);
updates.push(dt=>options["physics debug"] && worldVisualizer.update());
scene.add(new THREE.GridHelper(10,10).translateY(-.001));
scene.add(new THREE.AxesHelper(5));
//==========光照设定==========
scene.background=new THREE.Color(0x443355);
const skyLight=new THREE.HemisphereLight(0x6666aa,0x443322);
const light=new THREE.DirectionalLight(0xeeddcc);
light.castShadow=true;
light.position.set(8,20,12);
renderer.shadowMap.enabled=true;
light.shadow.camera.left=light.shadow.camera.bottom=-35;
light.shadow.camera.right=light.shadow.camera.top=35;
//scene.add(new THREE.CameraHelper(light.shadow.camera));
scene.add(skyLight);
scene.add(light);
const defaultMaterial=new THREE.MeshLambertMaterial({color:0x454545});
let sfxVolume=1;
class Character{
    constructor(isAuthor,localId){
        this.isAuthor=isAuthor;
        this.localId=localId;
        this.body=createCharacterBody(5,.5,2);

        //this.bodyModelMesh=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,2,12,1),defaultMaterial);
        //this.bodyModelMesh.position.set(0,1,0);
        this.bodyModelMesh=THREE.SkeletonUtils.clone(assets.get("soldier"));
        this.animator=new CharacterAnimator(this.bodyModelMesh);
        //this.headMesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),defaultMaterial);
        this.headMesh=new THREE.Object3D();
        this.mesh=new THREE.Object3D();
        this.trackedMesh=new THREE.Object3D();
        this.mesh.add(this.trackedMesh,this.headMesh,this.bodyModelMesh);
        //let helper=new THREE.SkeletonHelper(this.bodyModelMesh);
        //helper.renderOrder=500;
        //scene.add(helper);
        this.headMesh.position.set(0,2,0);
        world.addBody(this.body);
        scene.add(this.mesh);
        this.isAuthor=isAuthor;
        if(isAuthor){
            this.controls=new CharacterController(camera,this.mesh,this.headMesh,this.trackedMesh,this.body,renderer.domElement);
            this.controls.moveSpeed=3;
            this.controls.jumpListener=()=>this.animator.setJump();
            this.controls.thirdPersonPosition.set(-.5,0,-3);
            this.update=dt=>{this.updateCommon(dt);this.updateIsAuthor(dt);}
            document.addEventListener("mousedown",(event)=>{
                if(event.button==0){
                    let start=this.controls.camera.getWorldPosition(new THREE.Vector3());
                    let dir=new THREE.Vector3(0,0,-1).applyQuaternion(this.controls.camera.getWorldQuaternion(new THREE.Quaternion()));
                    start.addScaledVector(dir,3);
                    let netId=clientUpdater.getNetId(this.localId)
                    if(netId){
                        client.emitGameEvent([  {class:"shoot",nid:netId,p:start,d:dir},
                                                {class:"ca",nid:netId,anim:"shoot"},
                                                {class:"sd",nid:netId,sound:"sfxShoot",volume:1}]);
                        this.animator.action("shoot");
                        this.sound("sfxShoot");
                    }
                }
            })
        }
        else{
            this.body.type=CANNON.Body.KINEMATIC;
            this.update=dt=>{this.updateCommon(dt);this.updateOtherAuthor(dt);}
        }
        updates.push(this.update);
        this.mesh.userData.Character=this;
        this.mesh.userData.BodyW=new BodyW(this.body,this.mesh);
        this.sounds=[0,1,2].map(x=>{let y=new THREE.PositionalAudio(listener);this.mesh.add(y);return y});
        this.soundIterator=0;
        this.stepCounter=0;
        console.log("character create done");
    }
    updateCommon(dt){
        //TODO CharacterController NonAuthor
        //if(this.controls.isGrounded)
        this.stepCounter+=dt*this.body.velocity.norm();
        if(this.stepCounter>0.8){
            this.stepCounter=0;
            this.sound("sfxStep"+Math.floor(Math.random()*3+1),.3);
        }
    }
    updateIsAuthor(dt){
        this.controls.update(dt);
        this.animator.inputVelocity.copy(this.body.velocity);
        this.animator.inputVelocity.applyQuaternion(this.body.quaternion.clone().inverse());
        this.animator.inputGroundHeight=this.controls.distanceToGround;
        this.animator.update(dt);
    }
    updateOtherAuthor(dt){
        this.body.position.copy(this.mesh.position);
        this.body.velocity.copy(clientUpdater.getVelocity(this.localId));
        this.body.quaternion.copy(this.mesh.quaternion);
        this.animator.inputVelocity.copy(this.body.velocity);
        this.animator.inputVelocity.applyQuaternion(this.body.quaternion.clone().inverse());
        this.animator.update(dt);
    }
    sound(name,volume=1){
        //console.log(name,this.mesh.position,volume)
        let sound=this.sounds[this.soundIterator];
        this.soundIterator=(this.soundIterator+1)%this.sounds.length;
        if(sound.isPlaying)sound.stop();
        sound.setBuffer(assets.get(name));
        sound.setVolume(volume*sfxVolume);
        sound.play();
    }
    onSD(info){
        if(this.isAuthor)return;
        this.sound(info.sound,info.volume||0);
    }
    onCA(info){
        if(this.isAuthor)return;
        this.animator.action(info.anim);
    }
    onShot(shooter){
        if(!this.isAuthor)return;
        let netId=clientUpdater.getNetId(this.localId);
        this.animator.action("hit");
        this.sound("sfxPain");
        client.emitGameEvent([  {class:"ca",nid:netId,anim:"hit"},
                                {class:"sd",nid:netId,sound:"sfxPain",volume:1}]);
        //console.log("onShot",shooter);
    }
    dispose(){
        if(!this.isAuthor){
            scene.remove(this.mesh);
            world.remove(this.body);
            updates.splice(updates.indexOf(this.update),1);
            console.log("character disposed!")
        }
    }
}
const client=new ClientSide("ws://"+document.domain.replace("cdn","www")+":9999");
const clientUpdater=new ThreeJSClientUpdator(client,0.02);
let player;
clientUpdater.createHandlers.set("player",(localId,isAuthor,p,q,staticData)=>{
    let character=new Character(isAuthor,localId);
    if(isAuthor)
        player=character;
    character.body.position.set(p.x,p.y,p.z);
    character.body.quaternion.set(q.x,q.y,q.z,q.w);
    return character.mesh;
});
clientUpdater.removeHandler=(obj)=>{
    for(let key of Object.keys(obj.userData)){
        if(obj.userData[key].dispose)
            obj.userData[key].dispose();
    }
}
updates.push(dt=>clientUpdater.update(dt));
clientUpdater.gameEventHandlers.set("shoot",info=>{
    let raycastResult=new CANNON.RaycastResult();
    let from=new THREE.Vector3().copy(info.p);
    let dir=new THREE.Vector3().copy(info.d);
    let to=from.clone().addScaledVector(dir,10000);
    let line=new THREE.LineCurve(from,to)
    let shooter=clientUpdater.getThreeJsObjectFromNetId(info.nid);
    /*let geom=new THREE.Geometry();
    geom.vertices.push(from);
    geom.vertices.push(to);
    scene.add(new THREE.Line(geom,defaultMaterial));*/
    if(world.raycastClosest(from,to,{skipBackfaces:true,checkCollisionResponse:false},raycastResult)){
        //skipBackfaces:true以避免打到自己
        let m=bodyToMesh.get(raycastResult.body);
        if(m){
            let c=m.userData.Character;
            if(c && c.isAuthor)
                c.onShot(shooter);
        }
    }
})
clientUpdater.gameEventHandlers.set("ca",info=>{
    let tjo=clientUpdater.threeJSObjects.get(clientUpdater.getLocalId(info.nid));
    if(!tjo)return;
    let chara=tjo.userData.Character;
    if(!chara)return;
    if(!chara.isAuthor)chara.onCA(info);
})
clientUpdater.gameEventHandlers.set("sd",info=>{
    let tjo=clientUpdater.threeJSObjects.get(clientUpdater.getLocalId(info.nid));
    if(!tjo)return;
    let chara=tjo.userData.Character;
    if(!chara)return;
    if(!chara.isAuthor)chara.onSD(info);
})
const assets=new AssetLoader([
    [1,"level","gltf/level (8).gltf"],
    [1,"soldier","gltf/Soldier/vanguard_t_choonyung.glb"],
    //[7,"girl","gltf/girl2.glb"],
    [1,"grenade","gltf/emp_grenade.glb"],
    [3,"idle","gltf/Soldier/rifle aiming idle.glb"],
    [3,"shoot","gltf/Soldier/firing rifle.glb"],
    [3,"hit","gltf/Soldier/hit reaction.glb"],
    [3,"throw","gltf/Soldier/toss grenade.glb"],
    [3,"reload","gltf/Soldier/reloading.glb"],
    [3,"walk","gltf/Soldier/walking.glb"],
    [3,"walkB","gltf/Soldier/walking backwards.glb"],
    [3,"starfeL","gltf/Soldier/strafe left.glb"],
    [3,"starfeR","gltf/Soldier/strafe right.glb"],
    [3,"run","gltf/Soldier/rifle run.glb"],
    [3,"jump","gltf/Soldier/rifle jump.glb"],
    [1,"skybox","gltf/skybox_1km.glb"],
    [5,"crosshair","gltf/Crosshair 1.png"],
    [6,"bgm","gltf/A Journey Awaits compressed.ogg"],
    [6,"sfxShoot","gltf/sfx_weapon_singleshot8.wav"],
    [6,"sfxPain","gltf/male-pain-13.mp3"],
    [6,"sfxNoAmmo","gltf/sfx_wpn_noammo3.wav"],
    [6,"sfxReload","gltf/Pump Shotgun.mp3"],
    [6,"sfxStep1","gltf/stepstone_1.wav"],
    [6,"sfxStep2","gltf/stepstone_2.wav"],
    [6,"sfxStep3","gltf/stepstone_3.wav"],
],start).assets;
let level,bgm;
const panel=new dat.GUI();
const options={"render factor":0.5,"bgm volume":0.5,"sfx volume":1,"physics debug":false};
panel.add(options,"bgm volume",0,2).onChange(x=>bgm.setVolume(x));
panel.add(options,"sfx volume",0,2).onChange(x=>sfxVolume=x);
panel.add(options,"render factor",0,1).onChange(x=>{renderFactor=x;resize()});
panel.add(options,"physics debug");

let soldier,soldierSkeleton,girl,girlSkeleton;
function start(){
    level=assets.get("level");
    scene.add(level);
    scene.add(assets.get("skybox"));
    bgm=new THREE.Audio(listener);
    bgm.setBuffer(assets.get("bgm"));
    bgm.setLoop(true);
    bgm.setVolume(0.5);
    let click=()=>{bgm.play();document.removeEventListener("click",click)}
    document.addEventListener("click",click);
    //assets.get("girl").rotateY(3.14);
    /*girl=assets.get("soldier");
    //girl.rotateY(Math.PI);
    girl.updateMatrix();
    //girlSkeleton=girl.children[3].children[0];//new THREE.SkeletonHelper(girl);
    girlSkeleton=girl.children[2];//new THREE.SkeletonHelper(girl);
    soldier=assets.get("soldier");
    soldierSkeleton=soldier.children[2]//new THREE.SkeletonHelper(soldier);
    assets.set("idle0",assets.get('idle'))
    scene.add(girl)
    scene.add(soldier)
    for(let clipName of ["idle","starfeL","starfeR","run","walk","walkB","jump"]){
        let clip=assets.get(clipName);
        let clip2=THREE.SkeletonUtils.retargetClip(girlSkeleton,soldierSkeleton,clip,{})
        assets.set(clipName,clip2);
    }
    scene.remove(girl)
    scene.remove(soldier)*/
    
    new StaticMeshCollider(level);
    let crosshair=new THREE.Mesh(new THREE.PlaneGeometry(.05,.05),new THREE.MeshBasicMaterial({map:assets.get("crosshair"),transparent: true}));
    crosshair.position.set(0,0,-1);
    camera.add(crosshair);

    function randomUnitCircle(){let t=Math.random()*2*Math.PI;return new THREE.Vector3(Math.cos(t),0,Math.sin(t));}
    let playerPosition=randomUnitCircle().multiplyScalar(5).add(new THREE.Vector3(0,5,0));
    clientUpdater.create(playerPosition,{x:0,y:0,z:0,w:1},"player",{});


    client.joinRoom("default");
    gamestate="playing";

}