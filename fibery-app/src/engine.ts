// @ts-nocheck
/* Happy Palace world engine: ported from the Claude artifact. Runs once per page. */
import * as THREE from "three";
let started=false;
export function startPalace(API){
if(started)return;started=true;

"use strict";
/* ===== CONFIG: make it yours ===== */
const CONFIG={
  timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||"UTC", /* e.g. "Asia/Tokyo" */
  cityLabel:null,                         /* e.g. "Tokyo"; defaults to the time zone's city */
  places:[["Home",.3,0xd9826a],["First job",-.9,0xf2a93b],["Big move",1.4,0x3d86e0],["Favourite trip",-2.2,0x34d39a],["Next city",2.6,0x8a5cd6]],
  placesNote:"Edit CONFIG.places at the top of the script to list the places that shaped you."
};
const reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const SERVER="Fibery";

/* ---------- queries ---------- */
const Q=API.Q;

/* Example realm shown until live data arrives. Every name says Example. */
const DEMO={live:false,
  goals:[{Name:"Example: Income landed",MAX:"Slot 1",Metric:"Example metric: recurring monthly income"},{Name:"Example: Ship something every week",MAX:"Slot 2",Metric:"Example metric: one public post per week"},{Name:"Example: Health measured",MAX:"Life"}],
  projects:[
    {Name:"Example: Job search",State:"Active",Area:"Career",Goal:"Example: Income landed",Open:12,Agents:[{Name:"Scout"}],Next:"Example: reply to two recruiters"},
    {Name:"Example: Portfolio refresh",State:"Next Up",Area:"Career",Goal:"Example: Income landed",Open:3,Agents:[]},
    {Name:"Example: Advisory lead",State:"Active",Area:"Revenue",Goal:"Example: Income landed",Open:5,Agents:[{Name:"Closer"}]},
    {Name:"Example: Weekly newsletter",State:"Next Up",Area:"Telling",Goal:"Example: Ship something every week",Open:2,Agents:[{Name:"Scribe"}],ShipGate:"Told"},
    {Name:"Example: Server upkeep",State:"Maintenance",Area:"Engine Room",Open:0,Agents:[{Name:"Watchdog"}]},
    {Name:"Example: Side app",State:"Next Up",Area:null,Open:7,Agents:[]}],
  missions:[
    {Name:"Example: Send two applications",State:"Todo",Project:"Example: Job search",Priority:"P1",Due:null,GoalP:"Slot 1 · Active"},
    {Name:"Example: Draft the newsletter",State:"In Progress",Project:"Example: Weekly newsletter",Priority:"P2",Delegate:"Scribe",GoalP:"Slot 2 · Active"},
    {Name:"Example: Rotate server keys",State:"Todo",Project:"Example: Server upkeep",Priority:"P3",GoalP:"No goal"}],
  scorecards:[
    {Name:"Example: Income sprint",Area:"Career",Score:38,Off:2,Goal:"Example: Income landed",Metrics:[{Name:"Example: applications per week",Status:"Off",Att:20,Val:1,Target:5,Trend:"▼"},{Name:"Example: conversations per week",Status:"At risk",Att:80,Val:4,Target:5,Trend:"▲"},{Name:"Example: interview loops",Status:"On track",Att:100,Val:2,Target:2,Trend:"▬"}]},
    {Name:"Example: Ship Gate",Area:"Telling",Score:100,Off:0,Metrics:[{Name:"Example: tells per week",Status:"On track",Att:100,Val:1,Target:1,Trend:"▬"}]},
    {Name:"Example: Revenue health",Area:"Revenue",Score:62,Off:1,Metrics:[{Name:"Example: proposals per week",Status:"At risk",Att:50,Val:1,Target:2,Trend:"▬"},{Name:"Example: pipeline value",Status:"On track",Att:100,Val:12,Target:10,Trend:"▲"}]}],
  agents:[],ideas:[{Name:"Example: a game world for my agents"},{Name:"Example: a podcast"},{Name:"Example: a pottery class"}],doneWeek:3
};

/* ---------- payload parsing ---------- */
function splitCsv(line){const out=[];let cur="",q=false;for(let i=0;i<line.length;i++){const c=line[i];if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++;}else q=false;}else cur+=c;}else if(c==='"')q=true;else if(c===','){out.push(cur);cur="";}else cur+=c;}out.push(cur);return out.map(s=>s.trim());}
function parseTable(text){const lines=String(text).split("\n");for(let i=0;i<lines.length;i++){const m=lines[i].match(/result\[(\d+)\]\{([^}]*)\}:/);if(!m)continue;const f=m[2].split(",");const rows=[];for(let j=i+1;j<lines.length&&rows.length<+m[1];j++){const l=lines[j].trim();if(!l)break;const v=splitCsv(l);const o={};f.forEach((k,n)=>{let x=v[n];if(x==="null"||x===undefined)x=null;else if(x==="true"||x==="false")x=x==="true";else if(/^-?\d+(\.\d+)?$/.test(x))x=+x;o[k]=x;});rows.push(o);}return rows;}return [];}
function payloadOf(res){let p=res&&res.payload;if(p==null&&res&&Array.isArray(res.content)){const t=res.content.find(b=>b.type==="text");p=t?t.text:null;}if(typeof p==="string"){try{p=JSON.parse(p);}catch(e){return {__text:p};}}return p;}
function rowsFrom(res){const p=payloadOf(res);if(!p)return [];if(p.__text)return parseTable(p.__text);if(Array.isArray(p.result))return p.result;if(typeof p.result==="string")return parseTable(p.result);if(Array.isArray(p))return p;return [];}
function countFrom(res){const p=payloadOf(res);if(!p)return 0;if(typeof p.result==="number")return p.result;if(p.__text){const m=p.__text.match(/result:\s*(\d+)/);return m?+m[1]:0;}return 0;}

/* ---------- renderer ---------- */
const canvas=document.getElementById("stage");
const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,1,.1,900);
scene.fog=new THREE.Fog(0xcfe8ff,90,330);

/* sky dome */
const skyU={top:{value:new THREE.Color(0x3d9bff)},bottom:{value:new THREE.Color(0xd8efff)}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(500,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:"varying vec3 vP;void main(){vP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vP,1.);}",
  fragmentShader:"uniform vec3 top;uniform vec3 bottom;varying vec3 vP;void main(){float h=normalize(vP).y;gl_FragColor=vec4(mix(bottom,top,pow(max(h,0.),.55)),1.);}"}));
scene.add(sky);
/* stars */
const starGeo=new THREE.BufferGeometry();const sp=[];for(let i=0;i<900;i++){const u=Math.random()*Math.PI*2,v=Math.random()*.9+.08;sp.push(Math.cos(u)*Math.cos(v)*480,Math.sin(v)*480,Math.sin(u)*Math.cos(v)*480);}
starGeo.setAttribute("position",new THREE.Float32BufferAttribute(sp,3));
const stars=new THREE.Points(starGeo,new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,opacity:0,fog:false}));scene.add(stars);
const sunDisk=new THREE.Mesh(new THREE.SphereGeometry(14,20,14),new THREE.MeshBasicMaterial({color:0xfff2c4,fog:false}));scene.add(sunDisk);

const hemi=new THREE.HemisphereLight(0xcfe8ff,0xb98f6a,1);scene.add(hemi);
const sunLight=new THREE.DirectionalLight(0xffffff,1.3);sunLight.castShadow=true;sunLight.shadow.mapSize.set(2048,2048);sunLight.shadow.bias=-.0004;if("normalBias" in sunLight.shadow)sunLight.shadow.normalBias=.04;
Object.assign(sunLight.shadow.camera,{left:-130,right:130,top:130,bottom:-130,far:500});scene.add(sunLight);scene.add(sunLight.target);

/* time of day: keyframes by local hour */
const KF=[
 {h:0,  top:0x0b1030,bot:0x23285a,sun:0x9fb2ff,si:.35,hs:0x46508a,hg:0x1a1630,hi:.45,night:1},
 {h:5,  top:0x1b2050,bot:0x6a5486,sun:0xb0a0ff,si:.35,hs:0x6a6aa0,hg:0x2a2030,hi:.5,night:.85},
 {h:6.5,top:0x6aa0e0,bot:0xffb38a,sun:0xffc08a,si:.9, hs:0xffd2b0,hg:0x8a6a5a,hi:.8,night:.2},
 {h:9,  top:0x4fa3ff,bot:0xcfe8ff,sun:0xfff1d6,si:1.3,hs:0xdff0ff,hg:0xc8a07a,hi:1.0,night:0},
 {h:13, top:0x3d9bff,bot:0xd8efff,sun:0xffffff,si:1.45,hs:0xe6f4ff,hg:0xd0a880,hi:1.1,night:0},
 {h:17, top:0x5c9de8,bot:0xffd6a0,sun:0xffc078,si:1.2,hs:0xffe2c0,hg:0xb88a6a,hi:.95,night:0},
 {h:19, top:0x4a4a8c,bot:0xff8f70,sun:0xff8a5c,si:.6, hs:0xd6a0b0,hg:0x5a3a4a,hi:.7,night:.45},
 {h:21, top:0x141a40,bot:0x30306a,sun:0x9fb2ff,si:.35,hs:0x50589a,hg:0x1e1834,hi:.5,night:.95},
 {h:24, top:0x0b1030,bot:0x23285a,sun:0x9fb2ff,si:.35,hs:0x46508a,hg:0x1a1630,hi:.45,night:1}];
const cA=new THREE.Color(),cB=new THREE.Color();
function lerpC(a,b,t,out){cA.setHex(a);cB.setHex(b);return out.copy(cA).lerp(cB,t);}
let nightF=0;
let lamps=[];
function phaseName(h){return h<5?"Night":h<7?"Dawn":h<11?"Morning":h<14?"Midday":h<17?"Afternoon":h<19.5?"Golden hour":h<21?"Dusk":"Night";}
function applySky(){
  const now=new Date();const TZ=CONFIG.timeZone;
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour:"numeric",minute:"numeric",hourCycle:"h23"}).formatToParts(now).map(p=>[p.type,p.value]));
  const h=(+parts.hour%24)+(+parts.minute)/60;
  let i=0;while(i<KF.length-2&&KF[i+1].h<=h)i++;
  const a=KF[i],b=KF[i+1],t=(h-a.h)/(b.h-a.h);
  lerpC(a.top,b.top,t,skyU.top.value);lerpC(a.bot,b.bot,t,skyU.bottom.value);
  nightF=a.night+(b.night-a.night)*t;const dimF=.6+.4*nightF; /* daylight was blowing out pale stone */
  lerpC(a.sun,b.sun,t,sunLight.color);sunLight.intensity=(a.si+(b.si-a.si)*t)*dimF;
  lerpC(a.hs,b.hs,t,hemi.color);lerpC(a.hg,b.hg,t,hemi.groundColor);hemi.intensity=(a.hi+(b.hi-a.hi)*t)*dimF;
  scene.fog.color.copy(skyU.bottom.value);
  const day=h>=6&&h<18.5;
  const ang=((h-6)/12.5)*Math.PI;            /* sun arc east to west */
  const el=day?Math.sin(ang):Math.sin(((h+24-18.5)%24)/11.5*Math.PI); /* moon arc at night */
  const az=day?ang:((h+24-18.5)%24)/11.5*Math.PI;
  const dir=new THREE.Vector3(Math.cos(az)*Math.cos(el*1.1),Math.max(.12,el),-.35).normalize();
  sunLight.position.copy(dir).multiplyScalar(220);
  sunDisk.position.copy(dir).multiplyScalar(440);
  sunDisk.material.color.setHex(day?0xfff2c4:0xeef0ff);sunDisk.scale.setScalar(day?1:.6);
  stars.material.opacity=Math.max(0,nightF-.2)*.95;
  lamps.forEach(l=>{l.base=nightF;});
  document.documentElement.dataset.sky=nightF>.5?"night":"day";
  document.getElementById("clock").textContent=`${phaseName(h)} in ${CONFIG.cityLabel||String(TZ).split("/").pop().replace(/_/g," ")} · ${now.toLocaleTimeString([],{timeZone:TZ,hour:"2-digit",minute:"2-digit"})}`;
}

/* ground: warm sand courtyard with a grass meadow beyond */
function tileTex(base,line,n=4){const c=document.createElement("canvas");c.width=c.height=256;const g=c.getContext("2d");g.fillStyle=base;g.fillRect(0,0,256,256);const s=256/n;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const off=(y%2)*s/2;g.fillStyle=`rgba(255,255,255,${Math.random()*.08})`;g.fillRect(x*s+off,y*s,s-2,s-2);}g.strokeStyle=line;g.lineWidth=2;for(let y=0;y<=n;y++){g.beginPath();g.moveTo(0,y*s);g.lineTo(256,y*s);g.stroke();}for(let y=0;y<n;y++)for(let x=0;x<=n;x++){const off=(y%2)*s/2;g.beginPath();g.moveTo(x*s+off,y*s);g.lineTo(x*s+off,y*s+s);g.stroke();}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;return t;}
function grassTex(){const c=document.createElement("canvas");c.width=c.height=256;const g=c.getContext("2d");g.fillStyle="#8fcf6a";g.fillRect(0,0,256,256);
  for(let i=0;i<1800;i++){const v=Math.random();g.fillStyle=v<.5?`rgba(118,186,88,${.12+Math.random()*.14})`:v<.95?`rgba(165,214,120,${.1+Math.random()*.14})`:`rgba(255,246,190,.35)`;const x=Math.random()*256,y=Math.random()*256;g.beginPath();g.ellipse(x,y,1.5+Math.random()*2.5,3+Math.random()*4,Math.random()*3,0,Math.PI*2);g.fill();}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(60,60);t.anisotropy=8;t.encoding=THREE.sRGBEncoding;return t;}
const meadow=new THREE.Mesh(new THREE.CircleGeometry(600,48),new THREE.MeshStandardMaterial({map:grassTex(),roughness:1}));
meadow.rotation.x=-Math.PI/2;meadow.receiveShadow=true;scene.add(meadow);
const courtTex=tileTex("#f1dcc0","#dcc0a0");courtTex.repeat.set(26,26);
let court=null;

/* labels */
function label(text,{size=1,ink="#2a2233",bg="rgba(255,250,240,.92)",font="800 62px 'Bricolage Grotesque', sans-serif",maxW=1000}={}){
  const c=document.createElement("canvas");const g=c.getContext("2d");g.font=font;const w=Math.min(maxW,Math.ceil(g.measureText(text).width)+56);c.width=w;c.height=110;
  g.font=font;g.textAlign="center";g.textBaseline="middle";
  if(bg){g.fillStyle=bg;g.beginPath();if(g.roundRect)g.roundRect(4,10,w-8,90,45);else g.rect(4,10,w-8,90);g.fill();}
  g.fillStyle=ink;g.fillText(text,w/2,57,w-40);
  const t=new THREE.CanvasTexture(c);t.minFilter=THREE.LinearFilter;t.encoding=THREE.sRGBEncoding;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(size*w/110,size,1);return s;
}
const M={
  sandstone:new THREE.MeshStandardMaterial({color:0xe8a98a,roughness:.85}),
  sandstoneDeep:new THREE.MeshStandardMaterial({color:0xc97a62,roughness:.9}),
  plinth:new THREE.MeshStandardMaterial({color:0xf6ead8,roughness:.7}),
  skin:new THREE.MeshStandardMaterial({color:0xe8c4a0,roughness:.6}),
  water:new THREE.MeshStandardMaterial({color:0x5cc6e8,roughness:.15,metalness:.1,transparent:true,opacity:.85}),
  wood:new THREE.MeshStandardMaterial({color:0x9a6a44,roughness:.9}),
  gold:new THREE.MeshStandardMaterial({color:0xf2b84b,metalness:.6,roughness:.3,emissive:0x5a3a00})
};
const CRYSTAL={"Active":{c:0x34d39a,e:0x1a9a68},"Next Up":{c:0x8fb8ff,e:0x3a5aa8},"Maintenance":{c:0xc9c3d6,e:0x5a5468}};
const TINT={"Slot 1":0x3d86e0,"Slot 2":0x8a5cd6,"Slot 3":0x2ab7a9,"Life":0xf2a93b,"none":0xd9826a,"attic":0xa79bb2};
const PENNANT=[0xf25c54,0xf2a93b,0xf7d35a,0x34d39a,0x3d86e0,0x8a5cd6];

let world=new THREE.Group();scene.add(world);
let interactables=[],rooms=[],spinners=[],bobbers=[],pulsers=[],FOCUS={},OVERDUE={},focusList=[],guideIx=0;
let state={data:DEMO};
let ringRadius=60;

function figure(color,s=1){const g=new THREE.Group();const mat=new THREE.MeshStandardMaterial({color,roughness:.6});
  const body=new THREE.Mesh(new THREE.CylinderGeometry(.45*s,.55*s,1.6*s,12),mat);body.position.y=1*s;body.castShadow=true;g.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.36*s,16,12),M.skin);head.position.y=2.05*s;head.castShadow=true;g.add(head);
  return g;}
function lamp(x,z,color=0xffc870){const g=new THREE.Group();g.position.set(x,0,z);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.12,.16,3,8),M.wood);post.position.y=1.5;post.castShadow=true;g.add(post);
  const glow=new THREE.Mesh(new THREE.SphereGeometry(.42,14,10),new THREE.MeshStandardMaterial({color:0xfff0c8,emissive:color,emissiveIntensity:.2}));glow.position.y=3.2;g.add(glow);
  const pl=new THREE.PointLight(color,0,22,2);pl.position.y=3.2;g.add(pl);
  lamps.push({pl,glow,base:nightF});world.add(g);}
function pennantString(a,b,y){const n=10;for(let i=1;i<n;i++){const t=i/n;const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;const sag=Math.sin(t*Math.PI)*.8;
  const f=new THREE.Mesh(new THREE.ConeGeometry(.35,.8,3),new THREE.MeshStandardMaterial({color:PENNANT[i%PENNANT.length],roughness:.7,side:THREE.DoubleSide}));
  f.position.set(x,y-sag,z);f.rotation.x=Math.PI;world.add(f);bobbers.push({o:f,base:f.position.y,ph:i});}}
function gm(goals){const m={};(goals||[]).forEach(g=>{m[g.Name]=g.MAX;});return m;}
function rank(s){return {"Slot 1":0,"Slot 2":1,"Slot 3":2,"Life":3}[s]??4;}

/* ---------- refined building blocks ---------- */
function rbox(w,h,d,r=.18){r=Math.min(r,w/2-.01,h/2-.01,d/2-.01);const sh=new THREE.Shape();const x=-w/2+r,y=-h/2+r,ww=w-2*r,hh=h-2*r;
  sh.moveTo(x,y-r);sh.lineTo(x+ww,y-r);sh.quadraticCurveTo(x+ww+r,y-r,x+ww+r,y);sh.lineTo(x+ww+r,y+hh);sh.quadraticCurveTo(x+ww+r,y+hh+r,x+ww,y+hh+r);sh.lineTo(x,y+hh+r);sh.quadraticCurveTo(x-r,y+hh+r,x-r,y+hh);sh.lineTo(x-r,y);sh.quadraticCurveTo(x-r,y-r,x,y-r);
  const geo=new THREE.ExtrudeGeometry(sh,{depth:d-2*r,bevelEnabled:true,bevelThickness:r,bevelSize:r*.6,bevelSegments:3,curveSegments:5});geo.translate(0,0,-(d-2*r)/2);return geo;}
function mat(color,o={}){return new THREE.MeshStandardMaterial(Object.assign({color,roughness:.75},o));}
function add(parent,geo,material,x=0,y=0,z=0,cast=true){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;parent.add(m);return m;}
function stripeTex(a,b,n=8){const c=document.createElement("canvas");c.width=128;c.height=8;const g=c.getContext("2d");for(let i=0;i<n;i++){g.fillStyle=i%2?b:a;g.fillRect(i*128/n,0,128/n,8);}const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;return t;}
function gableRoof(w,d,h,color){const g=new THREE.CylinderGeometry(.01,1,1,4,1);g.rotateY(Math.PI/4);const m=new THREE.Mesh(g,mat(color,{roughness:.55,flatShading:true}));m.scale.set(w*.72,h,d*.72);m.castShadow=true;return m;}
function treeAt(parent,x,z,s=1,hue=0x5fb35a){const t=new THREE.Group();t.position.set(x,0,z);parent.add(t);add(t,new THREE.CylinderGeometry(.18*s,.26*s,1.6*s,7),M.wood,0,.8*s,0);
  const cm=mat(hue,{roughness:.8,flatShading:true});add(t,new THREE.IcosahedronGeometry(1.1*s,0),cm,0,2.2*s,0);add(t,new THREE.IcosahedronGeometry(.8*s,0),cm,.5*s,2.9*s,.2*s);return t;}

/* which landmark a Life Area gets, from its name */
function themeOf(name){const n=String(name||"").toLowerCase();
  if(/health|environment/.test(n))return "garden";
  if(/partner|family/.test(n))return "hearth";
  if(/market|telling|social/.test(n))return "stage";
  if(/money|finance|legal/.test(n))return "treasury";
  if(/revenue|sales|offer|product/.test(n))return "market";
  if(/operation|system|admin|engine/.test(n))return "workshop";
  if(/venture|trading/.test(n))return "observatory";
  if(/growth|learn|reading/.test(n))return "library";
  if(/career|client|delivery/.test(n))return "guild";
  if(/leisure|travel/.test(n))return "pavilion";
  return "pavilion";}
const THEME_NAME={garden:"Garden",hearth:"Hearth",stage:"Amphitheatre",treasury:"Treasury",market:"Bazaar",workshop:"Workshop",observatory:"Observatory",library:"Library",guild:"Guild Hall",pavilion:"Pavilion"};
const THEME_FLOOR={garden:0xd7ecc4,hearth:0xf6dccf,stage:0xe9ddf5,treasury:0xf6ead0,market:0xf7e2c4,workshop:0xdfe3e8,observatory:0xdcdff5,library:0xe8e0d0,guild:0xdfe9f7,pavilion:0xf3ecdf};

/* landmark builders: local space, back edge at z=zb, width W. Each returns its height. */
const LANDMARK={
  guild(g,W,zb,tint){const wall=mat(0xe6dccb,{roughness:.85});add(g,rbox(W*.72,6.5,3.2,.25),wall,0,3.25,zb);
    const roof=gableRoof(W*.8,4,3,0x3d6fb8);roof.position.set(0,8,zb);g.add(roof);
    add(g,new THREE.CylinderGeometry(1.5,1.7,10,14),wall,W*.36,5,zb-.3);const cone=add(g,new THREE.ConeGeometry(2,3.4,14),mat(0x3d6fb8,{roughness:.5}),W*.36,11.7,zb-.3);
    [-1,1].forEach(sx=>{const b=add(g,new THREE.PlaneGeometry(1.4,3.6),mat(tint,{side:THREE.DoubleSide,roughness:.9}),sx*W*.18,3.6,zb+1.65,false);bobbers.push({o:b,base:3.6,ph:sx,amp:.05});});
    add(g,rbox(2.4,3.6,.4,.15),mat(0x4a3428,{roughness:1}),0,1.8,zb+1.62);return 13.4;},
  library(g,W,zb){const wall=mat(0xefe4d0,{roughness:.85});add(g,new THREE.CylinderGeometry(3.4,3.6,9,20),wall,0,4.5,zb-.5);
    add(g,new THREE.ConeGeometry(4,3.4,20),mat(0x2a9d8f,{roughness:.5}),0,10.7,zb-.5);
    for(let i=0;i<3;i++)add(g,new THREE.TorusGeometry(3.45,.12,6,30),mat(0xc9a36b),0,2.4+i*2.6,zb-.5,false).rotation.x=Math.PI/2;
    const books=[0xd9826a,0x3d86e0,0xf2a93b,0x8a5cd6,0x34d39a];[-1,1].forEach(sx=>{const sh=new THREE.Group();sh.position.set(sx*(W/2-2.2),0,zb+1.2);g.add(sh);add(sh,rbox(2.8,3.4,.8,.08),M.wood,0,1.7,0);
      for(let r=0;r<3;r++)for(let b=0;b<6;b++)add(sh,new THREE.BoxGeometry(.36,.8,.5),mat(books[(b+r)%5]),-1.05+b*.42,.6+r*1.05,.2,false);});return 12.4;},
  market(g,W,zb,tint){const n=Math.max(2,Math.min(4,Math.round(W/6)));const cols=["#f25c54","#3d86e0","#34d39a","#8a5cd6"];
    for(let i=0;i<n;i++){const x=(i-(n-1)/2)*(W/n);const st=new THREE.Group();st.position.set(x,0,zb+.8);g.add(st);
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>add(st,new THREE.CylinderGeometry(.09,.09,3.2,6),M.wood,a*1.6,1.6,b*.9));
      const aw=add(st,new THREE.BoxGeometry(3.6,.12,2.4),new THREE.MeshStandardMaterial({map:stripeTex(cols[i%4],"#fff6e8"),roughness:.8}),0,3.3,.2);aw.rotation.x=-.18;
      add(st,rbox(3,1,1.6,.1),M.wood,0,.5,0);for(let k=0;k<4;k++)add(st,new THREE.CylinderGeometry(.22,.22,.1,14),M.gold,-1+k*.66,1.06,0,false);}
    return 4.6;},
  treasury(g,W,zb){const stone=mat(0xf4ecdc,{roughness:.6});add(g,rbox(W*.6,5.6,4,.25),stone,0,2.8,zb);
    for(let i=-2;i<=2;i++)add(g,new THREE.CylinderGeometry(.45,.5,5.2,14),stone,i*W*.12,2.6,zb+2.3);
    add(g,rbox(W*.66,.6,4.9,.15),stone,0,5.6,zb+.4);const dome=add(g,new THREE.SphereGeometry(3.2,24,12,0,Math.PI*2,0,Math.PI/2),M.gold,0,6.1,zb);
    const door=add(g,new THREE.CylinderGeometry(1.3,1.3,.3,24),mat(0x9aa3ad,{metalness:.7,roughness:.35}),0,2.4,zb+2.05);door.rotation.x=Math.PI/2;spinners.push(door);return 9.6;},
  stage(g,W,zb,tint){for(let i=0;i<3;i++){const r=W*.42-i*1.3;const step=add(g,new THREE.CylinderGeometry(r,r,.5+i*.5,32,1,false,Math.PI/2,Math.PI),mat(i%2?0xe9dff5:0xd8c8ef),0,(.5+i*.5)/2,zb+2.5);}
    add(g,rbox(W*.5,.8,3,.12),mat(0x8a5cd6,{roughness:.6}),0,.4,zb+6.2);
    [-1,1].forEach(sx=>{const x=sx*W*.32;add(g,new THREE.CylinderGeometry(.12,.12,6,8),mat(0x333344),x,3,zb+4);const head=add(g,new THREE.CylinderGeometry(.35,.5,.8,12),mat(0x333344),x,6,zb+4);head.rotation.x=.9;
      const beam=new THREE.Mesh(new THREE.ConeGeometry(2.2,7,20,1,true),new THREE.MeshBasicMaterial({color:0xfff2c4,transparent:true,opacity:.12,depthWrite:false,side:THREE.DoubleSide}));beam.position.set(x*.6,3,zb+6);beam.rotation.z=sx*.35;g.add(beam);lamps.push({glow:beam,base:0,beam:true});});
    return 5.5;},
  garden(g,W,zb){const pond=add(g,new THREE.CylinderGeometry(3,3,.12,28),M.water,-W*.18,.42,zb+2.2,false);pond.scale.z=.7;
    [0,1,2,3,4].forEach(i=>add(g,new THREE.CylinderGeometry(.5,.55,.12,10),mat(0xe6e0d4),W*.12+Math.sin(i)*.8,.42,zb+1+i*1.1,false));
    const tor=mat(0xe05a47,{roughness:.6});[-1,1].forEach(sx=>add(g,new THREE.CylinderGeometry(.28,.32,6,10),tor,sx*2.6,3,zb+.4));add(g,rbox(7.4,.5,.6,.15),tor,0,6.1,zb+.4);add(g,rbox(6.4,.35,.45,.1),tor,0,5,zb+.4);
    [[-W*.38,0],[W*.38,.5],[-W*.32,3],[W*.3,3.5]].forEach(([x,z],i)=>treeAt(g,x,zb+z,1.1+(i%2)*.3,i%2?0x7cc76a:0xf2a7c3));
    for(let i=0;i<5;i++)add(g,new THREE.DodecahedronGeometry(.45+Math.random()*.4,0),mat(0xb8b2a6,{flatShading:true}),-W*.3+i*1.4,.5,zb+4.4);return 6.6;},
  hearth(g,W,zb){const wall=mat(0xfbeee0,{roughness:.9});add(g,rbox(W*.5,4.6,4.4,.25),wall,0,2.3,zb);
    const roof=gableRoof(W*.58,5.4,3.2,0xd9826a);roof.position.set(0,6.2,zb);g.add(roof);add(g,rbox(1,3,1,.1),mat(0xb06a52),W*.14,7,zb-.8);
    add(g,rbox(1.6,2.8,.3,.1),mat(0x8a5038,{roughness:1}),0,1.4,zb+2.2);[-1,1].forEach(sx=>{const w=add(g,new THREE.PlaneGeometry(1.2,1.1),new THREE.MeshStandardMaterial({color:0x2e4a7a,emissive:0xffc870,emissiveIntensity:0}),sx*W*.14,2.6,zb+2.21,false);lamps.push({glow:w,base:0});});
    for(let i=0;i<5;i++){const h=add(g,new THREE.SphereGeometry(.28,12,10),new THREE.MeshStandardMaterial({color:0xff8fb1,emissive:0xff5f8f,emissiveIntensity:.6}),-W*.24+i*W*.12,4.6,zb+2.6,false);bobbers.push({o:h,base:4.6,ph:i,amp:.12});}return 8.2;},
  workshop(g,W,zb){const wall=mat(0xd6dce3,{roughness:.8});add(g,rbox(W*.62,5,4,.2),wall,0,2.5,zb);
    for(let i=0;i<3;i++){const t=add(g,new THREE.BoxGeometry(W*.62/3,1.6,4.1),mat(0x5b6b7c,{roughness:.6}),(i-1)*W*.62/3,5.6,zb);t.rotation.z=.25;}
    add(g,new THREE.CylinderGeometry(.5,.6,4,10),mat(0x7a5a4a),W*.24,7.5,zb-1);
    [[-W*.18,2.9,1.6],[-W*.18+2.4,4.4,1.1]].forEach(([x,y,r],i)=>{const gear=new THREE.Group();gear.position.set(x,y,zb+2.2);g.add(gear);const gm2=mat(i?0xf2a93b:0x9aa3ad,{metalness:.6,roughness:.35});
      add(gear,new THREE.TorusGeometry(r,.22,8,24),gm2,0,0,0,false);for(let k=0;k<10;k++){const tooth=add(gear,new THREE.BoxGeometry(.3,.5,.3),gm2,Math.cos(k/10*Math.PI*2)*(r+.3),Math.sin(k/10*Math.PI*2)*(r+.3),0,false);tooth.rotation.z=k/10*Math.PI*2;}
      gearSpin.push({o:gear,s:i?-1.4:1});});return 9.5;},
  observatory(g,W,zb){const wall=mat(0xe6e8f2,{roughness:.7});add(g,new THREE.CylinderGeometry(3.6,3.8,5,24),wall,0,2.5,zb);
    add(g,new THREE.SphereGeometry(3.7,24,12,0,Math.PI*2,0,Math.PI/2),mat(0xfafbff,{roughness:.35,metalness:.2}),0,5,zb);
    const tel=add(g,new THREE.CylinderGeometry(.45,.6,4.6,14),mat(0x2a2233,{metalness:.5,roughness:.4}),1.2,7.4,zb+1.4);tel.rotation.x=-.8;tel.rotation.z=-.35;
    for(let i=0;i<7;i++){const st=add(g,new THREE.OctahedronGeometry(.22,0),new THREE.MeshStandardMaterial({color:0xfff2c4,emissive:0xffe08a,emissiveIntensity:.8}),-3+i,9.5+Math.sin(i)*1.2,zb+1,false);bobbers.push({o:st,base:st.position.y,ph:i,amp:.25});}return 10.5;},
  pavilion(g,W,zb,tint){const col=mat(0xf6ead8,{roughness:.7});const w=W*.5;[[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([a,b])=>add(g,new THREE.CylinderGeometry(.32,.38,4.6,12),col,a*w/2,2.3,zb+1.6+b*1.6));
    const roof=add(g,new THREE.ConeGeometry(w*.85,2.6,4),mat(tint,{roughness:.5,flatShading:true}),0,5.9,zb+1.6);roof.rotation.y=Math.PI/4;
    for(let i=0;i<4;i++){const l=add(g,new THREE.SphereGeometry(.3,12,10),new THREE.MeshStandardMaterial({color:0xfff0c8,emissive:0xffb050,emissiveIntensity:.3}),(i-1.5)*w/3.4,4,zb+3.2,false);lamps.push({glow:l,base:0});bobbers.push({o:l,base:4,ph:i,amp:.1});}return 7.4;}
};

/* ---------- scorecards ---------- */
function scoreColor(s){return s==null?0xb8aec4:s>=70?0x34d39a:s>=40?0xf2a93b:0xf25c54;}
const STATUS_COL={"On track":"#2fae7a","At risk":"#f2a93b","Off":"#d2554b","Stale":"#9b8fa8","No data":"#c4bccd","No target":"#c4bccd","Parked":"#d9d3df"};
function num(v){const n=Number(v);return isFinite(n)?n:null;}
function fmtNum(v){const n=num(v);if(n==null)return "–";return Math.abs(n)>=1000?Math.round(n).toLocaleString():String(Math.round(n*10)/10);}
function plaqueTex(sc){const c=document.createElement("canvas");c.width=512;c.height=680;const g=c.getContext("2d");
  g.fillStyle="#fffaf0";if(g.roundRect){g.beginPath();g.roundRect(0,0,512,680,36);g.fill();}else g.fillRect(0,0,512,680);
  const col="#"+new THREE.Color(scoreColor(sc.Score)).getHexString();
  g.fillStyle="#5f5568";g.font="700 30px sans-serif";g.textAlign="center";g.fillText("SCORECARD",256,58);
  g.fillStyle="#2a2233";g.font="800 40px sans-serif";g.fillText(String(sc.Name).slice(0,22),256,108);
  g.lineWidth=26;g.strokeStyle="#ece4f0";g.beginPath();g.arc(256,236,92,0,Math.PI*2);g.stroke();
  g.strokeStyle=col;g.lineCap="round";g.beginPath();g.arc(256,236,92,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.01,(num(sc.Score)||0)/100));g.stroke();
  g.fillStyle="#2a2233";g.font="800 76px sans-serif";g.fillText(sc.Score==null?"–":String(sc.Score),256,262);
  const ms=(sc.Metrics||[]).filter(m=>m.Status!=="Parked").slice(0,6);g.textAlign="left";
  ms.forEach((m,i)=>{const y=380+i*48;g.fillStyle=STATUS_COL[m.Status]||"#c4bccd";g.beginPath();g.arc(40,y-8,10,0,Math.PI*2);g.fill();
    g.fillStyle="#2a2233";g.font="600 24px sans-serif";g.fillText(String(m.Name).slice(0,24),62,y);
    const a=num(m.Att);g.fillStyle="#ece4f0";g.fillRect(380,y-20,100,14);if(a!=null){g.fillStyle=STATUS_COL[m.Status]||"#c4bccd";g.fillRect(380,y-20,Math.max(4,a),14);}});
  if(!ms.length){g.fillStyle="#5f5568";g.font="600 26px sans-serif";g.textAlign="center";g.fillText("No live metrics yet",256,420);}
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t;}
function buildScorecard(g,sc,W,D,topY){
  /* plaque at the entrance, facing out */
  const pl=new THREE.Group();pl.position.set(-W/2+1.8,0,D/2+1.4);g.add(pl);
  add(pl,rbox(.3,2.4,.3,.08),M.wood,-1.25,1.2,0);add(pl,rbox(.3,2.4,.3,.08),M.wood,1.25,1.2,0);
  const face=add(pl,new THREE.PlaneGeometry(2.8,3.7),new THREE.MeshStandardMaterial({map:plaqueTex(sc),roughness:.85}),0,3.6,.02,false);
  add(pl,rbox(3.1,4,.18,.08),mat(scoreColor(sc.Score),{roughness:.5}),0,3.6,-.1);
  /* beacon above the landmark: colour = score health, visible from across the realm */
  const col=scoreColor(sc.Score);
  const orb=add(g,new THREE.SphereGeometry(.9,20,14),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:.9}),0,topY+2,-D/2,false);bobbers.push({o:orb,base:topY+2,ph:1,amp:.3});
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.35,.9,26,16,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.18,depthWrite:false}));beam.position.set(0,topY+15,-D/2);g.add(beam);
  /* metric columns along the left: height = attainment, colour = status */
  (sc.Metrics||[]).filter(m=>m.Status!=="Parked").slice(0,8).forEach((m,i)=>{const a=num(m.Att);const h=.4+((a==null?0:a)/100)*3.4;
    const c=new THREE.Color(STATUS_COL[m.Status]||"#c4bccd");add(g,rbox(.7,h,.7,.12),mat(c,{roughness:.45,emissive:c,emissiveIntensity:.12}),-W/2-1.4,.35+h/2,-D/2+1.4+i*1.5);});
  /* vitality: flowers bloom around the wing in proportion to the score */
  const n=Math.round((num(sc.Score)||0)/100*16);for(let i=0;i<n;i++){const t=i/16;const x=-W/2+t*W,z=D/2+.9+(i%2)*.5;
    add(g,new THREE.CylinderGeometry(.03,.03,.5,4),mat(0x4f9a4a),x,.25,z,false);add(g,new THREE.SphereGeometry(.16,8,6),mat(PENNANT[i%PENNANT.length],{emissive:PENNANT[i%PENNANT.length],emissiveIntensity:.15}),x,.55,z,false);}
  const wp=new THREE.Vector3();pl.getWorldPosition(wp);
  interactables.push({mesh:face,pos:wp,radius:3,kind:"scorecard",data:sc});
  return wp;
}

/* ---------- scenery: trees, hills, clouds ---------- */
let clouds=[],gearSpin=[];
function buildScenery(R){
  const N=140;const trunkG=new THREE.CylinderGeometry(.22,.32,1.8,6);trunkG.translate(0,.9,0);const crownG=new THREE.IcosahedronGeometry(1.4,0);crownG.translate(0,2.7,0);
  const trunks=new THREE.InstancedMesh(trunkG,M.wood,N),crowns=new THREE.InstancedMesh(crownG,mat(0xffffff,{roughness:.85,flatShading:true}),N);
  const greens=[0x5fb35a,0x7cc76a,0x4e9f58,0x8fd07a,0xf2a7c3,0xf6c46a];const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3(),ps=new THREE.Vector3(),col=new THREE.Color();
  for(let i=0;i<N;i++){const a=Math.random()*Math.PI*2,r=R+18+Math.random()*80;const s=.8+Math.random()*1.1;ps.set(Math.cos(a)*r,0,Math.sin(a)*r);q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.random()*6);sc.set(s,s*(.9+Math.random()*.4),s);m4.compose(ps,q,sc);
    trunks.setMatrixAt(i,m4);crowns.setMatrixAt(i,m4);col.setHex(greens[Math.random()<.85?Math.floor(Math.random()*4):4+Math.floor(Math.random()*2)]);if(crowns.setColorAt)crowns.setColorAt(i,col);}
  trunks.castShadow=crowns.castShadow=true;world.add(trunks);world.add(crowns);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;const h=new THREE.Mesh(new THREE.SphereGeometry(40+Math.random()*30,20,10),mat(i%2?0x9ccf7a:0x86c070,{roughness:1}));h.scale.y=.32;h.position.set(Math.cos(a)*(R+170),-6,Math.sin(a)*(R+170));world.add(h);}
  clouds=[];const cm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,transparent:true,opacity:.92});
  for(let i=0;i<14;i++){const c=new THREE.Group();for(let k=0;k<5;k++){const p=new THREE.Mesh(new THREE.SphereGeometry(3+Math.random()*3,12,10),cm);p.position.set(k*3.4-7,Math.random()*1.5,Math.random()*3);p.scale.y=.6;c.add(p);}
    c.position.set((Math.random()-.5)*400,55+Math.random()*30,(Math.random()-.5)*400);world.add(c);clouds.push(c);}
}

function buildWorld(data){
  scene.remove(world);world.traverse(o=>{if(o.geometry)o.geometry.dispose();});
  world=new THREE.Group();scene.add(world);interactables=[];rooms=[];spinners=[];bobbers=[];lamps=[];gearSpin=[];clouds=[];pulsers=[];
  const SC={};(data.scorecards||[]).forEach(c=>{if(c.Area)SC[c.Area]=c;});
  /* focus: the three projects holding the highest-ranked open missions (Fibery Execution Score order) */
  FOCUS={};OVERDUE={};focusList=[];const today=new Date(new Date().toDateString());
  (data.missions||[]).forEach((m,i)=>{if(!m.Project)return;if(m.Due&&new Date(String(m.Due).slice(0,10))<today)OVERDUE[m.Project]=(OVERDUE[m.Project]||0)+1;
    if(!(m.Project in FOCUS)&&focusList.length<3&&!m.Blocked){FOCUS[m.Project]=focusList.length+1;focusList.push({name:m.Project,mission:m.Name,pos:null});}});
  const G=gm(data.goals);
  const byArea=new Map();(data.projects||[]).forEach(p=>{const a=p.Area||"__attic";if(!byArea.has(a))byArea.set(a,[]);byArea.get(a).push(p);});
  const areas=[...byArea.keys()].map(a=>{const ps=byArea.get(a);const best=ps.map(p=>G[p.Goal]).sort((x,y)=>rank(x)-rank(y))[0]||null;return {name:a,projects:ps,slot:a==="__attic"?"attic":(best||"none")};})
    .sort((x,y)=>x.name==="__attic"?1:y.name==="__attic"?-1:(rank(x.slot)-rank(y.slot)||y.projects.length-x.projects.length));
  const n=areas.length;
  const dims=areas.map(a=>{const k=a.projects.length;const cols=Math.ceil(Math.sqrt(k)),rowsN=Math.ceil(k/cols);return {W:Math.max(16,cols*5.4+6),D:Math.max(16,rowsN*5.4+6)};});
  const need=dims.reduce((t,d)=>t+d.W+12,0);const maxD=Math.max(16,...dims.map(d=>d.D));
  const R=Math.max(44,need/(2*Math.PI),36+maxD/2);ringRadius=R+maxD/2+14;
  court=new THREE.Mesh(new THREE.CircleGeometry(30,64),new THREE.MeshStandardMaterial({map:courtTex,roughness:.95}));court.rotation.x=-Math.PI/2;court.position.y=.02;court.receiveShadow=true;world.add(court);
  buildThrone(data,G);
  areas.forEach((a,i)=>{const ang=-Math.PI/2+(i-(n-1)/2)*(2*Math.PI/n);buildRoom(a,Math.cos(ang)*R,Math.sin(ang)*R,ang,G,R,SC[a.name]||null);});
  buildFountain(data);buildGate(data);buildSignpost();buildScenery(R+maxD/2);
  for(let i=0;i<n;i++){const ang=-Math.PI/2+(i+.5-(n-1)/2)*(2*Math.PI/n);[[0,1],[3.5,.8],[-3.5,.9]].forEach(([dr,sz],k)=>treeAt(world,Math.cos(ang)*(R+dr)+(k?Math.sin(ang)*2:0),Math.sin(ang)*(R+dr),sz,[0x5fb35a,0x7cc76a,0xf2a7c3][(i+k)%3]));}
  for(let k=0;k<14;k++){const a=k/14*Math.PI*2+.11;const r=33+(k%3)*2;if(Math.abs(Math.cos(a))<.15)continue;treeAt(world,Math.cos(a)*r,Math.sin(a)*r,.75,k%4?0x7cc76a:0xf6c46a);}
  for(let k=0;k<10;k++){const a=k/10*Math.PI*2+.3;lamp(Math.cos(a)*24,Math.sin(a)*24);}
  applySky();drawMini();renderFocus();
}

/* Throne Room: a rose-sandstone facade, the Chief, MAX THREE pillars, and the mission board */
function buildThrone(data,G){
  const g=new THREE.Group();world.add(g);
  const dais=new THREE.Mesh(new THREE.CylinderGeometry(12,13,.9,32),M.plinth);dais.position.y=.45;dais.receiveShadow=true;dais.castShadow=true;g.add(dais);
  /* facade behind the Chief (north) */
  const fz=-11;
  const wall=new THREE.Mesh(new THREE.BoxGeometry(22,14,2),M.sandstone);wall.position.set(0,7.9,fz-1);wall.castShadow=true;wall.receiveShadow=true;g.add(wall);
  for(let i=-2;i<=2;i++){if(i===0)continue;const c=new THREE.Mesh(new THREE.CylinderGeometry(.7,.8,9,16),M.sandstoneDeep);c.position.set(i*3.6,5.4,fz+.4);c.castShadow=true;g.add(c);}
  const ped=new THREE.Mesh(new THREE.ConeGeometry(9,3,3),M.sandstoneDeep);ped.rotation.y=Math.PI/2;ped.scale.z=.25;ped.position.set(0,11.6,fz+.3);g.add(ped);
  const urn=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.4,3.2,16),M.sandstoneDeep);urn.position.set(0,14.6,fz);g.add(urn);
  const door=new THREE.Mesh(new THREE.BoxGeometry(3.4,6,.4),new THREE.MeshStandardMaterial({color:0x5a3428,roughness:1}));door.position.set(0,3.9,fz+.1);g.add(door);
  /* the Chief */
  const chief=figure(0xd2554b,1.4);chief.position.set(0,.9,-4);g.add(chief);
  const crown=new THREE.Mesh(new THREE.TorusGeometry(.42,.1,8,18),M.gold);crown.rotation.x=Math.PI/2;crown.position.set(0,.9+3.4,-4);g.add(crown);spinners.push(crown);
  const tl=label("The Chief",{size:1.5});tl.position.set(0,6.4,-4);g.add(tl);
  interactables.push({mesh:chief.children[0],pos:new THREE.Vector3(0,0,-4),radius:4.5,kind:"chief"});
  /* MAX THREE pillars */
  ["Slot 1","Slot 2","Slot 3"].forEach((s,i)=>{const x=(i-1)*7,z=2;const goal=(data.goals||[]).find(gl=>gl.MAX===s);const h=goal?5:2.5;
    const p=new THREE.Mesh(new THREE.CylinderGeometry(.75,.9,h,16),M.plinth);p.position.set(x,.9+h/2,z);p.castShadow=true;g.add(p);
    const orb=new THREE.Mesh(new THREE.SphereGeometry(.8,20,14),new THREE.MeshStandardMaterial({color:TINT[s],emissive:TINT[s],emissiveIntensity:goal?.7:.05,transparent:!goal,opacity:goal?1:.35}));
    orb.position.set(x,.9+h+1,z);g.add(orb);bobbers.push({o:orb,base:orb.position.y,ph:i});
    const lb=label(goal?`${s}: ${goal.Name}`:`${s}: open`,{size:.85,font:"700 50px 'Atkinson Hyperlegible', sans-serif"});lb.position.set(x,.9+h+2.6,z);g.add(lb);
    if(goal)interactables.push({mesh:p,pos:new THREE.Vector3(x,0,z),radius:2.6,kind:"goal",data:goal});});
  /* mission board */
  const board=new THREE.Group();board.position.set(9.5,.9,-3);board.rotation.y=-.5;g.add(board);
  const posts=new THREE.Mesh(new THREE.BoxGeometry(5,.3,.3),M.wood);posts.position.y=4.2;board.add(posts);
  [-2.3,2.3].forEach(x=>{const p=new THREE.Mesh(new THREE.BoxGeometry(.3,4.4,.3),M.wood);p.position.set(x,2.2,0);p.castShadow=true;board.add(p);});
  const face=new THREE.Mesh(new THREE.BoxGeometry(4.4,2.8,.15),new THREE.MeshStandardMaterial({color:0xf3e2c0,roughness:.9}));face.position.y=2.6;face.castShadow=true;board.add(face);
  for(let i=0;i<6;i++){const n=new THREE.Mesh(new THREE.PlaneGeometry(1.1,.8),new THREE.MeshStandardMaterial({color:PENNANT[i],roughness:.8}));n.position.set(-1.4+(i%3)*1.4,3.1-Math.floor(i/3)*1.1,.09);board.add(n);}
  const bl=label("Mission Board",{size:1});bl.position.y=5.2;board.add(bl);
  const bp=new THREE.Vector3();board.updateMatrixWorld(true);board.getWorldPosition(bp);
  interactables.push({mesh:face,pos:bp,radius:3.8,kind:"board"});
  rooms.push({name:"Throne Room",x:0,z:0,size:26,tint:0xf2a93b});
}

function buildRoom(a,cx,cz,ang,G,R,sc){
  const attic=a.name==="__attic";const title=attic?"The Attic":a.name;const tint=TINT[a.slot]||TINT.none;
  const n=a.projects.length;const cols=Math.ceil(Math.sqrt(n));const rowsN=Math.ceil(n/cols);const spc=5.4;
  const W=Math.max(16,cols*spc+6),D=Math.max(16,rowsN*spc+6);
  const g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y=-ang-Math.PI/2;world.add(g);
  const theme=attic?"pavilion":themeOf(a.name);const fc=new THREE.Color(THEME_FLOOR[theme]).lerp(new THREE.Color(tint),.18);
  const ft=tileTex("#"+fc.getHexString(),"#"+fc.clone().multiplyScalar(.9).getHexString(),3);ft.repeat.set(W/6,D/6);const floor=new THREE.Mesh(rbox(W,.35,D,.15),new THREE.MeshStandardMaterial({color:0xffffff,map:ft,roughness:.85}));floor.position.y=.17;floor.receiveShadow=true;g.add(floor);
  const rim=new THREE.Mesh(new THREE.BoxGeometry(W+.8,.2,D+.8),new THREE.MeshStandardMaterial({color:tint,roughness:.6}));rim.position.y=.1;g.add(rim);
  const topY=LANDMARK[theme](g,W,-D/2-1.2,tint);
  [[-1,1],[1,1]].forEach(([sx,sz])=>{add(g,rbox(1,1.4,1,.2),mat(0xf6ead8),sx*W/2,.7,sz*D/2);add(g,new THREE.SphereGeometry(.55,14,10),mat(tint,{roughness:.4}),sx*W/2,1.8,sz*D/2);});
  const nl=label(title,{size:2.1});nl.position.set(0,topY+(sc?4.6:2),-D/2);g.add(nl);
  const sub=attic?"no Life Area yet":[THEME_NAME[theme],a.slot==="none"?"":a.slot,sc?`score ${sc.Score??"–"}`:""].filter(Boolean).join(" · ");
  if(sub){const sl=label(sub,{size:.9,font:"700 48px 'Atkinson Hyperlegible', sans-serif",ink:"#5f5568"});sl.position.set(0,topY+(sc?3.4:.8),-D/2);g.add(sl);}
  if(sc)buildScorecard(g,sc,W,D,topY);
  /* pennants across the entrance */
  g.updateMatrixWorld(true);
  const pa=new THREE.Vector3(-W/2,0,D/2).applyMatrix4(g.matrixWorld),pb=new THREE.Vector3(W/2,0,D/2).applyMatrix4(g.matrixWorld);pennantString(pa,pb,5);
  const lp=new THREE.Vector3(W/2-1.2,0,D/2-1.2).applyMatrix4(g.matrixWorld);lamp(lp.x,lp.z);
  /* walkway to the throne (Connectedness): gold-edged for Slot 1 */
  const ent=new THREE.Vector3(0,0,D/2+.5).applyMatrix4(g.matrixWorld);const inner=ent.clone().setLength(29.5);
  const len=ent.distanceTo(inner);const mid=ent.clone().add(inner).multiplyScalar(.5);
  const path=new THREE.Mesh(new THREE.BoxGeometry(a.slot==="Slot 1"?2.4:1.8,.06,len),new THREE.MeshStandardMaterial({color:a.slot==="Slot 1"?0xf6d58a:0xe2d2b2,roughness:.95}));
  path.position.set(mid.x,.05,mid.z);path.lookAt(inner.x,.05,inner.z);path.receiveShadow=true;world.add(path);
  a.projects.forEach((p,i)=>{
    const c=i%cols,r=Math.floor(i/cols);const lx=(c-(cols-1)/2)*spc,lz=(r-(rowsN-1)/2)*spc+.6;
    const pd=new THREE.Group();pd.position.set(lx,.35,lz);g.add(pd);
    const fx=FOCUS[p.Name]||0,od=OVERDUE[p.Name]||0;const open=Number(p.Open)||0;const quiet=!fx&&(open===0||p.State==="Maintenance");
    const base=new THREE.Mesh(new THREE.CylinderGeometry(fx?1.2:.9,fx?1.4:1.1,.9,20),fx?M.gold:M.plinth);base.position.y=.45;base.castShadow=true;base.receiveShadow=true;pd.add(base);
    const cs=CRYSTAL[p.State]||CRYSTAL["Next Up"];const cr=(.45+Math.min(open,40)/40*.75)*(fx?1.45:quiet?.8:1);
    const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(cr,0),new THREE.MeshStandardMaterial({color:fx?0xffd36a:cs.c,emissive:fx?0xffa020:cs.e,emissiveIntensity:fx?.9:quiet?.05:.35,roughness:.2,flatShading:true,transparent:quiet,opacity:quiet?.55:1}));
    crystal.position.y=1.2+cr;crystal.castShadow=true;pd.add(crystal);spinners.push(crystal);
    if(fx){/* quest marker + beam so it reads from anywhere in the realm */
      const mk=new THREE.Group();mk.position.y=1.2+cr*2+3.4;pd.add(mk);const mm=new THREE.MeshStandardMaterial({color:0xffd23a,emissive:0xffb000,emissiveIntensity:1});
      add(mk,rbox(.5,1.5,.5,.2),mm,0,.55,0,false);add(mk,new THREE.SphereGeometry(.3,14,10),mm,0,-.65,0,false);bobbers.push({o:mk,base:mk.position.y,ph:fx,amp:.35});spinners.push(mk);
      const beam=new THREE.Mesh(new THREE.CylinderGeometry(.6,1.2,40,16,1,true),new THREE.MeshBasicMaterial({color:0xffd36a,transparent:true,opacity:.2,depthWrite:false}));beam.position.y=20;pd.add(beam);
      pulsers.push({o:base,s:1,amp:.04,sp:3});}
    if(od){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.45,.09,8,32),new THREE.MeshBasicMaterial({color:0xf25c54}));ring.rotation.x=Math.PI/2;ring.position.y=.12;pd.add(ring);pulsers.push({o:ring,s:1,amp:.12,sp:5});}
    if(p.ShipGate==="Told"){const halo=new THREE.Mesh(new THREE.TorusGeometry(cr+.4,.07,8,24),M.gold);halo.rotation.x=Math.PI/2;halo.position.y=1.2+cr;pd.add(halo);}
    const lead=(p.Agents&&p.Agents[0]&&p.Agents[0].Name)||null;
    if(lead){const f=figure(0x2ab7a9,.7);f.position.set(1.5,0,.4);f.rotation.y=-.4;pd.add(f);bobbers.push({o:f,base:0,ph:i,amp:.08});}
    else{const ring=new THREE.Mesh(new THREE.RingGeometry(.4,.56,24),new THREE.MeshBasicMaterial({color:0xd2554b,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.set(1.5,.03,.4);pd.add(ring);}
    const short=String(p.Name).length>30?String(p.Name).slice(0,28)+"…":String(p.Name);
    const lb=label((fx?`Focus ${fx} · `:"")+short+(od?` · ${od} overdue`:""),{size:fx?.95:.6,font:"700 50px 'Atkinson Hyperlegible', sans-serif",bg:fx?"rgba(255,214,106,.95)":quiet?"rgba(255,250,240,.6)":undefined,ink:quiet?"#8a8094":"#2a2233"});lb.position.y=1.2+cr*2+(fx?1.4:.9);pd.add(lb);
    const wp=new THREE.Vector3();pd.getWorldPosition(wp);if(fx)focusList[fx-1].pos=wp.clone();
    interactables.push({mesh:crystal,pos:wp,radius:2.6,kind:"project",data:p,room:title,slot:G[p.Goal]||null,lead});
  });
  rooms.push({name:title,x:cx,z:cz,size:Math.max(W,D),tint,score:sc?sc.Score:null});
}

/* Idea Fountain (Ideation): one floating orb per open idea */
function buildFountain(data){
  const g=new THREE.Group();g.position.set(-16,0,22);world.add(g);
  const basin=new THREE.Mesh(new THREE.CylinderGeometry(3.4,3.8,1,32),M.plinth);basin.position.y=.5;basin.castShadow=true;basin.receiveShadow=true;g.add(basin);
  const water=new THREE.Mesh(new THREE.CylinderGeometry(3.05,3.05,.2,32),M.water);water.position.y=.95;g.add(water);
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.35,.5,2.6,16),M.plinth);col.position.y=2.1;g.add(col);
  const ideas=data.ideas||[];const k=Math.min(ideas.length,24);
  for(let i=0;i<k;i++){const a=i/k*Math.PI*2;const o=new THREE.Mesh(new THREE.SphereGeometry(.28,12,10),new THREE.MeshStandardMaterial({color:PENNANT[i%PENNANT.length],emissive:PENNANT[i%PENNANT.length],emissiveIntensity:.5}));
    o.position.set(Math.cos(a)*1.6,3.6+(i%3)*.5,Math.sin(a)*1.6);g.add(o);bobbers.push({o,base:o.position.y,ph:i*.7,amp:.35});}
  const lb=label(`Idea Fountain · ${ideas.length} waiting`,{size:1});lb.position.y=6;g.add(lb);
  interactables.push({mesh:basin,pos:new THREE.Vector3(-16,0,22),radius:5,kind:"ideas",data:ideas});
}
/* Ship Gate: lights up when something is told this week */
function buildGate(data){
  const told=(data.projects||[]).filter(p=>p.ShipGate==="Told").length;
  const g=new THREE.Group();g.position.set(16,0,24);g.rotation.y=-.5;world.add(g);
  const mat=told?M.gold:new THREE.MeshStandardMaterial({color:0xb8aec4,roughness:.8});
  [-3,3].forEach(x=>{const p=new THREE.Mesh(new THREE.BoxGeometry(1.2,7,1.2),mat);p.position.set(x,3.5,0);p.castShadow=true;g.add(p);});
  const arch=new THREE.Mesh(new THREE.TorusGeometry(3,.6,10,24,Math.PI),mat);arch.position.y=7;g.add(arch);
  if(told){const glow=new THREE.PointLight(0xffd070,1.4,18,2);glow.position.y=5;g.add(glow);}
  const lb=label(told?`Ship Gate · ${told} told`:"Ship Gate · nothing told yet",{size:1,ink:told?"#2a2233":"#d2554b"});lb.position.y=11;g.add(lb);
  interactables.push({mesh:arch,pos:new THREE.Vector3(16,0,24),radius:5,kind:"gate",told});
}
/* Signpost of the places you have called home */
function buildSignpost(){
  const g=new THREE.Group();g.position.set(0,0,32);world.add(g);
  const post=new THREE.Mesh(new THREE.CylinderGeometry(.2,.25,6,8),M.wood);post.position.y=3;post.castShadow=true;g.add(post);
  const places=CONFIG.places;
  places.forEach(([nm,rot,col],i)=>{const arm=new THREE.Group();arm.position.y=5.4-i*.75;arm.rotation.y=rot;g.add(arm);
    const b=new THREE.Mesh(new THREE.BoxGeometry(2.6,.5,.12),new THREE.MeshStandardMaterial({color:col,roughness:.7}));b.position.x=1.4;b.castShadow=true;arm.add(b);
    const lb=label(nm,{size:.42,bg:null,ink:"#ffffff",font:"800 56px 'Bricolage Grotesque', sans-serif"});lb.position.set(1.4,0,.12);arm.add(lb);});
  interactables.push({mesh:post,pos:new THREE.Vector3(0,0,32),radius:3,kind:"sign"});
}

/* ---------- focus panel and guide trail ---------- */
const trail=[];{const tm=new THREE.MeshStandardMaterial({color:0xffd36a,emissive:0xffb000,emissiveIntensity:.9});for(let i=0;i<28;i++){const d=new THREE.Mesh(new THREE.SphereGeometry(.22,10,8),tm);d.visible=false;scene.add(d);trail.push(d);}}
function renderFocus(){const panel=document.getElementById("focusPanel"),ol=document.getElementById("focusList");if(!panel)return;
  if(!focusList.length){panel.hidden=true;return;}panel.hidden=false;if(guideIx>=focusList.length)guideIx=0;
  const D=state.data;ol.innerHTML=focusList.map((f,i)=>`<li class="${i===guideIx?"on":""}"><button data-f="${i}"><span class="fx">${i+1}</span><span><span class="fn">${esc(f.name)}</span><span class="fm">Next: ${esc(f.mission)}${OVERDUE[f.name]?` · <span class="od">${OVERDUE[f.name]} overdue</span>`:""}</span></span></button></li>`).join("");}
document.addEventListener("click",e=>{const b=e.target.closest&&e.target.closest("#focusList button");if(!b)return;guideIx=+b.dataset.f;const f=focusList[guideIx];renderFocus();if(f&&f.pos)travel={x:f.pos.x,z:f.pos.z+2.4};});
let trailT=0;
function updateTrail(dt,t){trailT+=dt;const f=focusList[guideIx];if(!f||!f.pos){trail.forEach(d=>d.visible=false);return;}
  const dx=f.pos.x-player.position.x,dz=f.pos.z-player.position.z,dd=Math.hypot(dx,dz);if(dd<4){trail.forEach(d=>d.visible=false);return;}
  const step=2.4,off=(t*2.2)%step;trail.forEach((d,i)=>{const k=2.2+i*step+off;if(k>dd-1.5){d.visible=false;return;}d.visible=true;d.position.set(player.position.x+dx/dd*k,.35+Math.sin(t*4-i*.6)*.08,player.position.z+dz/dd*k);const sc=1-i/trail.length*.5;d.scale.setScalar(sc);});}

/* ---------- player, companion pup, camera ---------- */
const player=figure(0xf2a93b,1);player.position.set(0,0,36);scene.add(player);
const pup=new THREE.Group();scene.add(pup);
(function(){const fur=new THREE.MeshStandardMaterial({color:0xd9a066,roughness:.9}),dark=new THREE.MeshStandardMaterial({color:0x5a3a28,roughness:.9});
  const body=new THREE.Mesh(new THREE.BoxGeometry(.6,.45,1),fur);body.position.y=.5;body.castShadow=true;pup.add(body);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.32,14,10),fur);head.position.set(0,.85,.55);pup.add(head);
  const snout=new THREE.Mesh(new THREE.SphereGeometry(.14,10,8),dark);snout.position.set(0,.8,.85);pup.add(snout);
  [-1,1].forEach(s=>{const ear=new THREE.Mesh(new THREE.BoxGeometry(.12,.35,.22),dark);ear.position.set(s*.32,.8,.5);pup.add(ear);});
  const tail=new THREE.Mesh(new THREE.TorusGeometry(.2,.08,8,14,Math.PI*1.4),fur);tail.position.set(0,.8,-.5);tail.rotation.y=Math.PI/2;pup.add(tail);
  [[-.2,.35],[.2,.35],[-.2,-.35],[.2,-.35]].forEach(([x,z])=>{const l=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.35,6),dark);l.position.set(x,.17,z);pup.add(l);});})();
pup.position.set(2,0,42);

let yaw=0,pitch=.82,dist=27,camTween=null,viewIx=1;
const VIEWS=[{name:"Close",pitch:.32,dist:11},{name:"Follow",pitch:.82,dist:27},{name:"Aerial",pitch:1.25,dist:62}];
const keys={};
addEventListener("keydown",e=>{const k=e.key.toLowerCase();
  if(e.target&&(e.target.tagName==="SELECT"||e.target.tagName==="INPUT"))return;
  if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k)&&document.activeElement===canvas)e.preventDefault();
  if(!e.repeat&&k==="v"){viewIx=(viewIx+1)%VIEWS.length;const v=VIEWS[viewIx];camTween={yaw,pitch:v.pitch,dist:v.dist};toast(`${v.name} view`);}
  if(!e.repeat&&k==="g"&&focusList.length){guideIx=(guideIx+1)%focusList.length;renderFocus();toast(`Guide: ${focusList[guideIx].name}`);}
  if(!e.repeat&&k==="h"){camTween={yaw:0,pitch:VIEWS[1].pitch,dist:VIEWS[1].dist};}
  keys[k]=true;if(k==="m")toggleDrawer();});
addEventListener("keyup",e=>{keys[e.key.toLowerCase()]=false;});
addEventListener("blur",()=>{for(const k in keys)keys[k]=false;});
let drag=null;
canvas.addEventListener("pointerdown",e=>{canvas.focus();drag={x:e.clientX,y:e.clientY,moved:0,id:e.pointerId};});
addEventListener("pointermove",e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);yaw-=dx*.006;pitch=Math.min(1.2,Math.max(.15,pitch+dy*.004));drag.x=e.clientX;drag.y=e.clientY;});
addEventListener("pointerup",e=>{if(drag&&e.pointerId===drag.id&&drag.moved<6)pick(e);drag=null;});
canvas.addEventListener("wheel",e=>{e.preventDefault();dist=Math.min(70,Math.max(7,dist+e.deltaY*.02));},{passive:false});
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2();let travel=null;
function pick(e){const r=canvas.getBoundingClientRect();ndc.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects(interactables.map(i=>i.mesh),false);if(hits.length){const it=interactables.find(i=>i.mesh===hits[0].object);if(it)travel={x:it.pos.x,z:it.pos.z+2.2};}}
const joy=document.getElementById("joy"),knob=document.getElementById("knob");let joyV={x:0,y:0},joyId=null;
joy.addEventListener("pointerdown",e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);moveJoy(e);});
joy.addEventListener("pointermove",e=>{if(e.pointerId===joyId)moveJoy(e);});
const endJoy=e=>{if(e.pointerId!==joyId)return;joyId=null;joyV={x:0,y:0};knob.style.transform="";};
joy.addEventListener("pointerup",endJoy);joy.addEventListener("pointercancel",endJoy);
function moveJoy(e){const r=joy.getBoundingClientRect();let x=(e.clientX-r.left-r.width/2)/(r.width/2),y=(e.clientY-r.top-r.height/2)/(r.height/2);const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}joyV={x,y};knob.style.transform=`translate(${x*36}px,${y*36}px)`;}

/* ---------- card ---------- */
const card=document.getElementById("card");let current=null;
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function slotClass(s){return s==="Slot 1"?"pill slot1":s==="Slot 2"?"pill slot2":"pill";}
function showCard(it){
  if(it===current)return;if(!it&&card.matches(":hover"))return;current=it;if(!it){card.classList.remove("on");return;}
  const eb=$("cEyebrow"),t=$("cTitle"),pills=$("cPills"),body=$("cBody"),link=$("cLink");link.hidden=true;
  const D=state.data;const tag=D.live?"":" · example";
  if(it.kind==="project"){const p=it.data;
    eb.textContent=it.room+tag;t.textContent=p.Name;
    pills.innerHTML=`<span class="pill ${p.State==="Active"?"good":""}">${esc(p.State)}</span><span class="pill">${Number(p.Open)||0} open missions</span>`+(it.slot?`<span class="${slotClass(it.slot)}">${esc(it.slot)}</span>`:"")+(it.lead?`<span class="pill">Lead: ${esc(it.lead)}</span>`:`<span class="pill warn">No lead agent</span>`)+(p.ShipGate?`<span class="pill ${p.ShipGate==="Told"?"good":""}">${esc(p.ShipGate)}</span>`:"");
    const ms=(D.missions||[]).filter(m=>m.Project===p.Name).slice(0,6);
    const agentOpts=(D.agents||[]).filter(a=>a.Class!=="Human").map(a=>`<option value="${esc(a.Id)}">${esc(a.Name)}</option>`).join("");
    const today=new Date(new Date().toDateString());
    body.innerHTML=(p.Next?`<p><strong>Next action:</strong> ${esc(p.Next)}</p>`:"")+
      (ms.length?ms.map((m,i)=>{const od=m.Due&&new Date(String(m.Due).slice(0,10))<today;return `<div class="qm ${i===0?"next":""}" data-mid="${esc(m.Id||"")}">
        <div class="qn">${i===0?"▶ ":""}${esc(m.Name)}</div>
        <div class="qd">${esc(m.State||"Todo")}${m.Priority?" · "+esc(m.Priority):""}${m.Due?` · <span style="color:${od?"var(--alarm)":"inherit"}">due ${esc(String(m.Due).slice(0,10))}</span>`:""}${m.Delegate?" · with "+esc(m.Delegate):""}${m.Blocked?' · <span style="color:var(--alarm)">blocked</span>':""}</div>
        <div class="qa"><button class="sprint" data-qact="sprint">25-min sprint</button><button class="done" data-qact="done" ${D.live?"":"disabled"}>Done</button>${m.State!=="In Progress"?`<button data-qact="start" ${D.live?"":"disabled"}>Start</button>`:""}${D.live&&agentOpts?`<select data-qact="agent" aria-label="Hand to an agent"><option value="">Hand to agent…</option>${agentOpts}</select>`:""}${m.url?`<a href="${esc(m.url)}" target="_blank" rel="noopener">Open</a>`:""}</div></div>`;}).join(""):`<p>No open missions here. Add a Task to this project in Fibery to give it a quest.</p>`)+
      (ms.length?`<p class="qd" style="margin-top:4px">Finish the ▶ mission to clear the quest. ${D.live?"":"Example data: buttons are off."}</p>`:"");
    if(p.url){link.href=p.url;link.hidden=false;}
  } else if(it.kind==="goal"){const gl=it.data;eb.textContent="Throne Room"+tag;t.textContent=gl.Name;
    pills.innerHTML=`<span class="${slotClass(gl.MAX)}">${esc(gl.MAX)}</span>`+(gl.Target?`<span class="pill">Target ${esc(gl.Target)}</span>`:"");
    body.innerHTML=gl.Metric?`<p>${esc(gl.Metric)}</p>`:"";if(gl.url){link.href=gl.url;link.hidden=false;}
  } else if(it.kind==="chief"){const ps=D.projects||[];const G=gm(D.goals);const s1=ps.filter(p=>G[p.Goal]==="Slot 1");const ung=ps.filter(p=>!(p.Agents&&p.Agents.length));const attic=ps.filter(p=>!p.Area);const told=ps.filter(p=>p.ShipGate==="Told").length;
    const top=(D.missions||[])[0];
    eb.textContent="Throne Room"+tag;t.textContent="The Chief's orders";
    pills.innerHTML=`<span class="pill slot1">${s1.length} Slot 1 rooms</span><span class="pill">${ps.length} rooms</span><span class="pill ${told?"good":"warn"}">${told} told</span>`;
    body.innerHTML=`<ul>${top?`<li>Today's first mission: ${esc(top.Name)}.</li>`:""}<li>Compute goes to Slot 1 first: ${esc(s1.slice(0,3).map(p=>p.Name).join(", ")||"no Slot 1 rooms yet")}.</li><li>${ung.length} rooms have no lead agent.</li><li>${attic.length} projects sit in the Attic with no Life Area.</li><li>Nothing new starts until something passes the Ship Gate.</li></ul>`+((D.scorecards||[]).length?`<p><strong>Realm health:</strong> ${(D.scorecards||[]).slice().sort((a,b)=>(a.Score??-1)-(b.Score??-1)).map(c=>`${esc(c.Name)} ${c.Score??"–"}`).join(" · ")}</p>`:"");
  } else if(it.kind==="scorecard"){const sc=it.data;eb.textContent=(sc.Area||"Scorecard")+tag;t.textContent=sc.Name;
    const sv=sc.Score;const cls=sv==null?"":sv>=70?"good":sv<40?"warn":"";
    pills.innerHTML=`<span class="pill ${cls}">Score ${sv??"–"} / 100</span>`+(sc.Off?`<span class="pill warn">${sc.Off} off or stale</span>`:"")+(sc.Goal?`<span class="pill">${esc(sc.Goal)}</span>`:"");
    const ms=(sc.Metrics||[]).filter(m=>m.Status!=="Parked");
    body.innerHTML=ms.length?`<ul>${ms.map(m=>`<li><strong style="color:${STATUS_COL[m.Status]||"inherit"}">${esc(m.Status)}</strong> · ${esc(m.Name)}: ${fmtNum(m.Val)}${m.Target!=null?` of ${fmtNum(m.Target)}`:""}${m.Unit?" "+esc(m.Unit):""} ${esc(m.Trend&&m.Trend!=="—"?m.Trend:"")}</li>`).join("")}</ul>`:`<p>No live metrics on this scorecard yet.</p>`;
    if(sc.url){link.href=sc.url;link.hidden=false;}
  } else if(it.kind==="board"){eb.textContent="Throne Room"+tag;t.textContent="Mission Board";pills.innerHTML=`<span class="pill">${(D.missions||[]).length} open missions</span>`;
    body.innerHTML=`<p>Press <kbd>M</kbd> or the Missions button to open the board. Finish a mission, start it, or hand it to an agent.</p>`;
  } else if(it.kind==="ideas"){const ideas=it.data||[];eb.textContent="Courtyard"+tag;t.textContent="Idea Fountain";
    pills.innerHTML=`<span class="pill">${ideas.length} ideas waiting</span>`;
    body.innerHTML=`<p>New ideas fill this fountain. Score them, then drain it weekly so it never becomes a second to-do list.</p><ul>${ideas.slice(0,5).map(i=>`<li>${esc(i.Name)}${i.Verdict&&i.Verdict!=="Unscored"?` · ${esc(i.Verdict)}`:""}</li>`).join("")}</ul>`;
  } else if(it.kind==="gate"){eb.textContent="Courtyard"+tag;t.textContent="Ship Gate";
    pills.innerHTML=`<span class="pill ${it.told?"good":"warn"}">${it.told} told</span>`;
    body.innerHTML=it.told?`<p>The gate is lit. Something went out into the world.</p>`:`<p>The gate stays dark until one project is marked Told: a post, a DM, a demo, a launch. This palace itself counts if you post it.</p>`;
  } else if(it.kind==="sign"){eb.textContent="Courtyard";t.textContent="Places you have called home";pills.innerHTML=`<span class="pill">${CONFIG.places.length} places</span>`;
    body.innerHTML=`<p>${esc(CONFIG.placesNote)}</p>`;}
  card.classList.add("on");
}
function $(id){return document.getElementById(id);}

/* ---------- missions drawer ---------- */
const drawer=$("drawer"),mlist=$("mlist");
function toggleDrawer(force){const on=force!==undefined?force:!drawer.classList.contains("on");drawer.classList.toggle("on",on);if(on)renderMissions();}
$("missionBtn").addEventListener("click",()=>toggleDrawer());
$("closeDrawer").addEventListener("click",()=>toggleDrawer(false));
function renderMissions(){
  const D=state.data;const ms=D.missions||[];
  $("mSub").textContent=D.live?"Your next missions, ranked by Fibery's Execution Score. Slot 1 comes first. Changes write straight to Fibery.":"Example missions. Open this page in Claude with Fibery connected to work your real board.";
  if(!ms.length){mlist.innerHTML=`<p class="sub">No open missions. Add a Task in Fibery and it appears here.</p>`;return;}
  const opts=(D.agents||[]).filter(a=>a.Class!=="Human").map(a=>`<option value="${esc(a.Id)}">${esc(a.Name)}</option>`).join("");
  mlist.innerHTML=ms.slice(0,30).map((m,i)=>{const s=String(m.GoalP||"");const cls=s.startsWith("Slot 1")?"s1":s.startsWith("Slot 2")?"s2":"";
    const overdue=m.Due&&new Date(m.Due)<new Date(new Date().toDateString());
    return `<div class="mission ${cls}" data-i="${i}">
      <div class="mt">${esc(m.Name)}</div>
      <div class="mm"><span>${esc(m.Project||"No project")}</span>${m.Priority?`<span>${esc(m.Priority)}</span>`:""}${m.Due?`<span style="color:${overdue?"var(--alarm)":"inherit"}">Due ${esc(String(m.Due).slice(0,10))}</span>`:""}<span>${m.Delegate?"Agent: "+esc(m.Delegate):"You"}</span>${m.Blocked?`<span style="color:var(--alarm)">Blocked</span>`:""}</div>
      <div class="acts">
        <button class="done" data-act="done" ${D.live?"":"disabled"}>Done</button>
        ${m.State!=="In Progress"?`<button data-act="start" ${D.live?"":"disabled"}>Start</button>`:""}
        ${D.live&&opts?`<select data-act="agent" aria-label="Hand to an agent"><option value="">Hand to agent…</option>${opts}</select>`:""}
        ${m.url?`<a href="${esc(m.url)}" target="_blank" rel="noopener">Open</a>`:""}
      </div></div>`;}).join("");
}
mlist.addEventListener("click",e=>{const b=e.target.closest("button[data-act]");if(!b)return;const m=state.data.missions[+b.closest(".mission").dataset.i];
  if(b.dataset.act==="done")write(b,"set_state",{database:"Personal OS/Task",entityId:m.Id,state:"Done"},`Mission complete: ${m.Name}`);
  if(b.dataset.act==="start")write(b,"set_state",{database:"Personal OS/Task",entityId:m.Id,state:"In Progress"},`Started: ${m.Name}`);});
mlist.addEventListener("change",e=>{const s=e.target.closest("select[data-act=agent]");if(!s||!s.value)return;const m=state.data.missions[+s.closest(".mission").dataset.i];const name=s.options[s.selectedIndex].text;
  write(s,"update_entities",{database:"Personal OS/Task",entities:[{id:m.Id,"Personal OS/Delegate":s.value}]},`${name} took the mission: ${m.Name}`);});
async function write(el,tool,input,okMsg){
  if(!LIVE)return;el.disabled=true;
  try{await API.write(tool,input);toast(okMsg);if(tool==="set_state"&&input.state==="Done")celebrate();
    loadLive(true);}
  catch(err){el.disabled=false;const c=err&&err.code;
    toast(c==="approval_required"?"Fibery asked for your OK. Press the button again to allow it.":c==="needs_reauth"?"Reconnect Fibery in claude.ai Settings → Connectors.":c==="not_in_manifest"?"Writing to Fibery is turned off for this page.":c==="tool_error"?"Fibery refused that change: "+String(err.message||"").slice(0,120):"That change may not have saved. Check Fibery before trying again.",true);}
}
card.addEventListener("click",e=>{const b=e.target.closest("button[data-qact]");if(!b)return;const row=b.closest(".qm");const m=(state.data.missions||[]).find(x=>String(x.Id)===row.dataset.mid)||null;if(!m&&b.dataset.qact!=="sprint")return;
  const nm=m?m.Name:row.querySelector(".qn").textContent.replace("▶ ","");
  if(b.dataset.qact==="sprint"){startSprint(nm);if(m&&m.State!=="In Progress"&&state.data.live)write(b,"set_state",{database:"Personal OS/Task",entityId:m.Id,state:"In Progress"},`Sprint started: ${nm}`);return;}
  if(b.dataset.qact==="done"){const left=(state.data.missions||[]).filter(x=>x.Project===m.Project&&x.Id!==m.Id).length;
    write(b,"set_state",{database:"Personal OS/Task",entityId:m.Id,state:"Done"},left?`Mission complete: ${nm}`:`Quest cleared: ${m.Project}`);if(sprint&&sprint.name===nm)stopSprint();}
  if(b.dataset.qact==="start")write(b,"set_state",{database:"Personal OS/Task",entityId:m.Id,state:"In Progress"},`Started: ${nm}`);});
card.addEventListener("change",e=>{const s=e.target.closest("select[data-qact=agent]");if(!s||!s.value)return;const row=s.closest(".qm");const m=(state.data.missions||[]).find(x=>String(x.Id)===row.dataset.mid);if(!m)return;
  write(s,"update_entities",{database:"Personal OS/Task",entities:[{id:m.Id,"Personal OS/Delegate":s.value}]},`${s.options[s.selectedIndex].text} took the mission: ${m.Name}`);});
/* focus sprint: a 25-minute timer pinned to one mission */
let sprint=null;const sprintEl=$("sprint"),sprintT=$("sprintT"),sprintN=$("sprintN");
function startSprint(name){sprint={name,end:Date.now()+25*60000};sprintN.textContent=name;sprintEl.hidden=false;tickSprint();toast(`25 minutes on: ${name}`);}
function stopSprint(){sprint=null;sprintEl.hidden=true;}
function tickSprint(){if(!sprint)return;const left=Math.max(0,sprint.end-Date.now());const m=Math.floor(left/60000),s2=Math.floor(left%60000/1000);sprintT.textContent=`${String(m).padStart(2,"0")}:${String(s2).padStart(2,"0")}`;
  if(left<=0){const n=sprint.name;stopSprint();celebrate();toast(`Sprint done on "${n}". Press Done if it's finished, or start another sprint.`);}}
setInterval(tickSprint,1000);$("sprintX").addEventListener("click",stopSprint);
const toastEl=$("toast");let toastT=0;
function toast(msg,bad){toastEl.textContent=msg;toastEl.style.borderTop=`4px solid ${bad?"var(--alarm)":"var(--mint)"}`;toastEl.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>toastEl.classList.remove("on"),3200);}
/* confetti burst over the player when a mission is done */
let confetti=[];
function celebrate(){if(reduceMotion)return;for(let i=0;i<60;i++){const m=new THREE.Mesh(new THREE.PlaneGeometry(.25,.4),new THREE.MeshBasicMaterial({color:PENNANT[i%PENNANT.length],side:THREE.DoubleSide}));m.position.copy(player.position).add(new THREE.Vector3(0,3,0));scene.add(m);confetti.push({m,v:new THREE.Vector3((Math.random()-.5)*8,6+Math.random()*6,(Math.random()-.5)*8),life:2.2});}}

/* ---------- minimap ---------- */
const mini=$("mini"),mg=mini.getContext("2d");
function drawMini(){const W=mini.width,s=W/2/ringRadius;mg.clearRect(0,0,W,W);mg.save();mg.translate(W/2,W/2);
  rooms.forEach(r=>{const c=new THREE.Color(r.tint);mg.fillStyle=`rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},.7)`;const h=r.size*s/2;mg.beginPath();if(mg.roundRect)mg.roundRect(r.x*s-h,r.z*s-h,h*2,h*2,6);else mg.rect(r.x*s-h,r.z*s-h,h*2,h*2);mg.fill();
    if(r.score!=null){mg.strokeStyle="#"+new THREE.Color(scoreColor(r.score)).getHexString();mg.lineWidth=4;mg.beginPath();mg.arc(r.x*s,r.z*s,h+5,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(.04,r.score/100));mg.stroke();}});
  focusList.forEach((f,i)=>{if(!f.pos)return;mg.fillStyle=i===guideIx?"#ffb000":"#ffd36a";mg.strokeStyle="#2a2233";mg.lineWidth=2;mg.beginPath();mg.arc(f.pos.x*s,f.pos.z*s,i===guideIx?9:6,0,Math.PI*2);mg.fill();mg.stroke();mg.fillStyle="#2a2233";mg.font="800 11px sans-serif";mg.textAlign="center";mg.textBaseline="middle";mg.fillText(String(i+1),f.pos.x*s,f.pos.z*s+.5);});
  mg.fillStyle="#2a2233";mg.beginPath();mg.arc(player.position.x*s,player.position.z*s,6,0,Math.PI*2);mg.fill();
  mg.strokeStyle="#f2a93b";mg.lineWidth=3;mg.beginPath();mg.moveTo(player.position.x*s,player.position.z*s);mg.lineTo(player.position.x*s-Math.sin(yaw)*16,player.position.z*s-Math.cos(yaw)*16);mg.stroke();mg.restore();}
mini.addEventListener("click",e=>{const r=mini.getBoundingClientRect(),s=mini.width/2/ringRadius;const x=((e.clientX-r.left)/r.width*mini.width-mini.width/2)/s,z=((e.clientY-r.top)/r.height*mini.width-mini.width/2)/s;
  let best=null,bd=1e9;rooms.forEach(rm=>{const d=Math.hypot(rm.x-x,rm.z-z);if(d<bd){bd=d;best=rm;}});if(best)travel={x:best.x,z:best.z+(best.name==="Throne Room"?10:0)};});
$("homeBtn").addEventListener("click",()=>{travel={x:0,z:8};});

/* ---------- loop ---------- */
const clock=new THREE.Clock();let miniT=0,skyT=0;const roomName=$("roomName");
function resize(){renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener("resize",resize);resize();
function step(){
  const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;
  let fx=0,fz=0;if(keys.w||keys.arrowup)fz-=1;if(keys.s||keys.arrowdown)fz+=1;if(keys.a||keys.arrowleft)fx-=1;if(keys.d||keys.arrowright)fx+=1;fx+=joyV.x;fz+=joyV.y;
  if(keys.q)yaw+=dt*1.7;if(keys.e)yaw-=dt*1.7;
  if(keys.r)pitch=Math.min(1.35,pitch+dt*.9);if(keys.f)pitch=Math.max(.12,pitch-dt*.9);
  if(keys.z||keys["="]||keys["+"])dist=Math.max(7,dist-dt*24);if(keys.x||keys["-"])dist=Math.min(70,dist+dt*24);
  if(camTween){const k=Math.min(1,dt*4);yaw+=(camTween.yaw-yaw)*k;pitch+=(camTween.pitch-pitch)*k;dist+=(camTween.dist-dist)*k;if(Math.abs(camTween.dist-dist)<.2&&Math.abs(camTween.pitch-pitch)<.01)camTween=null;}
  gearSpin.forEach(gs=>{gs.o.rotation.z+=dt*gs.s;});if(!reduceMotion)pulsers.forEach(p=>{p.o.scale.setScalar(p.s+Math.sin(t*p.sp)*p.amp);});updateTrail(dt,t);clouds.forEach(c=>{c.position.x+=dt*1.6;if(c.position.x>220)c.position.x=-220;});
  const speed=keys.shift?22:11;let moving=false;
  if(fx||fz){travel=null;moving=true;const l=Math.hypot(fx,fz)||1,m=Math.min(1,l);fx/=l;fz/=l;const dx=Math.cos(yaw)*fx+Math.sin(yaw)*fz,dz=-Math.sin(yaw)*fx+Math.cos(yaw)*fz;
    player.position.x+=dx*speed*m*dt;player.position.z+=dz*speed*m*dt;player.rotation.y=Math.atan2(dx,dz);}
  else if(travel){const dx=travel.x-player.position.x,dz=travel.z-player.position.z,d=Math.hypot(dx,dz);if(d<.4)travel=null;else{moving=true;const v=Math.min(d,32*dt);player.position.x+=dx/d*v;player.position.z+=dz/d*v;player.rotation.y=Math.atan2(dx,dz);}}
  const lim=ringRadius+12,pr=Math.hypot(player.position.x,player.position.z);if(pr>lim){player.position.x*=lim/pr;player.position.z*=lim/pr;}
  const ty=pr<12.5?.9:0;player.position.y+=(ty-player.position.y)*.2;
  if(moving&&!reduceMotion)player.children[0].position.y=1+Math.abs(Math.sin(t*12))*.12;
  /* pup trots behind */
  const behind=new THREE.Vector3(Math.sin(player.rotation.y)*-2.2+1.2,0,Math.cos(player.rotation.y)*-2.2).add(player.position);
  const pd=pup.position.distanceTo(behind);if(pd>.3){pup.position.lerp(behind,Math.min(1,dt*(pd>6?6:3)));pup.lookAt(player.position.x,pup.position.y,player.position.z);}
  pup.position.y=player.position.y+(reduceMotion?0:Math.abs(Math.sin(t*14))*(pd>.5?.15:.03));
  const cx=player.position.x+Math.sin(yaw)*Math.cos(pitch)*dist,cz=player.position.z+Math.cos(yaw)*Math.cos(pitch)*dist;
  camera.position.set(cx,player.position.y+1.5+Math.sin(pitch)*dist,cz);camera.lookAt(player.position.x,player.position.y+1.8,player.position.z);
  sky.position.copy(camera.position);stars.position.copy(camera.position);
  if(!reduceMotion){spinners.forEach(s=>{s.rotation.y+=dt*.7;});bobbers.forEach(b=>{b.o.position.y=b.base+Math.sin(t*2+b.ph)*(b.amp||.2);});}
  lamps.forEach((l,i)=>{const on=l.base;if(l.beam){l.glow.material.opacity=.04+on*.16;return;}if(l.pl)l.pl.intensity=on*(1.3+(reduceMotion?0:Math.sin(t*7+i)*.1));if(l.glow&&l.glow.material.emissiveIntensity!==undefined)l.glow.material.emissiveIntensity=.2+on*1.6;});
  for(let i=confetti.length-1;i>=0;i--){const c=confetti[i];c.v.y-=12*dt;c.m.position.addScaledVector(c.v,dt);c.m.rotation.x+=dt*6;c.m.rotation.z+=dt*4;c.life-=dt;if(c.life<=0){scene.remove(c.m);c.m.geometry.dispose();confetti.splice(i,1);}}
  let near=null,nd=1e9;for(const it of interactables){const d=Math.hypot(it.pos.x-player.position.x,it.pos.z-player.position.z);if(d<it.radius&&d<nd){nd=d;near=it;}}showCard(near);
  miniT+=dt;if(miniT>.1){miniT=0;drawMini();let rn="Courtyard";for(const r of rooms){if(Math.hypot(r.x-player.position.x,r.z-player.position.z)<r.size/2+2){rn=r.name;break;}}roomName.textContent=rn;}
  skyT+=dt;if(skyT>30){skyT=0;applySky();}
  renderer.render(scene,camera);requestAnimationFrame(step);
}

/* ---------- data ---------- */
const srcDot=$("srcDot"),srcLabel=$("srcLabel"),msg=$("statusMsg"),allowBtn=$("allowBtn"),refreshBtn=$("refreshBtn");
function setSource(kind,text,note){srcDot.className="dot "+kind;srcLabel.textContent=text;if(note){msg.textContent=note;msg.hidden=false;}else msg.hidden=true;}
function setXP(done){const xp=done*10;$("xp").hidden=false;$("xpNum").textContent=xp;$("xpLabel").textContent=state.data.live?"Week XP":"Example XP";$("xpfill").style.width=Math.min(100,xp/300*100)+"%";}

buildWorld(DEMO);setXP(DEMO.doneWeek);requestAnimationFrame(step);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{buildWorld(state.data);current=null;});

let LIVE=false;
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

}
