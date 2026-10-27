import {setTimeout} from 'node:timers';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {cpus,totalmem,release,platform,arch} from 'node:os';
import {createHash} from 'node:crypto';
import {launchBrowser} from './cdp.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const repo=resolve(root,'../..');
const smoke=process.argv.includes('--smoke');
for(const pkg of ['core','dicom-image-loader']){
  const installed=JSON.parse(await readFile(resolve(root,`node_modules/@cornerstonejs/${pkg}/package.json`),'utf8')).version;
  if(installed!=='4.22.13')throw new Error(`Protocol pins @cornerstonejs/${pkg} to 4.22.13; found ${installed}`);
}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=process.env.BENCHMARK_OUTPUT||resolve(root,'results',`${stamp}-${smoke?'smoke':'collection'}`);
await mkdir(dirname(out),{recursive:true});
await mkdir(out);
const dataset=JSON.parse(await readFile(resolve(root,'manifests/dataset.json'),'utf8'));
const reference=JSON.parse(await readFile(resolve(root,'data/reference.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const json=(path,value)=>writeFile(path,JSON.stringify(value,null,2)+'\n');
function command(cmd,args){try{return execFileSync(cmd,args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{return null;}}
let seed=20260923;
function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32;}
function shuffled(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
const schedule=[];
for(let i=0;i<(smoke?1:3);i++)for(const pipeline of i%2?['cornerstone','pyscript']:['pyscript','cornerstone'])schedule.push({phase:'rehearsal',block:i+1,size:32,pipeline});
const orders=Object.fromEntries([32,123].map(n=>[n,shuffled([true,false,true,false,true])]));
if(!smoke)for(let block=1;block<=5;block++)for(const size of block%2?[32,123]:[123,32])for(const pipeline of orders[size][block-1]?['pyscript','cornerstone']:['cornerstone','pyscript'])schedule.push({phase:'measured',block,size,pipeline});
await json(resolve(out,'schedule.json'),{seed:20260923,schedule});
const sourcePaths=[];
async function walk(path){
  for(const entry of await readdir(path,{withFileTypes:true})){
    if(entry.name==='__pycache__'){continue;}
    const file=resolve(path,entry.name);
    if(entry.isDirectory()){await walk(file);}
    else{sourcePaths.push(file);}
  }
}
for(const folder of ['web','scripts','dist'])await walk(resolve(root,folder));
sourcePaths.push(...['vite.config.mjs','reproduce.py','requirements.txt','package.json','package-lock.json','manifests/dataset.json','manifests/reference.json','data/reference.json','data/acquisition.json'].map(name=>resolve(root,name)),...['decodeWorkerRegistration.ts','uncompressedDecodeWorker.ts'].map(name=>resolve(repo,'packages/renderer-cornerstone/src',name)));
await json(resolve(out,'source-hashes.json'),Object.fromEntries(await Promise.all(sourcePaths.sort().map(async path=>[relative(repo,path),sha(await readFile(path))]))));
const browser=await launchBrowser();
const env={created_at_utc:new Date().toISOString(),source_commit:command('git',['rev-parse','HEAD']),working_tree_tracked_diff_sha256:sha(command('git',['diff'])||''),
  os:{platform:platform(),arch:arch(),release:release(),version:command('sw_vers',[])},cpu:cpus()[0]?.model,logical_cpus:cpus().length,ram_bytes:totalmem(),power:command('pmset',['-g','batt']),browser:browser.version,browser_flags:browser.flags,node:process.version,
  protocol:'0.2-controlled-B-portable-1',mode:smoke?'smoke':'collection',pyscript:'2025.2.4',cache:'new page per run; HTTP/browser and OS cache not reset; image caches empty; runtime ready',gpu:'disabled by flag; not queried',display_hz:null,power_mode:null};
await json(resolve(out,'environment.json'),env);
const records=[];
async function waitReady(page,eventStart){
  const deadline=Date.now()+250000;
  while(true){
    const ready=await page.eval('({ready:window.bench?.ready,error:window.bench?.error})');
    if(ready.error)throw new Error(ready.error);
    const exceptions=browser.events.slice(eventStart).filter(e=>e.sessionId===page.sessionId&&e.method==='Runtime.exceptionThrown');
    if(exceptions.length)throw new Error(JSON.stringify(exceptions));
    if(ready.ready)return;
    if(Date.now()>deadline)throw new Error('runtime-ready timeout');
    await new Promise(r=>setTimeout(r,100));
  }
}
function validateCorrectness(record,expected){
  record.validation_errors=[];
  for(let i=0;i<expected.length;i++){
    for(const field of ['sop_instance_uid','shape','raw_i32_sha256','rgba_sha256']){
      if(JSON.stringify(record.correctness[i]?.[field])!==JSON.stringify(expected[i][field])){
        record.validation_errors.push({index:i,field,actual:record.correctness[i]?.[field],expected:expected[i][field]});
      }
    }
  }
  if(JSON.stringify(record.correctness[0]?.window_rgba_sha256)!==JSON.stringify(expected[0].window_rgba_sha256))record.validation_errors.push({index:0,field:'window_rgba_sha256'});
  if(record.correctness.length!==expected.length)record.validation_errors.push({field:'count'});
}
async function runCase(spec,selected,expected){
  const runId=`${String(records.length+1).padStart(2,'0')}-${spec.phase}-${spec.size}-${spec.pipeline}`;
  console.log(`START ${runId}`);
  const record={run_id:runId,...spec,started_at_utc:new Date().toISOString(),status:'running'};
  records.push(record);
  const page=await browser.page(`${process.env.BENCHMARK_URL||'http://127.0.0.1:8765/dist/'}?pipeline=${spec.pipeline}`);
  const eventStart=browser.events.length;
  try {
    await waitReady(page,eventStart);
    await page.eval(`window.bench.prepare(${JSON.stringify(selected)})`);
    Object.assign(record,await page.eval('window.bench.run()'));
    record.correctness=await page.eval('window.bench.validate()');
    validateCorrectness(record,expected);
    record.status=record.validation_errors.length?'incorrect':'ok';
    if(spec.phase==='fixture'||(spec.phase==='measured'&&spec.block===1&&spec.size===123))await page.screenshot(resolve(out,runId+'.png'));
    console.log(`END ${runId}: ${record.status}, decode=${record.observations[0].value.toFixed(1)}ms`);
  }catch(error){record.status=/timeout/i.test(String(error))?'timeout':'error';record.error=String(error);console.error(`FAIL ${runId}: ${error}`);}
  finally {
    record.browser_errors=browser.events.slice(eventStart).filter(e=>e.sessionId===page.sessionId&&(e.method==='Runtime.exceptionThrown'||e.method==='Network.loadingFailed'));
    record.finished_at_utc=new Date().toISOString();
    await json(resolve(out,runId+'.json'),record);
    await json(resolve(out,'runs.json'),records);
    await page.close();
  }
  return record;
}
try {
  for(const pipeline of ['pyscript','cornerstone']){
    const record=await runCase({phase:'fixture',block:0,size:2,pipeline},reference.fixtures,reference.fixtures);
    if(record.status!=='ok')throw new Error('Correctness gate failed on synthetic fixtures; no measured run executed');
  }
  for(const spec of schedule){
    const indices=dataset.subsets[String(spec.size)];
    const record=await runCase(spec,indices.map(i=>dataset.instances[i]),indices.map(i=>reference.instances[i]));
    if(record.status!=='ok')throw new Error('Collection failed; raw diagnostic records retained. No success summary will be generated.');
  }
}finally{
  await browser.close();
  console.log(`RESULTS ${relative(repo,out)}`);
}
