import fetch from 'node-fetch';

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const text = await res.text();
  console.log('STATUS', res.status);
  console.log(text);
}

(async ()=>{
  try {
    await post('http://localhost:8080/api/team-debug', { name: 'Script Debug', role: 'tester' });
    await post('http://localhost:8080/api/team', { name: 'Script Debug 2', role: 'tester', username: 'script_debug', whatsapp: '+628999' });
  } catch (e) {
    console.error(e);
  }
})();
