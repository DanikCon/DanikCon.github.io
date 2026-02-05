import Liquid from './Liquid.js';
import Vector from './Vector.js';
import {lerp} from './Utils.js';
import LerpAnim from './LerpAnim.js';
import LinearMoveAnim from './LinearAnim.js';

export default class Holder extends ISpriteInstance{

	
	constructor()
	{
		super();
		this.maxValue = 4;
		this.pending = false;
		this.front = false;
		
		this.liquids = [];
		this.transferOffset = new Vector(300,-200);
		this.originalPoint = new Vector(this.x,this.y);
		this.pendingPoint = new Vector(this.x,this.y-50);
		this.updatables = [];
	}
	
	getTopLiquid()
	{
		return this.liquids[this.liquids.length-1];
	}
	
	addDefaultChild(child)
	{
		this.addChild(child,{
			transformX:true,
			transformY:true,
			transformAngle:true,
			transformZElevation:true,
			transformWidth:true,
			transformHeight:true,
				destroyWithParent:true
		});
	}
	
	currentTotalValue()
	{
		return this.liquids.reduce((s,l)=>s+l.value,0);
	}
	
	update()
	{
		this.updatables.forEach(u=>u.update(this.runtime.dt));
	}
	
	addLiquid(groupId,value=0)
	{
		const topPoint = this.getTopPoint();
		
		const liquid = this.runtime.objects.Liquid.createInstance(this.layer.index,topPoint.x,topPoint.y);
		liquid.setGroupId(groupId);
		liquid.setValue(value);
		liquid.setBottomLiquid(this.liquids.length===0);
		this.addDefaultChild(liquid);
		this.liquids.push(liquid);
	}
	
	getTopPoint()
	{
		return new Vector(this.x,this.y).add(new Vector(0,-1).mul( this.liquids.reduce((s,l)=>s+l.size(),0)));
	}
	
	isFull()
	{
		return Math.round(this.liquids.reduce((s,l)=>s+l.value,0))>=this.maxValue;
	}

	
	tap()
	{
		if(this.pending)
		{
			this.startPending();
		}
		else
		{
			this.clearPending();
		}
	}
	
	init(liquidDatas)
	{
		liquidDatas.forEach(l=>this.addLiquid(l.groupId,l.value));
		this.originalPoint = new Vector(this.x,this.y);
		this.pendingPoint = this.originalPoint.add(new Vector(0,-50));
		
	}
	

	startPending()
	{
		if(this.pending)
			throw Error();
			
		this.pending = true;
		this.setFront(true);
		this.moveTo(this.pendingPoint,5);
	}
	
	clearPending()
	{
		if(!this.pending)
			throw Error();
			
		this.pending = false;
		this.setFront(false);
		this.moveTo(this.originalPoint,5);
	}
	
	setFront(isFront)
	{
		if(this.front === isFront)
		return;
		this.front = isFront;
		this.zElevation += this.front ? 0.1:-0.1;
	}
	
	async moveAndTransferLiquid(holder,onTransfered)
	{
		this.pending = false;
	
		
		if(holder.isFull() || !this.liquids.length ||holder.liquids.length && holder.liquids[holder.liquids.length-1].groupId !== this.liquids[this.liquids.length-1].groupId)
		return;
		
		await this.moveNearToHolderForTransfer(holder);
		
		const targetPositionAndAngle = this.getTargetPointAndAngleToDeliver(holder);
		
		const startPoint = new Vector(this.x,this.y);
		const startAngle = this.angle;
		
		const thisLiquid = this.getTopLiquid();
		
		await this.linearAnim(2,n=>{
			this.x = lerp(startPoint.x,targetPositionAndAngle.position.x,n);
			this.y = lerp(startPoint.y,targetPositionAndAngle.position.y,n);
			
			this.angle = lerp(startAngle,targetPositionAndAngle.angle,n);
		});
		
		
		const thisLiquidStartValue = thisLiquid.value;
		const transferValue = Math.min(thisLiquid.value,holder.maxValue - holder.currentTotalValue());
		
		if(holder.liquids.length===0)
		{
			holder.addLiquid(thisLiquid.groupId);
		}
		
		const targetLiquid = holder.getTopLiquid();
		const targetLiquidStartValue = targetLiquid.value;
		const liquidLine = this.runtime.objects.LiquidLine.getFirstInstance();
		const sidePoint = this.isRightSide(holder) ? this.getImagePointPosition(2):this.getImagePointPosition(1);
		liquidLine.colorRgb = targetLiquid.renderer.colorRgb;
		liquidLine.x = sidePoint.x;
		liquidLine.y = sidePoint.y;
		liquidLine.isVisible = true;
		this.startPlaySound('transfer');
		await this.linearAnim(5,n=>{
			thisLiquid.setValue(lerp(thisLiquidStartValue,thisLiquidStartValue-transferValue,n));
			targetLiquid.setValue(lerp(targetLiquidStartValue,targetLiquidStartValue+transferValue,n));
			
		});
		
		if(thisLiquid.value<=0.05)
		{
			this.liquids.splice(this.liquids.indexOf(thisLiquid),1);
			thisLiquid.destroy();
		}
		else
		{
			thisLiquid.setValue(Math.round(thisLiquid.value));
		}
		this.StopPlaySound('transfer');
		liquidLine.isVisible = false;
		targetLiquid.setValue(Math.round(targetLiquid.value));
		if(onTransfered)onTransfered();
		await this.linearAnim(2,n=>{
			this.x = lerp(targetPositionAndAngle.position.x,startPoint.x,n);
			this.y = lerp(targetPositionAndAngle.position.y,startPoint.y,n);
			this.angle = lerp(targetPositionAndAngle.angle,startAngle,n);
		});
		
		await this.returnToOriginalPoint();
		this.setFront(false);
	}
	
	getImagePointPosition(index)
	{
		return new Vector(this.getImagePointX(index),this.getImagePointY(index));
	}
	
	isRightSide(holder)
	{
		return holder.x>this.x;
	}
	
	getTargetPointAndAngleToDeliver(holder)
	{
		const deliverAbsAngle = 82*Math.PI/180;
		const deliverTopPoint = new Vector(holder.x,holder.y-holder.height-50);
		
				const isRightSide = this.isRightSide(holder);
		const sidePoint = isRightSide ? this.getImagePointPosition(2) : this.getImagePointPosition(1);
		
		const deliverAngle = isRightSide ?deliverAbsAngle : -deliverAbsAngle;
		
		
		const relativePoint = new Vector(this.x,this.y).sub(sidePoint);
		const rotatedRelativePoint = relativePoint.getRotateVector(deliverAngle);
		
		
		const targetHolderPoint = rotatedRelativePoint.add(deliverTopPoint);
		
		return {position:targetHolderPoint,angle:deliverAngle};
	}
	
	async moveNearToHolderForTransfer(holder)
	{
		const targetPoint = new Vector(holder.x,holder.y).add(this.x>holder.x?this.transferOffset.clone():new Vector(-this.transferOffset.x,this.transferOffset.y));
		const speed = this.getSpeedForDistance(new Vector(this.x,this.y).sub(targetPoint).mag());
		
		await this.moveTo(targetPoint,speed);
		
		
	}
	
	async moveTo(toPoint,speed)
	{
		const startPoint = new Vector(this.x,this.y);
		await this.linearAnim(speed,n=>{
			this.x = lerp(startPoint.x,toPoint.x,n);
			this.y = lerp(startPoint.y,toPoint.y,n);
			
		});
	}
	
	async returnToOriginalPoint()
	{
		const speed = this.getSpeedForDistance(new Vector(this.x,this.y).sub(this.originalPoint).mag());
		await this.moveTo(this.originalPoint,Math.max(speed,3));
	}
	
	getSpeedForDistance(distance)
	{
		return Math.max(500/distance,4);
	}
	
			startPlaySound(name)
	{
	if(!this.runtime.globalVars.Sound)
	return;
		const ist = this.runtime.objects.SoundEffect.createInstance(0,0,0);
		ist.instVars.Name = name;
		ist.instVars.Message = "Start";
		ist.destroy();
	}
	
			StopPlaySound(name)
	{
	if(!this.runtime.globalVars.Sound)
	return;
		const ist = this.runtime.objects.SoundEffect.createInstance(0,0,0);
		ist.instVars.Name = name;
		ist.instVars.Message = "Stop";
		ist.destroy();
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