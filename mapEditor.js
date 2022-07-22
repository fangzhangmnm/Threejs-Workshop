//@ts-check
//==========基本设定==========
const scene=new THREE.Scene();
const renderer=new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);
renderer.gammaFactor=2.2;
renderer.gammaOutput=true;
renderer.shadowMap.enabled=true;
const camera=new THREE.PerspectiveCamera(45,1,.01,10000);
camera.position.set(6,9,12);
camera.lookAt(0,0,0);
function resize(){
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setDrawingBufferSize(window.innerWidth/2, window.innerHeight/2,window.devicePixelRatio);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize",resize);
//==========主循环==========
const clock=new THREE.Clock();
const updates=[];
function loop(){
    let dt=clock.getDelta();
    for(let handler of updates)handler(dt);
    renderer.render(scene,camera);
}
renderer.setAnimationLoop(loop);
//==========插件==========
const stats=new Stats();
document.body.appendChild(stats.dom);
updates.push(dt=>stats.update());
const controls=new THREE.OrbitControls(camera,renderer.domElement);
controls.mouseButtons={LEFT:THREE.MOUSE.RIGHT,MIDDLE:null,RIGHT:THREE.MOUSE.MIDDLE};
controls.screenSpacePanning=false;
updates.push(dt=>controls.update());
const panel=new dat.GUI();
//==========创建场景==========
scene.background=new THREE.Color(0x443355);
const skyLight=new THREE.HemisphereLight(0x6666aa,0x443322);
const light=new THREE.DirectionalLight(0xeeddcc);
light.castShadow=true;
light.position.set(8,20,12);
light.shadow.camera.left=light.shadow.camera.bottom=-35;
light.shadow.camera.right=light.shadow.camera.top=35;
//scene.add(new THREE.CameraHelper(light.shadow.camera));
scene.add(skyLight);
scene.add(light);
//scene.add(new THREE.GridHelper(10,10).translateY(-.001));
scene.add(new THREE.AxesHelper(5));
//==========加载资源==========
const assets=new AssetLoader([
    [4,"materials","gltf/materials.glb"],
],loadDone).assets;
function loadDone(){
    //scene.add(assets.matBalls);
    mesh.material=[assets.get("materials").get("metal"),assets.get("materials").get("hexagon")];
}
//==========w3map==========
const fill2DArray = (m, n, value) => [...Array(m)].map(e => Array(n).fill(value));
const clone2DArray = (value) => value.map(e=>[...e]);
const copy2DArray = (to, from, m, n)=>{for(let i=0;i<m;++i)for(let j=0;j<n;++j)to[i][j]=from[i][j]};
class HistoryRecorder{
    constructor(object,maxHistory,savedProperties){
        this.object=object;
        this.historyStates=[];
        this.savedProperties=savedProperties;
        this.maxHistory=maxHistory;
    }
    pushState(){
        this.historyStates.push(this.savedProperties.map(e=>e[1](this.object[e[0]])));
        if(this.historyStates.length>this.maxHistory)
            this.historyStates.shift();
    }
    popState(){
        if(this.historyStates.length==0)return;
        let state=this.historyStates.pop();
        for(let i in this.savedProperties)
            this.object[this.savedProperties[i][0]]=this.savedProperties[i][1](state[i]);
    }
}
class MapChunk{
    constructor(size){
        this.size=size;
        this.uvScale=1;
        this.uvScaleY=1;
        this.levels=fill2DArray(size+2,size+2,0);
        this.ramps=fill2DArray(size+2,size+2,0);
        this.highlights=fill2DArray(size+2,size+2,0);
        this.mats=fill2DArray(this.size+2,this.size+2,0);
        this.matCount=1;
        this.highlightColors=[[1,1,1],[1,0.6,0.6]];
        this.fogs=fill2DArray(size+2,size+2,1);
        this.h00=fill2DArray(this.size+2,this.size+2,0);//每个tile四个角的高程
        this.h01=fill2DArray(this.size+2,this.size+2,0);
        this.h10=fill2DArray(this.size+2,this.size+2,0);
        this.h11=fill2DArray(this.size+2,this.size+2,0);
        this.positions=new Float32Array(this.size*this.size*6*3*3);this.positionsPtr=0;
        this.colors=new Float32Array(this.size*this.size*6*3*3);this.colorsPtr=0;
        this.uvs=new Float32Array(this.size*this.size*6*3*2);this.uvPtr=0;
        this.triCount=0;
        this.geometry=new THREE.BufferGeometry();
        this.geometry.addAttribute("position",new THREE.BufferAttribute(this.positions,3));//.setDynamic(true)
        this.geometry.addAttribute("uv",new THREE.BufferAttribute(this.uvs,2));
        this.geometry.setDrawRange(0,0);
        this.oldGeometry=new THREE.BufferGeometry();
        this.history=new HistoryRecorder(this,10,[
            ["levels",clone2DArray],
            ["ramps",clone2DArray],
            ["highlights",clone2DArray],
            ["fogs",clone2DArray],
            ["mats",clone2DArray],
        ]);
    }
    cloneOldGeometry(){this.oldGeometry.copy(this.geometry);}
    getBoundaryLevels(){}
    getBoundaryHeights(){}
    generateHeights(){
        const dir8=[[0,-1],[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1]];//x右z下，十二点钟开始逆时针走
        let h00=this.h00;//每个tile四个角的高程
        let h01=this.h01;
        let h10=this.h10;
        let h11=this.h11;
        for(let xc=0;xc<this.size+2;++xc)for(let zc=0;zc<this.size+2;++zc)
            h00[xc][zc]=h01[xc][zc]=h10[xc][zc]=h11[xc][zc]=this.levels[xc][zc]
        for(let xc=0;xc<this.size;++xc)for(let zc=0;zc<this.size;++zc){
            let m=this.levels[xc+1][zc+1];//这个tile的高程
            h00[xc+1][zc+1]=h01[xc+1][zc+1]=h10[xc+1][zc+1]=h11[xc+1][zc+1]=m;
            if(this.ramps[xc+1][zc+1]>3)this.ramps[xc+1][zc+1]=0;
            if(this.ramps[xc+1][zc+1]){//如果这个tile是斜坡的话
                let n=[0,0,0,0,0,0,0,0];//八个方向的高程，根据旋转对称分类讨论
                for(let i=0;i<8;++i)n[i]=this.levels[xc+1+dir8[i][0]][zc+1+dir8[i][1]];
                let a=-1;
                for(let i=0;i<4;++i)if(n[2*i]==m+1){a=2*i;break;}
                if(a==-1){//如果没有边相邻的高地（高地是高程比你严格大1的tile）
                    if(this.ramps[xc+1][zc+1]>1)
                        this.ramps[xc+1][zc+1]=0;//type2 type3 ramp都是坡道，此时不应存在
                    else{
                        let b=-1;
                        for(let i=0;i<4;++i)
                            if(n[2*i+1]==m+1){b=2*i+1;break;}
                        if(b==-1)this.ramps[xc+1][zc+1]=0;//如果没有角相邻的高地
                        else if(n[(b+2)%8]==m+1||n[(b+4)%8]==m+1||n[(b+6)%8]==m+1)this.ramps[xc+1][zc+1]=0;//如果有超过一个角相邻的高地
                        else{//只有一个角相邻的高地，此时可以有type1 ramp
                            if(b==1)h00[xc+1][zc+1]+=1;
                            if(b==3)h01[xc+1][zc+1]+=1;
                            if(b==5)h11[xc+1][zc+1]+=1;
                            if(b==7)h10[xc+1][zc+1]+=1;
                        }
                    }
                }else{//有边相邻的高地
                    if(n[(a+4)%8]==m+1)this.ramps[xc+1][zc+1]=0;//对边不应是高地
                    else if(n[(a+2)%8]==m+1 && n[(a+6)%8]!=m+1 && this.ramps[xc+1][zc+1]==1){//逆时针方向是高地，type1
                        h00[xc+1][zc+1]+=1;h01[xc+1][zc+1]+=1;h10[xc+1][zc+1]+=1;h11[xc+1][zc+1]+=1;
                        if(a==0)h11[xc+1][zc+1]-=1;
                        if(a==2)h10[xc+1][zc+1]-=1;
                        if(a==4)h00[xc+1][zc+1]-=1;
                        if(a==6)h01[xc+1][zc+1]-=1;
                    }
                    else if(n[(a+2)%8]!=m+1 && n[(a+6)%8]==m+1 && this.ramps[xc+1][zc+1]==1){//顺时针方向是高地，type1
                        h00[xc+1][zc+1]+=1;h01[xc+1][zc+1]+=1;h10[xc+1][zc+1]+=1;h11[xc+1][zc+1]+=1;
                        if(a==0)h01[xc+1][zc+1]-=1;
                        if(a==2)h11[xc+1][zc+1]-=1;
                        if(a==4)h10[xc+1][zc+1]-=1;
                        if(a==6)h00[xc+1][zc+1]-=1;
                    }else{//考虑斜坡的情况type2是纵向type3是横向
                        let changed=false;
                        //如果type1，先检查是否有变成type2的可能性。同样处理下type2的情况
                        if(n[0]==m+1 && this.ramps[xc+1][zc+1]!=3){h00[xc+1][zc+1]+=1;h10[xc+1][zc+1]+=1;changed=true;}
                        else if(n[4]==m+1 && this.ramps[xc+1][zc+1]!=3){h11[xc+1][zc+1]+=1;h01[xc+1][zc+1]+=1;changed=true;}
                        if(changed)
                            this.ramps[xc+1][zc+1]=2;
                        else{//不能变成type2，或者设定好了是type3。检查下变成type3的可能性
                            this.ramps[xc+1][zc+1]=3;//type1也会变成type3
                            if(n[2]==m+1){h01[xc+1][zc+1]+=1;h00[xc+1][zc+1]+=1;}
                            else if(n[6]==m+1){h10[xc+1][zc+1]+=1;h11[xc+1][zc+1]+=1;}
                            else this.ramps[xc+1][zc+1]=0;//不能变成type3
                        }
                    }
                }
            }
        }
    }
    setPosition(x,y,z){this.positions[this.positionsPtr++]=x;this.positions[this.positionsPtr++]=y;this.positions[this.positionsPtr++]=z;return this;}
    setColor(x,y,z){this.colors[this.colorsPtr++]=x;this.colors[this.colorsPtr++]=y;this.colors[this.colorsPtr++]=z;return this;}
    setUv(x,y){this.uvs[this.uvPtr++]=x*this.uvScale;this.uvs[this.uvPtr++]=y*this.uvScale;return this;}
    setUvy(x,y){this.uvs[this.uvPtr++]=x*this.uvScale;this.uvs[this.uvPtr++]=y*this.uvScaleY;return this;}
    setTriangles(n){this.triCount+=n;return this;}
    resetTriangles(){this.triCount=0;this.positionsPtr=0;this.colorsPtr=0;this.uvPtr=0;this.geometry.clearGroups();return this;}
    updateGeometry(){
        this.generateHeights();
        this.resetTriangles();
        let h00=this.h00;
        let h01=this.h01;
        let h10=this.h10;
        let h11=this.h11;
        for(let mat=0;mat<this.matCount*2;++mat){
            let startTri=this.triCount;
            for(let xc=0;xc<this.size;++xc)for(let zc=0;zc<this.size;++zc){
                let m00=h00[xc+1][zc+1],m01=h01[xc+1][zc+1],m10=h10[xc+1][zc+1],m11=h11[xc+1][zc+1];
                let u01=h01[xc+1][zc],u11=h11[xc+1][zc];
                let d00=h00[xc+1][zc+2],d10=h10[xc+1][zc+2];
                let l10=h10[xc][zc+1],l11=h11[xc][zc+1];
                let r00=h00[xc+2][zc+1],r01=h01[xc+2][zc+1];
                //创建地面
                if(this.mats[xc+1][zc+1]*2==mat){
                    if(m00==m11){
                        this.setPosition(xc,m00,zc);
                        this.setPosition(xc,m01,zc+1);
                        this.setPosition(xc+1,m10,zc);
                        this.setPosition(xc+1,m11,zc+1);
                        this.setPosition(xc+1,m10,zc);
                        this.setPosition(xc,m01,zc+1);
                        this.setUv(xc,zc).setUv(xc,zc+1).setUv(xc+1,zc);
                        this.setUv(xc+1,zc+1).setUv(xc+1,zc).setUv(xc,zc+1);
                    }else{
                        this.setPosition(xc+1,m10,zc);
                        this.setPosition(xc,m00,zc);
                        this.setPosition(xc+1,m11,zc+1);
                        this.setPosition(xc,m01,zc+1);
                        this.setPosition(xc+1,m11,zc+1);
                        this.setPosition(xc,m00,zc);
                        this.setUv(xc+1,zc).setUv(xc,zc).setUv(xc+1,zc+1);
                        this.setUv(xc,zc+1).setUv(xc+1,zc+1).setUv(xc,zc);
                    }
                    this.setTriangles(2);
                }
                let dmat=this.mats[xc+1][zc+1];//判断下侧和右侧是否比自己高，若高则用对方的材质
                if(m01<d00||m11<d10)dmat=this.mats[xc+1][zc+2];
                let rmat=this.mats[xc+1][zc+1];
                if(m10<r00||m11<r01)rmat=this.mats[xc+1][zc+2];
                //创建下侧和右侧的悬崖
                if(dmat*2+1==mat){
                    if(m01!=d00){
                        this.setPosition(xc,d00,zc+1);
                        this.setPosition(xc+1,d10,zc+1);
                        this.setPosition(xc,m01,zc+1);
                        this.setUvy(xc,-d00).setUvy(xc+1,-d10).setUvy(xc,-m01);
                        this.setTriangles(1);
                    }
                    if(m11!=d10){
                        this.setPosition(xc+1,m11,zc+1);
                        this.setPosition(xc,m01,zc+1);
                        this.setPosition(xc+1,d10,zc+1);
                        this.setUvy(xc+1,-m11).setUvy(xc,-m01).setUvy(xc+1,-d10);
                        this.setTriangles(1);
                    }
                }
                if(rmat*2+1==mat){
                    if(m10!=r00){
                        this.setPosition(xc+1,r00,zc);
                        this.setPosition(xc+1,m10,zc);
                        this.setPosition(xc+1,r01,zc+1);
                        this.setUvy(zc,-r00).setUvy(zc,-m10).setUvy(zc+1,-r01);
                        this.setTriangles(1);
                    }
                    if(m11!=r01){
                        this.setPosition(xc+1,m11,zc+1);
                        this.setPosition(xc+1,r01,zc+1);
                        this.setPosition(xc+1,m10,zc);
                        this.setUvy(zc+1,-m11).setUvy(zc+1,-r01).setUvy(zc,-m10);
                        this.setTriangles(1);
                    }
                }
            }
            this.geometry.addGroup(startTri*3,(this.triCount-startTri)*3,mat);
        }
        //输出至几何体
        this.geometry.setDrawRange(0,3*this.triCount);
        this.geometry.attributes.position.needsUpdate=true;
        this.geometry.attributes.uv.needsUpdate=true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingBox();
        this.geometry.computeBoundingSphere();
    }
}
let mapSize=Number(new URL(window.location.href).searchParams.get("size"))||20;

let map=new MapChunk(mapSize);
map.uvScale=.5;
map.uvScaleY=.25;
map.updateGeometry();
map.cloneOldGeometry();
let material=new THREE.MeshStandardMaterial({color:0xeeeeee});//,vertexColors:THREE.VertexColors
let mesh=new THREE.Mesh(map.geometry,material);
let oldmesh=new THREE.Mesh(map.oldGeometry,material);
mesh.add(oldmesh);
oldmesh.visible=false;
oldmesh.name="collider";
mesh.scale.set(2,.5,2);
mesh.translateX(-mapSize).translateZ(-mapSize);
mesh.castShadow=mesh.receiveShadow=true;
scene.add(mesh);

let mapEditor={raise:0.5};
const getRaycasterFromMouse=(event)=>{
    let pointer = event.changedTouches ? event.changedTouches[0] : event;
    let rect = renderer.domElement.getBoundingClientRect();
    let mouse = new THREE.Vector2((pointer.clientX - rect.left) / rect.width * 2 - 1, -(pointer.clientY - rect.top) / rect.height * 2 + 1);
    let raycaster=new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    return raycaster;
}
let mousedown=(event)=>{
    if(event.button!=0)return;
    oldmesh.visible=true;
    let intersects = getRaycasterFromMouse(event).intersectObject(oldmesh);
    oldmesh.visible=false;
    if(intersects[0] && event.button==0){
        let p=intersects[0].point.clone();
        oldmesh.worldToLocal(p);
        let x=Math.floor(p.x);
        let z=Math.floor(p.z);
        mapEditor.startxz=new THREE.Vector3(x,0,z);
    }else mapEditor.startxz=null;
    map.history.pushState();
    mousemove(event);
}
let mousemove=(event)=>{
    oldmesh.visible=true;
    let intersects = getRaycasterFromMouse(event).intersectObject(oldmesh);
    oldmesh.visible=false;
    if(!intersects[0])return;

    let p=intersects[0].point.clone();
    oldmesh.worldToLocal(p);
    let x1=Math.floor(p.x),z1=Math.floor(p.z);
    if(mapEditor.startxz && event.button==0){
        let x0=mapEditor.startxz.x,z0=mapEditor.startxz.z;
        map.history.popState();
        map.history.pushState();
        for(let x=Math.min(x0,x1);x<=Math.max(x0,x1);++x)
        for(let z=Math.min(z0,z1);z<=Math.max(z0,z1);++z){
            if(event.shiftKey)
                map.levels[x+1][z+1]-=mapEditor.raise*2;
            else if(event.altKey){
                map.ramps[x+1][z+1]=(map.ramps[x+1][z+1]+1)%4;
            }
            else
                map.levels[x+1][z+1]+=mapEditor.raise*2;
            map.highlights[x+1][z+1]=1;
        }
        map.updateGeometry();
    }else{
        map.highlights=fill2DArray(map.size+2,map.size+2,0);
        map.highlights[x1+1][z1+1]=1;
        map.updateGeometry();
    }
}
let mouseup=(event)=>{
    if(!mapEditor.startxz)return;
    mousemove(event);
    mapEditor.startxz=null;
    map.highlights=fill2DArray(map.size+2,map.size+2,0);
    map.updateGeometry();
    map.cloneOldGeometry();
}
mapEditor.undo=()=>{
    map.history.popState();
    map.updateGeometry();
    map.cloneOldGeometry();
}
mapEditor.exporter=new THREE.GLTFExporter();
mapEditor.exportGLTF=()=>{
    //oldmesh.visible=true;
    mapEditor.exporter.parse( mesh, function ( gltf ) {
        console.log( gltf );
        downloadObjectAsJson( gltf ,"level.gltf");
    }, {onlyVisible :false} );
    //oldmesh.visible=false;
}
panel.add(mapEditor,"raise",-5,5,0.5);
panel.add(mapEditor,"undo");
panel.add(mapEditor,"exportGLTF");
renderer.domElement.addEventListener("mousedown",mousedown);
renderer.domElement.addEventListener("mousemove",mousemove);
renderer.domElement.addEventListener("mouseup",mouseup);

function downloadObjectAsJson(exportObj, exportName){
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj));
    let downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", exportName);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }