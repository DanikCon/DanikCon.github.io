
export let levelGroupNames = ["easy","normal","hard"];//name for files




const colorHexs = [
	"8CBEB2",
	"F2EBBF",
	"F3B562",
	"F01B1E",
	"5C4B51",
	"F06060",
	"00BBC9",
	"00747C",
	"A47859",
	"8C0303",
	"F2D3AC",
];

export let colors = colorHexs.map(h=>hEXToVBColor(h));

function hEXToVBColor(rrggbb) {
    const b = rrggbb.substr(4, 2);
	const g = rrggbb.substr(2,2);
	const r = rrggbb.substr(0,2);
	
	
    return [parseInt(r, 16)/255,parseInt(g,16)/255,parseInt(b,16)/255];
}