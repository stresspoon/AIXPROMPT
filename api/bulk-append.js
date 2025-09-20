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
    /**
     * body.items: Array<{ prompt: string, imageUrl?: string, imageIndex?: number, model?: string }>
     * body.imageBase64List: Array<{ base64: string|dataURL, name?: string, mime?: string }>
     */
    const itemsInput = Array.isArray(body.items) ? body.items : [];
    const imageBase64List = Array.isArray(body.imageBase64List) ? body.imageBase64List : [];
    if(itemsInput.length === 0){ res.statusCode = 400; return res.end('No items'); }

    const repo = process.env.REPO_SLUG || 'stresspoon/AIXPROMPT';
    const branch = process.env.REPO_BRANCH || 'main';
    const ghToken = process.env.GITHUB_TOKEN; if(!ghToken){ res.statusCode = 500; return res.end('Server missing GITHUB_TOKEN'); }
    const ghHeaders = { 'Authorization': `Bearer ${ghToken}`, 'Accept':'application/vnd.github+json', 'Content-Type':'application/json' };

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
    function inferExtFromContentType(ct){
      if(!ct) return 'bin';
      if(/png/.test(ct)) return 'png';
      if(/jpe?g/.test(ct)) return 'jpg';
      if(/webp/.test(ct)) return 'webp';
      return 'bin';
    }
    function toBase64FromDataUrlOrRaw(input){
      if(!input) return null;
      const m = String(input).match(/^data:[^;]+;base64,(.*)$/);
      return m ? m[1] : String(input);
    }
    function safeExt(mime, name){
      const byMime = mime === 'image/png' ? 'png' : (mime === 'image/jpeg' ? 'jpg' : (mime === 'image/webp' ? 'webp' : 'bin'));
      const byName = (String(name||'').split('.').pop() || '').toLowerCase();
      if(['png','jpg','jpeg','webp'].includes(byName)) return byName === 'jpeg' ? 'jpg' : byName;
      return byMime;
    }

    async function uploadFromUrl(imageUrl){
      if(!imageUrl) return '';
      const r = await fetch(imageUrl);
      if(!r.ok) return '';
      const buf = Buffer.from(await r.arrayBuffer());
      const base64 = buf.toString('base64');
      const now = new Date(); const ts = now.toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
      const ext = inferExtFromContentType(r.headers.get('content-type'));
      const safe = String(imageUrl.split('/').pop() || 'image').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.(png|jpg|jpeg|webp)$/i,'');
      const path = `public/images/${ts}-${safe}.${ext}`;
      await ghPut(path, base64, `feat(bulk): add image ${safe}`);
      return `./public/images/${ts}-${safe}.${ext}`;
    }
    async function uploadFromBase64(entry){
      if(!entry || !entry.base64) return '';
      const base64 = toBase64FromDataUrlOrRaw(entry.base64);
      const now = new Date(); const ts = now.toISOString().replace(/[-:T.Z]/g,'').slice(0,14);
      const ext = safeExt(entry.mime || '', entry.name || 'image');
      const safe = String(entry.name || 'image').replace(/[^a-zA-Z0-9._-]/g,'_').replace(/\.(png|jpg|jpeg|webp)$/i,'');
      const path = `public/images/${ts}-${safe}.${ext}`;
      await ghPut(path, base64, `feat(bulk): add image ${safe}`);
      return `./public/images/${ts}-${safe}.${ext}`;
    }

    const meta = await ghGet('data/prompts.json');
    let items = []; let sha = undefined;
    if(meta){ sha = meta.sha; try{ items = JSON.parse(Buffer.from(meta.content.replace(/\n/g,''),'base64').toString('utf8')); }catch{ items=[]; } }

    // Pre-upload local base64 images if provided
    const uploadedLocalImages = [];
    for(const entry of imageBase64List){
      try{ const p = await uploadFromBase64(entry); uploadedLocalImages.push(p); }catch(e){ uploadedLocalImages.push(''); }
    }

    // Process inputs sequentially (keep it simple and safe)
    for(const it of itemsInput){
      const prompt = (it && typeof it.prompt === 'string') ? it.prompt.trim() : '';
      const model = (it && typeof it.model === 'string') ? it.model.trim() : '';
      if(!prompt) continue;
      let imagePath = '';
      if(it.imageUrl){
        try{ imagePath = await uploadFromUrl(it.imageUrl); }catch(e){ imagePath = ''; }
      } else if (typeof it.imageIndex === 'number' && uploadedLocalImages[it.imageIndex]){
        imagePath = uploadedLocalImages[it.imageIndex];
      } else if (uploadedLocalImages.length === 1){
        imagePath = uploadedLocalImages[0];
      }
      const obj = { image: imagePath || (items[0]?.image || ''), prompt };
      if(model) obj.model = model;
      items.push(obj);
    }

    const jsonText = JSON.stringify(items, null, 2) + '\n';
    const jsonBase64 = Buffer.from(jsonText,'utf8').toString('base64');
    await ghPut('data/prompts.json', jsonBase64, 'feat(bulk): append multiple prompt cards', sha);

    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({ ok:true, count: items.length }));
  }catch(err){ res.statusCode = 500; return res.end('Server Error'); }
}


