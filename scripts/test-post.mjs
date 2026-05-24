const API = 'http://localhost:8080';

(async()=>{
  try{
    const res = await fetch(`${API}/api/team-safe`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name: 'dbg', role: 'tester' }) });
    console.log('status', res.status);
    console.log('headers', Object.fromEntries(res.headers));
    const text = await res.text();
    console.log('body:', text);
  }catch(e){
    console.error(e.stack||e);
  }
})();
