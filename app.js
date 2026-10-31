
// X3 Japanese Manga Converter V4.1 — PDF / ZIP / CBZ / EPUB input
// Sequential processing, grouped books, image controls and arrow-based preview.

const W=528,H=792,$=id=>document.getElementById(id);
let cancelled=false,selectedFiles=[],previewRequest=0,converting=false,previewBuilding=false;
let previewImages=[],previewPageIndex=0;

const folderInput=$('folder'),filesInput=$('files'),go=$('go'),
 cancel=$('cancel'),status=$('status'),bar=$('bar'),preview=$('preview');

const collator=new Intl.Collator('zh-CN',{numeric:true,sensitivity:'base'});
const imageExt=/\.(jpe?g|png|webp|bmp|gif|avif|tiff?)$/i;
const archiveExt=/\.(zip|cbz|epub)$/i;
let zipModulePromise=null,pdfModulePromise=null;

$('pickFolder').addEventListener('click',()=>folderInput.click());
$('pickFiles').addEventListener('click',()=>filesInput.click());
folderInput.addEventListener('change',()=>{
 if(folderInput.files?.length)acceptFiles(Array.from(folderInput.files),true);
});
filesInput.addEventListener('change',()=>{
 if(filesInput.files?.length)acceptFiles(Array.from(filesInput.files),false);
});

$('previewPrev').addEventListener('click',()=>showPreviewPage(previewPageIndex-1));
$('previewNext').addEventListener('click',()=>showPreviewPage(previewPageIndex+1));

$('includeCover').addEventListener('change',()=>{
 renderFileStatus();renderLivePreview();
});
$('outputMode').addEventListener('change',()=>{
 updateModeUI();renderLivePreview();
});
$('depth').addEventListener('change',updateCurrentPreview);
$('dither').addEventListener('change',updateCurrentPreview);
$('contrast').addEventListener('change',updateCurrentPreview);

for(const id of ['splitParts','doublePage','splitOverlap','trimMode','keepFirstPages'])$(id).addEventListener('change',renderLivePreview);

for(const id of ['brightness','ditherStrength','threshold']){
 $(id).addEventListener('input',()=>{
  const value=$(id).value;
  $(id+'Value').textContent=id==='ditherStrength'?value+'%':value;
  updateCurrentPreview();
 });
}

$('fromChapter').addEventListener('change',()=>{
 updateModeUI();renderLivePreview();
});
$('toChapter').addEventListener('change',()=>{
 updateModeUI();renderLivePreview();
});
$('chaptersPerBook').addEventListener('change',()=>{
 updateModeUI();renderLivePreview();
});

cancel.addEventListener('click',()=>{
 cancelled=true;
 cancel.disabled=true;
 status.textContent+='\n正在取消…';
});

updateModeUI();

function pathOf(f){return f.webkitRelativePath||f.name}
async function disposeVirtualFiles(files){for(const f of files||[])if(typeof f.__dispose==='function'){await f.__dispose();f.__dispose=null;}}

function isImage(f){
 return imageExt.test(f.name)&&(!f.type||f.type.startsWith('image/'));
}

async function acceptFiles(files,fromFolder){
 if(converting)return;
 previewRequest++;
 await disposeVirtualFiles(selectedFiles);
 selectedFiles=[];
 $('fileStatus').textContent='正在读取文件并建立页面索引……';
 go.disabled=true;
 try{
  const expanded=[];
  for(const file of files){
   if(isImage(file)) expanded.push(file);
   else if(/\.pdf$/i.test(file.name)) expanded.push(...await expandPdf(file));
   else if(archiveExt.test(file.name)) expanded.push(...await expandArchive(file));
  }
  selectedFiles=expanded.sort((a,b)=>collator.compare(pathOf(a),pathOf(b)));
  if(!selectedFiles.length){
   $('fileStatus').textContent='没有找到支持的图片或漫画文件。支持 JPG、PNG、WebP、PDF、ZIP、CBZ、EPUB。';
   go.disabled=true;previewRequest++;previewBuilding=false;previewImages=[];showPreviewPage(0);return;
  }
  const first=files[0];
  const baseName=first.name.replace(/\.[^.]+$/,'');
  $('bookTitle').value=fromFolder&&pathOf(selectedFiles[0]).split('/').length>1
   ?pathOf(selectedFiles[0]).split('/')[0]:baseName;
  fillChapterChoices();renderFileStatus();updateModeUI();renderLivePreview();
 }catch(err){
  selectedFiles=[];go.disabled=true;
  $('fileStatus').textContent='读取失败：'+(err?.message||err);
  console.error(err);
 }
}

function virtualPage(name,relativePath,loader){
 return {name,webkitRelativePath:relativePath,__loadImage:loader};
}

async function getZipModule(){
 if(!zipModulePromise)zipModulePromise=import('https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.8.21/+esm');
 return zipModulePromise;
}
async function getPdfModule(){
 if(!pdfModulePromise)pdfModulePromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/legacy/build/pdf.mjs');
 return pdfModulePromise;
}

async function expandPdf(file){
 const pdfjs=await getPdfModule();
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.4.624/build/pdf.worker.mjs';
 const data=new Uint8Array(await file.arrayBuffer());
 const task=pdfjs.getDocument({data,disableAutoFetch:true,disableStream:true,isEvalSupported:false});
 const pdf=await task.promise;
 const book=safeName(file.name.replace(/\.pdf$/i,''));
 const pages=[];
 for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){
  const n=pageNo;
  pages.push(virtualPage(String(n).padStart(5,'0')+'.pdfpage',book+'/'+book+'/'+String(n).padStart(5,'0')+'.jpg',async()=>{
   const page=await pdf.getPage(n);
   const viewport=page.getViewport({scale:1.5});
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   await page.render({canvasContext:ctx,viewport,background:'rgb(255,255,255)'}).promise;
   page.cleanup();
   return canvas;
  }));
 }
 // PDF document stays available for lazy page rendering; release after this book is processed.
 let disposed=false;const dispose=async()=>{if(disposed)return;disposed=true;try{await pdf.destroy()}catch(_){}};
 pages.forEach(f=>f.__dispose=dispose);
 return pages;
}

function normalizeZipPath(path){
 const out=[];
 for(const part of path.replace(/\\/g,'/').split('/')){
  if(!part||part==='.')continue;
  if(part==='..')out.pop();else out.push(part);
 }
 return out.join('/');
}
async function expandArchive(file){
 const {ZipReader,BlobReader,BlobWriter,TextWriter}=await getZipModule();
 const reader=new ZipReader(new BlobReader(file));
 try{
  const entries=await reader.getEntries();
  const byName=new Map(entries.filter(e=>!e.directory).map(e=>[normalizeZipPath(e.filename),e]));
  let imagePaths=[];
  const isImg=p=>imageExt.test(p);
  if(/\.epub$/i.test(file.name)){
   // EPUB: prefer OPF spine order (including XHTML image references), then append remaining images.
   let opfPath=null,opfText='';
   const container=byName.get('META-INF/container.xml');
   if(container?.getData){const t=await container.getData(new TextWriter());const xml=new DOMParser().parseFromString(t,'application/xml');opfPath=xml.querySelector('rootfile')?.getAttribute('full-path')||null;}
   if(opfPath&&byName.has(normalizeZipPath(opfPath))){
    const opfEntry=byName.get(normalizeZipPath(opfPath));opfText=await opfEntry.getData(new TextWriter());
    const xml=new DOMParser().parseFromString(opfText,'application/xml');
    const base=normalizeZipPath(opfPath).split('/').slice(0,-1).join('/');
    const resolve=(href)=>normalizeZipPath((base?base+'/':'')+decodeURIComponent(href.split('#')[0]));
    const manifest=new Map();
    xml.querySelectorAll('manifest item').forEach(item=>manifest.set(item.getAttribute('id'),{href:item.getAttribute('href'),type:item.getAttribute('media-type')||''}));
    for(const ref of xml.querySelectorAll('spine itemref')){
     const item=manifest.get(ref.getAttribute('idref'));if(!item)continue;
     const path=resolve(item.href||'');
     if(isImg(path)){imagePaths.push(path);continue;}
     const entry=byName.get(path);
     if(entry&&/xhtml|html/i.test(item.type||path)){
      try{const html=await entry.getData(new TextWriter());const doc=new DOMParser().parseFromString(html,'text/html');
       for(const el of doc.querySelectorAll('img[src],image[href],image')){const href=el.getAttribute('src')||el.getAttribute('href')||el.getAttribute('xlink:href');if(href){const candidate=normalizeZipPath(path.split('/').slice(0,-1).concat(href.split('#')[0]).join('/'));if(isImg(candidate))imagePaths.push(candidate);}}
      }catch(_){}
     }
    }
    for(const item of manifest.values()){const path=resolve(item.href||'');if(isImg(path))imagePaths.push(path);}
   }
  }
  if(!imagePaths.length)imagePaths=entries.filter(e=>!e.directory&&isImg(normalizeZipPath(e.filename))).map(e=>normalizeZipPath(e.filename)).sort((a,b)=>collator.compare(a,b));
  imagePaths=[...new Set(imagePaths)].filter(p=>byName.has(p));
  if(!imagePaths.length)throw new Error('压缩包中没有找到漫画图片。');
  const book=safeName(file.name.replace(/\.(zip|cbz|epub)$/i,''));
  const firstParts=imagePaths[0]?.split('/')||[];
  const commonRoot=firstParts.length>1&&imagePaths.every(p=>p.split('/')[0]===firstParts[0])?firstParts[0]:null;
  const pages=imagePaths.map((path,index)=>{
   const entry=byName.get(path);const short=path.split('/').pop()||('page-'+index+'.jpg');
   const normalized=commonRoot?path.split('/').slice(1).join('/'):path;
   const rel=/\.epub$/i.test(file.name)
    ?book+'/'+book+'/'+String(index).padStart(6,'0')+'_'+short
    :book+'/'+(normalized.includes('/')?normalized:book+'/'+normalized);
   return virtualPage(short,rel,async()=>{
    const blob=await entry.getData(new BlobWriter());
    const url=URL.createObjectURL(blob);const img=new Image();
    try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('无法解码图片：'+short));img.src=url;});return img;}
    finally{URL.revokeObjectURL(url);}
   });
  });
  let disposed=false;const dispose=async()=>{if(disposed)return;disposed=true;try{await reader.close()}catch(_){}};
  pages.forEach(f=>f.__dispose=dispose);
  return pages;
 }catch(e){try{await reader.close()}catch(_){};throw e;}
}

function isRootCover(f){
 const p=pathOf(f).split('/');
 return /^cover\.(jpe?g|png|webp|bmp|gif|avif)$/i.test(p[p.length-1])&&p.length===2;
}

function chapterOf(f){
 const p=pathOf(f).split('/');
 return p.length>=3
  ?p[1]
  :(p.length===2&&!/^cover\.(jpe?g|png|webp|bmp|gif|avif)$/i.test(p[1])
   ?p[0]:'未分章图片');
}

function getChapters(){
 return [...new Set(
  selectedFiles.filter(f=>!isRootCover(f)).map(chapterOf)
 )].sort((a,b)=>collator.compare(a,b));
}

function fillChapterChoices(){
 const chapters=getChapters();

 for(const id of ['fromChapter','toChapter']){
  const el=$(id),old=el.value;
  el.innerHTML='';
  chapters.forEach(ch=>{
   const o=document.createElement('option');
   o.value=ch;
   o.textContent=ch;
   el.appendChild(o);
  });
  if(chapters.includes(old))el.value=old;
 }

 if(chapters.length){
  $('fromChapter').value=chapters[0];
  $('toChapter').value=chapters[chapters.length-1];
 }
}

function getOrderedFiles(){
 const all=selectedFiles.slice()
  .sort((a,b)=>collator.compare(pathOf(a),pathOf(b)));

 const i=all.findIndex(isRootCover);
 let cover=null;

 if(i>=0)cover=all.splice(i,1)[0];

 return $('includeCover').checked&&cover?[cover,...all]:all;
}

function renderFileStatus(){
 const cover=selectedFiles.find(isRootCover),chapters=getChapters();

 $('fileStatus').textContent=
  '已读取 '+selectedFiles.length+' 张图片，识别到 '+chapters.length+' 个章节文件夹。\n'+
  (chapters.length===1&&chapters[0]==='未分章图片'
   ?'⚠ 未能识别章节路径，分章模式不可用。请检查目录结构或更换浏览器。\n'
   :'')+
  (cover
   ?'找到根目录 Cover.jpg。'+
    ($('includeCover').checked?'将放在整部合并模式的第一页。':'封面不会加入。')
   :'未找到根目录 Cover.jpg。')+
  '\n章节和图片按自然数字顺序排列。';

 go.disabled=!getOrderedFiles().length;
}

function updateModeUI(){
 const mode=$('outputMode').value;

 $('rangeFields').style.display=mode==='range'?'flex':'none';
 $('batchFields').style.display=mode==='batch'?'flex':'none';

 $('modeHint').textContent=mode==='merge'
  ?'整部合并：所有章节图片会合并成一个 XTC/XTCH 文件。'
  :mode==='chapter'
   ?'逐章读取图片，完成一本后自动继续下一章。支持时可选择一次输出文件夹自动保存；否则最后下载一个 ZIP。'
   :mode==='range'
    ?'范围模式：选择起止章节，将范围内章节合并为一本。'
    :'分组模式：连续每 N 章生成一本，最后不足 N 章也会生成一本。支持时可选择一次输出文件夹自动保存全部成品。';
}

function setStatus(s,p){
 status.textContent=s;
 if(p!=null)bar.style.width=Math.max(0,Math.min(100,p))+'%';
}

function safeName(s){
 return (s||'漫画').replace(/[\\/:*?"<>|]/g,'_').trim()||'漫画';
}

function downloadBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;
 a.download=name;
 document.body.appendChild(a);
 a.click();
 a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function yieldUI(){
 return new Promise(r=>setTimeout(r,0));
}

function getGroups(){
 const mode=$('outputMode').value;
 const files=getOrderedFiles();
 const chapters=getChapters();

 if((mode==='chapter'||mode==='range'||mode==='batch')&&
    (chapters.length===0||
     (chapters.length===1&&chapters[0]==='未分章图片'))){
  throw new Error('没有识别到章节文件夹。请重新选择包含章节子文件夹的漫画总文件夹。');
 }

 function makeChapter(name,chapterFiles){
  return {
   name,
   files:chapterFiles.filter(f=>!isRootCover(f))
    .sort((a,b)=>collator.compare(pathOf(a),pathOf(b)))
  };
 }

 const chapterGroups=chapters.map(name=>makeChapter(
  name,files.filter(f=>!isRootCover(f)&&chapterOf(f)===name)
 )).filter(ch=>ch.files.length>0);

 const cover=files.find(isRootCover);

 if(mode==='merge'){
  const segments=[];
  if($('includeCover').checked&&cover){
   segments.push({name:'封面',files:[cover]});
  }
  segments.push(...chapterGroups);

  return [{
   name:safeName($('bookTitle').value||'漫画'),
   chapters:segments,
   files:segments.flatMap(ch=>ch.files)
  }];
 }

 if(mode==='range'){
  let start=chapters.indexOf($('fromChapter').value);
  let end=chapters.indexOf($('toChapter').value);

  if(start<0||end<0)throw new Error('请先选择起始章节和结束章节。');
  if(start>end)[start,end]=[end,start];

  const selectedNames=new Set(chapters.slice(start,end+1));
  const selected=chapterGroups.filter(ch=>selectedNames.has(ch.name));

  return [{
   name:safeName(
    ($('bookTitle').value||'漫画')+'_'+chapters[start]+'-'+chapters[end]
   ),
   chapters:selected,
   files:selected.flatMap(ch=>ch.files)
  }];
 }

 if(mode==='batch'){
  const size=Math.max(1,Number($('chaptersPerBook').value)||5);
  const title=safeName($('bookTitle').value||'漫画');
  const groups=[];

  for(let i=0;i<chapterGroups.length;i+=size){
   const selected=chapterGroups.slice(i,i+size);

   groups.push({
    name:safeName(
     title+'_'+String(i+1).padStart(3,'0')+'-'+
     String(i+selected.length).padStart(3,'0')
    ),
    chapters:selected,
    files:selected.flatMap(ch=>ch.files)
   });
  }

  return groups;
 }

 return chapterGroups.map(ch=>({
  name:safeName(ch.name),
  files:ch.files
 }));
}


function mangaCanvas(w,h){
 const c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;
}
function mangaCrop(s,x,y,w,h){
 x=Math.max(0,Math.floor(x));y=Math.max(0,Math.floor(y));
 w=Math.max(1,Math.min(s.width-x,Math.ceil(w)));
 h=Math.max(1,Math.min(s.height-y,Math.ceil(h)));
 const c=mangaCanvas(w,h);
 c.getContext('2d').drawImage(s,x,y,w,h,0,0,w,h);return c;
}
function mangaRotate90(s){
 const c=mangaCanvas(s.height,s.width),x=c.getContext('2d');
 x.translate(c.width/2,c.height/2);x.rotate(Math.PI/2);
 x.drawImage(s,-s.width/2,-s.height/2);return c;
}
function mangaMakePage(s){
 const c=mangaCanvas(W,H),x=c.getContext('2d');
 x.fillStyle='#fff';x.fillRect(0,0,W,H);
 x.imageSmoothingEnabled=true;x.imageSmoothingQuality='high';
 x.drawImage(s,0,0,W,H);return c;
}
function mangaGray(s,maxW=420,maxH=640){
 const scale=Math.min(1,maxW/s.width,maxH/s.height);
 const w=Math.max(1,Math.round(s.width*scale)),h=Math.max(1,Math.round(s.height*scale));
 const c=mangaCanvas(w,h),x=c.getContext('2d',{willReadFrequently:true});
 x.drawImage(s,0,0,w,h);
 const d=x.getImageData(0,0,w,h).data,g=new Uint8Array(w*h);
 for(let i=0,p=0;i<d.length;i+=4,p++)g[p]=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]);
 return{g,w,h,scale};
}
function mangaColorPage(s){
 const c=mangaCanvas(72,96),x=c.getContext('2d',{willReadFrequently:true});
 x.drawImage(s,0,0,72,96);
 const d=x.getImageData(0,0,72,96).data;let n=0,k=0;
 for(let i=0;i<d.length;i+=16){n++;if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])>38)k++;}
 return k/Math.max(1,n)>.10;
}
function mangaTrimWhite(s){
 const mode=$('trimMode').value,{g,w,h,scale}=mangaGray(s,700,950);
 const th=mode==='strong'?247:251,lim=mode==='strong'?.28:.20;
 function row(y){let n=0,k=0;for(let x=0;x<w;x+=2){n++;if(g[y*w+x]>=th)k++;}return k/Math.max(1,n);}
 function col(x){let n=0,k=0;for(let y=0;y<h;y+=2){n++;if(g[y*w+x]>=th)k++;}return k/Math.max(1,n);}
 let t=0,b=h-1,l=0,r=w-1;
 while(t<h*lim&&row(t)>(mode==='strong'?.84:.92))t++;
 while(b>h-1-h*lim&&row(b)>(mode==='strong'?.84:.92))b--;
 while(l<w*lim&&col(l)>(mode==='strong'?.84:.92))l++;
 while(r>w-1-w*lim&&col(r)>(mode==='strong'?.84:.92))r--;
 if(r-l<w*.35||b-t<h*.35)return s;
 let out=mangaCrop(s,l/scale,t/scale,(r-l+1)/scale,(b-t+1)/scale);
 if(mode==='strong'){
  const mx=Math.round(out.width*.008),my=Math.round(out.height*.008);
  if(out.width-2*mx>out.width*.85&&out.height-2*my>out.height*.85)
   out=mangaCrop(out,mx,my,out.width-2*mx,out.height-2*my);
 }
 return out;
}
function mangaDetectSpreadGutter(s){
 if(s.width/s.height<1.25)return null;
 const{g,w,h,scale}=mangaGray(s,600,780),lo=Math.floor(w*.36),hi=Math.ceil(w*.64);
 let best=-1,bestScore=0;
 for(let x=lo;x<hi;x++){
  let white=0,n=0;
  for(let y=Math.floor(h*.08);y<h*.92;y+=2){n++;if(g[y*w+x]>218)white++;}
  const q=white/Math.max(1,n);if(q>bestScore){bestScore=q;best=x;}
 }
 if(best<0||bestScore<.68)return null;
 const mid=Math.floor(h/2);let l=best,r=best;
 while(l>lo&&g[mid*w+l-1]>205)l--;
 while(r<hi-1&&g[mid*w+r+1]>205)r++;
 if(r-l>w*.07)return null;
 function ink(a,b){
  let k=0,n=0;
  for(let y=Math.floor(h*.12);y<h*.88;y+=3)
   for(let x=Math.max(0,a);x<Math.min(w,b);x+=3){n++;if(g[y*w+x]<180)k++;}
  return k/Math.max(1,n);
 }
 if(ink(best-w*.045,best-w*.012)<.012||ink(best+w*.012,best+w*.045)<.012)return null;
 return Math.round(best/scale);
}
function mangaViews(s,count,overlap){
 const baseH=Math.max(1,Math.round(s.width*2/3));
 const extra=Math.min(300,Math.max(0,overlap));
 const vh=Math.min(s.height,baseH+extra),max=s.height-vh,tops=[];
 if(count<=1)return[{canvas:mangaMakePage(s)}];
 for(let i=0;i<count;i++)tops.push(Math.round(max*i/(count-1)));
 // 与 imagesplittest 一致：在预定切分线附近寻找横向墨线较少的位置，
 // 避开对白框轮廓和横向分格线，同时保留相邻视窗重叠。
 if(max>0&&count>2){
  const{g,w,h,scale}=mangaGray(s,360,720);
  const range=Math.min(Math.round(h*.055),Math.round(48*scale));
  function edgeCost(y){
   const yy=Math.max(2,Math.min(h-3,y));let cost=0,n=0;
   for(let dy=-2;dy<=2;dy++)for(let x=0;x<w;x+=2){const v=g[(yy+dy)*w+x];cost+=(255-v)/255;n++;}
   return cost/Math.max(1,n);
  }
  for(let i=1;i<count-1;i++){
   const target=Math.round(tops[i]*scale);let best=target,score=Infinity;
   for(let y=Math.max(2,target-range);y<=Math.min(h-3,target+range);y++){
    const v=edgeCost(y)+edgeCost(y+Math.round(vh*scale))*.9+Math.abs(y-target)/Math.max(1,range)*.08;
    if(v<score){score=v;best=y;}
   }
   tops[i]=Math.round(best/scale);
  }
 }
 return tops.map((t,i)=>({canvas:mangaMakePage(mangaRotate90(mangaCrop(s,0,t,s.width,Math.min(vh,s.height-t)))),index:i+1}));
}
function mangaProcessImage(source,options){
 const mode=options.parts,overlap=options.overlap,forceSpread=options.doublePage,keepPortrait=options.keepPortrait;
 const color=mangaColorPage(source);
 let base=color?source:mangaTrimWhite(source),gutter=null,pages;
 if(color||keepPortrait){
  return [mangaMakePage(base)];
 }
 if(forceSpread){
  const spread=source;
  gutter=mangaDetectSpreadGutter(spread);
  const center=Math.round(spread.width/2);
  if(!Number.isFinite(gutter)||Math.abs(gutter-center)>spread.width*.035)gutter=center;
  gutter=Math.round(gutter*.25+center*.75);
  const safety=Math.max(3,Math.round(spread.width*.008));
  const cutR=Math.min(spread.width-1,gutter+safety),cutL=Math.max(1,gutter-safety);
  pages=[
   mangaTrimWhite(mangaCrop(spread,cutR,0,spread.width-cutR,spread.height)),
   mangaTrimWhite(mangaCrop(spread,0,0,cutL,spread.height))
  ];
 }else{
  gutter=mangaDetectSpreadGutter(base);
  pages=gutter!==null
   ?[mangaTrimWhite(mangaCrop(base,gutter,0,base.width-gutter,base.height)),mangaTrimWhite(mangaCrop(base,0,0,gutter,base.height))]
   :[base];
 }
 const outputs=[];
 for(const side of pages){
  if(mode===0)outputs.push(mangaMakePage(side));
  else outputs.push(...mangaViews(side,mode,overlap).map(x=>x.canvas));
 }
 return outputs;
}

async function makeBook(
 group,depth,algo,contrast,brightness,ditherStrength,threshold,bookTitle,onProgress
){
 const pages=[];
 const chapters=group.chapters||[{name:group.name,files:group.files}];
 const totalFiles=Math.max(1,chapters.reduce((n,ch)=>n+ch.files.length,0));
 let doneFiles=0,inputPageIndex=0;
 const options={
  parts:Number($('splitParts').value),
  doublePage:$('doublePage').checked,
  overlap:Number($('splitOverlap').value)||0
 };
 const keepFirst=Math.max(0,Number($('keepFirstPages').value)||0);
 for(const chapter of chapters){
  if(cancelled)throw new Error('已取消');
  for(const file of chapter.files){
   if(cancelled)throw new Error('已取消');
   const img=await loadImage(file);
   const source=mangaCanvas(img.naturalWidth||img.width,img.naturalHeight||img.height);
   source.getContext('2d').drawImage(img,0,0);img.src='';
   if(file.__loadImage){try{img.width=1;img.height=1;}catch(_){}}
   const keepPortrait=isRootCover(file)||inputPageIndex<keepFirst;
   const outputCanvases=mangaProcessImage(source,{...options,keepPortrait});
   source.width=1;source.height=1;
   for(const pageCanvas of outputCanvases){
    if(cancelled){pageCanvas.width=1;pageCanvas.height=1;throw new Error('已取消');}
    const gray=canvasToGray(pageCanvas);
    const processed=dither(gray,W,H,algo,depth,contrast,brightness,ditherStrength,threshold);
    pages.push(depth===2?packXTH(processed,W,H):packXTG(processed,W,H));
    pageCanvas.width=1;pageCanvas.height=1;
   }
   if(!isRootCover(file))inputPageIndex++;
   doneFiles++;onProgress?.(doneFiles,totalFiles,file);await yieldUI();
  }
 }
 if(!pages.length)throw new Error('没有生成可转换的漫画页面。');
 const pageCount=pages.length,data=buildBook(pages,depth===2,bookTitle);
 pages.length=0;
 return{data,pages:pageCount,files:group.files.length};
}

function contrastGray(gray,mode){
 const factors={
  none:1,
  light:1.10,
  medium:1.25,
  strong:1.45,
  maximum:1.70
 };

 const factor=factors[mode]??1;
 if(factor===1)return new Uint8Array(gray);

 const out=new Uint8Array(gray.length);

 for(let i=0;i<gray.length;i++){
  out[i]=Math.max(
   0,
   Math.min(255,Math.round((gray[i]-127.5)*factor+127.5))
  );
 }

 return out;
}

function brightnessGray(gray,brightness){
 const amount=Number(brightness)||0;
 if(amount===0)return new Uint8Array(gray);

 const out=new Uint8Array(gray.length);

 for(let i=0;i<gray.length;i++){
  out[i]=Math.max(0,Math.min(255,gray[i]+amount*2));
 }

 return out;
}

function dither(
 gray,w,h,mode,depth,contrast='none',brightness=0,ditherStrength=100,threshold=128
){
 // 处理顺序：对比度 → 亮度 → 抖动量化。
 const contrasted=contrastGray(gray,contrast);
 const adjusted=brightnessGray(contrasted,brightness);
 const a=new Float32Array(adjusted);
 const matrix=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
 const clamp=v=>Math.max(0,Math.min(255,v));

 const binaryThreshold=Math.max(
  0,Math.min(255,Number(threshold)||128)
 );
 const strength=Math.max(
  0,Math.min(100,Number(ditherStrength)||0)
 )/100;

 const quantize=v=>{
  v=clamp(v);

  if(depth!==2)return v<binaryThreshold?0:255;

  return v<42.5?0:v<127.5?85:v<212.5?170:255;
 };

 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   const i=y*w+x;
   const old=clamp(a[i]);

   if(mode==='ordered'){
    const step=depth===2?85:255;
    const bias=((matrix[y&3][x&3]+0.5)/16-0.5)*step*strength;
    a[i]=quantize(old+bias);
    continue;
   }

   const value=quantize(old);
   a[i]=value;

   if(mode==='none'||strength===0)continue;

   const error=(old-value)*strength;

   const add=(xx,yy,weight,divisor)=>{
    if(xx>=0&&xx<w&&yy<h){
     a[yy*w+xx]+=error*weight/divisor;
    }
   };

   if(mode==='atkinson'){
    add(x+1,y,1,8);
    add(x+2,y,1,8);
    add(x-1,y+1,1,8);
    add(x,y+1,1,8);
    add(x+1,y+1,1,8);
    add(x,y+2,1,8);
   }else if(mode==='sierra-lite'){
    add(x+1,y,2,4);
    add(x-1,y+1,1,4);
    add(x,y+1,1,4);
   }else{
    add(x+1,y,7,16);
    add(x-1,y+1,3,16);
    add(x,y+1,5,16);
    add(x+1,y+1,1,16);
   }
  }
 }

 return Uint8Array.from(a,v=>Math.round(clamp(v)));
}

function packXTG(px,w,h){
 const rb=Math.ceil(w/8),data=new Uint8Array(rb*h);

 for(let y=0;y<h;y++){
  for(let x=0;x<w;x++){
   if(px[y*w+x]>=128){
    data[y*rb+(x>>3)]|=0x80>>(x&7);
   }
  }
 }

 return makePage('XTG\0',w,h,data);
}

function packXTH(px,w,h){
 const cb=Math.ceil(h/8),plane=cb*w;
 const p0=new Uint8Array(plane),p1=new Uint8Array(plane);

 for(let x=0;x<w;x++){
  const off=(w-1-x)*cb;

  for(let y=0;y<h;y++){
   const p=px[y*w+x],v=p>=212?0:p>=127?1:p>=42?2:3;
   const idx=off+(y>>3),bit=7-(y&7);

   if(v&1)p0[idx]|=1<<bit;
   if(v&2)p1[idx]|=1<<bit;
  }
 }

 const data=new Uint8Array(plane*2);
 data.set(p0);
 data.set(p1,plane);

 return makePage('XTH\0',w,h,data);
}

function makePage(magic,w,h,data){
 const out=new Uint8Array(22+data.length),v=new DataView(out.buffer);

 for(let i=0;i<4;i++)out[i]=magic.charCodeAt(i);

 v.setUint16(4,w,true);
 v.setUint16(6,h,true);
 out[8]=0;
 out[9]=0;
 v.setUint32(10,data.length,true);

 out.set(data,22);
 out.set(md5(data).slice(0,8),14);

 return out;
}

function md5(input){
 // 修正 MD5 轮移位表，确保页面校验值计算正确。
 const K=new Uint32Array(64);
 const S=[7,12,17,22,5,9,14,20,4,11,16,23,6,10,15,21];

 for(let i=0;i<64;i++){
  K[i]=Math.floor(Math.abs(Math.sin(i+1))*4294967296)>>>0;
 }

 const len=input.length,bitLen=len*8;
 const total=((len+9+63)>>6)<<6;
 const msg=new Uint8Array(total);

 msg.set(input);
 msg[len]=128;

 const mdv=new DataView(msg.buffer);
 mdv.setUint32(total-8,bitLen>>>0,true);
 mdv.setUint32(total-4,Math.floor(bitLen/4294967296),true);

 let a0=0x67452301,b0=0xefcdab89,c0=0x98badcfe,d0=0x10325476;

 for(let o=0;o<total;o+=64){
  const M=new Uint32Array(16),dv=new DataView(msg.buffer,o,64);

  for(let i=0;i<16;i++)M[i]=dv.getUint32(i*4,true);

  let a=a0,b=b0,c=c0,d=d0;

  for(let i=0;i<64;i++){
   let f,g;

   if(i<16){
    f=(b&c)|(~b&d);
    g=i;
   }else if(i<32){
    f=(d&b)|(~d&c);
    g=(5*i+1)%16;
   }else if(i<48){
    f=b^c^d;
    g=(3*i+5)%16;
   }else{
    f=c^(b|~d);
    g=(7*i)%16;
   }

   const s=i<16?S[i%4]:i<32?S[4+i%4]:i<48?S[8+i%4]:S[12+i%4];
   const z=(a+f+K[i]+M[g])|0;
   const r=(z<<s)|(z>>>(32-s));

   a=d;
   d=c;
   c=b;
   b=(b+r)|0;
  }

  a0=(a0+a)|0;
  b0=(b0+b)|0;
  c0=(c0+c)|0;
  d0=(d0+d)|0;
 }

 const out=new Uint8Array(16),dv=new DataView(out.buffer);
 [a0,b0,c0,d0].forEach((v,i)=>dv.setUint32(i*4,v,true));

 return out;
}

function buildBook(pages,is2,title){
 if(pages.length>65535){
  throw new Error('页面数量超过 XTC 容器可表示的上限（65535 页）。');
 }

 const metaOff=56,indexOff=312,dataOff=indexOff+pages.length*16;
 const total=dataOff+pages.reduce((n,p)=>n+p.length,0);
 const out=new Uint8Array(total),v=new DataView(out.buffer);
 const magic=is2?'XTCH':'XTC\0';

 for(let i=0;i<4;i++)out[i]=magic.charCodeAt(i);

 v.setUint16(4,1,true);
 v.setUint16(6,pages.length,true);
 v.setUint32(8,0x01000100,true);
 v.setUint32(12,1,true);
 v.setBigUint64(16,BigInt(metaOff),true);
 v.setBigUint64(24,BigInt(indexOff),true);
 v.setBigUint64(32,BigInt(dataOff),true);
 v.setBigUint64(40,0n,true);
 v.setBigUint64(48,0n,true);

 out.set(new TextEncoder().encode(title).slice(0,127),metaOff);

 let pos=dataOff;

 pages.forEach((p,i)=>{
  const e=indexOff+i*16;
  v.setBigUint64(e,BigInt(pos),true);
  v.setUint32(e+8,p.length,true);
  v.setUint16(e+12,W,true);
  v.setUint16(e+14,H,true);
  out.set(p,pos);
  pos+=p.length;
 });

 return out;
}

async function loadImage(file){
 if(file&&typeof file.__loadImage==='function')return file.__loadImage();
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(file),img=new Image();

  img.onload=()=>{
   URL.revokeObjectURL(url);
   resolve(img);
  };

  img.onerror=()=>{
   URL.revokeObjectURL(url);
   reject(new Error('无法读取图片：'+file.name));
  };

  img.src=url;
 });
}

function canvasToGray(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const im=ctx.getImageData(0,0,W,H),gray=new Uint8Array(W*H);

 for(let i=0,j=0;i<im.data.length;i+=4,j++){
  gray[j]=Math.round(
   .299*im.data[i]+.587*im.data[i+1]+.114*im.data[i+2]
  );
 }

 return gray;
}

// 对缓存的当前页灰度图应用最新参数；不重新读取文件。
function renderCurrentPreviewPage(){
 if(!previewImages.length)return;
 const gray=previewImages[previewPageIndex];
 if(!gray)return;

 const depth=Number($('depth').value);
 const algo=$('dither').value;
 const contrast=$('contrast').value;
 const brightness=Number($('brightness').value);
 const ditherStrength=Number($('ditherStrength').value);
 const threshold=Number($('threshold').value);
 const processed=dither(
  gray,W,H,algo,depth,contrast,brightness,ditherStrength,threshold
 );

 const out=document.createElement('canvas');
 out.width=W;
 out.height=H;
 const outCtx=out.getContext('2d');
 const imageData=outCtx.createImageData(W,H);

 for(let i=0,j=0;i<processed.length;i++,j+=4){
  const v=processed[i];
  imageData.data[j]=v;
  imageData.data[j+1]=v;
  imageData.data[j+2]=v;
  imageData.data[j+3]=255;
 }

 outCtx.putImageData(imageData,0,0);
 const nextSrc=out.toDataURL('image/png');
 // 直到新预览生成完才替换，旧图不会先消失。
 preview.src=nextSrc;
 preview.style.display='block';
 preview.dataset.shown='1';
 out.width=1;
 out.height=1;
}

function updateCurrentPreview(){
 // 调整图像参数时只重绘当前页，保留当前页码与现有预览。
 if(previewBuilding)return;
 if(!previewImages.length){
  renderLivePreview();
  return;
 }
 renderCurrentPreviewPage();
}

function showPreviewPage(index){
 if(!previewImages.length){
  preview.style.display='none';
  preview.removeAttribute('src');
  $('previewPageLabel').textContent='第 0 / 0 页';
  $('previewPrev').disabled=true;
  $('previewNext').disabled=true;
  return;
 }

 previewPageIndex=Math.max(0,Math.min(previewImages.length-1,index));
 $('previewPageLabel').textContent=
  '第 '+(previewPageIndex+1)+' / '+previewImages.length+' 页';
 $('previewPrev').disabled=previewPageIndex===0;
 $('previewNext').disabled=previewPageIndex===previewImages.length-1;
 renderCurrentPreviewPage();
}

// 按正式转换的拼接、分页和章节补白方式生成最多 5 页原始灰度预览。
async function renderLivePreview(){
 if(converting)return;
 const request=++previewRequest,previewStatus=$('previewStatus');
 if(!selectedFiles.length){
  previewBuilding=false;previewImages=[];showPreviewPage(0);
  if(previewStatus)previewStatus.textContent='选择漫画文件夹后，这里会自动生成预览。';
  return;
 }
 previewBuilding=true;previewImages=[];showPreviewPage(0);
 if(previewStatus)previewStatus.textContent='正在生成前 5 页预览……';
 try{
  const groups=getGroups().filter(g=>g.files&&g.files.length);
  if(!groups.length)throw new Error('当前设置下没有可预览的图片。');
  const group=groups[0];
  const chapters=group.chapters&&group.chapters.length?group.chapters:[{name:group.name||'图片',files:group.files||[]}];
  const options={parts:Number($('splitParts').value),doublePage:$('doublePage').checked,overlap:Number($('splitOverlap').value)||0};
  const keepFirst=Math.max(0,Number($('keepFirstPages').value)||0);
  let inputPageIndex=0,finished=false;
  for(const chapter of chapters){
   if(finished||request!==previewRequest)break;
   for(const file of chapter.files||[]){
    if(finished||request!==previewRequest)break;
    const img=await loadImage(file);
    if(request!==previewRequest){img.src='';break;}
    const source=mangaCanvas(img.naturalWidth||img.width,img.naturalHeight||img.height);
    source.getContext('2d').drawImage(img,0,0);img.src='';
    const outputCanvases=mangaProcessImage(source,{...options,keepPortrait:isRootCover(file)||inputPageIndex<keepFirst});
    source.width=1;source.height=1;
    for(const pageCanvas of outputCanvases){
     if(request!==previewRequest){pageCanvas.width=1;pageCanvas.height=1;break;}
     if(previewImages.length<5)previewImages.push(canvasToGray(pageCanvas));
     pageCanvas.width=1;pageCanvas.height=1;
     if(previewImages.length>=5){finished=true;break;}
    }
    if(!isRootCover(file))inputPageIndex++;
    await yieldUI();
   }
  }
  if(request!==previewRequest)return;
  if(!previewImages.length)throw new Error('没有生成可预览的页面。');
  showPreviewPage(0);
  if(previewStatus)previewStatus.textContent='已生成 '+previewImages.length+' 页预览；预览使用当前日漫分割和转换设置。';
 }catch(e){
  if(request===previewRequest){
   console.warn('预览生成失败：',e);previewImages=[];showPreviewPage(0);
   if(previewStatus)previewStatus.textContent='预览生成失败：'+(e?.message||'请重新选择图片。');
  }
 }finally{
  if(request===previewRequest)previewBuilding=false;
 }
}

go.addEventListener('click',async()=>{
 if(!selectedFiles.length||converting)return;

 cancelled=false;
 converting=true;
 previewRequest++;

 go.disabled=true;
 cancel.disabled=false;
 bar.style.width='0%';

 const depth=Number($('depth').value);
 const algo=$('dither').value;
 const contrast=$('contrast').value;
 const brightness=Number($('brightness').value);
 const ditherStrength=Number($('ditherStrength').value);
 const threshold=Number($('threshold').value);
 const mode=$('outputMode').value;

 try{
  const groups=getGroups().filter(g=>g.files.length);
  if(!groups.length)throw new Error('所选范围内没有图片。');

  const multipleBooks=(mode==='chapter'||mode==='batch');
  let outputDir=null,zipFallback=null;

  if(multipleBooks){
   if(typeof window.showDirectoryPicker==='function'){
    try{
     outputDir=await window.showDirectoryPicker({mode:'readwrite'});
    }catch(err){
     if(err&&err.name==='AbortError'){
      throw new Error('已取消选择输出文件夹，尚未开始转换。');
     }
     throw err;
    }
   }else{
    if(typeof JSZip==='undefined'){
     throw new Error('ZIP 组件加载失败，无法自动打包。请检查网络后刷新页面。');
    }

    zipFallback=new JSZip();

    setStatus(
     '当前浏览器不支持选择输出文件夹，将在全部转换完成后下载一个 ZIP。',
     0
    );
   }
  }

  if(!multipleBooks){
   const g=groups[0];
   setStatus('准备转换：'+g.name,0);

   const result=await makeBook(
    g,depth,algo,contrast,brightness,ditherStrength,threshold,g.name,
    (done,total,file)=>setStatus(
     '正在转换：'+g.name+'\n当前图片：'+file.name+
     '\n本书图片：'+done+'/'+total,
     Math.min(94,94*done/total)
    )
   );

   setStatus('正在保存文件…',96);

   downloadBlob(
    new Blob([result.data],{type:'application/octet-stream'}),
    g.name+(depth===2?'.xtch':'.xtc')
   );

   setStatus(
    '转换完成！\n图片：'+result.files+' 张\nX3 页面：'+result.pages+
    ' 页\n文件大小：'+(result.data.length/1024/1024).toFixed(2)+
    ' MB\n已触发下载。',
    100
   );

  }else{
   let completed=0,totalPages=0,totalFiles=0;
   const ext=depth===2?'.xtch':'.xtc';

   for(let i=0;i<groups.length;i++){
    if(cancelled)throw new Error('已取消');

    const g=groups[i];

    setStatus(
     '正在生成第 '+(i+1)+'/'+groups.length+' 本：'+g.name,
     100*i/groups.length
    );

    let result=await makeBook(
     g,depth,algo,contrast,brightness,ditherStrength,threshold,g.name,
     (done,total,file)=>setStatus(
      '正在生成第 '+(i+1)+'/'+groups.length+' 本：'+g.name+
      '\n当前图片：'+file.name+
      '\n本书图片：'+done+'/'+total,
      100*(i+done/Math.max(1,total))/groups.length
     )
    );

    totalPages+=result.pages;
    totalFiles+=result.files;
    completed++;

    if(outputDir){
     const handle=await outputDir.getFileHandle(g.name+ext,{create:true});
     const writable=await handle.createWritable();
     await writable.write(result.data);
     await writable.close();
    }else{
     zipFallback.file(g.name+ext,result.data);
    }

    result.data=null;
    result=null;
    await yieldUI();
   }

   if(zipFallback){
    setStatus('全部章节已转换，正在生成单个 ZIP…',96);

    const blob=await zipFallback.generateAsync(
     {type:'blob',compression:'STORE'},
     m=>setStatus(
      '正在打包 ZIP… '+Math.round(m.percent)+'%',
      96+4*m.percent/100
     )
    );

    downloadBlob(
     blob,
     safeName($('bookTitle').value||'漫画')+'_全部章节.zip'
    );

    zipFallback=null;
   }

   setStatus(
    '全部完成！\n生成文件：'+completed+' 本\n章节图片：'+
    totalFiles+' 张\n总 X3 页面：'+totalPages+' 页\n'+
    (outputDir
     ?'已自动保存到你选择的文件夹。'
     :'已触发一次 ZIP 下载。'),
    100
   );
  }

 }catch(e){
  setStatus('转换失败：'+(e?.message||e),0);
  console.error(e);
 }finally{
  converting=false;
  go.disabled=!getOrderedFiles().length;
  cancel.disabled=true;
 }
});


// ===== 中英文界面切换：不修改转换算法 =====
(() => {
  const zh = document.getElementById('langZh');
  const en = document.getElementById('langEn');

  if (!zh || !en) return;

  const translations = [
    ['X3 日漫转换器（图片 / PDF / ZIP / EPUB / CBZ）', 'X3 Japanese Manga Converter (Images / PDF / ZIP / EPUB / CBZ)'],
    ['选择日漫总文件夹，自动裁切白边、识别彩页和双页扫描；单页可保持整页或切成 2/3 个带重叠的横向阅读视窗。保留章节识别、批量合并、XTC/XTCH、预览、图像调节和自动保存等功能。所有处理均在本机浏览器完成，不会上传图片。', 'Select a Japanese manga folder. The converter trims white borders, detects color pages and double-page scans, and can keep a page whole or split it into 2/3 overlapping landscape-reading views. Chapter handling, batch merging, XTC/XTCH output, previews, image adjustments, and automatic saving are retained. Everything runs locally in your browser; images are never uploaded.'],
    ['只需选择一次漫画总文件夹。程序逐张读取图片，按章节顺序自动处理；支持每章一本、每 N 章一本或整部合并。支持时可选择一次输出文件夹，自动保存全部成品；否则最后生成一个 ZIP。所有处理都在本机浏览器进行，不会上传图片。',
     'Select the manga folder once. Images are processed sequentially in chapter order. Create one book per chapter, combine every N chapters, or merge the entire series. Where supported, choose an output folder to save all books; otherwise, download one ZIP. All processing happens locally in your browser. Images are never uploaded.'],
    ['① 选择漫画', '① Select Manga'],
    ['请选择包含各章节子文件夹的漫画总文件夹，目录结构应为“漫画名/章节文件夹/图片”。选择后请确认识别到的章节数量；如果显示“未分章图片”或章节数为 0，说明浏览器没有提供完整目录路径，无法自动分章，请换 Chrome 再试。',
     'Select the main manga folder containing chapter subfolders. The structure should be “Manga name / Chapter folder / Images”. Check the detected chapter count after selecting. If it shows “Unsorted images” or zero chapters, your browser may not provide the full folder path. Try Chrome.'],
    ['选择整个漫画文件夹', 'Select Manga Folder'],
    ['备用：多选图片文件', 'Alternative: Select Image Files'],
    ['漫画名（可修改）', 'Book Title (editable)'],
    ['自动使用文件夹名称', 'Uses folder name automatically'],
    ['如果有根目录 Cover.jpg，在整部合并模式下作为第一页', 'Use root Cover.jpg as the first page when merging the entire series'],
    ['尚未选择漫画。', 'No manga selected.'],
    ['前 5 页预览', 'Preview First 5 Pages'],
    ['选择文件夹或漫画文件后自动生成预览，可用左右箭头查看前 5 页。', 'A preview is generated after selecting a folder or manga file. Use the arrows to view up to 5 pages.'],
    ['第 0 / 0 页', 'Page 0 / 0'],
    ['② 输出方式', '② Output Options'],
    ['生成方式', 'Output Mode'],
    ['每章单独一本（默认）', 'One book per chapter (default)'],
    ['整部合并成一本', 'Merge entire series into one book'],
    ['指定章节范围合并', 'Merge selected chapter range'],
    ['每 N 章合并成一本', 'Combine every N chapters'],
    ['输出格式', 'Output Format'],
    ['4 灰阶（XTCH）', '4-level grayscale (XTCH)'],
    ['黑白（XTC）', 'Black and white (XTC)'],
    ['从章节', 'From Chapter'],
    ['到章节', 'To Chapter'],
    ['每本包含章节数', 'Chapters per Book'],
    ['每 1 章一本', '1 chapter per book'],
    ['每 2 章一本', '2 chapters per book'],
    ['每 5 章一本', '5 chapters per book'],
    ['每 10 章一本', '10 chapters per book'],
    ['每 20 章一本', '20 chapters per book'],
    ['③ 转换设置', '③ Conversion Settings'],
    ['日漫分割设置', 'Japanese Manga Splitting'],
    ['单页分割方式', 'Single-page splitting'],
    ['不切分（整页）', 'Keep full page'],
    ['分成 2 份', 'Split into 2 views'],
    ['分成 3 份', 'Split into 3 views'],
    ['整本双页扫描', 'Whole-book double-page scans'],
    ['分割重叠像素', 'Split overlap (pixels)'],
    ['白边裁切', 'White-border trimming'],
    ['普通', 'Normal'],
    ['积极（推荐，尽量裁掉边缘水印）', 'Strong (recommended; trims edge watermarks)'],
    ['封面之后前几页保持竖屏不分割', 'Keep the first pages after the cover portrait (no splitting)'],
    ['彩页自动整页保留。宽幅扫描默认尝试检测白色中缝，识别成功时按日漫顺序先输出右页、再输出左页；勾选“整本双页扫描”则即使没有明显白色中缝也会按中线分开。单页切分使用 imagesplittest 的重叠视窗和切线避让算法。封面始终不切分；也可设置前 N 张图片不切分。', 'Color pages are kept whole. Wide scans are checked for a white center gutter; when detected, the right page is output before the left. Enable “Whole-book double-page scans” to split at the center even without a clear white gutter. Single-page splitting uses the overlapping-view and cut-line adjustment algorithm from imagesplittest. Covers are never split; you can also keep the first N pages after the cover whole.'],
    ['彩页自动整页保留；宽幅双页可按中缝分成右页、左页，先输出右页。普通单页按 2 或 3 份切分，并保留重叠；切分位置会尽量避开横向线条。', 'Color pages stay intact. Wide spreads can be split at the gutter into right then left pages. Single pages can be split into 2 or 3 overlapping views; cut positions avoid horizontal lines where possible.'],
    ['抖动算法', 'Dithering Algorithm'],
    ['对比度', 'Contrast'],
    ['亮度', 'Brightness'],
    ['负值变暗，正值变亮；默认 0。', 'Negative values darken; positive values brighten. Default: 0.'],
    ['抖动强度', 'Dithering Strength'],
    ['控制误差扩散的强弱；0% 不扩散误差，100% 使用完整算法强度。Ordered 和无抖动模式不使用误差扩散。',
     'Controls error diffusion strength. 0% disables diffusion; 100% uses full strength. Ordered and No Dithering modes do not use error diffusion.'],
    ['黑白阈值', 'Black-and-White Threshold'],
    ['仅在黑白（XTC）模式下生效。数值较低时更容易变白，较高时更容易变黑。',
     'Only applies to black-and-white (XTC) mode. Lower values produce more white; higher values produce more black.'],
    ['开始转换', 'Start Conversion'],
    ['取消', 'Cancel'],
    ['请先选择漫画文件夹或漫画文件。', 'Please select a manga folder or manga file first.'],
    ['编码逻辑参考 srokl/xtcjsapp（MIT）及本项目现有实现。',
     'Encoding logic is based on srokl/xtcjsapp (MIT) and this project’s existing implementation.']
  ];

  const originalTexts = new Map();

  function collectTextNodes(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.parentElement?.closest('.language-switch')) continue;
      if (node.nodeValue.trim()) nodes.push(node);
    }
    return nodes;
  }

  function translateText(value, toEnglish) {
    let result = value;
    for (const [chinese, english] of translations) {
      if (toEnglish) {
        if (result.includes(chinese)) {
          result = result.replaceAll(chinese, english);
        }
      } else {
        if (result.includes(english)) {
          result = result.replaceAll(english, chinese);
        }
      }
    }
    return result;
  }

  function setLanguage(language) {
    const toEnglish = language === 'en';
    document.documentElement.lang = toEnglish ? 'en' : 'zh-CN';
    zh.classList.toggle('active', !toEnglish);
    en.classList.toggle('active', toEnglish);

    for (const node of collectTextNodes(document.body)) {
      if (!originalTexts.has(node)) originalTexts.set(node, node.nodeValue);
      const original = originalTexts.get(node);
      node.nodeValue = translateText(original, toEnglish);
    }

    document.title = toEnglish
      ? 'X3 Japanese Manga Converter (Images / PDF / ZIP / EPUB / CBZ)'
      : 'X3 日漫转换器（图片 / PDF / ZIP / EPUB / CBZ）';

    const prev = document.getElementById('previewPrev');
    const next = document.getElementById('previewNext');
    if (prev) prev.setAttribute('aria-label', toEnglish ? 'Previous page' : '上一页');
    if (next) next.setAttribute('aria-label', toEnglish ? 'Next page' : '下一页');

    try {
      localStorage.setItem('x3-manga-language', language);
    } catch (_) {}
  }

  zh.addEventListener('click', () => setLanguage('zh'));
  en.addEventListener('click', () => setLanguage('en'));

  let saved = 'zh';
  try {
    saved = localStorage.getItem('x3-manga-language') || 'zh';
  } catch (_) {}

  setLanguage(saved === 'en' ? 'en' : 'zh');

  // 让转换过程中新出现的状态文字也尝试翻译。
  const observer = new MutationObserver(records => {
    const toEnglish = document.documentElement.lang === 'en';
    for (const record of records) {
      if (record.type === 'characterData') {
        const node = record.target;
        if (!originalTexts.has(node)) originalTexts.set(node, node.nodeValue);
        const original = originalTexts.get(node);
        const translated = translateText(original, toEnglish);
        if (node.nodeValue !== translated) node.nodeValue = translated;
      }
    }
  });

  observer.observe(document.body, {
    subtree: true,
    characterData: true
  });
})();

