const API = 'http://localhost:8080';

async function wait(ms){return new Promise(r=>setTimeout(r,ms));}

async function createMember(name){
  let res = await fetch(`${API}/api/team-safe`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, role: 'tester', email: `${name.replace(/ /g,'').toLowerCase()}@test.local` }) });
  if (res.status === 404) {
    // fallback to minimal debug endpoint
    res = await fetch(`${API}/api/team-debug`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, role: 'tester' }) });
  }
  if(!res.ok) throw new Error('createMember failed: '+await res.text());
  return await res.json();
}

async function createProject(title){
  const res = await fetch(`${API}/api/projects`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title }) });
  if(!res.ok) throw new Error('createProject failed: '+await res.text());
  return await res.json();
}

async function assignProject(projectId, memberId){
  const res = await fetch(`${API}/api/projects/${projectId}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ assignedMemberId: memberId }) });
  if(!res.ok) throw new Error('assignProject failed: '+await res.text());
  return await res.json();
}

async function fetchChatMessages(){
  const res = await fetch(`${API}/api/chat/messages`);
  if(!res.ok) throw new Error('fetchChat failed: '+await res.text());
  return await res.json();
}

(async ()=>{
  try {
    console.log('Creating member...');
    const member = await createMember('Auto Member ' + Date.now());
    console.log('Member:', member.id);

    console.log('Creating project...');
    const project = await createProject('Auto Project ' + Date.now());
    console.log('Project:', project.id);

    console.log('Assigning project...');
    await assignProject(project.id, member.id);

    console.log('Waiting 5s for AI to run...');
    await wait(5000);

    const msgs = await fetchChatMessages();
    const aiMsgs = msgs.filter(m => m.senderName === 'AI Assistant' || m.senderRole === 'system');
    console.log('AI messages count:', aiMsgs.length);
    console.log(aiMsgs.slice(-5));
  } catch (e){
    console.error(e.stack||e);
    process.exit(1);
  }
})();
