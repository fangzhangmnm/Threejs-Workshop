//@ts-check
if(false){/* just to enable the code snippers*/
    var THREE=require("three");
}
//==========基本设定==========
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);
renderer.gammaFactor=2.2;
renderer.gammaOutput=true;
const camera=new THREE.PerspectiveCamera(45,1,.01,10000);
camera.position.set(2,1,3);
camera.lookAt(0,0,0);
const listener=new THREE.AudioListener();
camera.add(listener);
let renderFactor=1;
function resize(){
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setDrawingBufferSize(window.innerWidth*renderFactor, window.innerHeight*renderFactor,window.devicePixelRatio);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize",resize);
//==========输入输出==========
class Input{
    constructor(domElement,camera){
        this.mouseX=this.mouseY=0;
        this.clicked=false;
        let mousemove = event=> {
            let rect=domElement.getBoundingClientRect();
            this.mouseX=(event.clientX-rect.left)/rect.width*2-1;
            this.mouseY=-(event.clientY-rect.top)/rect.height*2+1;
        };
        let mousedown=event=>{
            if(event.button==0)
                this.clicked=true;
        }
        domElement.addEventListener("mousemove",mousemove);
        domElement.addEventListener("mousedown",mousedown);
    }
    update(dt){
        this.clicked=false;
    }
}
const input=new Input(renderer.domElement,camera);
//==========主循环==========
const clock=new THREE.Clock();
const updates=[];
function loop(){
    let dt=clock.getDelta();
    for(let handler of updates)handler(dt);
    input.update(dt);
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(loop);

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
scene.add(new THREE.GridHelper(100,100).translateY(-.001));
scene.add(new THREE.AxesHelper(5));
//==========模型==========
const red=new THREE.MeshStandardMaterial({color:0xdd4433});
const green=new THREE.MeshStandardMaterial({color:0x117733});
const white=new THREE.MeshStandardMaterial({color:0xbbaacc});
const black=new THREE.MeshStandardMaterial({color:0x010402});
const yellowFlat=new THREE.MeshBasicMaterial({color:0xddcc88,transparent:true});
const whiteGlow=new THREE.MeshBasicMaterial({color:0x090909,blending: THREE.AdditiveBlending,depthWrite:false});
const whiteGlow1=new THREE.MeshBasicMaterial({color:0x020202,blending: THREE.AdditiveBlending,depthWrite:false});
const boxMesh=new THREE.BoxGeometry(1,1,1);
const sphereMesh=new THREE.SphereGeometry(.5);
function box(cx,cy,cz,sx,sy,sz,mat){
    let mesh=new THREE.Mesh(boxMesh,mat)
    mesh.scale.set(sx,sy,sz)
    mesh.position.set(cx,cy,cz)
    return mesh
}
function sphere(cx,cy,cz,sx,sy,sz,mat){
    let mesh=new THREE.Mesh(sphereMesh,mat)
    mesh.scale.set(sx,sy,sz)
    mesh.position.set(cx,cy,cz)
    return mesh
}
function fighterMesh(mainColor,secondaryColor){
    let group=new THREE.Group()
    //机身
    group.add(box(0,0,0,.5,.7,2,mainColor))
    group.add(box(0,.1,1.5,.5,.5,1.5,mainColor))
    //翅膀
    group.add(box(0,1,0,4,.1,1.2,mainColor))
    group.add(box(0,.2,0,4,.1,1.2,mainColor))
    //尾翼
    group.add(box(0,.2,2,1.5,.1,.6,mainColor))
    group.add(box(0,.5,2,.1,.8,.4,mainColor))
    //螺旋桨
    group.add(box(0,0,-1.1,.7,.2,.1,secondaryColor).rotateZ(.8))
    group.add(box(0,0,-1.1,.7,.2,.1,secondaryColor).rotateZ(-.8))
    //装饰
    group.add(box(1.9,.6,.4,.05,1,.05,secondaryColor))
    group.add(box(1.9,.6,-.4,.05,1,.05,secondaryColor))
    group.add(box(-1.9,.6,.4,.05,1,.05,secondaryColor))
    group.add(box(-1.9,.6,-.4,.05,1,.05,secondaryColor))
    group.add(box(0.25,.6,-.4,.05,1,.05,secondaryColor))
    group.add(box(-0.25,.6,-.4,.05,1,.05,secondaryColor))
    //整体放缩
    group.scale.set(.3,.3,.3);
    let group2=new THREE.Group();
    group2.add(group);
    return group2
}
function bomberMesh(mainColor,secondaryColor){
    let group=new THREE.Group()
    //机身
    group.add(box(1,0,1,.5,.7,4,mainColor))
    group.add(box(-1,0,1,.5,.7,4,mainColor))
    //翅膀
    group.add(box(0,.2,0,6,.1,1.2,mainColor))
    group.add(box(0,.2,-.2,6.1,.2,.1,secondaryColor))
    //尾翼
    group.add(box(0,.2,3,4,.1,.6,mainColor))
    group.add(box(2,.3,3,.1,.5,.4,secondaryColor))
    group.add(box(-2,.3,3,.1,.5,.4,secondaryColor))

    group.scale.set(.3,.3,.3);
    let group2=new THREE.Group();
    group2.add(group);
    return group2
}
function bulletMesh(size,size2,length){
    let group=new THREE.Group();
    group.add(box(0,0,0,size,size,length,whiteGlow));
    group.add(box(0,0,0,size+size2*.2,size+size2*.2,length,whiteGlow));
    group.add(box(0,0,0,size+size2*.4,size+size2*.4,length,whiteGlow));
    group.add(box(0,0,0,size+size2*.6,size+size2*.6,length,whiteGlow));
    group.add(box(0,0,0,size+size2*.8,size+size2*.8,length,whiteGlow1));
    return group
}
function explosionMesh(size){
    let group=new THREE.Group();
    let mat=yellowFlat.clone();
    group.add(sphere(0,0,0,size,size,size,mat));
    return [group,mat];
}
//==========游戏性类==========
var planes=[]
class GameObject{
    constructor(mesh){
        this.mesh=mesh;
        scene.add(this.mesh);
        this.updateWrapper=dt=>this.update(dt);
        updates.push(this.updateWrapper);
    }
    update(dt){}
    dispose(){
        scene.remove(this.mesh);
        updates.splice(updates.indexOf(this.updateWrapper),1);
    }
}
class Effect extends GameObject{
    constructor(mesh,material,lifetime,options={}){
        super(mesh);
        this.material=material;
        this.lifetime=lifetime;
        this.age=0;
        this.scaleRate=options.scaleRate||0;
        this.fadeRate=options.fadeRate||0;
    }
    update(dt){
        super.update(dt);
        this.mesh.scale.addScalar(dt*this.scaleRate);
        this.material.opacity=Math.max(0,this.material.opacity-dt*this.fadeRate);
        this.age+=dt;
        if(this.age>this.lifetime)this.dispose();
    }
}
function explosion(position,size){
    let [mesh,mat]=explosionMesh(size);
    mesh.position.copy(position);
    new Effect(mesh,mat,1,{fadeRate:1,scaleRate:2});
}
class Bullet extends GameObject{
    constructor(mesh,speed,lifetime){
        super(mesh);
        this.speed=speed;
        this.lifetime=lifetime;
        this.damage=10;
    }
    update(dt){
        super.update(dt);
        this.lifetime-=dt;
        if(this.lifetime<0){this.dispose();return;}
        let v=new THREE.Vector3(0,0,-this.speed*dt);
        v.applyQuaternion(this.mesh.quaternion);
        this.mesh.position.add(v);
        for(let plane of planes){
            if(plane.mesh.position.distanceTo(this.mesh.position)<plane.hitRadius){
                plane.takeDamage(this.damage);
                explosion(this.mesh.position,.5);
                this.dispose();return;
            }
        }
    }
}
class Plane extends GameObject{
    constructor(mesh,hitRadius){
        super(mesh);
        this.hitRadius=hitRadius;
        this.pitch=0;
        this.yaw=0;
        this.roll=0;
        this.speed=0;
        this.maxSpeed=1;
        this.maxAcceleration=1;
        this.inputX=0;
        this.inputY=0;
        this.health=100;
        this.bulletSpeed=20;
        this.shootInterval=0.5;
        this.isDead=false;
        this.shootCD=0;
        this.gravity=3;
        planes.push(this);
    }
    update(dt){
        super.update(dt);
        this.pitch=this.inputY;
        this.yaw+=-this.inputX*dt;
        this.roll=-this.inputX;
        this.mesh.quaternion.setFromEuler(new THREE.Euler(this.pitch,this.yaw,this.roll,"YXZ"));
        //this.speed=this.maxSpeed;
        let a=this.maxAcceleration*(1-Math.pow(Math.abs(this.speed)/this.maxSpeed,2)*Math.sign(this.speed));
        a-=this.gravity*Math.sin(this.pitch);
        this.speed+=a*dt;
        if(this.speed<0)this.speed=0;
        let v=new THREE.Vector3(0,0,-this.speed);
        v.applyQuaternion(this.mesh.quaternion);
        this.mesh.position.addScaledVector(v,dt);
        if(!this.isDead){
            this.shootCD-=dt;
        }
        for(let plane of planes){
            if(this!=plane && plane.mesh.position.distanceTo(this.mesh.position)<plane.hitRadius+this.hitRadius){
                this.die();
                plane.die();
            }
        }
        if(this.mesh.position.y<-0.1){
            explosion(this.mesh.position,2);
            this.dispose();
        }
    }
    shoot(){
        if(this.shootCD>0)return;this.shootCD=this.shootInterval;
        let v=new THREE.Vector3(0,0,-1);
        this.mesh.localToWorld(v);
        let b=new Bullet(bulletMesh(.03,.05,.4),this.bulletSpeed,3);
        b.mesh.position.copy(v);
        b.mesh.quaternion.copy(this.mesh.quaternion);
    }
    takeDamage(damage){
        if(!this.isDead){
            this.health-=damage;
            if(this.health<0){
                this.health=0;
                this.die();
            }
        }
    }
    die(){
        this.isDead=true;
        this.inputY=-1;
        this.inputX=3;
    }
    dispose(){
        planes.splice(planes.indexOf(this),1);
        super.dispose();
    }
    maxClimbAngle(){return Math.asin(this.maxAcceleration/this.gravity);}
}
class Player extends Plane{
    constructor(mesh,hitRadius){
        super(mesh,hitRadius);
        this.name="player";
        this.health=100;
        this.maxSpeed=2;
        this.maxAcceleration=1;
        this.shootInterval=0.1;
    }
    setCamera(){
        let v=new THREE.Vector3(0,1,5);
        v.y+=this.pitch;
        this.mesh.localToWorld(v);
        camera.position.copy(v);
        let v2=new THREE.Vector3(0,0,0);
        v2.y=this.pitch;
        v2.x=-this.roll*2;
        this.mesh.localToWorld(v2);
        camera.lookAt(v2);
    }
    update(dt){
        super.update(dt);
        if(!this.isDead){
            this.inputX=input.mouseX;
            this.inputY=input.mouseY;
            this.setCamera();
            if(input.clicked)
                this.shoot();
        }
    }
}
class EnemyA extends Plane{
    constructor(){
        super(bomberMesh(green,black),1);
        this.name="bomber";
        this.health=150;
        this.maxSpeed=1.6;
        this.maxAcceleration=1;
        this.mesh.position.set(Math.random()*40-20,Math.random()*10+5,Math.random()*40-20);
        this.yaw=Math.random()*Math.PI*2;
        this.inputX=.2;
    }
}
class EnemyB extends Plane{
    constructor(){
        super(fighterMesh(green,white),0.6);
        this.name="enemy";
        this.health=50;
        this.maxSpeed=1.3;
        this.maxAcceleration=0.5;
        this.mesh.position.set(Math.random()*40-20,Math.random()*10+5,Math.random()*40-20);
        this.yaw=Math.random()*Math.PI*2;
    }
    update(dt){
        super.update(dt);
        if(!this.isDead){
            this.decide(dt);
        }
    }
    decide(dt){
        let d=player.mesh.position.distanceTo(this.mesh.position);
        let v=player.mesh.position.clone();
        v.addScaledVector(new THREE.Vector3(0,0,-player.speed).applyQuaternion(player.mesh.quaternion),Math.min(1,d/this.bulletSpeed));
        v.addScaledVector(this.mesh.position,-1);
        
        let q=new THREE.Quaternion().setFromEuler(new THREE.Euler(0,this.yaw,0,"YXZ")).inverse();
        v.applyQuaternion(q);

        let found=false,dy=0,dp=0;
        if(-v.z>0){
            dy=Math.atan2(v.x,-v.z);
            dp=Math.atan2(v.y,-v.z);
            if(Math.abs(dy)<1 && Math.abs(dp)<0.8)
                found=true;
        }
        if(found){
            this.inputX=Math.max(-1,Math.min(1,dy*.5));
            this.inputY=Math.max(-1,Math.min(1,dp*.5));
            if(Math.abs(dy)<0.2 && Math.abs(dp)<0.2){
                this.shoot();
            }
        }else{
            this.inputX=0.5;
            this.inputY=0;
        }
        if(this.mesh.position.y<2){
            this.inputX=0;
            this.inputY=1;
        }
        if(d<2){
            this.inputX=-Math.sign(dy);
            this.inputY=-Math.sign(dp);
        }
        if(this.speed<this.maxSpeed/2){
            this.inputY=Math.min(this.inputY,this.maxClimbAngle());
        }
        
    }
}
const player=new Player(fighterMesh(red,white),.25);
player.mesh.position.set(0,10,50);
new EnemyA();
new EnemyA();
new EnemyA();
new EnemyB();
new EnemyB();
new EnemyB();
new EnemyB();
new EnemyB();
new EnemyB();
new EnemyB();
new EnemyB();