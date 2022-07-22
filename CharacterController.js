/**
 * @author mrdoob / http://mrdoob.com/
 * @author schteppe / https://github.com/schteppe
 * @author fangzhangmnm / https://github.com/fangzhangmnm
 */
//@ts-check
const defaultPhysicsMaterial=new CANNON.Material("default");
const characterPhysicsMaterial=new CANNON.Material("character");
const characterContactMaterial=new CANNON.ContactMaterial(characterPhysicsMaterial,defaultPhysicsMaterial,{friction:0,restitution:0});
const characterContactMaterial2=new CANNON.ContactMaterial(characterPhysicsMaterial,characterPhysicsMaterial,{friction:0,restitution:0});

function createCharacterBody(mass,radius,height){
    if(!world.contactmaterials.includes(characterContactMaterial)){
        world.addContactMaterial(characterContactMaterial);
        world.addContactMaterial(characterContactMaterial2);
    }
    let body=new CANNON.Body({mass:mass,material:characterPhysicsMaterial});
    body.addShape(new CANNON.Sphere(radius));
    body.shapeOffsets[0].set(0,radius,0);
    body.addShape(new CANNON.Sphere(radius));
    body.shapeOffsets[1].set(0,height-radius,0);
    body.addShape(new CANNON.Sphere(radius));
    body.shapeOffsets[2].set(0,height/2,0);
    return body;
}
class CharacterController {
    constructor(camera, bodyMesh, headMesh, trackedMesh, body, domElement) {
        this.moveSpeed = 5;
        this.jumpVelocity = 5;
        this.eyeHeight = 1.75;
        this.isLocked = false;//获得鼠标焦点
        this.pitch = 0;
        this.body = body;
        this.isGrounded = false;
        this.distanceToGround=0;
        this.thirdPersonPosition=new THREE.Vector3(0,0,0);
        //设置正确的层次
        bodyMesh.add(headMesh);
        bodyMesh.add(trackedMesh);
        trackedMesh.position.set(0, 0, 0);//vr中的房间参考系
        trackedMesh.rotation.set(0, Math.PI, 0);
        trackedMesh.add(camera);
        this.camera=camera;
        //camera.position.set(0, this.eyeHeight, 0);
        //camera.rotation.set(this.pitch, 0, 0, 'YXZ');
        this.body.fixedRotation = true;
        this.body.updateMassProperties();//fixedRotation后面必须跟这句
        let raycastResult=new CANNON.RaycastResult();
        this.jumpListener=null;

        this.update = dt=> {
            //利用玩家的手柄输入更新刚体速度
            let input = new THREE.Vector3(0,0,0);//玩家的手柄输入
            if (this.isLocked) {
                if(moveForward)input.z += 1;
                if(moveBackward)input.z -= 1;
                if(moveLeft)input.x += 1;
                if(moveRight)input.x -= 1;
                input.normalize();
            }
            input.multiplyScalar(this.moveSpeed);
            input.applyQuaternion(this.body.quaternion);//变换到世界参考系
            this.body.velocity.set(input.x,this.body.velocity.y,input.z);//Mario Style，保留垂直方向的速度，竖直方向替换成手柄输入

            //检测玩家是否站在地面上
            let up = new THREE.Vector3(0, .1, 0).applyQuaternion(this.body.quaternion);//鸭子类型
            let down = new THREE.Vector3(0, -2, 0).applyQuaternion(this.body.quaternion);
            let v1 = body.position.clone().vadd(up);
            let v2 = body.position.clone().vadd(down);
            if(this.body.world.raycastClosest(v1,v2,{skipBackfaces:true,checkCollisionResponse:false},raycastResult))
                this.distanceToGround=raycastResult.distance-.1;
            else
                this.distanceToGround=Number.POSITIVE_INFINITY;
            this.isGrounded=this.distanceToGround<.1;

            //更新身体位置
            bodyMesh.position.copy(this.body.position);
            bodyMesh.quaternion.copy(this.body.quaternion);
            if (headMesh) {
                headMesh.position.set(0, this.eyeHeight, 0);
                headMesh.rotation.set(-this.pitch, 0, 0, 'YXZ');
            }

            //确定摄像机位置
            let cameraPosition=this.thirdPersonPosition.clone();
            trackedMesh.worldToLocal(headMesh.localToWorld(cameraPosition));
            //camera.position.set(0, this.eyeHeight, 0);
            camera.position.copy(cameraPosition);
            camera.rotation.set(this.pitch, 0, 0, 'YXZ');
        };
        this.update(0);
        let onMouseMove = event=> {//根据鼠标移动事件更新朝向
            if (this.isLocked === false)return;
            let movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
            let movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
            let q = new CANNON.Quaternion().setFromEuler(0, -movementX * 0.002, 0, "YXZ");
            this.body.quaternion.copy(this.body.quaternion.mult(q));
            this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch - movementY * 0.002));
        };
        document.addEventListener('mousemove', onMouseMove, false);
        let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;//四个方向的按键
        let onKeyDown = event=> {
            switch (event.keyCode) {
                case 38:case 87:moveForward = true;break;
                case 37:case 65:moveLeft = true;break;
                case 40:case 83:moveBackward = true;break;
                case 39:case 68:moveRight = true;break;
                case 32:
                    if (this.isLocked && this.isGrounded) {
                        let n = new THREE.Vector3(0, this.jumpVelocity, 0).applyQuaternion(this.body.quaternion);
                        this.body.velocity.copy(body.velocity.vadd(n));
                        if(this.jumpListener)
                            this.jumpListener();
                    }
                    break;
            }
        };
        let onKeyUp = event=> {
            switch (event.keyCode) {
                case 38:case 87:moveForward = false;break;
                case 37:case 65:moveLeft = false;break;
                case 40:case 83:moveBackward = false;break;
                case 39:case 68:moveRight = false;break;
            }
        };
        let blocker = document.getElementById( 'blocker' );
        let blocker_style_display=blocker?blocker.style.display:null;
        let onPointerlockChange=()=> {
            if (document.pointerLockElement === domElement) {
                if(blocker)blocker.style.display='none';
                this.isLocked = true;
                //moveForward = moveBackward = moveLeft = moveRight = false;//不能这么做，不然双击时角色会停下来
            }else {
                if(blocker)blocker.style.display=blocker_style_display;
                this.isLocked = false;
                //moveForward = moveBackward = moveLeft = moveRight = false;
            }
        }
        let onPointerlockError=()=>console.error('THREE.PointerLockControls: Unable to use Pointer Lock API');
        //TODO document=>domElement
        document.addEventListener('mousemove', onMouseMove, false);
        document.addEventListener('keydown', onKeyDown, false);
        document.addEventListener('keyup', onKeyUp, false);
        document.addEventListener('pointerlockchange', onPointerlockChange, false);
        document.addEventListener('pointerlockerror', onPointerlockError, false);
        document.addEventListener("click",()=>{this.lock()});
        this.lock = function () {
            domElement.requestPointerLock();
        };
        this.unlock = function () {
            document.exitPointerLock();
        };
        this.dispose=function(){
            document.removeEventListener('mousemove', onMouseMove, false);
            document.removeEventListener('keydown', onKeyDown, false);
            document.removeEventListener('keyup', onKeyUp, false);
            document.removeEventListener('pointerlockchange', onPointerlockChange, false);
            document.removeEventListener('pointerlockerror', onPointerlockError, false);
        }
    }
}

//CharacterController.prototype = Object.create( THREE.EventDispatcher.prototype );
//CharacterController.prototype.constructor = THREE.CharacterController;
