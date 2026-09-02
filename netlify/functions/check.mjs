export default async (req) => {
  try {
    const url = new URL(req.url);
    const ids = (url.searchParams.get("ids") || "")
      .split(/[,\s\n]+/).map(x => x.trim()).filter(Boolean);

    if (!ids.length)
      return Response.json({error:"Please provide at least one FPL Team ID."},{status:400});

    const results=[], errors=[];
    const unique=[...new Set(ids)];

    const getJson=async (u)=>{
      const r=await fetch(u,{headers:{"User-Agent":"RAMBOO-FPL-LEAGUE-CHECKER/1.0"}});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    };

    for(const teamId of unique){
      try{
        const entry=await getJson(`https://fantasy.premierleague.com/api/entry/${teamId}/`);
        const leagues=entry?.leagues?.classic || [];
        const privateLeagues=leagues.filter(l =>
          ["x","private","invitational"].includes(String(l.league_type||"").toLowerCase())
        );

        for(const league of privateLeagues){
          let rank=league.entry_rank ?? league.rank ?? null;
          let points=league.entry_points ?? league.points ?? null;
          try{
            const s=await getJson(`https://fantasy.premierleague.com/api/leagues-classic/${league.id}/standings/`);
            const found=(s?.standings?.results||[]).find(e=>Number(e.entry)===Number(teamId));
            if(found){ rank=found.rank ?? rank; points=found.total ?? points; }
          }catch(_){}

          results.push({
            team_id:Number(teamId),
            manager:`${entry.player_first_name||""} ${entry.player_last_name||""}`.trim(),
            team_name:entry.name||"",
            league_name:league.name||"",
            league_id:league.id,
            rank, points
          });
        }
      }catch(e){
        errors.push({team_id:Number(teamId),error:`Failed to fetch FPL data: ${e.message}`});
      }
    }

    return Response.json({success:true,results,errors,checked_team_ids:unique.length});
  }catch(e){
    return Response.json({error:e.message||"Unexpected server error."},{status:500});
  }
};

export const config = { path: "/api/check" };
