import {lerp,randFloat,rand,clamp,max} from './Utils.js';
import Holder from "./Holder.js";
import Vector from './Vector.js';



export default class MainScene{


	constructor(runtime,level)
	{
		this.runtime = runtime;
		this.minXDistanceBetweenHolders = 250;
		this.holders=[];
		this.level = level;
		
		//update level txt
		const lvlTxt = runtime.objects.GameLevelTxt.getFirstInstance();
		lvlTxt.text = "LEVEL "+level.no;
		
		//get positions for holders
		const pos = this.calculatePositionsForHolders(level.map.length);
		runtime.globalVars.ExpectWidth = pos.expectWidth;
		
		//instiate the holders and balls
		for(let i =0;i<level.map.length;i++)
		{
			const liquidDatas = MainScene.levelColumnToLevelData(level.map[i].values);
			const holder = runtime.objects.holder.createInstance(0,0,0);
			const point = pos.positions[i];
			holder.x = point.x;
			holder.y = point.y;
			
			holder.init(liquidDatas);
			this.holders.push(holder);
		}
		
		this.runtime.globalVars.GameState = "playing";
		
	}
	
	static levelColumnToLevelData(column)
	{
		const list = [];
		
		for(let i=0;i<column.length;i++)
		{
			const currentGroup =column[i];
			var count = 0;
			
			for(;i<column.length;i++)
			{
				if(currentGroup == column[i])
					count++
				else
				{
					i--;
					break;
				}
			}
			
			list.push({groupId:currentGroup,value:count});
		}
		
		return list;
	}
	
	//on click the holder - call by event script
	async onClickHolder(holder)
	{
		
		
		if(this.runtime.globalVars.GameState!=="playing")
		return;
	
		//if ball can move then move the ball otherwise toggle the pending
		const pendingHolder = this.holders.find(h=>h.pending);
		
		if(pendingHolder && pendingHolder != holder)
		{
			const topLiquid = holder.getTopLiquid();
			
			if(topLiquid==null || (pendingHolder.getTopLiquid().groupId === topLiquid.groupId && !holder.isFull()))
			{
				pendingHolder.moveAndTransferLiquid(holder,()=>this.checkAndGameOver());
			}
			else
			{
			
				
				this.playSoundEffect("pop_sound_effect");
				pendingHolder.clearPending();
				holder.startPending();
			}
		}
		else{
			if(holder.liquids.length)
			{
				if(!holder.pending)
				holder.startPending();
				else
				holder.clearPending();
				
				this.playSoundEffect("pop_sound_effect");
			}
		}
	}
	
			//Play sound effect
	playSoundEffect(name)
	{
	if(!this.runtime.globalVars.Sound)
	return;
		const ist = this.runtime.objects.SoundEffect.createInstance(0,0,0);
		ist.instVars.Name = name;
		ist.destroy();
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
	
	checkAndGameOver()
	{
	

	
		if(this.holders.filter(h=>h.liquids.length).every(h=>h.isFull() && h.liquids.length==1))
		{
			this.overTheGame();
		}
		
	}
	

	
	async overTheGame()
	{
		
		this.runtime.globalVars.GameState = "over";
		this.playSoundEffect("Correct");
this.runtime.objects.WinParticles.createInstance(0,this.runtime.layout.width/2,500).simulate();
		
		
		//update local storage for completed level if needed
		const lastCompletedLevel =  await this.runtime.storage.getItem("LevelProgress_"+this.runtime.globalVars.SelectedLevelGroup);
		
		if(lastCompletedLevel<this.runtime.globalVars.SelectedLevel)
		{
		await this.runtime.storage.setItem("LevelProgress_"+this.runtime.globalVars.SelectedLevelGroup, this.runtime.globalVars.SelectedLevel);
		}
		this.sendEvent("GameOver");
		

		
	}
	
	loadNextLevel()
	{
		
	}
	
	//send the event to event sheet
	sendEvent(name)
	{
		const event = this.runtime.objects.SimpleEvent.createInstance(0,0,0);
		event.instVars.Name = name;
		event.destroy();
	}
	

	
	update(runtime)
	{
		for(const inst of runtime.objects.WinParticles.instances())
		{
			inst.update();
		}
		
		for(const inst of runtime.objects.holder.instances())
		{
			inst.update();
		}
	}
	
	
	//get the positions for holder based on count
	calculatePositionsForHolders(count)
	{
		let expectWidth = 4*this.minXDistanceBetweenHolders;
		const midPoint = new Vector(this.runtime.layout.width/2,this.runtime.layout.height/2)
		if(count<6)
		{
			const minPoint = midPoint.sub(new Vector(1,0).mul(this.minXDistanceBetweenHolders *(count-1)/2)).add(new Vector(0,1).mul(160));
			
			expectWidth = max((count+.5)*this.minXDistanceBetweenHolders,expectWidth);
			
			return { positions : [...Array(count).keys()].map( i=>{
			
			return minPoint.add(new Vector(1,0).mul(i*this.minXDistanceBetweenHolders));}),
			expectWidth : expectWidth
			}
		}
		
// 		const aspect = this.runtime.layout.width/this.runtime.layout.height;
		const maxCountInRow = Math.ceil(count/2);
		
		if((maxCountInRow+1)*this.minXDistanceBetweenHolders>expectWidth)
		{
			 expectWidth = max((maxCountInRow + 1) * this.minXDistanceBetweenHolders,this.runtime.layout.width);
		}
		
// 		const height = expectWidth/aspect;
		
		const list = [];
		const topRowMinPoint = midPoint.sub(new Vector(0,1).mul(this.runtime.layout.height/5.5)).sub(new Vector(1,0).mul((maxCountInRow-1)*this.minXDistanceBetweenHolders/2)).add(new Vector(0,1).mul(250));
		
		list.push(...[...Array(maxCountInRow).keys()].map( i=>{
			
			return topRowMinPoint.add(new Vector(1,0).mul(i*this.minXDistanceBetweenHolders));}));
			
				const lowRowMinPoint = midPoint.add(new Vector(0,1).mul(this.runtime.layout.height/4.5)).sub(new Vector(1,0).mul((count - maxCountInRow-1)*this.minXDistanceBetweenHolders/2)).add(new Vector(0,1).mul(250));
		
		
		list.push(...[...Array(count - maxCountInRow).keys()].map( i=>{
			
			return lowRowMinPoint.add(new Vector(1,0).mul(i*this.minXDistanceBetweenHolders));}));
			
		return {
		positions:list,
		expectWidth:expectWidth
		};
		
	}
}