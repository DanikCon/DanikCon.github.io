
class GameSpriteInstance extends ISpriteInstance{
	constructor()
	{
		super();
		this.updatables = [];
	}
	
	update()
	{
		this.updatables.forEach(u=>u.update());
	}
	
		
	addToUpdatables(updatable)
	{
		this.updatables.push(updatable);
	}
	
	removeFromUpdatables(updatable)
	{
		this.updatables.slice(this.updatables.indexOf(updatable),1);
	}
	
	linearAnim(speed,updateCallback,finished)
	{
		return new Promise((resolve,_)=>{
			
			let anim = null;
			anim = new LinearMoveAnim(speed,updateCallback,()=>{
				this.removeFromUpdatables(anim);
				if(finished)finished();
				resolve();
				
			});
			
			this.addToUpdatables(anim);
		});
	}
	
	
	lerpAnim(speed,start,end,updateCallback,finished)
	{
		return new Promise((resolve,_)=>{
			
			let anim = null;
			anim = new LerpAnim(speed,start,end,updateCallback,()=>{
				this.removeFromUpdatables(anim);
				if(finished)finished();
				
				resolve();
			});
			
			this.addToUpdatables(anim);
		});
	}

	delay(s)
	{
		return new Promise((resolve,_)=>{
			setTimeout(resolve,s*1000);
		});
	}
}