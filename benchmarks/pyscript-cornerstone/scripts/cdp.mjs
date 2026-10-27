/* global WebSocket */
import {setTimeout,clearTimeout} from 'node:timers';
import {Buffer} from 'node:buffer';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

function chromeExecutable() {
  const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ];
  const executable = candidates.find(path => existsSync(path));
  if (!executable) throw new Error('Install Chrome/Chromium or set CHROME_PATH to its executable.');
  return executable;
}

export async function launchBrowser() {
  const executable=chromeExecutable();
  const profile=await mkdtemp(join(tmpdir(),'pycom-benchmark-'));
  const flags=['--headless','--disable-gpu','--no-first-run','--no-default-browser-check',
    '--disable-background-networking','--disable-component-update','--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'];
  const chrome=spawn(executable,flags,{stdio:['ignore','ignore','pipe']});
  const endpoint=await new Promise((resolve,reject)=>{
    let output='';const timeout=setTimeout(()=>reject(new Error('Chrome startup timeout')),20000);
    chrome.stderr.on('data',c=>{output+=c;const m=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(m){clearTimeout(timeout);resolve(m[1]);}});
    chrome.once('error',error=>{clearTimeout(timeout);reject(error);});
    chrome.on('exit',code=>{clearTimeout(timeout);reject(new Error(`Chrome exited ${code}: ${output.slice(-2000)}`));});
  }).catch(async error=>{chrome.kill();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});throw error;});
  const ws=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let next=1;const pending=new Map();const events=[];
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.method){events.push(m);}
    const p=pending.get(m.id);
    if(p){
      pending.delete(m.id);
      clearTimeout(p.timer);
      if(m.error){p.reject(new Error(JSON.stringify(m.error)));}
      else{p.resolve(m.result);}
    }
  };
  function rpc(method,params={},sessionId){return new Promise((resolve,reject)=>{
    const id=next++;const timer=setTimeout(()=>{pending.delete(id);reject(new Error(`${method} timed out`));},300000);
    pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...sessionId?{sessionId}:{}}));
  });}
  return {flags,events,version:await rpc('Browser.getVersion'),
    async page(url){
      const {targetId}=await rpc('Target.createTarget',{url:'about:blank'});
      const {sessionId}=await rpc('Target.attachToTarget',{targetId,flatten:true});
      await rpc('Runtime.enable',{},sessionId);await rpc('Page.enable',{},sessionId);
      await rpc('Network.enable',{},sessionId);
      await rpc('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false},sessionId);
      await rpc('Page.navigate',{url},sessionId);
      return {sessionId,
        async eval(expression){
          const r=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);
          if(r.exceptionDetails){throw new Error(JSON.stringify(r.exceptionDetails));}
          return r.result.value;
        },
        async screenshot(path){const r=await rpc('Page.captureScreenshot',{format:'png'},sessionId);await writeFile(path,Buffer.from(r.data,'base64'));},
        close:()=>rpc('Target.closeTarget',{targetId})};
    },
    async close(){await rpc('Browser.close').catch(()=>{});ws.close();chrome.kill();chrome.stderr.destroy();chrome.unref();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
  };
}
