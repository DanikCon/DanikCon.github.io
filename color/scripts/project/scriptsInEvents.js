import {scene} from './Main.js';
import {colors} from './Settings.js';



export function getScene()
{
	return scene;
}

export function getColors()
{
	return colors;
}

export	function getRandom(start,end)
	{
		const list = [];
		for(let i = start;i<=end;i++)
		{
			list.push(i);
		}
	
		const modifyList= [];
	
	
		while(list.length)
		{
			const index = rand(0,list.length);
			modifyList.push(list[index]);
			list.splice(index,1);
		}
		
	
		return modifyList;
		

	}
	
export	function lerp(x,y,val)
{
	const v = val>1?1:val<0?0:val;
	
	return x + (y-x)*v;
	
}


export function lerpArray(x,y,n)
{
	const list = [];
	for(let i=0;i<x.length;i++)
	{
		list.push(lerp(x[i],y[i],n));
	}
	
	return list;
}

export function max(x,y)
{
	return x > y ? x:y;
}


export function min(x,y)
{
	return x < y ? x:y;
}

export function rand(start,end)
{
	return Math.floor(Math.random()*(end-start)) + start;
}

export function clamp(val,min,max)
{

	return	val < min ? min : (val > max ? max : val);
}



const scriptsInEvents = {

		async Egame_Event9_Act1(runtime, localVars)
		{
			const gameManager = runtime.objects.GameManager.getFirstInstance();
			
			const spacing = 10;
			const colors = getColors();
			const width = (runtime.layout.width - spacing*(colors.length-1))/colors.length;
			
			const tileAspect = runtime.objects.Tile.getFirstInstance().width/ runtime.objects.Tile.getFirstInstance().height;
			
			const y = gameManager.instVars.LastY - runtime.globalVars.VTileDistance;
			
			const cols = getRandom(0,colors.length-1);
			
			for(let i=0;i<colors.length;i++)
			{
				const tile = runtime.objects.Tile.createInstance(0,(i+0.5)*width + spacing*i,y);
				tile.width = width;
				tile.height = width/tileAspect;
				tile.instVars.Color = cols[i];
				tile.colorRgb = colors[cols[i]];
			}
			
			gameManager.instVars.LastY = y;
			
		},

		async Egame_Event10_Act1(runtime, localVars)
		{
			const camera = runtime.objects.Camera.getFirstInstance();
			Array.from(runtime.objects.Tile.instances()).filter(item=>item.y > camera.y + runtime.layout.height*0.7).forEach(item=>item.destroy());
			Array.from(runtime.objects.ColorBar.instances()).filter(item=>item.y > camera.y + runtime.layout.height*0.7).forEach(item=>item.destroy());
			Array.from(runtime.objects.PerfectPoint.instances()).filter(item=>item.y > camera.y + runtime.layout.height*0.7).forEach(item=>item.destroy());
		},

		async Egame_Event11_Act1(runtime, localVars)
		{
			const gameManager = runtime.objects.GameManager.getFirstInstance();
			const y = gameManager.instVars.LastY - runtime.globalVars.VTileDistance;
			const colors = getColors();
			const colorBar = runtime.objects.ColorBar.createInstance(0,runtime.layout.width/2,y)
			const color = getRandom(0,colors.length-1)[0];
			
			colorBar.instVars.Color = color;
			colorBar.colorRgb = colors[color];
			gameManager.instVars.LastY = y;
			
			
		},

		async Egame_Event19_Act5(runtime, localVars)
		{
			const colors = getColors();
			const player = runtime.objects.Player.getFirstInstance();
			player.colorRgb = colors[player.instVars.Color]; 
			
		},

		async Egame_Event23_Act8(runtime, localVars)
		{
			const tile = runtime.getInstanceByUid(+runtime.globalVars.Temp);
			runtime.getInstanceByUid(tile.instVars.PerfectPointUID).destroy();
			const startY = tile.y;
			const peakY = startY + 70;
			const startColor = tile.colorRgb;
			const endColor = [1,1,1];
			const scene = getScene();
			
			scene.lerbAnim(3,0,1.5,n=>{
				tile.y = n<=0.5 ? lerp(startY,peakY,n/0.5) : lerp(peakY,startY,(n-0.5)/0.5);
				tile.colorRgb = n<=0.5 ? lerpArray(startColor,endColor,n/0.5) : lerpArray(endColor,startColor,(n-0.5)/0.5);
				
			});
			
			
		},

		async Egame_Event25_Act5(runtime, localVars)
		{
			const tile = runtime.getInstanceByUid(+runtime.globalVars.Temp);
			const perfectPoint = runtime.getInstanceByUid(tile.instVars.PerfectPointUID);
			
			const startY = tile.y;
			const peakY = startY + 10;
			const startColor = tile.colorRgb;
			const endColor = [.5,.5,.5];
			const perfectOffset = perfectPoint.y - startY;
			const scene = getScene();
			
			scene.lerbAnim(4,0,1.5,n=>{
				tile.y = n<=0.5 ? lerp(startY,peakY,n/0.5) : lerp(peakY,startY,(n-0.5)/0.5);
				tile.colorRgb = n<=0.5 ? lerpArray(startColor,endColor,n/0.5) : lerpArray(endColor,startColor,(n-0.5)/0.5);
				perfectPoint.y = tile.y + perfectOffset;
				
			});
			
			
		}

};

self.C3.ScriptsInEvents = scriptsInEvents;

