function factory(a){
    let foo=function AddA(b){
        return a+b
    }
    return foo
}
let Add5=factory(5)
Add5(3)