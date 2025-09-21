module.exports = async function handler(req, res){
  try{
    if(req.method !== 'POST'){
      res.statusCode = 405; res.setHeader('Allow','POST'); return res.end('Method Not Allowed');
    }
    const authHeader = req.headers['authorization'] || '';
    const tokenPart = authHeader.split(' ')[1] || '';
    const decoded = Buffer.from(tokenPart, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const user = sep !== -1 ? decoded.slice(0, sep) : '';
    const pass = sep !== -1 ? decoded.slice(sep+1) : '';
    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPass = process.env.ADMIN_PASS || 'AIXPROMPT!2025';
    if(user !== expectedUser || pass !== expectedPass){ res.statusCode = 401; return res.end('Unauthorized'); }

    const chunks = []; await new Promise((resolve)=>{ req.on('data',(c)=>chunks.push(c)); req.on('end', resolve); });
    let body = {}; try{ body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }catch{ body = {}; }
    const order = Array.isArray(body.order) ? body.order.map(n=>Number(n)) : null;
    if(!order || order.length === 0 || order.some(n=>!Number.isFinite(n) || n < 1)){
      res.statusCode = 400; return res.end('Invalid order');
    }

    const repo = process.env.REPO_SLUG || 'stresspoon/AIXPROMPT';
    const branch = process.env.REPO_BRANCH || 'main';
    const ghToken = process.env.GITHUB_TOKEN; if(!ghToken){ res.statusCode = 500; return res.end('Server missing GITHUB_TOKEN'); }
    const ghHeaders = { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };

    async function ghGet(path){
      const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      const r = await fetch(url, { headers: ghHeaders });
      if(r.status === 404) return null; if(!r.ok) throw new Error('GitHub GET failed'); return await r.json();
    }
    async function ghPut(path, base64Content, message, sha){
      const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
      const payload = { message, content: base64Content, branch }; if(sha) payload.sha = sha;
      const r = await fetch(url, { method:'PUT', headers: ghHeaders, body: JSON.stringify(payload) });
      if(!r.ok){ const t = await r.text(); throw new Error('GitHub PUT failed: '+t); }
      return await r.json();
    }

    const meta = await ghGet('data/prompts.json');
    if(!meta){ res.statusCode = 404; return res.end('prompts.json not found'); }
    const items = JSON.parse(Buffer.from(String(meta.content).replace(/\n/g,''), 'base64').toString('utf8'));
    if(order.length !== items.length){ res.statusCode = 400; return res.end('Order length mismatch'); }

    // Validate permutation 1..n
    const n = items.length; const seen = new Set(order);
    if(seen.size !== n || Math.min(...order) !== 1 || Math.max(...order) !== n){ res.statusCode = 400; return res.end('Order must be permutation of 1..n'); }

    const next = order.map(idx => items[idx-1]);
    const jsonText = JSON.stringify(next, null, 2) + '\n';
    const jsonBase64 = Buffer.from(jsonText,'utf8').toString('base64');
    await ghPut('data/prompts.json', jsonBase64, 'chore(api): reorder cards', meta.sha);

    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({ ok:true }));
  }catch(err){ res.statusCode = 500; return res.end('Server Error'); }
}


