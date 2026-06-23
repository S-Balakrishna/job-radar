import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { formatDistanceToNow } from 'date-fns'
import './Dashboard.css'

// ── HELPERS ──────────────────────────────────────────────────────────────────
function timeAgo(d) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true }) }
  catch { return '—' }
}

function todayFormatted() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// ── STATUS STAMP ─────────────────────────────────────────────────────────────
function Stamp({ status }) {
  return <span className={`stamp stamp-${status}`}>{status}</span>
}

// ── CLASSIFIED (JOB CARD) ────────────────────────────────────────────────────
function Classified({ job, company, onStatusChange, index }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState(job.application_status)

  async function changeStatus(s) {
    setStatus(s)
    await supabase.from('jobs').update({ application_status: s }).eq('id', job.id)
    onStatusChange()
  }

  const others = ['new', 'applied', 'saved', 'rejected'].filter(s => s !== status)

  return (
    <div
      className={`classified${job.priority === 1 ? ' priority' : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={() => setOpen(!open)}
    >
      <div className={`classified-tag ${job.priority === 1 ? 'hot' : 'ok'}`}>
        {job.priority === 1 ? '◆ Priority · Data / Analyst' : '◇ Early Career'}
      </div>
      <div className="classified-title">
        {job.title}
        <Stamp status={status} />
      </div>
      <div className="classified-meta">
        <span>{company?.name || '—'}</span>
        <span>·</span>
        <span>{job.experience_mentioned || 'exp not listed'}</span>
        <span>·</span>
        <span>{timeAgo(job.found_at)}</span>
      </div>

      {open && (
        <div className="classified-expand" onClick={e => e.stopPropagation()}>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
              <button className="stamp-btn apply">Apply now →</button>
            </a>
          )}
          {others.map(s => (
            <button key={s} className="stamp-btn ghost" onClick={() => changeStatus(s)}>
              mark {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── COMPANY ADBLOCK ───────────────────────────────────────────────────────────
function AdBlock({ company, jobs, onDelete }) {
  const cnt = jobs.filter(j => j.company_id === company.id).length
  const p1  = jobs.filter(j => j.company_id === company.id && j.priority === 1).length

  async function handleDelete() {
    if (!window.confirm(`Remove ${company.name} from radar?`)) return
    await supabase.from('companies').delete().eq('id', company.id)
    onDelete(company.id)
  }

  return (
    <div className="adblock">
      <div className="adblock-corner" />
      <div className="adblock-name">{company.name}</div>
      <div className="adblock-url">{company.career_url}</div>
      <div className="adblock-stats">
        <div>
          <div className="adblock-stat-n">{cnt}</div>
          <div className="adblock-stat-l">jobs</div>
        </div>
        <div>
          <div className="adblock-stat-n" style={{ color: 'var(--red)' }}>{p1}</div>
          <div className="adblock-stat-l">priority</div>
        </div>
        <div>
          <div className="adblock-stat-n" style={{ fontSize: 13 }}>
            {company.last_scraped ? timeAgo(company.last_scraped) : 'pending'}
          </div>
          <div className="adblock-stat-l">last scan</div>
        </div>
      </div>
      <button className="adblock-del" onClick={handleDelete}>remove</button>
    </div>
  )
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [companies, setCompanies]     = useState([])
  const [jobs, setJobs]               = useState([])
  const [loading, setLoading]         = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch]           = useState('')
  const [tick, setTick]               = useState(0)
  const [formName, setFormName]       = useState('')
  const [formUrl, setFormUrl]         = useState('')
  const [formErr, setFormErr]         = useState('')
  const [formLoading, setFormLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [c, j] = await Promise.all([
      supabase.from('companies').select('*').order('added_at', { ascending: false }),
      supabase.from('jobs').select('*').order('found_at', { ascending: false })
    ])
    setCompanies(c.data || [])
    setJobs(j.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData, tick])

  // Stats
  const newJobs     = jobs.filter(j => j.application_status === 'new').length
  const priorityJobs = jobs.filter(j => j.priority === 1).length

  // Filtered jobs
  const filteredJobs = jobs.filter(j => {
    const co = companies.find(c => c.id === j.company_id)
    const matchSearch = !search ||
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      co?.name.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (activeFilter === 'all') return true
    if (activeFilter === '1') return j.priority === 1
    return j.application_status === activeFilter
  })

  // Ticker items
  const tickerJobs = jobs.filter(j => j.priority === 1).slice(0, 12)

  async function addCompany() {
    if (!formName.trim() || !formUrl.trim()) { setFormErr('Both fields required.'); return }
    if (!formUrl.startsWith('http')) { setFormErr('URL needs https://'); return }
    setFormLoading(true); setFormErr('')
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{ name: formName.trim(), career_url: formUrl.trim() }])
        .select()
      if (error) throw error
      setCompanies(prev => [data[0], ...prev])
      setFormName(''); setFormUrl('')
      // Trigger immediate scrape
      await fetch(
        'https://api.github.com/repos/S-Balakrishna/job-radar/actions/workflows/scraper.yml/dispatches',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.REACT_APP_GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ref: 'main' })
        }
      )
    } catch(e) {
      setFormErr(e.message)
    } finally {
      setFormLoading(false)
    }

  const KEYWORDS = ['analyst','data engineer','SQL','BI developer','entry level','fresher','0–2 yrs','new grad','product analyst','associate']

  return (
    <div className="paper">
      {/* MASTHEAD */}
      <div className="masthead">
        <div className="masthead-vol">Vol. 1 · Issue 1 · Bengaluru Edition</div>
        <div className="masthead-title">The Job<em>Radar</em> Gazette</div>
        <div className="masthead-sub">The only paper that finds your next role</div>
        <div className="masthead-rule" />
      </div>

      {/* DATE BAR */}
      <div className="datebar">
        <span>{todayFormatted()}</span>
        <div className="datebar-live"><span className="live-dot" /> Live intelligence feed</div>
        <span>{jobs.length} jobs · {companies.length} companies</span>
      </div>

      {/* THREE COLUMNS */}
      <div className="columns">

        {/* LEFT */}
        <div className="col-left">
          <div className="section-label">At a glance</div>

          <div className="pull-stat">
            <div className="pull-n">{newJobs}</div>
            <div className="pull-l">new jobs today</div>
          </div>
          <div className="pull-stat">
            <div className="pull-n"><em>{priorityJobs}</em></div>
            <div className="pull-l">priority roles</div>
          </div>
          <div className="pull-stat">
            <div className="pull-n">{companies.length}</div>
            <div className="pull-l">companies tracked</div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="section-label">Tracked companies</div>
            {companies.length === 0 && (
              <div className="empty-col">No companies yet. Submit your first listing below.</div>
            )}
            {companies.map(co => (
              <AdBlock
                key={co.id}
                company={co}
                jobs={jobs}
                onDelete={id => {
                  setCompanies(prev => prev.filter(c => c.id !== id))
                  setJobs(prev => prev.filter(j => j.company_id !== id))
                }}
              />
            ))}

            {/* SUBMIT FORM */}
            <div className="submit-box">
              <div className="submit-box-title">Submit a listing</div>
              <div className="field-row">
                <label>Company</label>
                <input placeholder="e.g. Zepto, CRED" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div className="field-row">
                <label>Career URL</label>
                <input placeholder="https://careers..." value={formUrl} onChange={e => setFormUrl(e.target.value)} />
              </div>
              {formErr && <div className="submit-err">{formErr}</div>}
              <button className="submit-btn" onClick={addCompany} disabled={formLoading}>
                {formLoading ? '— Publishing... —' : '— Publish to radar —'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-rule" />

        {/* MIDDLE */}
        <div className="col-mid">
          <div className="section-label">Today's openings</div>
          <div className="headline-xl">Early career<br />roles are <em>surging</em></div>
          <div className="byline">By JobRadar Intelligence · Compiled every 3 hours</div>
          <p className="body-text dropcap">
            Your personal radar has detected fresh opportunities across {companies.length} companies.
            Priority roles — data, analytics, SQL — are marked in red. Click any listing to act.
          </p>

          <div className="search-row">
            <input
              placeholder="search listings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span>⌕ search</span>
          </div>

          <div className="filter-row">
            {[
              { key: 'all', label: 'All' },
              { key: '1',   label: 'Priority' },
              { key: 'new', label: 'New' },
              { key: 'applied', label: 'Applied' },
              { key: 'saved',   label: 'Saved' },
            ].map(f => (
              <button
                key={f.key}
                className={`filter-btn${activeFilter === f.key ? ' active' : ''}`}
                onClick={() => setActiveFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="loading-lines">
              {[1,2,3,4].map(i => <div key={i} className="loading-line" style={{ animationDelay: `${i*0.1}s` }} />)}
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="empty-col" style={{ padding: '32px 0', textAlign: 'center' }}>
              — no listings match —
            </div>
          ) : (
            filteredJobs.map((j, i) => (
              <Classified
                key={j.id}
                job={j}
                company={companies.find(c => c.id === j.company_id)}
                onStatusChange={() => setTick(t => t + 1)}
                index={i}
              />
            ))
          )}
        </div>

        <div className="col-rule" />

        {/* RIGHT */}
        <div className="col-right">
          <div className="section-label">Intelligence brief</div>
          <div className="headline-lg">How to be<br /><em>first</em> to apply</div>
          <div className="byline">Editorial</div>
          <p className="body-text">
            Companies fill roles within 48 hours of posting. This gazette scans every career
            page you've listed every 3 hours — meaning you see openings before job boards do.
          </p>
          <p className="body-text">
            Priority listings marked in red are data, analyst, BI, SQL, and ML roles.
            All others are early career across any domain.
          </p>

          <div className="kw-box">
            <div className="byline" style={{ marginBottom: 8 }}>Keyword intelligence</div>
            <div className="kw-cloud">
              {KEYWORDS.map(k => <span key={k} className="kw-tag">{k}</span>)}
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>Status legend</div>
          <div className="legend-list">
            {['new','applied','saved','rejected'].map(s => (
              <div key={s} className="legend-row">
                <Stamp status={s} />
                <span className="body-text" style={{ margin: 0 }}>
                  {{ new: 'Just detected', applied: 'Application sent', saved: 'Bookmarked', rejected: 'Closed out' }[s]}
                </span>
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>Scan schedule</div>
          <div className="scan-schedule">
            <div className="scan-item">
              <div className="scan-label" style={{ color: 'var(--red)' }}>Next scan</div>
              <div className="scan-val">in ~3 hours</div>
            </div>
            <div className="scan-item">
              <div className="scan-label">Frequency</div>
              <div className="scan-val">Every 3h</div>
            </div>
            <div className="scan-item">
              <div className="scan-label">Engine</div>
              <div className="scan-val">GitHub Actions</div>
            </div>
          </div>
        </div>
      </div>

      {/* TICKER */}
      <div className="ticker-footer">
        <div className="ticker-scroll">
          {[...tickerJobs, ...tickerJobs].map((j, i) => {
            const co = companies.find(c => c.id === j.company_id)
            return (
              <span key={i} className="ticker-item">
                {co?.name?.toUpperCase() || '—'}
                <span className="ticker-sep"> — </span>
                {j.title}
                <span className="ticker-sep"> — </span>
                {j.experience_mentioned || '0–2 yrs'}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
