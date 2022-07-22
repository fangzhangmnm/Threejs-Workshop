//@ts-check
if(false){/* just to enable the code snippers*/
    var THREE=require("three");
    var CANNON=require("cannon");
}
class AssetLoader{
    constructor(queue,loadDoneHandler){
        this.gltfLoader=new THREE.GLTFLoader();
        THREE.DRACOLoader.setDecoderPath("lib/draco/");
        THREE.DRACOLoader.getDecoderModule();
        this.gltfLoader.setDRACOLoader(new THREE.DRACOLoader());
        this.textureLoader=new THREE.TextureLoader();
        this.audioLoader=new THREE.AudioLoader();
        this.fileLoader=new THREE.FileLoader();
        this.boneNames={}
        this.fileLoader.load("gltf/boneNames.json",data=>this.boneNames=JSON.parse(data).names);

        this.queue=queue||[];//0 pipeline ID 1 name 2 url
        this.queueIndex=0;
        this.assets=new Map();
        this.isLoading=false;
        this.loadDoneHandler=loadDoneHandler;

        let pipeline=[];
        let loader=[];
        loader[0]=this.gltfLoader;
        pipeline[0]=x=>x;//返回整个gltf对象{scene, animations, etc}
        loader[1]=this.gltfLoader;
        pipeline[1]=x=>{
            x.scene.children[0].traverse(x=>{
                if(x.isBone)x.name=this.mapBoneName(x.name);
            });
            return x.scene.children[0];//返回第一个模型，并且替换骨骼名称
        }
        loader[2]=this.gltfLoader;
        pipeline[2]=x=>{//返回场景中的全部模型的Map
            let ans=new Map();
            for(let child of x.scene.children){
                ans.set(child.name,child);
                child.position.set(0,0,0);
            }
            return ans;
        }
        loader[3]=this.gltfLoader;
        pipeline[3]=x=>{//返回第一个动画，并移除RootMotion
            for(let a of x.animations[0].tracks)
                a.name=this.mapBoneName(a.name);
            //TODO remove finger animation
            if(x.animations[0].tracks[0].name=="Hips.position"){
                let track=x.animations[0].tracks[0];
                let n=track.times.length;
                let t=track.times[n-1]-track.times[0];
                let vx=(track.values[3*(n-1)]-track.values[0])/t;
                let vz=(track.values[3*(n-1)+2]-track.values[2])/t;
                for(let i=0;i<x.animations[0].tracks[0].values.length/3;++i){//移除RootMotion
                    track.values[3*i]-=vx*track.times[i];
                    track.values[3*i+2]-=vz*track.times[i];
                }
            }
            return x.animations[0];
        }
        loader[4]=this.gltfLoader;
        pipeline[4]=x=>{//返回包括场景中全部材质的Map
            let ans=new Map();
            x.scene.traverse(y=>{
                if(y.material)
                    ans.set(y.material.name,y.material);
            });
            return ans;
        }
        loader[5]=this.textureLoader;//返回贴图
        pipeline[5]=x=>x;
        loader[6]=this.audioLoader;//返回音效
        pipeline[6]=x=>x;
        loader[7]=this.gltfLoader;
        pipeline[7]=x=>{//返回整个场景，并且替换骨骼名称
            x.scene.traverse(x=>{
                if(x.isBone)x.name=this.mapBoneName(x.name);
            });
            return x.scene
        }
        
        this.loadNext=()=>{
            if(this.queueIndex>=queue.length){
                this.isLoading=false;
                if(this.loadDoneHandler)this.loadDoneHandler();
            }else{
                this.isLoading=true;
                let pipelineId=this.queue[this.queueIndex][0];
                let url=this.queue[this.queueIndex][2];
                let name=this.queue[this.queueIndex][1];
                loader[pipelineId].load(url,x=>{
                    let obj=pipeline[pipelineId](x);
                    //obj.name=name;
                    this.assets.set(name,obj);
                    this.queueIndex+=1;
                    this.loadNext();
                },null,err=>console.log(err));
            }
        }
        this.loadNext();
        function absolute(base, relative) {
            var stack = base.split("/"),
                parts = relative.split("/");
            stack.pop(); // remove current file name (or empty string)
                         // (omit if "base" is the current folder without trailing slash)
            for (var i=0; i<parts.length; i++) {
                if (parts[i] == ".")
                    continue;
                if (parts[i] == "..")
                    stack.pop();
                else
                    stack.push(parts[i]);
            }
            return stack.join("/");
        }
    }
    addQueue(queue){
        this.queue=this.queue.concat(queue);
        if(!this.isLoading)
            this.loadNext();
    }
    mapBoneName(name){
        let postfix="";
        if(name.substr(-9)==".position"){
            name=name.substr(0,name.length-9);
            postfix=".position"
        }else if(name.substr(-11)==".quaternion"){
            name=name.substr(0,name.length-11);
            postfix=".quaternion"
        }
        for(let a of this.boneNames){
            for(let b of a)
                if(name==b)
                    return a[0]+postfix;
        }
        return name+postfix;
    }
}
class StaticMeshCollider{
    constructor(mesh){
        this.body=new CANNON.Body({mass:0,material:defaultPhysicsMaterial});
        this.body.type=CANNON.Body.STATIC;

        mesh.updateWorldMatrix();
        mesh.traverse(m=>{
            if(m.name=="collider"){
                m.visible=false;
                //console.log(m.geometry)
                let shape,nv=m.geometry.attributes.position.count;
                let ws=new THREE.Vector3();m.getWorldScale(ws);
                //console.log(m,m.name,m.getWorldScale())
                let ls=[ws.x,ws.y,ws.z];
                if(m.geometry.index){
                    //TODO
                    console.warn("TODO");
                }else{
                    let vertices=new Float32Array(nv*3);
                    for(let i=0;i<nv*3;++i)vertices[i]=m.geometry.attributes.position.array[i]*ls[i%3];
                    let indices=new Uint16Array(nv);
                    for(let i=0;i<nv;++i)indices[i]=i;
                    //console.log(vertices,indices)
                    shape=new CANNON.Trimesh(vertices,indices);
                }
                this.body.addShape(shape);
                let i=this.body.shapes.length-1,pos=new THREE.Vector3(),quat=new THREE.Quaternion(),quat2=new THREE.Quaternion();
                this.body.shapeOffsets[i].copy(mesh.worldToLocal(m.getWorldPosition(pos)));
                this.body.shapeOrientations[i].copy(mesh.getWorldQuaternion(quat).inverse().multiply(m.getWorldQuaternion(quat2)));
            }
        });
        this.body.position.copy(mesh.getWorldPosition());
        this.body.quaternion.copy(mesh.getWorldQuaternion());
        this.body.aabbNeedsUpdate = true;
        world.addBody(this.body);
        //console.log(this.body)
    }
}