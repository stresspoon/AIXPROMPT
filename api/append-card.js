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
    if(user !== expectedUser || pass !== expectedPass){
      res.statusCode = 401;
      res.setHeader('WWW-Authenticate','Basic realm="AIXPROMPT"');
      return res.end('Unauthorized');
    }

    const chunks = [];
    await new Promise((resolve)=>{
      req.on('data', (c)=> chunks.push(c));
      req.on('end', resolve);
    });
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = null;
    try{ body = JSON.parse(raw); }catch(e){ body = {}; }

    const prompt = (body && typeof body.prompt === 'string') ? body.prompt.trim() : '';
    if(!prompt){ res.statusCode = 400; return res.end('Missing prompt'); }

    const imageBase64Input = body.imageBase64 || null; // may be dataURL or pure base64
    const imageName = body.imageName || 'image';
    const imageMime = body.imageMime || 'application/octet-stream';

    const repo = process.env.REPO_SLUG || 'stresspoon/AIXPROMPT';
    const branch = process.env.REPO_BRANCH || 'main';
    const ghToken = process.env.GITHUB_TOKEN;
    if(!ghToken){ res.statusCode = 500; return res.end('Server missing GITHUB_TOKEN'); }

    const ghHeaders = {
      'Authorization': `Bearer ${ghToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    async function ghGet(path){
      const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      const r = await fetch(url, { headers: ghHeaders });
      if(r.status === 404) return null;
      if(!r.ok){ throw new Error('GitHub GET failed: '+r.status); }
      return await r.json();
    }

    async function ghPut(path, base64Content, message, sha){
      const url = `https://api.github.com/repos/${repo}/contents/${encodeURIComponent(path)}`;
      const payload = { message, content: base64Content, branch };
      if(sha) payload.sha = sha;
      const r = await fetch(url, { method:'PUT', headers: ghHeaders, body: JSON.stringify(payload) });
      if(!r.ok){ const t = await r.text(); throw new Error('GitHub PUT failed: '+t); }
      return await r.json();
    }

    function toBase64FromDataUrlOrRaw(input){
      if(!input) return null;
      const m = String(input).match(/^data:[^;]+;base64,(.*)$/);
      return m ? m[1] : String(input);
    }

    function safeExt(mime, name){
      const byMime = mime === 'image/png' ? 'png' : (mime === 'image/jpeg' ? 'jpg' : (mime === 'image/webp' ? 'webp' : 'bin'));
      const byName = (name.split('.').pop() || '').toLowerCase();
      if(['png','jpg','jpeg','webp'].includes(byName)) return byName === 'jpeg' ? 'jpg' : byName;
      return byMime;
    }

    // 1) Upload image if provided
    let imagePath = '';
    if(imageBase64Input){
      const base64 = toBase64FromDataUrlOrRaw(imageBase64Input);
      const now = new Date();
      const ts = now.toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
      const safeName = String(imageName).replace(/[^a-zA-Z0-9._-]/g,'_');
      const ext = safeExt(imageMime, imageName);
      const finalName = safeName.replace(/\.(png|jpg|jpeg|webp)$/i,'');
      const path = `public/images/${ts}-${finalName}.${ext}`;
      await ghPut(path, base64, `feat(api): add image ${finalName}`);
      imagePath = `./public/images/${ts}-${finalName}.${ext}`;
    }

    // 2) Update prompts.json
    const meta = await ghGet('data/prompts.json');
    let items = [];
    let sha = undefined;
    if(meta){
      sha = meta.sha;
      try{
        const decoded = Buffer.from(meta.content.replace(/\n/g,''), 'base64').toString('utf8');
        items = JSON.parse(decoded);
      }catch(e){ items = []; }
    }
    const newItem = { image: imagePath || (items[0]?.image || ''), prompt };
    const next = [...items, newItem];
    const jsonText = JSON.stringify(next, null, 2) + '\n';
    const jsonBase64 = Buffer.from(jsonText, 'utf8').toString('base64');
    await ghPut('data/prompts.json', jsonBase64, 'feat(api): append prompt card', sha);

    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({ ok:true, count: next.length }));
  }catch(err){
    res.statusCode = 500;
    return res.end('Server Error: '+(err && err.message || String(err)));
  }
}


