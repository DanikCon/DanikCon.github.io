import {lerp} from './Utils.js';

export default class Vector{

	constructor(x,y)
	{
		this.x = x;
		this.y = y;
	}
	
	static lerp(vec1,vec2,n)
	{
		return new Vector(lerp(vec1.x,vec2.x,n),lerp(vec1.y,vec2.y,n));
	}
	
	mag()
	{
		return Math.sqrt(this.x*this.x + this.y*this.y);
	}


	sub(item)
	{
		return new Vector(this.x - item.x,this.y-item.y);
	}
	
	add(item)
	{
		return new Vector(this.x + item.x,this.y+item.y);
	}

	mul(item)
	{
		return new Vector(this.x*item,this.y*item);
	}
	
	normalized()
	{
		return  this.mul(1/this.mag());
	}
	clone()
	{
		return new Vector(this.x,this.y);
	}
	
		getRotateVector(angle)
	{
		return new Vector(Math.cos(angle)*this.x - Math.sin(angle)*this.y,Math.sin(angle)*this.x + Math.cos(angle)*this.y);
	}

}