const BASE="https://fantasy.premierleague.com/api";
const allowed=/^(entry\/\d+\/|leagues-classic\/\d+\/standings\/?(?:\?.*)?)$/;
export default async (req)=>{
  const url=new URL(req.url); const path=(url.searchParams.get("path")||"").replace(/^\/+/,"");
  if(!allowed.test(path)) return json({error:"Invalid FPL API path"},400);
  try{
    const upstream=await fetch(`${BASE}/${path}`,{headers:{"User-Agent":"Mozilla/5.0 RAMBOO-FPL-League-Checker"}});
    const text=await upstream.text();
    return new Response(text,{status:upstream.status,headers:{"content-type":upstream.headers.get("content-type")||"application/json","cache-control":"no-store","access-control-allow-origin":"*"}});
  }catch(e){return json({error:`Unable to reach FPL API: ${e.message}`},502)}
};
export const config={path:"/.netlify/functions/fpl"};
function json(obj,status){return new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json","access-control-allow-origin":"*"}})}
