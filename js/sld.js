/* ElectroLoad Pro | sld.js
 * Deterministic tree-based conceptual SLD. Downstream feeders follow each board's explicit par reference.
 * Preliminary visualization only; not a construction drawing or protection-coordination study.
 */
function renderSLD(mainMccbRating,totalCurrent) {
 const svg=document.getElementById('sldSvg'); svg.replaceChildren();
 const NS='http://www.w3.org/2000/svg', g=document.createElementNS(NS,'g'); svg.appendChild(g);
 const phaseColor={R:'#ef4444',Y:'#eab308',B:'#3b82f6',N:'#64748b'};
 const line=(x1,y1,x2,y2,color='#38bdf8',width=2,dash=false)=>{const e=document.createElementNS(NS,'line');Object.entries({x1,y1,x2,y2,stroke:color,'stroke-width':width}).forEach(([k,v])=>e.setAttribute(k,v));if(dash)e.setAttribute('stroke-dasharray','5 4');g.appendChild(e);};
 const label=(v,x,y,color='#e2e8f0',size=9,anchor='middle')=>{const e=document.createElementNS(NS,'text');Object.entries({x,y,fill:color,'font-size':size,'text-anchor':anchor}).forEach(([k,v])=>e.setAttribute(k,v));e.textContent=String(v??'');g.appendChild(e);};
 const box=(x,y,w,h,v,color='#38bdf8',size=9)=>{const e=document.createElementNS(NS,'rect');Object.entries({x,y,width:w,height:h,rx:5,fill:'#0f172a',stroke:color,'stroke-width':1.5}).forEach(([k,v])=>e.setAttribute(k,v));g.appendChild(e);label(v,x+w/2,y+h/2+3,'#e2e8f0',size);};
 const root=boards[0]; if(!root)return;
 const children=b=>boards.filter(k=>k.par===b.id&&k!==b), positions=new Map(); let leaf=0;
 const maxLocalCircuits=Math.max(0,...boards.map(b=>circuits.filter(c=>c.board===b.id).length));
 const margin=180+maxLocalCircuits*90, leafStep=Math.max(260,maxLocalCircuits*90+150);
 function place(b,depth){const kids=children(b);let x;if(!kids.length){x=margin+leaf*leafStep;leaf++;}else{const xs=kids.map(k=>place(k,depth+1));x=(Math.min(...xs)+Math.max(...xs))/2;}positions.set(b.id,{x,depth});return x;}
 place(root,0);
 const maxDepth=Math.max(...Array.from(positions.values(),p=>p.depth)),width=Math.max(900,margin*2+Math.max(0,leaf-1)*leafStep),height=210+(maxDepth+1)*250;
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=width+'px';svg.style.height=height+'px';
 const top=b=>130+positions.get(b.id).depth*250,bus=b=>top(b)+75;
 const rx=positions.get(root.id).x;
 box(rx-100,15,200,30,`${is3PSystem()?'3-PHASE':'1-PHASE'} SUPPLY · ${is3PSystem()?config.voltageLL:config.voltageLN} V`,'#0284c7',10);
 line(rx,45,rx,58);box(rx-70,58,140,34,`MAIN MCCB · ${mainMccbRating==null?'NOT SIZED':mainMccbRating+' A'}`,'#ef4444',9);
 label(`Incomer estimate: ${Number(totalCurrent||0).toFixed(1)} A`,rx,111,'#94a3b8',9);
 line(rx,92,rx,130,'#38bdf8',2);
 // Draw each board bus and its own final circuits.
 for(const b of boards){
  const x=positions.get(b.id).x,y=top(b),by=bus(b),three=bSup(b)===3,own=circuits.filter(c=>c.board===b.id),kids=children(b);
  box(x-92,y,184,42,`${b.name} · ${b.type} · ${b.room||'General'}`,'#38bdf8',9);
  label(`${three?'3P':'1P'} · ${Number(b.s?.mx||0).toFixed(1)} A · Main protection ${b.s?.cb==null?'NOT SIZED':b.s.cb+' A'}`,x,y+57,'#94a3b8',8);
 line(x,y+42,x,by,'#38bdf8',1.7);
  const childXs=kids.map(k=>positions.get(k.id).x);
  const circuitStart=kids.length?Math.min(...childXs)-own.length*78-55:x-((own.length-1)/2)*78;
  const circuitXs=own.map((c,i)=>circuitStart+i*78),taps=[...circuitXs,...childXs];
  const left=taps.length?Math.min(x,...taps)-24:x-85,right=taps.length?Math.max(x,...taps)+24:x+85;
  if(three){line(left,by,right,by,phaseColor.R,3);line(left,by+6,right,by+6,phaseColor.Y,3);line(left,by+12,right,by+12,phaseColor.B,3);line(left,by+18,right,by+18,phaseColor.N,1.5,true);}
  else{line(left,by,right,by,phaseColor[b.e]||phaseColor.R,3);line(left,by+8,right,by+8,phaseColor.N,1.5,true);}
  own.forEach((c,i)=>{const cx=circuitXs[i],col=c.sup===3?'#94a3b8':(phaseColor[c.phase]||phaseColor.R);line(cx,by+20,cx,by+38,col,1.5);box(cx-34,by+38,68,28,`${c.mcb==null?'N/S':c.mcb+'A'} ${c.sup===3?'3P':'MCB'}`,'#64748b',8);label(c.id,cx,by+82,'#cbd5e1',8);label(Math.round(c.watts)+' W',cx,by+94,'#38bdf8',8);});
  // Child feeder is a continuous parent-bus -> feeder breaker -> child board path.
  kids.forEach(k=>{const kx=positions.get(k.id).x,ky=top(k);line(kx,by+20,kx,by+62,'#94a3b8',1.7);box(kx-39,by+62,78,27,`${k.s?.cb==null?'N/S':k.s.cb+'A'} FEED`,'#f59e0b',8);line(kx,by+89,kx,ky,'#94a3b8',1.7);});
 }
 label(ENGINEERING_LIMITATION_NOTICE,12,height-14,'#fbbf24',8,'start');
}