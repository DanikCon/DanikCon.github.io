runOnStartup(async runtime =>
{
  runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
});

async function OnBeforeProjectStart(runtime)
{
  runtime.addEventListener("tick", () => Tick(runtime));
  C3.CanvasManager.prototype.GetDocumentFullscreenMode = function () {return "scale-outter";}
}

function Tick(runtime)
{
  C3.CanvasManager.prototype.GetDocumentFullscreenMode = function () {return "scale-outter";}
}