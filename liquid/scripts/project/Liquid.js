import {colors} from "./Settings.js";
import Vector from "./Vector.js";

export default class Liquid extends ISpriteInstance{
	
	
	constructor()
	{
		super();
		this.groupId = 0;
		this.unitSize = 120;
		this.renderer = this.runtime.objects.LiquidBody.createInstance(this.layer.index,this.x,this.y);
		
		this.addDefaultChild(this.renderer);
		
		this.renderer.relativeY = 0;
		this.bottomRenderer =null;
		this.isBottomLiquid = false;
		this.value = 1;
		this.front = false;
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
	
	setGroupId(id)
	{
		this.groupId = id;
		
		this.renderer.colorRgb = colors[id%colors.length];
	}

	
	size()
	{
		return this.value*this.unitSize;
	}
	

	
	setValue(value)
	{
		this.value = value;
		this.updateRenderers();
		
	}
	
	setBottomLiquid(bottom)
	{
		this.isBottomLiquid = bottom;
		this.updateRenderers();
	}
	
	updateRenderers()
	{
		if(this.isBottomLiquid)
		{
			this.updateRendererForBottomLiquid();
			
		}
		else
		{
			this.updateRendererForNonBottomLiquid();
		}
	}
	
	updateRendererForNonBottomLiquid()
	{
		if(this.bottomRenderer)
			{
				this.bottomRenderer.destroy();
			}
			
			this.renderer.height = Math.max(this.value*this.unitSize,0.01);
			this.renderer.relativeY = 0;
			this.renderer.y = this.y;
			
	}
	
	updateRendererForBottomLiquid()
	{
		if(!this.bottomRenderer)
			{
				this.bottomRenderer = this.runtime.objects.LiquidBottom.createInstance(this.layer.index,this.x,this.y);
				this.addDefaultChild(this.bottomRenderer);
				this.bottomRenderer.colorRgb = colors[this.groupId%colors.length];
				this.initialBottomRendererHeight = this.bottomRenderer.height;
				
			}
			
			if(this.value < this.initialBottomRendererHeight/this.unitSize)
			{
				
				this.renderer.isVisible = false;
				this.bottomRenderer.height = Math.max(this.unitSize*this.value,0.1);
				
			}
			else
			{
				const delta = 2;
				this.renderer.isVisible = true;
				this.bottomRenderer.height = this.initialBottomRendererHeight;
				
				this.renderer.height = Math.max(this.unitSize*this.value - this.initialBottomRendererHeight +delta,1);
				const pos = new Vector(0,-1).getRotateVector(this.angle).mul(this.bottomRenderer.height-delta).add(new Vector(this.x,this.y));
				this.renderer.y = pos.y;
				this.renderer.x = pos.x;
// 				this.renderer.relativeY = -this.bottomRenderer.height+delta;
			}
			
	}
	
// 	setXY(x,y)
// 	{
// 		this.x = x;
// 		this.y =y;
		
// 		this.updatePositions();
// 	}
	
// 	updatePositions()
// 	{
// 		this.renderer.y = this.y+this.renderer.relativeY;
// 		this.renderer.x = this.x;
		
// 		if(this.bottomRenderer)
// 		{
// 			this.bottomRenderer.x = this.x;
// 			this.bottomRenderer.y = this.y;
// 		}
// 	}
	
}


