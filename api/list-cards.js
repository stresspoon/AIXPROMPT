module.exports = async function handler(req, res){
  try{
    if(req.method !== 'GET'){
      res.statusCode = 405; res.setHeader('Allow','GET'); return res.end('Method Not Allowed');
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

    const repo = process.env.REPO_SLUG || 'stresspoon/AIXPROMPT';
    const branch = process.env.REPO_BRANCH || 'main';
    const ghToken = process.env.GITHUB_TOKEN;
    if(!ghToken){ res.statusCode = 500; return res.end('Server missing GITHUB_TOKEN'); }

    const ghHeaders = { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/vnd.github+json' };
    const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent('data/prompts.json')}?ref=${encodeURIComponent(branch)}`;
    const r = await fetch(url, { headers: ghHeaders });
    if(r.status === 404){ res.setHeader('Content-Type','application/json'); return res.end(JSON.stringify({ items: [] })); }
    if(!r.ok){ const t = await r.text(); res.statusCode = 502; return res.end('GitHub error: '+t); }
    const meta = await r.json();
    const decodedJson = Buffer.from(String(meta.content).replace(/\n/g,''), 'base64').toString('utf8');
    let items = [];
    try{ items = JSON.parse(decodedJson); }catch{ items = []; }
    const mapped = items.map((it, idx)=>({ index: idx+1, image: it.image || '', prompt: (it.prompt || '').slice(0, 80) }));
    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({ items: mapped }));
  }catch(err){ res.statusCode = 500; return res.end('Server Error'); }
}


