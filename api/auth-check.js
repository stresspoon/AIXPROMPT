module.exports = async function handler(req, res){
  try{
    const authHeader = req.headers['authorization'] || '';
    const tokenPart = authHeader.split(' ')[1] || '';
    const decoded = Buffer.from(tokenPart, 'base64').toString('utf8');
    const sep = decoded.indexOf(':');
    const user = sep !== -1 ? decoded.slice(0, sep) : '';
    const pass = sep !== -1 ? decoded.slice(sep+1) : '';
    const expectedUser = process.env.ADMIN_USER || 'admin';
    const expectedPass = process.env.ADMIN_PASS || 'AIXPROMPT!2025';
    if(user !== expectedUser || pass !== expectedPass){
      res.statusCode = 401; return res.end('Unauthorized');
    }
    res.setHeader('Content-Type','application/json');
    return res.end(JSON.stringify({ ok:true }));
  }catch(err){
    res.statusCode = 500; return res.end('Server Error');
  }
}

