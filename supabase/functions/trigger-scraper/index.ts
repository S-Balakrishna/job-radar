import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async () => {
  const response = await fetch(
    'https://api.github.com/repos/S-Balakrishna/job-radar/actions/workflows/scraper.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GH_TOKEN')}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' })
    }
  )
  
  return new Response(
    JSON.stringify({ status: response.status }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})