/* globals pdfLib */
const { PDFDocument, rgb, StandardFonts } = PDFLib;

document.getElementById('go' ).onclick = () => makePlan(false);
document.getElementById('go4').onclick = () => makePlan(true);

async function makePlan(make4UP) {
  const startStr = document.getElementById('start').value;
  const endStr   = document.getElementById('end'  ).value;
  if (!startStr || !endStr) return alert('Bitte Daten wählen!');
  const start = new Date(startStr), end = new Date(endStr);
  if (end < start) return alert('Enddatum liegt vor dem Start!');

  const weeklyDoc = await PDFDocument.create();
  for (let m = toMonday(start); m <= end; m = addDays(m, 7))
    await drawWeekPage(weeklyDoc, m);
  const weeklyBytes = await weeklyDoc.save();
  download(weeklyBytes, `Studiumsplan_${startStr}_${endStr}_weekly.pdf`);

  if (!make4UP) return;

  const fourDoc = await PDFDocument.create();
  const refs    = await fourDoc.embedPdf(weeklyBytes);
  const W = refs[0].width, H = refs[0].height;
  for (let i = 0; i < refs.length; i += 4) {
    const p = fourDoc.addPage([2*W, 2*H]);
    [[0,H],[W,H],[0,0],[W,0]].forEach(([x,y],idx)=>{
      if (refs[i+idx]) p.drawPage(refs[i+idx],{x,y,width:W,height:H});
    });
  }
  download(await fourDoc.save(),
           `Studiumsplan_${startStr}_${endStr}_4up.pdf`);
}

// ---------- Hilfsfunktionen ----------
function toMonday(d){ const wd=d.getDay(); return addDays(d, wd===0? -6 : 1-wd); }
function addDays(d,n){ return new Date(+d + n*86400000); }
function fmt(d){ return d.toISOString().slice(0,10).split('-').reverse().join('.'); }

async function drawWeekPage(doc, monday){
  const page = doc.addPage([842,595]), m = 28;
  const gridW = page.getWidth()-2*m, gridH = page.getHeight()-2*m-30;
  const fB = await doc.embedFont(StandardFonts.HelveticaBold);
  const fR = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText(
    `Woche ${fmt(monday)} – ${fmt(addDays(monday,6))}`,
    {x:m,y:page.getHeight()-m-20,size:12,font:fB}
  );

  const cols=8, rows=15, cw=gridW/cols, rh=gridH/rows, g=rgb(.6,.6,.6);
  drawGrid(page,m,gridW,gridH,cw,rh,g);

  const days=['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];
  days.forEach((d,i)=>{
    page.drawText(`${d}\n${fmt(addDays(monday,i))}`,{
      x:m+(i+1)*cw+2,y:m+gridH-rh+4,size:8,font:fB,lineHeight:9
    });
  });
  page.drawText('Zeit',{x:m+2,y:m+gridH-rh+4,size:8,font:fB});

  for(let h=8;h<=21;h++){
    const label=`${String(h).padStart(2,'0')}:00`;
    const row=h-8+1;
    page.drawText(label,{x:m+4,y:m+gridH-(row+1)*rh+4,size:8,font:fR});
    for(let d=1;d<cols;d++){
      page.drawText(label,{
        x:m+d*cw+cw-30,y:m+gridH-(row+1)*rh+rh-10,
        size:6,font:fR,color:rgb(.5,.5,.5)
      });
    }
  }
}

function drawGrid(pg,x0,w,h,cw,rh,c){
  pg.drawRectangle({x:x0,y:x0,width:w,height:h,borderColor:c,borderWidth:.5});
  for(let i=1;i<8;i++){const x=x0+i*cw; pg.drawLine({start:{x,y:x0},end:{x,y:x0+h},
    thickness:.5,color:c});}
  for(let r=1;r<15;r++){const y=x0+r*rh; pg.drawLine({start:{x:x0,y},end:{x:x0+w,y},
    thickness:.5,color:c});}
}

function download(bytes,name){
  const blob=new Blob([bytes],{type:'application/pdf'});
  const url=URL.createObjectURL(blob);
  Object.assign(document.createElement('a'),{href:url,download:name}).click();
  setTimeout(()=>URL.revokeObjectURL(url),1e3);
}