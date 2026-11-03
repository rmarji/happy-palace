"""Generate fibery-app/src/{engine.ts,markup.ts,palace.css} from demo/index.html.
Run from the repo root: python3 tools/build_fibery_app.py
"""
import re,json
src=open('demo/index.html').read()
css=src.split('<style>')[1].split('</style>')[0]
css=css.replace('--display:"Bricolage Grotesque","Avenir Next","Segoe UI",system-ui,sans-serif;','--display:var(--font-sans,system-ui),sans-serif;').replace('--body:"Atkinson Hyperlegible","Verdana",system-ui,sans-serif;','--body:var(--font-sans,system-ui),sans-serif;')
markup=src.split('</style>')[1].split('<script src=')[0].replace('</head>','').replace('<body>','').strip()
js=src.split('<script>')[1].split('</script>')[0]
js=js.strip()
assert js.startswith('(function(){') and js.endswith('})();')
body=js[len('(function(){'):-len('})();')]
# queries
qs=body.index('const Q={'); qe=body.index('/* Example realm')
body=body[:qs]+'const Q=API.Q;\n\n'+body[qe:]
# write()
body=body.replace('if(!mcp)return;el.disabled=true;','if(!LIVE)return;el.disabled=true;')
body=body.replace('try{await mcp.callTool(SERVER,tool,input,{cache:false});','try{await API.write(tool,input);')
body=body.replace('try{await mcp.invalidate(SERVER);}catch(e){}','')
assert 'API.write' in body
# loader
ls=body.index('let mcp=null;')
loader=r'''let LIVE=false;
async function loadLive(){
  refreshBtn.disabled=true;
  try{
    const projects=await API.query(Q.projects());
    const [gr,mr,ar,ir,dr,sr]=await Promise.allSettled([API.query(Q.goals()),API.query(Q.missions()),API.query(Q.agents()),API.query(Q.ideas()),API.query(Q.doneWeek()),API.query(Q.scorecards())]);
    const val=(r,d)=>r.status==="fulfilled"?r.value:d;
    if(!projects.length){setSource("err","Fibery answered","No active projects came back from Personal OS, so the example palace stays up.");return;}
    LIVE=true;
    state.data={live:true,projects,goals:val(gr,[]).filter(g=>g.MAX!=="Out"),missions:val(mr,[]),agents:val(ar,[]).filter(a=>String(a.Status||"").toLowerCase()==="live"),ideas:val(ir,[]),doneWeek:val(dr,[]).length,scorecards:val(sr,[])};
    buildWorld(state.data);current=null;setXP(state.data.doneWeek);if(drawer.classList.contains("on"))renderMissions();
    const failed=[gr,mr,ar,ir,dr,sr].filter(r=>r.status==="rejected");
    if(failed.length)console.warn("Happy Palace: some sections failed",failed.map(r=>r.reason&&r.reason.message));
    setSource("live","Live from Fibery",`${projects.length} rooms · ${state.data.missions.length} missions · updated ${new Date().toLocaleTimeString([],{timeZone:CONFIG.timeZone,hour:"2-digit",minute:"2-digit"})}${failed.length?" · some sections could not load":""}`);
    refreshBtn.hidden=false;
  }catch(err){
    setSource("err","Fibery refused the query",String((err&&err.message)||err).slice(0,220));refreshBtn.hidden=false;
  }finally{refreshBtn.disabled=false;}
}
refreshBtn.addEventListener("click",()=>loadLive());
setSource("demo","Summoning Fibery","Reading your Personal OS…");
loadLive();
'''
body=body[:ls]+loader
body=body.replace('setSource("demo","Example realm","Showing an example palace. Open this page in Claude with the Fibery connector to walk your own.");','')
body=body.replace('THREE.CapsuleGeometry?new THREE.CapsuleGeometry(.45*s,.9*s,4,10):new THREE.CylinderGeometry','new THREE.CylinderGeometry')
engine='// @ts-nocheck\n/* Happy Palace world engine: ported from the Claude artifact. Runs once per page. */\nimport * as THREE from "three";\nlet started=false;\nexport function startPalace(API){\nif(started)return;started=true;\n'+body+'\n}\n'
import os
d='fibery-app/src'
open(d+'/palace.css','w').write(css)
open(d+'/markup.ts','w').write('export const MARKUP = '+json.dumps(markup)+';\n')
open(d+'/engine.ts','w').write(engine)
print(len(engine), 'mcp' in body.replace('mcp.','X'), body.count('mcp'))
