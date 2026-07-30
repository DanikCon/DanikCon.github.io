const C3 = self.C3;
self.C3_GetObjectRefTable = function () {
	return [
		C3.Plugins.Eponesh_GameScore,
		C3.Plugins.System.Cnds.OnLayoutStart,
		C3.JavaScriptInEvents.Game_Event1_Act1
	];
};
self.C3_JsPropNameTable = [
	{GamePush: 0}
];

self.InstanceType = {
	GamePush: class extends C3.Plugins.Eponesh_GameScore.Instance {}
}