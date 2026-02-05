import MainScene from "./MainScene.js";
import WinParticles from './WinParticles.js';
import Holder from './Holder.js';
import Liquid from './Liquid.js';
import {levelGroupNames} from './Settings.js';
// Put any global functions etc. here

export let scene = null;
export let levelGroups = []; //all level groups


export let level = null;
//cache level tiles


export let levelProgresses = []; //level progress for each group

export function setLevelProgresses(progresses)
{
	levelProgresses = progresses;	
}

export function setCurrentLevelTiles(tiles)
{
	currentLevelTiles = tiles;
}

runOnStartup(async runtime =>
{
	// Code to run on the loading screen.
	// Note layouts, objects etc. are not yet available.
	runtime.objects.WinParticles.setInstanceClass(WinParticles);
	runtime.objects.holder.setInstanceClass(Holder);
	runtime.objects.Liquid.setInstanceClass(Liquid);

	runtime.getLayout("Game").addEventListener("beforelayoutstart",()=>{
		scene = new MainScene(runtime,level);
	
	});
	runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
	
});


export function loadGame(runtime,lvl)
{
	level= lvl;
	runtime.goToLayout("Game");

}

export function loadMenu(runtime)
{
	scene = null;
	runtime.goToLayout("Menu");
}

async function OnBeforeProjectStart(runtime)
{
	//load level groups
	for(const name of levelGroupNames)
	{
		const url = await runtime.assets.getProjectFileUrl(name+".json");
		const response = await fetch(url);
		const fetchedText = await response.text();
		levelGroups.push(JSON.parse(fetchedText));
		
	}

	runtime.addEventListener("tick", () => Tick(runtime));
}

function Tick(runtime)
{
	if(scene)
	{
		scene.update(runtime);
	}
}
