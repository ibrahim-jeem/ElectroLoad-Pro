/* ElectroLoad Pro | SLD renderer with node tooltips and viewport zoom. */
let sldZoom = 1;
function changeSldZoom(factor) {
    sldZoom = Math.max(0.55, Math.min(2.25, sldZoom * factor));
    const svg=document.getElementById('sldSvg');
    if(svg && svg.dataset.baseWidth) {
        const w=Number(svg.dataset.baseWidth)/sldZoom, h=Number(svg.dataset.baseHeight)/sldZoom;
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
}
function resetSldZoom(){sldZoom=1;changeSldZoom(1);}
function renderSLD(mainMccbRating,totalCurrent) {
    const svg=document.getElementById('sldSvg'); if(!svg)return;
    svg.replaceChildren();
    const NS='http://www.w3.org/2000/svg';
    const root=boards[0]; if(!root)return;
    const children=b=>boards.filter(x=>x.par===b.id&&x!==b);
    const positions=new Map(); let leaf=0;
    const maxCircuits=Math.max(1,...boards.map(b=>circuits.filter(c=>c.board===b.id).length));
    const step=Math.max(300, maxCircuits*105+180), margin=220;
    function place(board,depth){
        const kids=children(board); let x;
        if(!kids.length){x=margin+leaf*step;leaf++;}
        else {const xs=kids.map(k=>place(k,depth+1));x=(Math.min(...xs)+Math.max(...xs))/2;}
        positions.set(board.id,{x,depth});return x;
    }
    place(root,0);
    const depth=Math.max(0,...[...positions.values()].map(p=>p.depth));
    const width=Math.max(1050,margin*2+Math.max(0,leaf-1)*step);
    const height=230+(depth+1)*300;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    svg.dataset.baseWidth=width;svg.dataset.baseHeight=height;sldZoom=1;
    svg.style.width=width+'px';svg.style.height=height+'px';
    let toolbar=svg.parentElement.querySelector('[data-sld-toolbar]');
    if(!toolbar){
        toolbar=document.createElement('div');toolbar.dataset.sldToolbar='1';
        toolbar.className='flex items-center justify-end gap-2 mb-3';
        toolbar.innerHTML='<span class="text-xs text-slate-400 mr-auto">Hover a board, feeder or circuit for details</span><button type="button" class="px-3 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700" data-zoom="out">− Zoom</button><button type="button" class="px-3 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700" data-zoom="reset">Reset</button><button type="button" class="px-3 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700" data-zoom="in">+ Zoom</button>';
        svg.parentElement.insertBefore(toolbar,svg);
        toolbar.addEventListener('click',e=>{const action=e.target.closest('button')?.dataset.zoom;if(action==='in')changeSldZoom(1.2);if(action==='out')changeSldZoom(1/1.2);if(action==='reset')resetSldZoom();});
    }
    const group=document.createElementNS(NS,'g');svg.appendChild(group);
    const colors={R:'#ef4444',Y:'#eab308',B:'#3b82f6',N:'#64748b'};
    const line=(x1,y1,x2,y2,color='#38bdf8',width=2,dash=false,title='')=>{
        const el=document.createElementNS(NS,'line');
        Object.entries({x1,y1,x2,y2,stroke:color,'stroke-width':width,'stroke-linecap':'round'}).forEach(([k,v])=>el.setAttribute(k,v));
        if(dash)el.setAttribute('stroke-dasharray','5 4');
        if(title){const t=document.createElementNS(NS,'title');t.textContent=title;el.appendChild(t);}
        group.appendChild(el);return el;
    };
    const text=(value,x,y,size=11,color='#e2e8f0',anchor='middle')=>{
        const el=document.createElementNS(NS,'text');Object.entries({x,y,'font-size':size,fill:color,'text-anchor':anchor}).forEach(([k,v])=>el.setAttribute(k,v));el.textContent=String(value??'');group.appendChild(el);return el;
    };
    const rect=(x,y,w,h,stroke,lines,title)=>{
        const g=document.createElementNS(NS,'g');g.setAttribute('class','sld-node');
        const r=document.createElementNS(NS,'rect');Object.entries({x,y,width:w,height:h,rx:8,fill:'#0f172a',stroke,'stroke-width':2}).forEach(([k,v])=>r.setAttribute(k,v));g.appendChild(r);
        const t=document.createElementNS(NS,'title');t.textContent=title;g.appendChild(t);
        lines.forEach((entry,i)=>{const tx=document.createElementNS(NS,'text');Object.entries({x:x+w/2,y:y+23+i*17,'font-size':entry.size||11,'font-weight':i===0?'700':'400',fill:entry.color||'#e2e8f0','text-anchor':'middle'}).forEach(([k,v])=>tx.setAttribute(k,v));tx.textContent=entry.text;g.appendChild(tx);});
        group.appendChild(g);return g;
    };
    const rootX=positions.get(root.id).x;
    rect(rootX-120,18,240,38,'#0284c7',[{text:(is3PSystem()?'3-PHASE':'1-PHASE')+' INCOMER · '+(is3PSystem()?config.voltageLL:config.voltageLN)+' V'}],'Incoming supply: '+config.phase+', '+(is3PSystem()?config.voltageLL:config.voltageLN)+' volts');
    line(rootX,56,rootX,72);
    rect(rootX-100,72,200,42,'#ef4444',[{text:'MAIN MCCB'},{text:mainMccbRating==null?'NOT SIZED':mainMccbRating+' A'}],'Main breaker estimate '+(mainMccbRating==null?'not sized':mainMccbRating+' amperes')+'. Incomer current '+Number(totalCurrent||0).toFixed(2)+' A.');
    line(rootX,114,rootX,145);
    const top=b=>145+positions.get(b.id).depth*300, busY=b=>top(b)+105;
    for(const board of boards){
        const p=positions.get(board.id);if(!p)continue;
        const x=p.x,y=top(board),bus=busY(board),three=bSup(board)===3;
        const own=circuits.filter(c=>c.board===board.id),kids=children(board);
        const area=board.room||'Unspecified area';
        const boardDetails=[
            {text:board.name,size:14},
            {text:(board.type||'DB')+' · '+(three?'3-phase':'1-phase')+' · '+area,color:'#7dd3fc'},
            {text:'Load '+Number(board.s?.kw||0).toFixed(2)+' kW · Max '+Number(board.s?.mx||0).toFixed(2)+' A',color:'#cbd5e1'},
            {text:'Main protection: '+(board.s?.cb==null?'NOT SIZED':board.s.cb+' A'),color:board.s?.cb==null?'#fca5a5':'#86efac'}
        ];
        rect(x-135,y,270,88,'#38bdf8',boardDetails,'Board: '+board.name+'; type '+board.type+'; area '+area+'; parent '+(board.par?(boardOf(board.par)?.name||board.par):'Incoming supply')+'; supply '+(three?'3-phase':'1-phase')+'; load '+Number(board.s?.kw||0).toFixed(2)+' kW; maximum current '+Number(board.s?.mx||0).toFixed(2)+' A; protection '+(board.s?.cb==null?'not sized':board.s.cb+' A'));
        line(x,y+88,x,bus,'#38bdf8',2);
        const childXs=kids.map(k=>positions.get(k.id).x);
        const circuitStart=kids.length?Math.min(...childXs)-own.length*100-70:x-((own.length-1)/2)*100;
        const taps=own.map((c,i)=>circuitStart+i*100);
        const all=[...taps,...childXs],left=all.length?Math.min(x,...all)-35:x-100,right=all.length?Math.max(x,...all)+35:x+100;
        if(three){line(left,bus,right,bus,colors.R,4);line(left,bus+7,right,bus+7,colors.Y,4);line(left,bus+14,right,bus+14,colors.B,4);line(left,bus+21,right,bus+21,colors.N,1.5,true);}
        else{line(left,bus,right,bus,colors[board.e]||colors.R,4);line(left,bus+9,right,bus+9,colors.N,1.5,true);}
        own.forEach((c,i)=>{
            const cx=taps[i],current=Number(c.current||0).toFixed(2);
            line(cx,bus+24,cx,bus+42,c.sup===3?'#cbd5e1':(colors[c.phase]||colors.R),2);
            rect(cx-43,bus+42,86,55,'#64748b',[{text:c.id},{text:(c.mcb==null?'N/S':c.mcb+' A')+' · '+c.sup+'P',color:'#7dd3fc'},{text:Number(c.watts).toFixed(0)+' W',color:'#cbd5e1'}],'Circuit '+c.id+'; board '+board.name+'; loads '+c.items.map(f=>f.name).join(', ')+'; rooms '+c.rooms.join(', ')+'; current '+current+' A; breaker '+(c.mcb==null?'not sized':c.mcb+' A')+'; phase '+c.phase);
        });
        kids.forEach(child=>{
            const cx=positions.get(child.id).x,childTop=top(child);
            line(cx,bus+24,cx,bus+47,'#f59e0b',2);
            rect(cx-52,bus+47,104,42,'#f59e0b',[{text:'FEEDER BREAKER'},{text:child.s?.cb==null?'NOT SIZED':child.s.cb+' A'}],'Feeder from '+board.name+' to '+child.name+'; downstream board '+(bSup(child)===3?'3-phase':'1-phase')+'; calculated feeder protection '+(child.s?.cb==null?'not sized':child.s.cb+' A'));
            line(cx,bus+89,cx,childTop,'#f59e0b',2,false,'Feeder '+board.name+' → '+child.name);
        });
    }
    text('Conceptual SLD only · feeder topology follows each board parent relationship',16,height-14,10,'#fbbf24','start');
}
