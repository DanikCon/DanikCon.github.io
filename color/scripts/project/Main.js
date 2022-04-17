import Scene from './Scene.js';

export let scene = null;

runOnStartup(async runtime =>
{
	// Code to run on the loading screen.
	// Note layouts, objects etc. are not yet available.
	
	runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
	runtime.getLayout("Game").addEventListener("beforelayoutstart",()=>{
		scene = new Scene(runtime);
	
	});
});


function OnBeforeProjectStart(runtime)
{
	runtime.addEventListener("tick", () => Tick(runtime));
}

function Tick(runtime)
{
	if(scene)
	{
		scene.update(runtime);
	}
}