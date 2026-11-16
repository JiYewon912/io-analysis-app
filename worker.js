const BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
let py;
let chain = Promise.resolve();
async function handle({id,type,payload}) {
  try {
    let result;
    if(type==='init') {
      if(!py) {
        postMessage({type:'status',text:'Python 실행 환경 준비 중… (처음 한 번만 오래 걸립니다)'});
        importScripts(BASE+'pyodide.js');
        const p=await loadPyodide({indexURL:BASE});
        await p.loadPackage(['numpy','micropip']);
        await p.runPythonAsync("import micropip\nawait micropip.install('openpyxl==3.1.5')");
        const response=await fetch('./model.py');
        if(!response.ok) throw Error('model.py를 불러올 수 없습니다.');
        await p.runPythonAsync(await response.text());
        py=p;
      }
      postMessage({type:'status',text:'Excel 읽기와 계수 검증 중…'});
      py.globals.set('raw_input',new Uint8Array(payload));
      await py.runPythonAsync('raw_bytes = raw_input.to_py()');
      result=await py.runPythonAsync('initialize(raw_bytes)');
      await py.runPythonAsync('del raw_input, raw_bytes');
    } else if(type==='explore') {
      py.globals.set('sheet_input',payload.sheet);
      py.globals.set('row_input',payload.row||'');
      result=py.runPython('explore(sheet_input, row_input)');
    } else {
      py.globals.set('scenario_input',JSON.stringify(payload));
      result=py.runPython('simulate(scenario_input)');
    }
    postMessage({id,ok:true,result:JSON.parse(result)});
  } catch(error) { postMessage({id,ok:false,error:String(error)}); }
}
onmessage=e=>{ chain=chain.then(()=>handle(e.data)); };
