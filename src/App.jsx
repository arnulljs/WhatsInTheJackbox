import { useEffect, useMemo, useRef, useState } from 'react'
import gamesData from './data/games.json'
import './App.css'

const PACK_ORDER = ["Party Pack 1","Party Pack 2","Party Pack 3","Party Pack 4","Party Pack 5","Party Pack 6","Party Pack 7","Party Pack 8","Party Pack 9","Party Pack 10","Party Pack 11","Naughty Pack","Standalone"]
const allPacks = [...new Set(gamesData.map(g=>g.pack))].sort((a,b)=>PACK_ORDER.indexOf(a)-PACK_ORDER.indexOf(b))

// ponytail: consolidate 27 raw types → 8 clean filters (art+creative, music/sound/rhythm/rap, etc.)
const TYPE_MAP = {
  // creative
  creative: 'Creative', art: 'Creative',
  // drawing stays
  drawing: 'Drawing',
  // wordplay
  wordplay: 'Wordplay', writing: 'Wordplay',
  // trivia
  trivia: 'Trivia', horror: 'Trivia', sorting: 'Trivia', guessing: 'Trivia',
  // deception / social
  deception: 'Social', bluffing: 'Social', 'hidden-identity': 'Social', social: 'Social', dating: 'Social', roleplay: 'Social',
  // music & audio (user asked)
  sound: 'Music', music: 'Music', rhythm: 'Music', rap: 'Music',
  // teamwork
  collaborative: 'Teamwork', teamwork: 'Teamwork', puzzle: 'Teamwork',
  // party / competitive (voting, head-to-head, presentation, action)
  voting: 'Party', 'head-to-head': 'Party', presentation: 'Party', action: 'Party',
  // mature is a flag, not a type filter — keep but hidden from chips if needed
  mature: 'Mature',
}
function toConsolidated(types){ return [...new Set(types.map(t=> TYPE_MAP[t] || t))] }
const allTypes = [...new Set(gamesData.flatMap(g=> toConsolidated(g.types)))].filter(t=> t!=='Mature').sort()
// display order: most useful first
const TYPE_ORDER = ['Trivia','Wordplay','Drawing','Creative','Social','Music','Teamwork','Party']
const orderedTypes = [...TYPE_ORDER.filter(t=> allTypes.includes(t)), ...allTypes.filter(t=> !TYPE_ORDER.includes(t)).sort()]

const PACK_COLOR = {
  "Party Pack 1": "#ffe600", "Party Pack 2": "#00e5ff", "Party Pack 3": "#ff2e7e",
  "Party Pack 4": "#7cff00", "Party Pack 5": "#ff8c00", "Party Pack 6": "#a259ff",
  "Party Pack 7": "#00ffaa", "Party Pack 8": "#ff3b30", "Party Pack 9": "#ffe600",
  "Party Pack 10": "#00e5ff", "Party Pack 11": "#ff2e7e", "Naughty Pack": "#ff0055",
  "Standalone": "#ffffff"
}

function placeholderIcon(title, pack){
  const col = (PACK_COLOR[pack]||'#ffe600').slice(1)
  const txt = encodeURIComponent(title).replace(/%20/g,'+')
  return `https://dummyimage.com/600x400/${col}/000.png&text=${txt}`
}
function ytThumb(id){ return `https://img.youtube.com/vi/${id}/hqdefault.jpg` }

export default function App(){
  const [playerCount, setPlayerCount] = useState('')
  const [ownedPacks, setOwnedPacks] = useState(()=> new Set())
  const [selectedTypes, setSelectedTypes] = useState(()=> new Set())
  const [familyOnly, setFamilyOnly] = useState(false)
  const [audienceOnly, setAudienceOnly] = useState(false)
  const [hideMature, setHideMature] = useState(false)
  const [durationFilter, setDurationFilter] = useState('') // '', short, medium, long
  const [search, setSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState(null)
  const [history, setHistory] = useState([])
  const [isPicking, setIsPicking] = useState(false)
  const [shuffleTitle, setShuffleTitle] = useState('')
  const shuffleRef = useRef(null)

  // localStorage load
  useEffect(()=>{
    try{
      const s = JSON.parse(localStorage.getItem('jackbox:filters')||'{}')
      if(s.playerCount) setPlayerCount(s.playerCount)
      if(s.ownedPacks) setOwnedPacks(new Set(s.ownedPacks))
      if(s.selectedTypes) setSelectedTypes(new Set(s.selectedTypes))
      if(s.familyOnly) setFamilyOnly(s.familyOnly)
      if(s.audienceOnly) setAudienceOnly(s.audienceOnly)
      if(s.hideMature) setHideMature(s.hideMature)
      if(s.durationFilter) setDurationFilter(s.durationFilter)
      if(s.search) setSearch(s.search)
      const h = JSON.parse(localStorage.getItem('jackbox:history')||'[]')
      if(Array.isArray(h)) setHistory(h)
    }catch{}
  },[])
  // localStorage save
  useEffect(()=>{
    localStorage.setItem('jackbox:filters', JSON.stringify({
      playerCount, ownedPacks:[...ownedPacks], selectedTypes:[...selectedTypes],
      familyOnly, audienceOnly, hideMature, durationFilter, search
    }))
  },[playerCount, ownedPacks, selectedTypes, familyOnly, audienceOnly, hideMature, durationFilter, search])
  useEffect(()=>{ localStorage.setItem('jackbox:history', JSON.stringify(history)) },[history])

  const filtered = useMemo(()=>{
    return gamesData.filter(g=>{
      if(playerCount!=='' ){
        const n = Number(playerCount)
        if(Number.isNaN(n) || n < g.players[0] || n > g.players[1]) return false
      }
      if(ownedPacks.size>0 && !ownedPacks.has(g.pack)) return false
      if(selectedTypes.size>0){
        const cons = toConsolidated(g.types)
        if(!cons.some(t=>selectedTypes.has(t))) return false
      }
      if(familyOnly && !g.familyFriendly) return false
      if(audienceOnly && !g.audience) return false
      if(hideMature && g.mature) return false
      if(durationFilter==='short' && g.duration>10) return false
      if(durationFilter==='medium' && g.duration!==15) return false
      if(durationFilter==='long' && g.duration<20) return false
      if(search.trim()){
        const q=search.toLowerCase()
        const cons = toConsolidated(g.types).join(' ').toLowerCase()
        if(!g.title.toLowerCase().includes(q) && !g.description.toLowerCase().includes(q) && !g.pack.toLowerCase().includes(q) && !cons.includes(q) && !g.types.join(' ').toLowerCase().includes(q)) return false
      }
      return true
    })
  },[playerCount, ownedPacks, selectedTypes, familyOnly, audienceOnly, hideMature, durationFilter, search])

  const pickRandom = ()=>{
    if(filtered.length===0) return
    if(isPicking) return
    setIsPicking(true)
    let ticks=0
    const total=22 // ponytail: fixed shuffle steps, no physics
    shuffleRef.current = setInterval(()=>{
      ticks++
      const r = filtered[Math.floor(Math.random()*filtered.length)]
      setShuffleTitle(r.title)
      if(ticks>=total){
        clearInterval(shuffleRef.current)
        const winner = filtered[Math.floor(Math.random()*filtered.length)]
        setShuffleTitle(winner.title)
        setHistory(h=>[winner.title, ...h].slice(0,20))
        setSelectedGame(winner)
        setIsPicking(false)
      }
    }, 70)
  }
  useEffect(()=>()=>clearInterval(shuffleRef.current),[])
  // R to random
  useEffect(()=>{
    const onKey = e=>{
      if(e.key.toLowerCase()==='r' && !selectedGame && !isPicking && filtered.length>0 && e.target.tagName!=='INPUT' && e.target.tagName!=='SELECT' && e.target.tagName!=='TEXTAREA'){
        pickRandom()
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=>window.removeEventListener('keydown', onKey)
  },[filtered, isPicking, selectedGame])

  const lastGame = useMemo(()=>{
    if(!history.length) return null
    return gamesData.find(g=> g.title===history[0]) || null
  },[history])
  const lastArt = lastGame ? (lastGame.iconUrl || ytThumb(lastGame.youtubeId)) : null

  const toggleSet = (set, setter, val)=>{
    const n = new Set(set)
    if(n.has(val)) n.delete(val); else n.add(val)
    setter(n)
  }
  const clearFilters = ()=>{
    setPlayerCount(''); setOwnedPacks(new Set()); setSelectedTypes(new Set())
    setFamilyOnly(false); setAudienceOnly(false); setHideMature(false); setDurationFilter(''); setSearch('')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="/whatsinthejackboxlogo.png" alt="What's In The Jackbox?" />
          <div className="brand-sub">WHAT'S IN THE JACKBOX?<span>• PICKER</span></div>
        </div>
        <div className="topbar-right">
          <span className="count-badge">{filtered.length} / {gamesData.length} GAMES</span>
          <a className="jack-link" href="https://jackbox.tv" target="_blank" rel="noreferrer">jackbox.tv ↗</a>
        </div>
      </header>

      <section className="hero-picker">
        <div className="hero-left">
          <div className="hero-copy">
            <h1>WHAT ARE <br/>WE PLAYING?</h1>
            <p>Filter your packs, smash RANDOM — we handle the rest.<br/>No accounts. No BS.</p>
            <div className="hero-actions">
              <button className="btn-primary" onClick={pickRandom} disabled={isPicking || filtered.length===0}>
                {isPicking ? `SHUFFLING… ${shuffleTitle}` : `★ SURPRISE ME — PICK A GAME ★`}
              </button>
              <button className="btn-ghost" onClick={()=>setHistory([])} disabled={history.length===0}>CLEAR HISTORY</button>
            </div>
            {history.length>0 && (
              <div className="history">
                <span>HISTORY:</span>
                {history.map((t,i)=>{
                  const g = gamesData.find(x=> x.title===t)
                  return <button key={i} type="button" className="hist-item" onClick={()=> g && setSelectedGame(g)} title={g ? `Open ${t}` : t}>{t}</button>
                })}
              </div>
            )}
            {filtered.length===0 && <div className="no-match">NO GAMES MATCH YOUR FILTERS — TRY CLEARING SOME.</div>}
          </div>
          {lastGame && lastArt && (
            <div className="hero-art" style={{backgroundImage: `url("${lastArt}")`}} aria-hidden="true">
              <div className="hero-art-fade" />
              <span className="hero-art-label">{lastGame.title}</span>
            </div>
          )}
        </div>
      </section>

      <section className="filters">
        <div className="filter-row">
          <label className="field">
            <span>PLAYERS</span>
            <input type="number" min="1" max="16" placeholder="e.g. 6" value={playerCount} onChange={e=>setPlayerCount(e.target.value)} />
          </label>

          <label className="field search-field">
            <span>SEARCH</span>
            <input type="text" placeholder="quiplash, drawing, bluff…" value={search} onChange={e=>setSearch(e.target.value)} />
          </label>

          <label className="field">
            <span>DURATION</span>
            <select value={durationFilter} onChange={e=>setDurationFilter(e.target.value)}>
              <option value="">Any time</option>
              <option value="short">Quick ≤10 min</option>
              <option value="medium">Standard 15 min</option>
              <option value="long">Long 20+ min</option>
            </select>
          </label>

          <div className="toggles">
            <label className="toggle"><input type="checkbox" checked={familyOnly} onChange={e=>setFamilyOnly(e.target.checked)}/> Family-friendly only</label>
            <label className="toggle"><input type="checkbox" checked={audienceOnly} onChange={e=>setAudienceOnly(e.target.checked)}/> Audience (10k) </label>
            <label className="toggle"><input type="checkbox" checked={hideMature} onChange={e=>setHideMature(e.target.checked)}/> Hide 17+ / Naughty</label>
          </div>

          <button className="btn-small" onClick={clearFilters}>RESET</button>
        </div>

        <div className="filter-block">
          <div className="filter-label">PACKS YOU OWN <span className="hint">(leave empty = show all)</span></div>
          <div className="chips">
            {allPacks.map(p=>(
              <button key={p} className={`chip ${ownedPacks.has(p)?'chip-on':''} ${p==='Naughty Pack'?'chip-naughty':''}`} onClick={()=>toggleSet(ownedPacks,setOwnedPacks,p)} style={{'--c': PACK_COLOR[p]}}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-block">
          <div className="filter-label">GAME TYPE <span className="hint">(consolidated — art+creative, music/sound/rhythm/rap, etc.)</span></div>
          <div className="chips">
            {orderedTypes.map(t=>(
              <button key={t} className={`chip ${selectedTypes.has(t)?'chip-on':''}`} onClick={()=>toggleSet(selectedTypes,setSelectedTypes,t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-wrap">
        <div className="grid">
          {filtered.map(g=>(
            <GameCard key={g.id} game={g} onSelect={setSelectedGame}/>
          ))}
        </div>
        {filtered.length===0 && <div className="empty">No games. Adjust filters.</div>}
      </section>

      <footer className="footer">
        <span>66 GAMES • Packs 1-11 + Naughty + Standalone • Not affiliated with Jackbox Games, Inc. — fan picker.</span>
        <span>Hit <b>R</b> to random. <b>Esc</b> closes modal.</span>
      </footer>

      {selectedGame && <GameModal game={selectedGame} onClose={()=>setSelectedGame(null)} onPickAnother={pickRandom} filteredCount={filtered.length}/>}
    </div>
  )
}

function GameCard({game, onSelect}){
  const color = PACK_COLOR[game.pack] || '#ffe600'
  const thumb = game.iconUrl || ytThumb(game.youtubeId)
  return (
    <button className="card" onClick={()=>onSelect(game)} style={{'--accent': color}}>
      <div className="card-media">
        <img
          src={thumb}
          alt=""
          loading="lazy"
          onError={e=>{
            e.currentTarget.onerror=null
            e.currentTarget.src=placeholderIcon(game.title, game.pack)
          }}
        />
        <span className="card-pack" style={{background: color, color: game.pack==='Standalone' ? '#0f0f0f':'#0f0f0f'}}>{game.pack.toUpperCase()}</span>
        {game.mature && <span className="card-mature">17+</span>}
      </div>
      <div className="card-body">
        <h3>{game.title}</h3>
        <p className="card-desc">{game.description}</p>
        <div className="card-meta">
          <span className="meta-pill">{game.players[0]}–{game.players[1]} PLAYERS</span>
          {game.audience && <span className="meta-pill aud">+ AUDIENCE</span>}
          <span className="meta-pill">{game.duration} MIN</span>
        </div>
        <div className="card-types">
          {toConsolidated(game.types).slice(0,3).map(t=><span key={t} className="type-tag">{t}</span>)}
        </div>
      </div>
    </button>
  )
}

function GameModal({game, onClose, onPickAnother, filteredCount}){
  useEffect(()=>{
    const h = e=>{ if(e.key==='Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow='hidden'
    return ()=>{ window.removeEventListener('keydown', h); document.body.style.overflow='' }
  },[onClose])

  const hasVideo = !!game.youtubeId
  const hasGif = !!game.gifUrl
  const fallbackImg = game.iconUrl || placeholderIcon(game.title, game.pack)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={game.title}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="modal-media">
          {hasVideo ? (
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${game.youtubeId}?rel=0&modestbranding=1`}
              title={`${game.title} trailer`}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : hasGif ? (
            <img src={game.gifUrl} alt={`${game.title} gameplay`} loading="lazy"
              onError={e=>{e.currentTarget.style.display='none'}} />
          ) : (
            <div className="modal-placeholder">
              <img src={fallbackImg} alt={`${game.title} icon`} />
              <p>No trailer available</p>
            </div>
          )}
        </div>

        <div className="modal-body">
          <div className="modal-head">
            <span className="modal-pack" style={{background: PACK_COLOR[game.pack]||'#ffe600'}}>{game.pack}</span>
            {game.mature && <span className="modal-mature">MATURE 17+</span>}
            {!game.mature && game.familyFriendly && <span className="modal-family">FAMILY FRIENDLY</span>}
          </div>
          <h2>{game.title}</h2>
          <p className="modal-desc">{game.description}</p>

          <div className="modal-stats">
            <div className="stat"><span>PLAYERS</span><b>{game.players[0]}–{game.players[1]}</b>{game.audience && <i>+ audience up to 10k</i>}</div>
            <div className="stat"><span>DURATION</span><b>{game.duration} min</b></div>
            <div className="stat"><span>YEAR / PACK</span><b>{game.year} • {game.pack}</b></div>
          </div>

          <div className="modal-types">
            {toConsolidated(game.types).map(t=> <span key={t} className="type-tag large">{t}</span>)}
          </div>

          <div className="modal-details">
            <div><b>Audience:</b> {game.audience ? 'Yes — 10,000 can join as audience' : 'No'}</div>
            <div><b>Family friendly setting:</b> {game.familyFriendly ? 'Yes' : 'No — may include edgy content'}</div>
            <div><b>Mature:</b> {game.mature ? 'Yes — Naughty Pack 17+' : 'No'}</div>
          </div>

          <div className="modal-actions">
            <button className="btn-primary small" onClick={()=>{ onClose(); setTimeout(onPickAnother, 150)}}>PICK ANOTHER ({filteredCount} in pool)</button>
            <a className="btn-ghost" href={`https://www.youtube.com/results?search_query=jackbox+${encodeURIComponent(game.title)}+gameplay`} target="_blank" rel="noreferrer">WATCH ON YOUTUBE ↗</a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ponytail: global random + filter is O(n) scan, no index — fine for 66 games; add indexing if catalog grows 10x
