import {lerp,clamp} from './Utils.js';

export default class LerpAnim{

	constructor(speed,start,end,updateCallback,finishCallback)
	{
		this.end = end;
		this.normalized = start;
		this.speed = speed;
		this.finished = false;
		this.updateCallback = updateCallback;
		this.finishCallback = finishCallback;
	}

	update(dt)
	{
		
		if(this.finished)
		return;
		
		this.normalized  = clamp(lerp( this.normalized,this.end,dt*this.speed),0,1);

if(this.updateCallback)
		{
			this.updateCallback(this.normalized);
		}
		
		if(this.normalized>=1 )
		{
			this.finished = true;
			if(this.finishCallback)
			this.finishCallback()
		}
		
	}

}

