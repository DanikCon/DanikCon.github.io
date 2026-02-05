import {scene,levelProgresses,levelGroups,level,setLevelProgresses,loadGame,loadMenu} from "./Main.js";
import {levelGroupNames} from './Settings.js';


export let currentLevelTiles = []; 

function getScene(){
	return scene;
}

function getLevelProgresses()
{
	return levelProgresses;
}

function getLevelGroups()
{
	return levelGroups;
}

function getLevel()
{
	return level;
}

function setProgresses(progresses)
{
	setLevelProgresses(progresses);
}

function getLevelGroupNames()
{
	return levelGroupNames;
}

function LoadGame(runtime,lvl)
{
	loadGame(runtime,lvl);
}

function LoadMenu(runtime)
{
	loadMenu(runtime);
}


const scriptsInEvents = {

	async Emenu_Event3_Act1(runtime, localVars)
	{
		console.log("on start of layout");
		setProgresses(getLevelGroupNames().map(_=>0));
	},

	async Emenu_Event4_Act2(runtime, localVars)
	{
		
		getLevelProgresses()[0] = runtime.globalVars.temp ?runtime.globalVars.temp:0 ;
		
		console.log(levelProgresses);
	},

	async Emenu_Event5_Act2(runtime, localVars)
	{
		
		getLevelProgresses()[1] =  runtime.globalVars.temp ?runtime.globalVars.temp:0 ;
		
		
		console.log(levelProgresses);
	},

	async Emenu_Event6_Act2(runtime, localVars)
	{
		
		getLevelProgresses()[2] =  runtime.globalVars.temp ?runtime.globalVars.temp:0 ;
		console.log(levelProgresses);
	},

	async Emenu_Event18_Act1(runtime, localVars)
	{
		
		//runtime.objects.LevelText.instances().forEach(i=>i.destroy());
		//runtime.objects.LevelTileBG.instances().forEach(i=>i.destroy());
		console.log(runtime);
		
		currentLevelTiles.forEach(t=>{t.tile.destroy();t.text.destroy();});
		
		const levelPerRow = 5;
		const spacing = 30;
		const offsetTop = 150;
		// const currentLevelTiles =[];
		const levelGroup = getLevelGroups()[runtime.globalVars.SelectedLevelGroup];
		const levelProgresses = getLevelProgresses();
		
		const tileWidth = (runtime.layout.width - (levelPerRow+1)*spacing)/levelPerRow;
		
		console.log(tileWidth);
		
		for(let i=0;i<levelGroup.levels.length;i++)
		{
			const tile = runtime.objects.LevelTileBG.createInstance(2,0,0);
			const text = runtime.objects.LevelText.createInstance(2,0,0);
			
			text.text = (""+(i+1));
			const row = Math.floor((i)/levelPerRow);
			const col = i - levelPerRow*row;
			
			const x = (col+0.5)*tileWidth + spacing*(col+1);
			const y = (row+0.5)*tileWidth + spacing*(row+1) + offsetTop;
			tile.x = x;
			tile.y = y;
			tile.width = tileWidth;
			tile.height = tileWidth;
			
			
		text.width = tileWidth;
			text.height = tileWidth;
			text.x = x - tileWidth/2;
			text.y = y - tileWidth/2;
			text.width = tileWidth;
			text.height = tileWidth;
			tile.instVars.level = i+1;
			const locked = (levelProgresses[runtime.globalVars.SelectedLevelGroup] < i)?1:0;
			tile.instVars.locked = 	locked;
			
			if(levelProgresses[runtime.globalVars.SelectedLevelGroup]>i)
			{
				tile.setAnimation("Completed");
			}
			
			if(tile.instVars.locked===1)
			tile.setAnimation("Locked");
			console.log(levelProgresses[runtime.globalVars.SelectedLevelGroup] < i);
			
			
			currentLevelTiles.push({tile,text});
			
		}
		
		runtime.globalVars.MaxLevelPanelY = currentLevelTiles[currentLevelTiles.length-1].tile.y + tileWidth - runtime.layout.height/2;
		
		
		
		
		
		
		
		
		
		
	},

	async Emenu_Event20_Act3(runtime, localVars)
	{
		
		if(runtime.globalVars.SelectedLevel==-1)
		return;
		LoadGame(runtime,levelGroups[runtime.globalVars.SelectedLevelGroup].levels[runtime.globalVars.SelectedLevel-1]);
	},

	async Emenu_Event26_Act1(runtime, localVars)
	{
		currentLevelTiles = [];
	},

	async Egame_Event1_Act2(runtime, localVars)
	{
		scene.onClickHolder(runtime.getInstanceByUid(runtime.globalVars.temp));
	},

	async Egame_Event5_Act2(runtime, localVars)
	{
		runtime.objects.CompleteLevelTxt.getFirstInstance().text = "Level " + scene.level.no;
	},

	async Egame_Event5_Act5(runtime, localVars)
	{
		runtime.objects.NextLevelBtn.getFirstInstance().isVisible = levelGroups[runtime.globalVars.SelectedLevelGroup].levels[runtime.globalVars.SelectedLevel]
	},

	async Egame_Event8_Act2(runtime, localVars)
	{

	},

	async Egame_Event17_Act1(runtime, localVars)
	{
		runtime.globalVars.SelectedLevel++;
		LoadGame(runtime,levelGroups[runtime.globalVars.SelectedLevelGroup].levels[runtime.globalVars.SelectedLevel-1]);
	}
};

globalThis.C3.JavaScriptInEvents = scriptsInEvents;
