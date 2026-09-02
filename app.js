const state={rows:[],busy:false};
const $=id=>document.getElementById(id);

function getTeamIds(){
  let raw=$("ids").value||"";
  raw=raw.replace(/<br\s*\/?>/gi,"\n").replace(/\r\n?/g,"\n");
  const ids=[];
  for(const original of raw.split("\n")){
    const line=original.replace(/\|/g," ").trim();
    if(!line || /^[-:\s]+$/.test(line)) continue;
    const matches=line.match(/(?<!\d)(\d{4,})(?!\d)/g);
    if(matches?.length) ids.push(Number(matches[matches.length-1]));
  }
  return [...new Set(ids)];
}

async function fpl(path){
  const res=await fetch(`/.netlify/functions/fpl?path=${encodeURIComponent(path)}`);
  let data; try{data=await res.json()}catch{throw new Error(`Proxy returned HTTP ${res.status}`)}
  if(!res.ok) throw new Error(data?.error||`FPL request failed (${res.status})`);
  return data;
}

function setStatus(text,loading=false){$("status").textContent=text;document.querySelector(".ready i").style.background=loading?"#ffd54a":"#20e070"}
function render(){
  const term=$("leagueFilter").value.trim().toLocaleLowerCase();
  const rows=term?state.rows.filter(r=>r.league.toLocaleLowerCase().includes(term)):state.rows;
  const tbody=$("results"); tbody.innerHTML="";
  for(const r of rows){
    const tr=document.createElement("tr");
    [r.team_id,r.manager,r.team_name,r.league,r.league_id,r.rank,r.points].forEach(v=>{const td=document.createElement("td");td.textContent=v??"";tr.appendChild(td)});
    tbody.appendChild(tr);
  }
  $("empty").classList.toggle("hidden",rows.length>0);
  if(!state.busy){
    setStatus(term?`Filter: '${$("leagueFilter").value.trim()}' — ${rows.length} of ${state.rows.length} shown`:`${state.rows.length} private league membership(s) found`);
  }
}

async function check(){
  const ids=getTeamIds();
  if(!ids.length){alert("Please enter at least one valid FPL Team ID.");return}
  state.busy=true;state.rows=[];render();$("check").disabled=true;$("refresh").disabled=true;setStatus(`Starting — ${ids.length} team(s)`,true);
  const errors=[];
  try{
    for(let i=0;i<ids.length;i++){
      const teamId=ids[i];setStatus(`Checking ${i+1}/${ids.length}: ${teamId}`,true);
      try{
        const entry=await fpl(`entry/${teamId}/`);
        const manager=`${entry.player_first_name||""} ${entry.player_last_name||""}`.trim();
        const teamName=entry.name||"";
        const classic=entry.leagues?.classic||[];
        const privateLeagues=classic.filter(x=>["x","private","invitational"].includes(String(x.league_type||"").toLowerCase()));
        for(const league of privateLeagues){
          const lid=league.id; let rank=league.entry_rank??""; let points="";
          try{
            const standings=await fpl(`leagues-classic/${lid}/standings/`);
            const member=(standings.standings?.results||[]).find(x=>Number(x.entry)===Number(teamId));
            if(member){rank=member.rank??rank;points=member.total??"";}
          }catch(e){/* preserve membership even if standings lookup fails */}
          state.rows.push({team_id:teamId,manager,team_name:teamName,league:league.name||"",league_id:lid,rank,points});
          render();
        }
      }catch(e){errors.push(`Team ${teamId}: ${e.message}`)}
    }
    state.busy=false;render();
    setStatus(`Completed: ${state.rows.length} private league membership(s)${errors.length?`; ${errors.length} error(s)`:""}`);
    if(errors.length) alert("Completed with errors:\n\n"+errors.slice(0,10).join("\n"));
  }finally{$("check").disabled=false;$("refresh").disabled=false;state.busy=false;render()}
}

function clearAll(){$("ids").value="";$("leagueFilter").value="";state.rows=[];render();setStatus("Ready")}
function exportCsv(){
  if(!state.rows.length){alert("Run a check first.");return}
  const term=$("leagueFilter").value.trim().toLocaleLowerCase();
  const rows=term?state.rows.filter(r=>r.league.toLocaleLowerCase().includes(term)):state.rows;
  const fields=["team_id","manager","team_name","league","league_id","rank","points"];
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[fields.join(","),...rows.map(r=>fields.map(f=>esc(r[f])).join(","))].join("\r\n");
  const blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="ramboo_fpl_private_leagues.csv";a.click();URL.revokeObjectURL(url);
}

$("check").addEventListener("click",check);$("refresh").addEventListener("click",check);$("clear").addEventListener("click",clearAll);$("export").addEventListener("click",exportCsv);$("leagueFilter").addEventListener("input",render);$("clearFilter").addEventListener("click",()=>{$("leagueFilter").value="";render()});
render();
