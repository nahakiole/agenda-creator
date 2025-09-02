/* globals pdfLib */
const { PDFDocument, rgb, StandardFonts } = PDFLib;

document.getElementById('go' ).onclick = () => makePlan(false);
document.getElementById('go4').onclick = () => makePlan(true);

// ------------------------------------------------------------------------
async function makePlan(make4UP) {
  const startStr = document.getElementById('start').value;
  const endStr   = document.getElementById('end'  ).value;
  if (!startStr || !endStr) return alert('Bitte Daten wählen!');
  const start = new Date(startStr), end = new Date(endStr);
  if (end < start) return alert('Enddatum liegt vor dem Start!');

  // Basis-Dateiname, z.B. "Studienplan_2025-07-01_bis_2025-08-31"
  const baseName = `Studienplan_${startStr}_bis_${endStr}`;

  // ---------- Wochen-PDF erzeugen ---------------------------------------
  const weeklyDoc = await PDFDocument.create();
  weeklyDoc.setTitle(`Studienplan ${startStr} bis ${endStr}`);


  for (let monday = toMonday(start); monday <= end; monday = addDays(monday, 7))
    await drawWeekPage(weeklyDoc, monday);
  const weeklyBytes = await weeklyDoc.save();

  if (!make4UP) {
    preview(weeklyBytes, `${baseName}.pdf`);
    return;
  }

  // ---------- 4-up-PDF ---------------------------------------------------
  const srcDoc   = await PDFDocument.load(weeklyBytes);            // neu: nachladen
  const fourDoc  = await PDFDocument.create();

  fourDoc.setTitle(`Studienplan ${startStr} bis ${endStr} (4-up)`);

  const pageCnt  = srcDoc.getPageCount();
  const firstDim = srcDoc.getPage(0).getSize();
  const halfW    = firstDim.width  * 0.5;
  const halfH    = firstDim.height * 0.5;

  for (let i = 0; i < pageCnt; i += 4) {
    const target = fourDoc.addPage([halfW*2, halfH*2]);
    const slots  = [[0,halfH],[halfW,halfH],[0,0],[halfW,0]];
    for (let k = 0; k < 4 && i+k < pageCnt; k++) {
      const [x,y] = slots[k];
      const srcPage     = srcDoc.getPage(i+k);
      const embedded    = await fourDoc.embedPage(srcPage);
      target.drawPage(embedded, { x, y, width: halfW, height: halfH });
    }
  }
  preview(await fourDoc.save(), `${baseName}_4up.pdf`);
}

// ------------------------------------------------------------------
// Hilfsfunktionen
function toMonday(d){ const wd=d.getDay(); return addDays(d, wd===0? -6 : 1-wd); }
function addDays(d,n){ return new Date(+d + n*86400000); }
function fmt(d){ return d.toISOString().slice(0,10).split('-').reverse().join('.'); }

// Set default dates: current week's Monday to 4 weeks (28 days) span
function toYMD(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function setDefaultDates(){
  const today  = new Date();
  const monday = toMonday(today);
  const end    = addDays(monday, 27); // Sunday of the 4th week
  const startEl = document.getElementById('start');
  const endEl   = document.getElementById('end');
  if (startEl && !startEl.value) startEl.value = toYMD(monday);
  if (endEl && !endEl.value)     endEl.value   = toYMD(end);
}

async function drawWeekPage(doc, monday){
  const page = doc.addPage([842,595]);           // A4 quer
  const m = 28;
  const gridW = page.getWidth()  - 2*m;
  const gridH = page.getHeight() - 2*m - 30;

  const fB = await doc.embedFont(StandardFonts.HelveticaBold);
  const fR = await doc.embedFont(StandardFonts.Helvetica);

  // Kopf
  page.drawText(
    `Woche ${fmt(monday)} – ${fmt(addDays(monday,6))}`,
    { x:m, y:page.getHeight()-m-20, size:12, font:fB }
  );

  // Raster (ohne separate Zeit-Spalte)
  const cols=7, rows=15, cw=gridW/cols, rh=gridH/rows, g=rgb(.6,.6,.6);
  drawGrid(page,m,gridW,gridH,cw,rh,g,cols,rows);

  // Spaltenkopf: kurzer Tag + Datum (eine Zeile)
  const days=['Mo','Di','Mi','Do','Fr','Sa','So'];
  days.forEach((d,i)=>{
    page.drawText(`${d} ${fmt(addDays(monday,i))}`,{
      x:m+i*cw+2,
      y:m+gridH-rh+6,
      size:8,
      font:fB
    });
  });

  // Zeiten + Mini-Labels
  for(let h=8;h<=21;h++){
    const label=`${String(h).padStart(2,'0')}:00`;
    const row=h-8+1;
    // Zeit-Label in jeder Zelle (oben rechts, dezent)
    for(let d=0;d<cols;d++){
      page.drawText(label,{
        x:m+d*cw+cw-18,
        y:m+gridH-(row+1)*rh+rh-8,
        size:6,
        font:fR,
        color:rgb(.5,.5,.5)
      });
    }
  }
}

function drawGrid(pg,x0,w,h,cw,rh,c, cols, rows){
  pg.drawRectangle({x:x0,y:x0,width:w,height:h,borderColor:c,borderWidth:.5});
  for(let i=1;i<cols;i++){
    const x=x0+i*cw;
    pg.drawLine({start:{x,y:x0},end:{x,y:x0+h},thickness:.5,color:c});
  }
  for(let r=1;r<rows;r++){
    const y=x0+r*rh;
    pg.drawLine({start:{x:x0,y},end:{x:x0+w,y},thickness:.5,color:c});
  }
}

// ------- PDF-Preview im <iframe> + Download-Link -------------------------
function preview(bytes, filename){
  /* ---- 1) File statt Blob ----------------------- */
  const file = new File([bytes], filename, { type: 'application/pdf' });
  const url  = URL.createObjectURL(file);
  const iframe = document.getElementById('preview');
  iframe.src = url;
  // Show iframe and hide placeholder background
  iframe.classList.remove('d-none');
  const ph = document.getElementById('pdf-placeholder');
  if (ph) ph.classList.add('d-none');

  /* ---- 2) Download-Link wie gehabt -------------- */
  const a = document.getElementById('dl');
  a.href = url;
  a.download = filename;
  a.textContent = 'PDF herunterladen';
  // Sicherstellen, dass der Link sichtbar ist
  a.classList.remove('d-none');

  /* ---- 3) Auto-Cleanup -------------------------- */
  setTimeout(()=>URL.revokeObjectURL(url), 10*60*1000);
}

// Initialize default date range on load
setDefaultDates();
