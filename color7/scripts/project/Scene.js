import LerpAnim from "./LerpAnim.js";
import LinearMoveAnim from './LinearAnim.js';


export default class Scene{

	constructor(runtime)
	{
		this.runtime = runtime;
		this.updatables = [];
	}

	update(runtime)
	{
		this.updatables.forEach(u=>u.update(runtime.dt));
	}
	
	addUpdatable(updatable)
	{
		this.updatables.push(updatable);
	}
	
	removeUpdatable(updatable)
	{
		const index = this.updatables.indexOf(updatable);
		this.updatables.splice(index,1);
	}
	
	lerbAnim(speed,start,end,updataCallback,finishCallback)
	{
		let anim = null;
		anim =new LerpAnim(speed,start,end,updataCallback,()=>{
			this.removeUpdatable(anim);
			if(finishCallback)
			finishCallback();
		});
		
		this.addUpdatable(anim);
		
	}
	
	linearAnim(speed,updataCallback,finishCallback)
	{
		let anim = null;
		anim =new LinearMoveAnim(speed,updataCallback,()=>{
			this.removeUpdatable(anim);
			if(finishCallback)
			finishCallback();
		});
		
		this.addUpdatable(anim);
		
	}

}