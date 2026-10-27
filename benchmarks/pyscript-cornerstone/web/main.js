/* global URLSearchParams, location, document, setTimeout, requestAnimationFrame,
   crypto, PerformanceObserver, window, ImageData, performance, fetch, File,
   navigator, crossOriginIsolated, innerWidth, innerHeight, devicePixelRatio */
import * as core from '@cornerstonejs/core';
import * as dicom from '@cornerstonejs/dicom-image-loader';
import { registerDecodeWorker } from '../../../packages/renderer-cornerstone/src/decodeWorkerRegistration';

const pipeline = new URLSearchParams(location.search).get('pipeline') || 'cornerstone';
const canvas = document.querySelector('canvas');
const context = canvas.getContext('2d');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
let buffers = [], files = [], instances = [], images = [], ids = [];
const longTasks = [];
new PerformanceObserver(list => longTasks.push(...list.getEntries().map(e => ({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});

async function init() {
  if (pipeline === 'pyscript') {
    const py = document.createElement('script');
    py.type = 'py'; py.src = './python.py'; py.setAttribute('config', './python.json');
    document.body.append(py);
    const script = document.createElement('script');
    script.type = 'module'; script.src = 'https://pyscript.net/releases/2025.2.4/core.js';
    document.head.append(script);
    let attempts=0;
    while(!window.pyReady) {
      if(attempts++>2400) throw new Error('Python runtime timeout 240s');
      await sleep(100);
    }
  } else {
    await core.init();
    core.setUseCPURendering(true);
    dicom.init({maxWebWorkers:1});
    registerDecodeWorker(core.getWebWorkerManager());
  }
  window.bench.ready = true;
  document.querySelector('#status').textContent = `${pipeline}: pronto`;
}

function rgba(index, center, width) {
  if (pipeline === 'pyscript') return window.pyRender(index, center, width);
  const pixels = images[index].getPixelData();
  const {rescale_slope:slope,rescale_intercept:intercept} = instances[index];
  const out = new Uint8Array(pixels.length * 4);
  const lower = center-width/2;
  for(let i=0;i<pixels.length;i++) {
    const scaled = Math.fround(Math.fround(pixels[i]*slope)+intercept);
    const normalized = Math.fround(Math.fround(Math.max(0,Math.min(width,scaled-lower))/width)*255);
    const v = Math.floor(normalized);
    out[i*4]=out[i*4+1]=out[i*4+2]=v;out[i*4+3]=255;
  }
  return out;
}
function draw(index,center,width) {
  const bytes = rgba(index,center,width);
  context.putImageData(new ImageData(new Uint8ClampedArray(bytes),canvas.width,canvas.height),0,0);
}
async function measure(operation, metric, fn) {
  const start=performance.now();
  const value=await fn();
  const end=performance.now();
  return {operation_id:operation,metric,value:end-start,unit:'ms',start,end,status:'ok',result:value};
}

window.bench = {
  ready:false, pipeline,
  async prepare(selected) {
    instances=selected;
    // Network and File creation excluded equally. Every timed decode still reads a File.
    buffers = await Promise.all(selected.map(async entry=> {
      const r=await fetch('/'+entry.relative_path);
      if(!r.ok)throw new Error(`${r.status}: ${entry.relative_path}`);
      return new Uint8Array(await r.arrayBuffer());
    }));
    for(let i=0;i<buffers.length;i++)if(await sha256(buffers[i])!==selected[i].sha256)throw new Error('Input hash mismatch');
    files=buffers.map((b,i)=>new File([b],`${i}.dcm`,{type:'application/dicom'}));
    buffers=[];
    canvas.width=selected[0].columns;canvas.height=selected[0].rows;
    document.querySelector('#details').textContent=`${selected.length} instâncias idênticas; ${canvas.width} × ${canvas.height}`;
  },
  async run() {
    const observations=[];
    images=[];
    if(pipeline==='pyscript')window.pyReset();
    else {
      core.cache.purgeCache();
      dicom.wadouri.dataSetCacheManager.purge();
      ids=files.map(f=>dicom.wadouri.fileManager.add(f));
    }
    await frame();
    const started=performance.now();
    observations.push(await measure('decode-all','decode_all_ms',async()=>{
      for(let i=0;i<files.length;i++) {
        if(pipeline==='pyscript')window.pyDecode(new Uint8Array(await files[i].arrayBuffer()));
        else images.push(await core.imageLoader.loadAndCacheImage(ids[i],{preScale:{enabled:false}}));
      }
    }));
    const present = async (id, metric, index, center, width, access) => {
      observations.push(await measure(id,metric,async()=>{
        if(access)await access();
        observations.push(await measure(id,'transform_canvas_sync_ms',()=>draw(index,center,width)));
        await frame(); await frame();
      }));
    };
    await present('first-common-frame','transform_canvas_frame_ms',0,40,400);
    for(let i=0;i<40;i++) {
      const index=(i+1)%files.length;
      await present(`navigate-${i}`,'navigate_cached_ms',index,40,400,async()=>{
        if(pipeline==='pyscript')window.pyCached(index);
        else await core.imageLoader.loadAndCacheImage(ids[index],{preScale:{enabled:false}});
      });
    }
    for(let i=0;i<40;i++)await present(`window-${i}`,'window_level_ms',0,40+i,400+i*4);
    const ended=performance.now();
    await sleep(100); // Let the observer deliver entries; not part of the workload window.
    const tasks=longTasks.filter(t=>t.start>=started&&t.start<ended);
    observations.push({operation_id:'workload',metric:'longtask_count',value:tasks.length,unit:'count',status:'ok'});
    observations.push({operation_id:'workload',metric:'longtask_total_ms',value:tasks.reduce((a,b)=>a+b.duration,0),unit:'ms',status:'ok'});
    return {observations,long_tasks:tasks,window:{start:started,end:ended},versions:pipeline==='pyscript'?JSON.parse(window.pyVersions):{cornerstone:'4.22.13',dicom_image_loader:'4.22.13'},environment:{userAgent:navigator.userAgent,hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,crossOriginIsolated,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio}};
  },
  async validate() {
    // Full pixel and RGBA hashes outside performance windows, for every decoded slice.
    const raw=pipeline==='pyscript'?JSON.parse(window.pyHashes()):await Promise.all(images.map(async image=>({
      raw_i32_sha256:await sha256(Int32Array.from(image.getPixelData())),
      sop_instance_uid:image.data.string('x00080018'),shape:[image.rows,image.columns]
    })));
    for(let i=0;i<raw.length;i++)raw[i].rgba_sha256=await sha256(rgba(i,40,400));
    raw[0].window_rgba_sha256=[];
    for(let i=0;i<40;i++)raw[0].window_rgba_sha256.push(await sha256(rgba(0,40+i,400+i*4)));
    draw(0,40,400);
    return raw;
  },
};
init().catch(error=>{window.bench.error=String(error);document.querySelector('#status').textContent=String(error);});
