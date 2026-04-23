import React, { useState, useEffect } from "react";

/* ── THEME ───────────────────────────────────────────────── */
function useTheme() {
  const [dark, setDark] = useState(() => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const h = e => setDark(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return dark;
}
function makeTheme(dark) {
  if (dark) return { bg:"#250902", surface:"#310C03", card:"#3D1005", red:"#800E13", text:"#F5ECD8", textMid:"rgba(245,236,216,0.65)", muted:"rgba(245,236,216,0.4)", faint:"rgba(245,236,216,0.08)", border:"rgba(128,14,19,0.45)", borderSub:"rgba(245,236,216,0.1)", navBg:"#1E0702", grad:"linear-gradient(135deg,#A01018,#600A0E)", isDark:true };
  return { bg:"#FFFFFF", surface:"#F8F8F8", card:"#FFFFFF", red:"#800E13", text:"#1A0202", textMid:"rgba(26,2,2,0.65)", muted:"rgba(26,2,2,0.4)", faint:"rgba(128,14,19,0.07)", border:"rgba(128,14,19,0.2)", borderSub:"rgba(26,2,2,0.08)", navBg:"#FFFFFF", grad:"linear-gradient(135deg,#A01018,#600A0E)", isDark:false };
}
/* ── GOOGLE PLACES ───────────────────────────────────────── */
const PLACES_KEY = "AIzaSyCkg3ThAKCWzEu-waM_KBsX4Ys90MJNSAo";

const CAT_QUERY = {
  restaurants:"romantic dinner date night restaurant",
  nightlife:"cocktail bar lounge rooftop bar wine bar nightclub",
  experiences:"painting class wine tasting escape room bowling axe throwing comedy show",
  outdoors:"parks outdoor",
  dessert:"dessert bar cafe bakery",
};
const CAT_TYPE = {
  restaurants:"restaurant", nightlife:"bar",
  experiences:"tourist_attraction", outdoors:"park", dessert:"bakery",
};
function noiseFromTypes(types=[]) {
  if(types.includes("night_club")) return "loud";
  if(types.includes("bar")) return "moderate";
  return "quiet";
}
function priceFromLevel(l){ return["$","$","$$","$$$","$$$$"][Math.min(l??1,4)]; }
function transformGPlace(p,cat){
  const photoRef=p.photos?.[0]?.photo_reference;
  // Store all photo refs for gallery (up to 8)
  const allPhotoRefs = (p.photos||[]).slice(0,8).map(ph=>ph.photo_reference).filter(Boolean);
  const DG={restaurants:"linear-gradient(160deg,#3A0808,#600E10)",nightlife:"linear-gradient(160deg,#180A35,#28145A)",experiences:"linear-gradient(160deg,#2A1A08,#402810)",outdoors:"linear-gradient(160deg,#0A2A14,#124020)",dessert:"linear-gradient(160deg,#3A0A18,#5A1028)"};
  const LG={restaurants:"linear-gradient(160deg,#FFF0F0,#FFDEDE)",nightlife:"linear-gradient(160deg,#F4F0FF,#EAE2FF)",experiences:"linear-gradient(160deg,#FFF4EE,#FFE4D4)",outdoors:"linear-gradient(160deg,#EEFFF4,#DCFFE8)",dessert:"linear-gradient(160deg,#FFF0F6,#FFDDED)"};
  const EM={restaurants:"🍽️",nightlife:"🌙",experiences:"✨",outdoors:"🌿",dessert:"🍰"};
  const address = p.formatted_address||p.vicinity||"";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}&query_place_id=${p.place_id}`;
  // Build busy times from popular_times if available
  const popularTimes = p.current_popularity || null;
  // Weekday hours text
  const hoursText = p.opening_hours?.weekday_text || null;
  const isOpen = p.opening_hours?.open_now;
  return {
    id:p.place_id, name:p.name, cat,
    tag:p.types?.[0]?.replace(/_/g," ").replace(/\w/g,c=>c.toUpperCase())||cat,
    address, mapsUrl,
    rating:p.rating||4.5, reviews:p.user_ratings_total||0,
    price:priceFromLevel(p.price_level), noise:noiseFromTypes(p.types||[]),
    isOpen, hoursText, popularTimes,
    photoUrl:photoRef?`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${PLACES_KEY}`:null,
    photos:allPhotoRefs.map(ref=>`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ref}&key=${PLACES_KEY}`),
    emoji:EM[cat]||"📍", dg:DG[cat]||DG.restaurants, lg:LG[cat]||LG.restaurants,
    // desc will be enriched by fetchPlaceDetails, default to editorial summary placeholder
    desc: p.editorial_summary?.overview || "",
    descPending: !p.editorial_summary?.overview,
    isReal:true,
  };
}
// Excluded chain types — not date-appropriate
const EXCLUDE_TYPES = ["meal_takeaway","meal_delivery","fast_food","grocery_or_supermarket","supermarket","gas_station","pharmacy","hospital","dentist","doctor","gym","laundry"];

function isDateAppropriate(place) {
  const types = place.types || [];
  if (EXCLUDE_TYPES.some(t => types.includes(t))) return false;
  if ((place.rating || 0) < 3.8) return false;
  if ((place.user_ratings_total || 0) < 20) return false;
  return true;
}

async function fetchPlacesByCity(city, cat) {
  const query = `${CAT_QUERY[cat]||cat} in ${city}`;
  const type  = CAT_TYPE[cat]||"establishment";
  // Use nearbysearch with fields including editorial_summary for descriptions
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&type=${type}&key=${PLACES_KEY}`;
  const proxies = [
    { url:`https://corsproxy.io/?${encodeURIComponent(url)}`, parse:r=>r },
    { url:`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, parse:r=>JSON.parse(r.contents) },
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const raw = await res.json();
      const parsed = proxy.parse(raw);
      const results = (parsed.results||[]).filter(isDateAppropriate);
      if (results.length > 0) return results.slice(0, 12);
    } catch { continue; }
  }
  return [];
}

// Fetch Place Details for description, hours, busy times
async function fetchPlaceDetails(placeId) {
  const fields = "editorial_summary,opening_hours,current_opening_hours,website,formatted_phone_number,price_level,user_ratings_total,serves_beer,serves_wine,serves_cocktails,reservable,curbside_pickup,delivery,dine_in,takeout";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${PLACES_KEY}`;
  const proxies = [
    { url:`https://corsproxy.io/?${encodeURIComponent(url)}`, parse:r=>r },
    { url:`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, parse:r=>JSON.parse(r.contents) },
  ];
  for (const proxy of proxies) {
    try {
      const res = await fetch(proxy.url, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const raw = await res.json();
      const parsed = proxy.parse(raw);
      if (parsed.result) return parsed.result;
    } catch { continue; }
  }
  return null;
}

/* ── DATA ────────────────────────────────────────────────── */
const STAGES = [
  { id:"first",    label:"First Date", emoji:"🦋", color:"#E8547A", sub:"Getting to know each other" },
  { id:"dating",   label:"Dating",     emoji:"❤️",  color:"#D4A853", sub:"1–6 months in" },
  { id:"serious",  label:"Serious",    emoji:"💛",  color:"#9B7FD4", sub:"6 months to 2 years" },
  { id:"married",  label:"Married",    emoji:"💍",  color:"#7ABFDF", sub:"For life" },
];
const CATEGORIES = [
  { id:"restaurants", label:"Restaurants",  emoji:"🍽️", desc:"Dining for every mood",          dg:"linear-gradient(145deg,#4A0E0E,#2A0602)", lg:"linear-gradient(145deg,#FFF0F0,#FFDEDE)" },
  { id:"nightlife",   label:"Nightlife",    emoji:"🌙", desc:"Bars, clubs & late nights",      dg:"linear-gradient(145deg,#14082A,#0A0418)", lg:"linear-gradient(145deg,#F4F0FF,#E8DEFF)" },
  { id:"experiences", label:"Experiences", emoji:"✨", desc:"Activities, outdoors & more",    dg:"linear-gradient(145deg,#2A1A08,#180E04)", lg:"linear-gradient(145deg,#FFFAF0,#FFF0DE)" },
  { id:"questions",   label:"Questions",   emoji:"💬", desc:"Spark great conversation",       dg:"linear-gradient(145deg,#2A080E,#180406)", lg:"linear-gradient(145deg,#FFF0F2,#FFDDE2)" },
];
const SPOTS = [
  { id:1,  name:"Maison Rouge",        cat:"restaurants",  price:"$$$", rating:4.9, noise:"quiet",    tag:"Fine Dining",    dg:"linear-gradient(160deg,#3A0808,#600E10)", lg:"linear-gradient(160deg,#FFF0F0,#FFDEDE)", emoji:"🕯️", hours:["5:00 PM","11:00 PM"], desc:"French-inspired tasting menu in a candlelit townhouse. Intimate and unforgettable." },

  { id:3,  name:"Velvet Lounge",       cat:"nightlife",    price:"$$$", rating:4.7, noise:"loud",     tag:"Cocktail Bar",   dg:"linear-gradient(160deg,#180A35,#28145A)", lg:"linear-gradient(160deg,#F4F0FF,#EAE2FF)", emoji:"🌙", hours:["8:00 PM","2:00 AM"],  desc:"Intimate underground bar with handcrafted cocktails and velvet booths." },
  { id:4,  name:"Ember & Ash",         cat:"restaurants",  price:"$$",  rating:4.8, noise:"moderate", tag:"Wood-fire",      dg:"linear-gradient(160deg,#3A1808,#5A2A10)", lg:"linear-gradient(160deg,#FFF4EE,#FFE4D4)", emoji:"🔥", hours:["4:30 PM","10:00 PM"], desc:"Wood-fired seasonal dishes in a warm courtyard setting." },
  { id:5,  name:"Moonlight Cruise",    cat:"experiences",  price:"$$$", rating:4.9, noise:"quiet",    tag:"Sunset Sail",    dg:"linear-gradient(160deg,#0A1E35,#103050)", lg:"linear-gradient(160deg,#EEF6FF,#DCEDFF)", emoji:"⛵", desc:"Private harbor cruise at golden hour with champagne for two." },

  { id:7,  name:"Sweet Surrender",     cat:"dessert",      price:"$$",  rating:4.9, noise:"quiet",    tag:"Dessert Bar",    dg:"linear-gradient(160deg,#3A0A18,#5A1028)", lg:"linear-gradient(160deg,#FFF0F6,#FFDDED)", emoji:"🍫", hours:["12:00 PM","12:00 AM"], desc:"Chocolate fondue and dessert flights until midnight." },
  { id:8,  name:"Stargazer Rooftop",   cat:"nightlife",    price:"$$",  rating:4.8, noise:"moderate", tag:"Rooftop Bar",    dg:"linear-gradient(160deg,#14103A,#201858)", lg:"linear-gradient(160deg,#F2F0FF,#E6E2FF)", emoji:"🔭", hours:["5:00 PM","1:00 AM"],  desc:"Open-air rooftop with telescopes, star maps, and craft cocktails." },
  { id:9,  name:"Botanical Picnic",    cat:"outdoors",     price:"$$",  rating:4.8, noise:"quiet",    tag:"Picnic",         dg:"linear-gradient(160deg,#0A2A14,#124020)", lg:"linear-gradient(160deg,#EEFFF4,#DCFFE8)", emoji:"🧺", desc:"Pre-arranged luxury picnic — flowers, food, blankets." },
  { id:10, name:"Canvas & Cuvée",      cat:"experiences",  price:"$$",  rating:4.7, noise:"moderate", tag:"Paint & Wine",   dg:"linear-gradient(160deg,#2A1A08,#402810)", lg:"linear-gradient(160deg,#FFFAEE,#FFF2D4)", emoji:"🎨", desc:"Paint side by side with wine. Take your art home." },

  { id:12, name:"Rosario's Trattoria", cat:"restaurants",  price:"$$",  rating:4.7, noise:"moderate", tag:"Italian",        dg:"linear-gradient(160deg,#3A0A08,#5A1810)", lg:"linear-gradient(160deg,#FFF4F0,#FFE4DC)", emoji:"🍝", hours:["11:30 AM","10:00 PM"], desc:"Handmade pasta, a fireplace, and a wine list that never disappoints." },
];
const QUESTIONS = {
  first:   ["If you could live anywhere for a year, where?","What are you really proud of that most people don't know?","What does your perfect Sunday look like?","What made you genuinely laugh recently?","What's on your bucket list you actually plan to do?","What music puts you in a great mood?"],
  dating:  ["What's something about your routine you'd never give up?","When did you last step outside your comfort zone?","What does romance mean to you — beyond the clichés?","What's the best trip you've taken and why?","What quality do you value most in a partner?","What goal are you quietly working toward?"],
  serious: ["What's something I do that makes you feel most loved?","Is there anything we used to do early on that you miss?","What's a dream trip we've never seriously discussed?","When do you feel most connected to me?","What's one thing you've always wanted to try together?","What do you want more of in our relationship?"],
  married: ["What's something about our life you never imagined you'd love?","If you could relive one day of our marriage, which?","What dream have you quietly shelved?","What's our greatest strength as a couple?","What's something I've never fully understood about you?","What would you tell our younger selves about us?"],
};
const ONBOARDING_STEPS = [
  { id:"stage", title:"Where are you in your journey?", subtitle:"We'll tailor everything to your stage.", type:"single",
    options: STAGES.map(s => ({ id:s.id, label:s.label, sub:s.sub, emoji:s.emoji, color:s.color })) },
  { id:"frequency", title:"How often do you go on dates?", subtitle:"No judgment — every pace is perfect.", type:"single",
    options:[
      {id:"starting",  label:"Just getting back out there",      emoji:"🌱"},
      {id:"occasional",label:"Occasionally — once or twice a month", emoji:"🗓️"},
      {id:"regular",   label:"Regularly — it's a priority",      emoji:"🔥"},
      {id:"together",  label:"We're together but life gets busy", emoji:"⏳"},
      {id:"habit",     label:"Date night is a real habit for us", emoji:"💪"},
    ]},
  { id:"priority", title:"What matters most on a date?", subtitle:"Pick everything that feels true.", type:"multi",
    options:[
      {id:"conversation", label:"Great conversation",      emoji:"💬"},
      {id:"food",         label:"Amazing food & drinks",   emoji:"🍷"},
      {id:"experiences",  label:"Trying new experiences",  emoji:"✨"},
      {id:"vibe",         label:"The setting & atmosphere",emoji:"🕯️"},
      {id:"laughing",     label:"Laughing together",       emoji:"😂"},
    ]},
];
const noiseInfo = {
  quiet:    { label:"Intimate",  color:"#2D9E6A", bg:"rgba(45,158,106,0.15)",  icon:"🕯️" },
  moderate: { label:"Buzzy",     color:"#B8860B", bg:"rgba(184,134,11,0.15)",  icon:"🎶" },
  loud:     { label:"Energetic", color:"#C03030", bg:"rgba(192,48,48,0.15)",   icon:"🎉" },
};

/* ── TINY HELPERS ────────────────────────────────────────── */
const NoiseBadge = ({noise}) => { const n=noiseInfo[noise]||noiseInfo.moderate; return <span style={{display:"inline-flex",alignItems:"center",gap:3,background:n.bg,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,color:n.color,fontFamily:"'DM Sans',sans-serif"}}>{n.icon} {n.label}</span>; };
const Star = ({r,T}) => <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.red}}>★ {r}</span>;
const Logo = ({T,size=28}) => <span style={{fontFamily:"'Playfair Display',serif",fontSize:size,fontWeight:800,fontStyle:"italic",color:T.isDark?"#FFFFFF":"#000000",letterSpacing:"-0.01em"}}>First Date</span>;
const BackBtn = ({onBack,T}) => <button onClick={onBack} style={{background:T.faint,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,color:T.muted,cursor:"pointer"}}>← Back</button>;

/* ── SCREEN WRAPPER ──────────────────────────────────────── */
const Screen = ({title,onBack,T,children}) => (
  <div style={{position:"fixed",inset:0,zIndex:600,background:T.bg,overflowY:"auto",maxWidth:480,margin:"0 auto"}}>
    <div style={{padding:"52px 20px 16px",display:"flex",alignItems:"center",gap:14,borderBottom:`1px solid ${T.borderSub}`,marginBottom:8}}>
      <BackBtn onBack={onBack} T={T}/>
      <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:T.text}}>{title}</span>
    </div>
    <div style={{padding:"8px 20px 80px"}}>{children}</div>
  </div>
);

/* ── ONBOARDING ──────────────────────────────────────────── */
function Onboarding({T, onComplete}) {
  const [screen, setScreen] = useState("welcome");
  const [form, setForm] = useState({name:"",email:"",password:""});
  const [answers, setAnswers] = useState({});
  const [stepIdx, setStepIdx] = useState(0);
  const [err, setErr] = useState("");

  const handleSignup = () => {
    if (!form.name.trim()) return setErr("Please enter your name");
    if (!form.email.includes("@")) return setErr("Please enter a valid email");
    if (form.password.length < 6) return setErr("Password must be at least 6 characters");
    setErr(""); setScreen("steps");
  };

  const step = ONBOARDING_STEPS[stepIdx];
  const toggle = (sid, oid, multi) => {
    if (multi) { const c=answers[sid]||[]; setAnswers(a=>({...a,[sid]:c.includes(oid)?c.filter(x=>x!==oid):[...c,oid]})); }
    else setAnswers(a=>({...a,[sid]:oid}));
  };
  const canNext = step?.type==="multi" ? (answers[step?.id]||[]).length>0 : !!answers[step?.id];
  const next = () => { if(stepIdx<ONBOARDING_STEPS.length-1) setStepIdx(i=>i+1); else onComplete({...form,...answers}); };

  const inp = (field, label, type, ph) => (
    <div style={{marginBottom:16}}>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:6}}>{label}</div>
      <input type={type} placeholder={ph} value={form[field]} onChange={e=>setForm(x=>({...x,[field]:e.target.value}))}
        style={{width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:"14px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:T.text,outline:"none"}}/>
    </div>
  );

  if (screen==="welcome") return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px",textAlign:"center",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:T.grad,borderRadius:"50%",width:80,height:80,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,marginBottom:28,boxShadow:"0 8px 32px rgba(128,14,19,0.35)"}}>❤️</div>
      <Logo T={T} size={36}/>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,margin:"12px 0 36px",lineHeight:1.6,maxWidth:280}}>Your ultimate wingman for every date — first dates, date nights, and everything in between.</p>
      <button onClick={()=>setScreen("signup")} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:16,padding:"16px",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:800,cursor:"pointer",marginBottom:12,boxShadow:"0 6px 20px rgba(128,14,19,0.3)"}}>Create Account</button>
      <button onClick={()=>setScreen("login")} style={{width:"100%",background:"transparent",color:T.red,border:`1.5px solid ${T.border}`,borderRadius:16,padding:"15px",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:700,cursor:"pointer"}}>Sign In</button>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted,marginTop:20}}>By continuing you agree to our <span style={{color:T.red,fontWeight:700}}>Privacy Policy</span></p>
    </div>
  );

  if (screen==="signup") return (
    <div style={{minHeight:"100vh",background:T.bg,padding:"52px 28px 0",maxWidth:480,margin:"0 auto"}}>
      <div style={{marginBottom:24}}><BackBtn onBack={()=>setScreen("welcome")} T={T}/></div>
      <Logo T={T}/><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:T.text,marginTop:12,marginBottom:4}}>Create your account</div>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:24}}>Takes less than 2 minutes.</p>
      {err&&<div style={{background:"rgba(192,48,48,0.12)",border:"1px solid rgba(192,48,48,0.3)",borderRadius:10,padding:"10px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#C03030",marginBottom:16}}>{err}</div>}
      {inp("name","Your first name","text","Alex")}{inp("email","Email address","email","you@email.com")}{inp("password","Password","password","At least 6 characters")}
      <button onClick={handleSignup} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:16,padding:"16px",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:800,cursor:"pointer",marginTop:8}}>Continue →</button>
    </div>
  );

  if (screen==="login") return (
    <div style={{minHeight:"100vh",background:T.bg,padding:"52px 28px 0",maxWidth:480,margin:"0 auto"}}>
      <div style={{marginBottom:24}}><BackBtn onBack={()=>setScreen("welcome")} T={T}/></div>
      <Logo T={T}/><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:T.text,marginTop:12,marginBottom:4}}>Welcome back</div>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:24}}>Sign in to your account.</p>
      {inp("email","Email address","email","you@email.com")}{inp("password","Password","password","Your password")}
      <button onClick={()=>onComplete({...form,name:form.email.split("@")[0]||"You"})} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:16,padding:"16px",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:800,cursor:"pointer",marginTop:8}}>Sign In →</button>
      <button style={{width:"100%",background:"transparent",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,cursor:"pointer",marginTop:14}}>Forgot password?</button>
    </div>
  );

  if (screen==="steps" && step) return (
    <div style={{minHeight:"100vh",background:T.bg,padding:"52px 24px 0",maxWidth:480,margin:"0 auto"}}>
      <div style={{display:"flex",gap:6,marginBottom:28}}>
        {ONBOARDING_STEPS.map((_,i)=><div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=stepIdx?T.red:T.faint,transition:"background 0.3s"}}/>)}
      </div>
      <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:T.text,lineHeight:1.2,marginBottom:4}}>{step.title}</div>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:22}}>{step.subtitle}{step.type==="multi"&&" Select all that apply."}</p>
      <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
        {step.options.map(opt => {
          const sel = step.type==="multi" ? (answers[step.id]||[]).includes(opt.id) : answers[step.id]===opt.id;
          return (
            <button key={opt.id} onClick={()=>toggle(step.id,opt.id,step.type==="multi")}
              style={{background:sel?`${opt.color||T.red}18`:T.faint,border:`1.5px solid ${sel?opt.color||T.red:T.border}`,borderRadius:14,padding:"14px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",textAlign:"left",transition:"all 0.18s"}}>
              <span style={{fontSize:22}}>{opt.emoji}</span>
              <div style={{flex:1}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:T.text}}>{opt.label}</div>
                {opt.sub&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted,marginTop:1}}>{opt.sub}</div>}
              </div>
              {sel&&<span style={{color:opt.color||T.red,fontWeight:800}}>✓</span>}
            </button>
          );
        })}
      </div>
      <button onClick={next} disabled={!canNext} style={{width:"100%",background:canNext?T.grad:"transparent",color:canNext?"#fff":T.muted,border:canNext?"none":`1px solid ${T.border}`,borderRadius:16,padding:"16px",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:800,cursor:canNext?"pointer":"not-allowed"}}>
        {stepIdx<ONBOARDING_STEPS.length-1?"Continue →":"Let's go! →"}
      </button>
      {stepIdx>0&&<button onClick={()=>setStepIdx(i=>i-1)} style={{width:"100%",background:"transparent",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,cursor:"pointer",marginTop:12}}>← Back</button>}
    </div>
  );

  return null;
}

/* ── SETTINGS ────────────────────────────────────────────── */
function Settings({T, onBack, user}) {
  const [sec, setSec] = useState("main");
  const [notifs, setNotifs] = useState({reminders:true,newSpots:true,weekly:false,updates:true});
  const [radius, setRadius] = useState("5");
  const [copied, setCopied] = useState(false);
  const [fbType, setFbType] = useState("feedback");
  const [fbMsg, setFbMsg] = useState("");
  const [fbSent, setFbSent] = useState(false);

  const Toggle = ({val,onChange}) => (
    <div onClick={onChange} style={{width:44,height:26,borderRadius:13,background:val?T.red:T.faint,border:`1px solid ${val?T.red:T.border}`,cursor:"pointer",position:"relative",transition:"all 0.22s",flexShrink:0}}>
      <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:val?22:2,transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
    </div>
  );
  const Row = ({icon,label,sub,go}) => (
    <button onClick={go} style={{width:"100%",background:T.surface,border:`1px solid ${T.borderSub}`,borderRadius:16,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",textAlign:"left",marginBottom:10,transition:"all 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=T.border} onMouseLeave={e=>e.currentTarget.style.borderColor=T.borderSub}>
      <span style={{fontSize:22,flexShrink:0}}>{icon}</span>
      <div style={{flex:1}}><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:T.text}}>{label}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.muted,marginTop:1}}>{sub}</div></div>
      <span style={{color:T.muted,fontSize:16}}>›</span>
    </button>
  );

  const [prefCity, setPrefCity] = useState("Tampa, FL");
  const [prefCityInput, setPrefCityInput] = useState("Tampa, FL");
  if (sec==="preferences") return (
    <Screen title="Preferences" onBack={()=>setSec("main")} T={T}>
      {/* Location */}
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:T.muted,marginBottom:10}}>Your Location</div>
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        <div style={{position:"relative",flex:1}}>
          <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",fontSize:13}}>📍</span>
          <input value={prefCityInput} onChange={e=>setPrefCityInput(e.target.value)} placeholder="City, e.g. Miami, FL"
            style={{width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:22,padding:"10px 12px 10px 32px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.text,outline:"none"}}/>
        </div>
        <button onClick={()=>setPrefCity(prefCityInput)} style={{background:T.grad,color:"#fff",border:"none",borderRadius:22,padding:"10px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>Update</button>
      </div>
      {/* Search Radius */}
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:T.muted,marginBottom:10}}>Search Radius</div>
      <div style={{display:"flex",gap:8,marginBottom:24}}>
        {["1","3","5","10","20"].map(r=><button key={r} onClick={()=>setRadius(r)} style={{flex:1,background:radius===r?T.grad:T.faint,color:radius===r?"#fff":T.muted,border:`1px solid ${radius===r?"transparent":T.border}`,borderRadius:10,padding:"10px 0",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>{r}mi</button>)}
      </div>
      {/* Notifications */}
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:T.muted,marginBottom:10}}>Notifications</div>
      {[{k:"reminders",l:"Date reminders",s:"Remind you before a planned date"},{k:"newSpots",l:"New spots near you",s:"When great new places open"},{k:"weekly",l:"Weekly inspiration",s:"Ideas every Thursday evening"},{k:"updates",l:"App updates",s:"New features and fixes"}].map(x=>(
        <div key={x.k} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0",borderBottom:`1px solid ${T.borderSub}`}}>
          <div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,color:T.text}}>{x.l}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted,marginTop:2}}>{x.s}</div></div>
          <div onClick={()=>setNotifs(n=>({...n,[x.k]:!n[x.k]}))} style={{width:44,height:26,borderRadius:13,background:notifs[x.k]?T.red:T.faint,border:`1px solid ${notifs[x.k]?T.red:T.border}`,cursor:"pointer",position:"relative",transition:"all 0.22s",flexShrink:0}}>
            <div style={{width:20,height:20,borderRadius:"50%",background:"#fff",position:"absolute",top:2,left:notifs[x.k]?22:2,transition:"left 0.22s",boxShadow:"0 1px 4px rgba(0,0,0,0.2)"}}/>
          </div>
        </div>
      ))}
      {/* Appearance */}
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:T.muted,margin:"20px 0 10px"}}>Appearance</div>
      <div style={{background:T.surface,borderRadius:14,padding:"14px 16px",border:`1px solid ${T.borderSub}`,display:"flex",alignItems:"center",gap:12}}>
        <span style={{fontSize:20}}>{T.isDark?"🌙":"☀️"}</span>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.text}}><strong>{T.isDark?"Dark Mode":"Light Mode"}</strong> · Follows your device setting automatically</div>
      </div>
    </Screen>
  );

  if (sec==="account") return (
    <Screen title="Account" onBack={()=>setSec("main")} T={T}>
      <div style={{background:T.grad,borderRadius:18,padding:"24px 20px",marginBottom:20,textAlign:"center"}}>
        <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 12px"}}>👤</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:"#fff"}}>{user?.name||"Your Name"}</div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"rgba(255,255,255,0.65)",marginTop:2}}>{user?.email||"your@email.com"}</div>
      </div>
      {[["Edit Name",user?.name||""],["Email",user?.email||""],["Password","••••••••"]].map(([l,v],i)=>(
        <div key={i} style={{background:T.surface,borderRadius:12,padding:"14px 16px",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center",border:`1px solid ${T.borderSub}`}}>
          <div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.08em",textTransform:"uppercase",color:T.muted,marginBottom:2}}>{l}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.text}}>{v}</div></div>
          <span style={{color:T.muted}}>›</span>
        </div>
      ))}
      <button style={{width:"100%",background:"rgba(192,48,48,0.1)",border:"1px solid rgba(192,48,48,0.3)",borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,color:"#C03030",cursor:"pointer",marginTop:8}}>Sign Out</button>
    </Screen>
  );

  if (sec==="share") return (
    <Screen title="Share First Date" onBack={()=>setSec("main")} T={T}>
      <div style={{textAlign:"center",padding:"16px 0 28px"}}><div style={{fontSize:52,marginBottom:12}}>📤</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:T.text,marginBottom:8}}>Share the love</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,lineHeight:1.6}}>Know someone who deserves an unforgettable date night?</div></div>
      {[["💬","Send via Messages"],["✉️","Share via Email"],["📱","Share via Instagram"],["🐦","Post on X"]].map(([icon,label],i)=>(
        <button key={i} style={{width:"100%",background:T.surface,border:`1px solid ${T.borderSub}`,borderRadius:14,padding:"16px",display:"flex",alignItems:"center",gap:14,cursor:"pointer",marginBottom:10,fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,color:T.text}}>
          <span style={{fontSize:22}}>{icon}</span>{label}<span style={{marginLeft:"auto",color:T.muted}}>›</span>
        </button>
      ))}
      <button onClick={()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}} style={{width:"100%",background:copied?`${T.red}15`:T.grad,color:copied?T.red:"#fff",border:copied?`1.5px solid ${T.red}`:"none",borderRadius:14,padding:"15px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:4}}>
        {copied?"✓ Link Copied!":"Copy App Link"}
      </button>
    </Screen>
  );

  if (sec==="about") return (
    <Screen title="About First Date" onBack={()=>setSec("main")} T={T}>
      <div style={{background:T.grad,borderRadius:20,padding:"32px 24px",textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:48,marginBottom:12}}>❤️</div>
        <Logo T={{...T,isDark:true}} size={28}/>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.6)",marginTop:6}}>Version 1.0</div>
      </div>
      {[
        {t:"Our Mission",b:"First Date was built for everyone — from the nervous first-dater who doesn't know where to start, to the married couple who wants to rediscover why they fell in love. We believe great dates don't happen by accident. They happen when someone cares enough to plan one."},
        {t:"What We Do",b:"We're your personal date night wingman. We find the best restaurants, bars, and experiences near you, help you build a full itinerary, and give you conversation starters so the night flows naturally."},
        {t:"Our Promise",b:"First Date is built independently. We don't sell your data, we don't show ads, and we're always working to make your experience better."},
      ].map((s,i)=>(
        <div key={i} style={{background:T.surface,borderRadius:16,padding:"18px",marginBottom:12,border:`1px solid ${T.borderSub}`}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:T.text,marginBottom:8}}>{s.t}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,lineHeight:1.65}}>{s.b}</div>
        </div>
      ))}
    </Screen>
  );

  if (sec==="feedback") return (
    <Screen title="Contact / Feedback" onBack={()=>setSec("main")} T={T}>
      {fbSent ? (
        <div style={{textAlign:"center",padding:"60px 0"}}><div style={{fontSize:52,marginBottom:16}}>🙏</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:T.text,marginBottom:8}}>Thank you!</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted}}>We read every message and will get back to you soon.</div></div>
      ) : (
        <>
          <div style={{display:"flex",gap:8,marginBottom:20}}>
            {[["feedback","💡 Feedback"],["bug","🐛 Bug"],["other","💬 Other"]].map(([id,label])=>(
              <button key={id} onClick={()=>setFbType(id)} style={{flex:1,background:fbType===id?T.grad:T.faint,color:fbType===id?"#fff":T.muted,border:`1px solid ${fbType===id?"transparent":T.border}`,borderRadius:10,padding:"9px 0",fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label}</button>
            ))}
          </div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:8}}>Your message</div>
          <textarea value={fbMsg} onChange={e=>setFbMsg(e.target.value)} placeholder="Tell us what's on your mind…" rows={6}
            style={{width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.text,outline:"none",resize:"none",marginBottom:16}}/>
          <button onClick={()=>fbMsg.trim()&&setFbSent(true)} style={{width:"100%",background:fbMsg.trim()?T.grad:"transparent",color:fbMsg.trim()?"#fff":T.muted,border:fbMsg.trim()?"none":`1px solid ${T.border}`,borderRadius:14,padding:"15px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:fbMsg.trim()?"pointer":"not-allowed"}}>Send Message</button>
        </>
      )}
    </Screen>
  );

  if (sec==="privacy") return (
    <Screen title="Privacy Policy" onBack={()=>setSec("main")} T={T}>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.muted,marginBottom:20}}>Last updated: April 2026</div>
      {[
        ["1. Information We Collect","We collect information you provide when creating an account (name, email, relationship stage preferences), usage data about how you interact with the app, and location data solely to show you nearby venues. We never collect sensitive personal information."],
        ["2. How We Use Your Information","Your information is used to personalize your experience, show relevant date spots near your location, remember your saved spots and date plans, and send optional notifications if you opt in. We do not use your data for advertising."],
        ["3. Location Data","First Date requests your location to find nearby restaurants, events, and experiences. Location data is used in real time and is never stored on our servers. You can revoke location access at any time in your device settings."],
        ["4. Data Storage & Security","Your account data is stored securely using industry-standard encryption. We do not sell your personal data to any third party under any circumstances."],
        ["5. Third-Party Services","We use Google Places API for venue discovery. See their privacy policy for details."],
        ["6. Your Rights","You may access, correct, or delete your personal data at any time via Settings → Account. We process all deletion requests within 30 days."],
        ["7. Children's Privacy","First Date is for users 17 and older. We do not knowingly collect information from minors."],
        ["8. Contact","Questions about this policy? Email privacy@firstdateapp.com — we respond within 5 business days."],
      ].map(([title,body],i,arr)=>(
        <div key={i} style={{marginBottom:20}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,color:T.text,marginBottom:6}}>{title}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,lineHeight:1.7}}>{body}</div>
          {i<arr.length-1&&<div style={{height:1,background:T.borderSub,marginTop:20}}/>}
        </div>
      ))}
    </Screen>
  );

  // Main settings hub
  return (
    <Screen title="Settings" onBack={onBack} T={T}>
      <Row icon="⚙️" label="Preferences"           sub="Location, radius, notifications & display" go={()=>setSec("preferences")}/>
      <Row icon="👤" label="Account"                sub="Name, email & password"                    go={()=>setSec("account")}/>
      <Row icon="📤" label="Share the App"          sub="Tell your friends about First Date"         go={()=>setSec("share")}/>
      <Row icon="❤️" label="About First Date"      sub="Our story and mission"                      go={()=>setSec("about")}/>
      <Row icon="💬" label="Contact / Feedback"    sub="We'd love to hear from you"                 go={()=>setSec("feedback")}/>
      <Row icon="🔒" label="Privacy Policy"        sub="How we handle your data"                    go={()=>setSec("privacy")}/>
    </Screen>
  );
}

/* ── DETAIL SHEET ────────────────────────────────────────── */
function DetailSheet({spot,onClose,inPlan,onAdd,onRemove,saved,onSave,T,extra}) {
  const [photoIdx, setPhotoIdx] = React.useState(0);
  React.useEffect(()=>{ if(spot) setPhotoIdx(0); }, [spot?.id]);
  if (!spot) return null;
  const g = T.isDark ? spot.dg : spot.lg;
  return (
    <div style={{position:"fixed",inset:0,zIndex:700,background:"rgba(0,0,0,0.55)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:T.surface,borderRadius:"24px 24px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",animation:"sheetUp 0.28s ease"}}>
        {/* Photo Gallery */}
        <div style={{height:240,background:g,borderRadius:"24px 24px 0 0",position:"relative",overflow:"hidden"}}>
          {spot.photos && spot.photos.length>0 ? (
            <>
              <img key={photoIdx} src={spot.photos[photoIdx]} alt={spot.name}
                style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}}
                onError={e=>{e.target.style.display='none'}} />
              {/* Photo dots */}
              {spot.photos.length>1&&(
                <div style={{position:"absolute",bottom:54,left:"50%",transform:"translateX(-50%)",display:"flex",gap:5,zIndex:4}}>
                  {spot.photos.map((_,i)=>(
                    <div key={i} onClick={()=>setPhotoIdx(i)}
                      style={{width:i===photoIdx?18:6,height:6,borderRadius:3,background:i===photoIdx?"#fff":"rgba(255,255,255,0.45)",cursor:"pointer",transition:"all 0.2s"}}/>
                  ))}
                </div>
              )}
              {/* Prev/Next arrows */}
              {photoIdx>0&&(
                <button onClick={e=>{e.stopPropagation();setPhotoIdx(i=>i-1);}}
                  style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.45)",border:"none",borderRadius:"50%",width:32,height:32,color:"#fff",fontSize:14,cursor:"pointer",zIndex:4,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
              )}
              {photoIdx<spot.photos.length-1&&(
                <button onClick={e=>{e.stopPropagation();setPhotoIdx(i=>i+1);}}
                  style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(0,0,0,0.45)",border:"none",borderRadius:"50%",width:32,height:32,color:"#fff",fontSize:14,cursor:"pointer",zIndex:4,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
              )}
            </>
          ) : (
            <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:76}}>{spot.emoji}</div>
          )}
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.8),transparent 50%)",zIndex:2,pointerEvents:"none"}}/>
          <button onClick={onClose} style={{position:"absolute",top:14,left:14,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:34,height:34,color:"#fff",fontSize:16,cursor:"pointer",backdropFilter:"blur(4px)",zIndex:3}}>←</button>
          <button onClick={onSave} style={{position:"absolute",top:14,right:14,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:34,height:34,fontSize:18,cursor:"pointer",backdropFilter:"blur(4px)",zIndex:3}}>{saved?"❤️":"🤍"}</button>
          <div style={{position:"absolute",bottom:14,left:18,zIndex:3}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.65)",marginBottom:2}}>{spot.tag}</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#fff"}}>{spot.name}</div>
          </div>
        </div>
        <div style={{padding:"20px 22px 36px"}}>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:14}}>
            <Star r={spot.rating} T={T}/><NoiseBadge noise={spot.noise}/><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,color:T.red}}>{spot.price}</span>
          </div>
          {spot.cat==="restaurants"&&spot.hours&&(
            <div style={{display:"flex",gap:10,alignItems:"center",background:T.faint,borderRadius:12,padding:"10px 14px",marginBottom:12}}>
              <span>🕐</span><div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.muted,marginBottom:1}}>Hours Today</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,color:T.text}}>{spot.hours[0]} – {spot.hours[1]}</div></div>
            </div>
          )}
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:T.textMid,lineHeight:1.65,marginBottom:18}}>{spot.desc}</p>
          <button onClick={()=>{inPlan?onRemove():onAdd();onClose();}} style={{width:"100%",background:inPlan?"transparent":T.grad,color:inPlan?T.red:"#fff",border:inPlan?`1.5px solid ${T.red}`:"none",borderRadius:14,padding:"15px",fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:800,cursor:"pointer"}}>
            {inPlan?"✓ Remove from Date Plan":"+ Add to Date Plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── SPOT CARD ───────────────────────────────────────────── */
function SpotCard({spot,inPlan,onAdd,onRemove,saved,onSave,onClick,T}) {
  const g = T.isDark ? spot.dg : spot.lg;
  return (
    <div onClick={onClick} style={{background:g,borderRadius:18,overflow:"hidden",border:`1px solid ${T.borderSub}`,cursor:"pointer",transition:"all 0.18s"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=T.border;}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.borderColor=T.borderSub;}}>
      <div style={{height:110,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:48}}>
        {spot.photoUrl
          ? <img src={spot.photoUrl} alt={spot.name} style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}} onError={e=>{e.target.style.display='none'}} />
          : spot.emoji}
        <button onClick={e=>{e.stopPropagation();onSave();}} style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.3)",border:"none",borderRadius:"50%",width:28,height:28,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}}>
          {saved?"❤️":"🤍"}
        </button>
        {inPlan&&<div style={{position:"absolute",bottom:6,left:8,background:T.red,borderRadius:8,padding:"2px 7px",fontSize:8,fontWeight:800,color:"#fff"}}>IN PLAN</div>}
      </div>
      <div style={{padding:"8px 12px 14px"}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.muted,marginBottom:2}}>{spot.tag}</div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:15,fontWeight:700,color:T.text,marginBottom:4,lineHeight:1.2}}>{spot.name}</div>
        <div style={{marginBottom:5}}><NoiseBadge noise={spot.noise}/></div>
        {spot.cat==="restaurants"&&spot.hours&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:T.red,fontWeight:700,marginBottom:4}}>🕐 {spot.hours[0]} – {spot.hours[1]}</div>}
        
        <div style={{display:"flex",gap:5,alignItems:"center",marginBottom:8}}><Star r={spot.rating} T={T}/><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,color:T.red}}>{spot.price}</span></div>
        <button onClick={e=>{e.stopPropagation();inPlan?onRemove():onAdd();}} style={{width:"100%",background:inPlan?"transparent":T.grad,color:inPlan?T.red:"#fff",border:inPlan?`1.5px solid ${T.red}`:"none",borderRadius:10,padding:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer"}}>
          {inPlan?"✓ Added":"+ Add to Plan"}
        </button>
      </div>
    </div>
  );
}

/* ── MAIN APP ────────────────────────────────────────────── */

/* ── CITY SEARCH — fully uncontrolled input, immune to re-renders ── */
function CitySearch({ initialCity, onCommit, compact }) {
  const inputRef   = typeof document !== "undefined" ? (() => { const r = {current:null}; return r; })() : {current:null};
  const [sugg, setSugg]       = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [locLoading, setLocLoading] = useState(false);
  const timer = typeof window !== "undefined" ? (window.__csTimer || (window.__csTimer = {t:null})) : {t:null};

  // Set input value once on mount / when initialCity changes from outside
  const lastCity = typeof window !== "undefined" ? (window.__csCity || (window.__csCity = {v:""})) : {v:""};
  useEffect(() => {
    if (initialCity && initialCity !== lastCity.v) {
      lastCity.v = initialCity;
      if (inputRef.current) inputRef.current.value = initialCity;
    }
  }, [initialCity]);

  const fetchSuggestions = (text) => {
    clearTimeout(timer.t);
    if (!text || text.trim().length < 2) { setSugg([]); setShowSugg(false); return; }
    timer.t = setTimeout(async () => {
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=(cities)&key=${PLACES_KEY}`;
        const res  = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const json = JSON.parse((await res.json()).contents);
        const list = (json.predictions || []).slice(0,5).map(p => p.description);
        setSugg(list);
        setShowSugg(list.length > 0);
      } catch { setSugg([]); }
    }, 150);
  };

  const commit = (city) => {
    if (inputRef.current) inputRef.current.value = city;
    lastCity.v = city;
    setSugg([]); setShowSugg(false);
    onCommit(city);
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) return;
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(async pos => {
      try {
        const url  = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.coords.latitude},${pos.coords.longitude}&key=${PLACES_KEY}`;
        const res  = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
        const json = JSON.parse((await res.json()).contents);
        const loc  = json.results?.[0]?.address_components;
        const city = loc?.find(a => a.types.includes("locality"))?.long_name;
        const st   = loc?.find(a => a.types.includes("administrative_area_level_1"))?.short_name;
        if (city) commit(`${city}${st ? ", " + st : ""}`);
      } catch {}
      setLocLoading(false);
    }, () => setLocLoading(false), { timeout: 8000 });
  };

  return (
    <div style={{ position:"relative", marginBottom:12 }}>
      <div style={{ display:"flex", gap:8 }}>
        <div style={{ position:"relative", flex:1 }}>
          <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:13, pointerEvents:"none", zIndex:1 }}>📍</span>
          <input
            ref={inputRef}
            defaultValue={initialCity || ""}
            onChange={e => fetchSuggestions(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && inputRef.current?.value.trim()) commit(inputRef.current.value.trim()); }}
            onBlur={() => setTimeout(() => setShowSugg(false), 200)}
            onFocus={() => sugg.length > 0 && setShowSugg(true)}
            placeholder="Search city, e.g. Atlanta, GA"
            style={{ width:"100%", background:"rgba(255,255,255,0.07)", border:"1.5px solid rgba(128,14,19,0.35)", borderRadius:22, padding:"11px 12px 11px 34px", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#F5ECD8", outline:"none", colorScheme:"dark" }}
          />
        </div>
        <button onClick={handleNearMe} disabled={locLoading} title="Use my location"
          style={{ background:"linear-gradient(135deg,#A01018,#600A0E)", color:"#fff", border:"none", borderRadius:"50%", width:42, height:42, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, fontSize: locLoading ? 11 : 18, fontFamily:"'DM Sans',sans-serif", fontWeight:800 }}>
          {locLoading ? "..." : "📍"}
        </button>
      </div>
      {showSugg && sugg.length > 0 && (
        <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:52, background:"#2a1020", border:"1px solid rgba(128,14,19,0.4)", borderRadius:14, zIndex:400, overflow:"hidden", boxShadow:"0 8px 28px rgba(0,0,0,0.35)" }}>
          {sugg.map((s,i) => (
            <div key={i} onMouseDown={() => commit(s)}
              style={{ padding:"12px 16px", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:"#F5ECD8", cursor:"pointer", borderBottom: i < sugg.length-1 ? "1px solid rgba(245,236,216,0.08)" : "none", display:"flex", alignItems:"center", gap:10 }}
              onMouseEnter={e => e.currentTarget.style.background="rgba(245,236,216,0.07)"}
              onMouseLeave={e => e.currentTarget.style.background="transparent"}>
              <span style={{ fontSize:12 }}>📍</span><span>{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthSheet({show, onClose, T, authScreen, setAuthScreen, authForm, setAuthForm, authErr, setAuthErr, handleSignup, handleLogin, authStep, authAnswers, toggleAuthAns, authCanNext, authNext, authStepIdx, ONBOARDING_STEPS}) {
  if (!show) return null;
  // Use refs for inputs so typing never causes re-mount
  const nameRef = typeof document!=="undefined"?{current:null}:{current:null};
  const emailRef = typeof document!=="undefined"?{current:null}:{current:null};
  const passRef = typeof document!=="undefined"?{current:null}:{current:null};
  const fieldRefs = {name:nameRef, email:emailRef, password:passRef};
  const inp = (field,label,type,ph) => (
    <div style={{marginBottom:12}}>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.muted,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:5}}>{label}</div>
      <input ref={fieldRefs[field]} type={type} placeholder={ph} defaultValue={authForm[field]||""}
        onChange={e=>setAuthForm(x=>({...x,[field]:e.target.value}))}
        style={{width:"100%",background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"12px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,color:T.text,outline:"none"}}/>
    </div>
  );
  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:800,background:"rgba(0,0,0,0.45)",backdropFilter:"blur(4px)"}}/>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",zIndex:900,width:"100%",maxWidth:480,background:T.surface,borderRadius:"24px 24px 0 0",animation:"sheetUp 0.32s cubic-bezier(0.32,0.72,0,1)",maxHeight:"76vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.35)"}}>
        <div style={{padding:"12px 20px 0",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
          <div style={{width:36,height:4,borderRadius:2,background:T.borderSub}}/>
          <button onClick={onClose} style={{position:"absolute",right:16,top:8,background:T.faint,border:`1px solid ${T.borderSub}`,borderRadius:"50%",width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:13,color:T.muted,fontWeight:700}}>✕</button>
        </div>
        <div style={{padding:"10px 22px 36px"}}>
          {authScreen==="signup" && (
            <>
              <div style={{textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:6}}>❤️</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:800,fontStyle:"italic",color:T.isDark?"#fff":"#000"}}>First Date</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginTop:4}}>Your wingman for every date night.</div>
              </div>
              {authErr&&<div style={{background:"rgba(192,48,48,0.12)",border:"1px solid rgba(192,48,48,0.3)",borderRadius:10,padding:"9px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#C03030",marginBottom:12}}>{authErr}</div>}
              {inp("name","First name","text","Alex")}
              {inp("email","Email","email","you@email.com")}
              {inp("password","Password","password","6+ characters")}
              <button onClick={handleSignup} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:6,boxShadow:"0 4px 16px rgba(128,14,19,0.28)"}}>Create Account →</button>
              <div style={{textAlign:"center",marginTop:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted}}>
                Already have an account?{" "}<span onClick={()=>{setAuthScreen("login");setAuthErr("");}} style={{color:T.red,fontWeight:700,cursor:"pointer"}}>Sign In</span>
              </div>
            </>
          )}
          {authScreen==="login" && (
            <>
              <div style={{textAlign:"center",marginBottom:16}}>
                <div style={{fontSize:28,marginBottom:6}}>👋</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:T.text,marginBottom:2}}>Welcome back</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted}}>Sign in to your account.</div>
              </div>
              {authErr&&<div style={{background:"rgba(192,48,48,0.12)",border:"1px solid rgba(192,48,48,0.3)",borderRadius:10,padding:"9px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#C03030",marginBottom:12}}>{authErr}</div>}
              {inp("email","Email","email","you@email.com")}
              {inp("password","Password","password","Your password")}
              <button onClick={handleLogin} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",marginTop:6}}>Sign In →</button>
              <div style={{textAlign:"center",marginTop:12,fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted}}>
                No account?{" "}<span onClick={()=>{setAuthScreen("signup");setAuthErr("");}} style={{color:T.red,fontWeight:700,cursor:"pointer"}}>Create one</span>
              </div>
            </>
          )}
          {authScreen==="steps" && authStep && (
            <>
              <div style={{display:"flex",gap:5,marginBottom:16}}>
                {ONBOARDING_STEPS.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<=authStepIdx?T.red:T.faint,transition:"background 0.3s"}}/>)}
              </div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:T.text,lineHeight:1.2,marginBottom:4}}>{authStep.title}</div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.muted,marginBottom:14}}>{authStep.subtitle}{authStep.type==="multi"&&" Select all that apply."}</p>
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {authStep.options.map(opt=>{
                  const sel=authStep.type==="multi"?(authAnswers[authStep.id]||[]).includes(opt.id):authAnswers[authStep.id]===opt.id;
                  return(
                    <button key={opt.id} onClick={()=>toggleAuthAns(authStep.id,opt.id,authStep.type==="multi")}
                      style={{background:sel?`${opt.color||T.red}18`:T.faint,border:`1.5px solid ${sel?opt.color||T.red:T.border}`,borderRadius:12,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left",transition:"all 0.18s"}}>
                      <span style={{fontSize:18}}>{opt.emoji}</span>
                      <div style={{flex:1}}><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,color:T.text}}>{opt.label}</div>{opt.sub&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted,marginTop:1}}>{opt.sub}</div>}</div>
                      {sel&&<span style={{color:opt.color||T.red,fontWeight:800}}>✓</span>}
                    </button>
                  );
                })}
              </div>
              <button onClick={authNext} disabled={!authCanNext} style={{width:"100%",background:authCanNext?T.grad:"transparent",color:authCanNext?"#fff":T.muted,border:authCanNext?"none":`1px solid ${T.border}`,borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:authCanNext?"pointer":"not-allowed"}}>
                {authStepIdx<ONBOARDING_STEPS.length-1?"Continue →":"Let's go! →"}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/* ── IN-APP WEB VIEW ─────────────────────────────────────── */
function InAppBrowser({url, title, onClose, T}) {
  if (!url) return null;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:T.bg,display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.borderSub}`,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onClose} style={{background:T.faint,border:`1px solid ${T.border}`,borderRadius:10,padding:"7px 14px",fontSize:12,fontWeight:700,color:T.muted,cursor:"pointer",flexShrink:0}}>✕ Close</button>
        <div style={{flex:1,overflow:"hidden"}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{url}</div>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{background:T.grad,color:"#fff",borderRadius:10,padding:"7px 12px",fontSize:11,fontWeight:700,textDecoration:"none",flexShrink:0}}>Open ↗</a>
      </div>
      {/* iFrame */}
      <iframe
        src={url}
        title={title}
        style={{flex:1,border:"none",width:"100%"}}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-navigation"
      />
    </div>
  );
}

/* ── LOCATION PROMPT — outside App, stable across re-renders ── */
function LocationPrompt({show, onClose, onAllow, onTypeCity, T}) {
  const [showManual, setShowManual] = useState(false);
  const [locSugg, setLocSugg] = useState([]);
  const [showLocSugg, setShowLocSugg] = useState(false);
  const locTimer = typeof window!=="undefined" ? (window.__lpTimer||(window.__lpTimer={t:null})) : {t:null};

  const fetchLocSugg = async (text) => {
    clearTimeout(locTimer.t);
    if (!text || text.length < 2) { setLocSugg([]); setShowLocSugg(false); return; }
    locTimer.t = setTimeout(async () => {
      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&types=(cities)&key=${PLACES_KEY}`;
      const proxies = [
        { url:`https://corsproxy.io/?${encodeURIComponent(url)}`, parse:r=>r },
        { url:`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, parse:r=>JSON.parse(r.contents) },
      ];
      for (const proxy of proxies) {
        try {
          const res = await fetch(proxy.url, {signal:AbortSignal.timeout(5000)});
          const raw = await res.json();
          const json = proxy.parse(raw);
          if (json?.predictions?.length > 0) {
            setLocSugg(json.predictions.slice(0,5).map(p=>p.description));
            setShowLocSugg(true);
            return;
          }
        } catch { continue; }
      }
    }, 150);
  };

  if (!show) return null;
  return (
    <>
      <div style={{position:"fixed",inset:0,zIndex:850,background:"rgba(0,0,0,0.5)",backdropFilter:"blur(4px)"}}/>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",zIndex:860,width:"100%",maxWidth:480,background:T.surface,borderRadius:"24px 24px 0 0",padding:"20px 24px 40px",animation:"sheetUp 0.3s ease",boxShadow:"0 -8px 40px rgba(0,0,0,0.3)"}}>
        <div style={{width:36,height:4,borderRadius:2,background:T.borderSub,margin:"0 auto 20px"}}/>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:40,marginBottom:10}}>📍</div>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700,color:T.text,marginBottom:6}}>Find spots near you</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,lineHeight:1.6,maxWidth:300,margin:"0 auto"}}>
            Allow location access for the best nearby restaurant, bar, and experience recommendations.
          </div>
        </div>
        {!showManual ? (
          <>
            <button onClick={onAllow} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"15px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,cursor:"pointer",marginBottom:10,boxShadow:"0 4px 16px rgba(128,14,19,0.28)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <span>📍</span> Find Spots Near Me
            </button>
            <button onClick={()=>setShowManual(true)} style={{width:"100%",background:"transparent",border:`1.5px solid ${T.border}`,borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:T.muted,cursor:"pointer",marginBottom:10}}>
              Type My City Instead
            </button>
            <button onClick={onClose} style={{width:"100%",background:"transparent",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,cursor:"pointer"}}>
              Skip for now
            </button>
          </>
        ) : (
          <>
            <div style={{position:"relative",marginBottom:12}}>
              <div style={{display:"flex",gap:8}}>
                <input
                  autoFocus
                  id="fd-manual-city"
                  defaultValue=""
                  placeholder="e.g. Dallas, TX"
                  onChange={e=>fetchLocSugg(e.target.value)}
                  onBlur={()=>setTimeout(()=>setShowLocSugg(false),200)}
                  onKeyDown={e=>{ if(e.key==="Enter"){ const v=e.target.value.trim(); if(v){onTypeCity(v);setShowManual(false);setShowLocSugg(false);} }}}
                  style={{flex:1,background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:12,padding:"13px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:16,color:T.text,outline:"none"}}/>
                <button
                  onClick={()=>{ const v=document.getElementById("fd-manual-city")?.value?.trim(); if(v){onTypeCity(v);setShowManual(false);} }}
                  style={{background:T.grad,color:"#fff",border:"none",borderRadius:12,padding:"13px 18px",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,cursor:"pointer",flexShrink:0}}>Go</button>
              </div>
              {showLocSugg && locSugg.length>0 && (
                <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:60,background:T.card,border:`1px solid ${T.border}`,borderRadius:12,zIndex:900,overflow:"hidden",boxShadow:"0 8px 28px rgba(0,0,0,0.4)"}}>
                  {locSugg.map((s,i)=>(
                    <div key={i} onMouseDown={()=>{document.getElementById("fd-manual-city").value=s;onTypeCity(s);setShowManual(false);setShowLocSugg(false);}}
                      style={{padding:"12px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.text,cursor:"pointer",borderBottom:i<locSugg.length-1?`1px solid ${T.borderSub}`:"none",display:"flex",alignItems:"center",gap:10}}
                      onMouseEnter={e=>e.currentTarget.style.background="rgba(245,236,216,0.07)"}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <span style={{fontSize:12}}>📍</span>{s}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={()=>setShowManual(false)} style={{width:"100%",background:"transparent",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,cursor:"pointer",marginTop:4}}>← Back</button>
          </>
        )}
      </div>
    </>
  );
}

/* ── CATEGORY CARD ───────────────────────────────────────── */
const CAT_PHOTOS = {
  restaurants: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80",
  nightlife:   "https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=400&q=80",
  experiences: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80",
  questions:   "https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=400&q=80",
};
function CatCard({ cat, T, onPress }) {
  const photo = CAT_PHOTOS[cat.id];
  return (
    <div className="cat-card" onClick={onPress}
      style={{position:"relative",minHeight:110,overflow:"hidden",background:T.isDark?cat.dg:cat.lg}}>
      {photo && (
        <img src={photo} alt={cat.label}
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:0.6}}
          onError={e=>{e.target.style.display='none'}} />
      )}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(0,0,0,0.75),rgba(0,0,0,0.1))"}}/>
      <div style={{position:"relative",zIndex:1,padding:"12px 14px",display:"flex",flexDirection:"column",justifyContent:"flex-end",minHeight:110}}>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:18,fontWeight:700,color:"#fff",lineHeight:1.1,marginBottom:3}}>{cat.label}</div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.75)",lineHeight:1.4}}>{cat.desc}</div>
      </div>
    </div>
  );
}

export default function App() {
  const isDark = useTheme();
  const T = makeTheme(isDark);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("home");
  const [showSettings, setShowSettings] = useState(false);
  const [browseCat, setBrowseCat] = useState("all");
  const [plan, setPlan] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [detail, setDetail] = useState(null);
  const [search, setSearch] = useState("");
  const [qStage, setQStage] = useState("first");
  const [qIdx, setQIdx] = useState(0);
  const [qFlipped, setQFlipped] = useState(false);
  const [surpriseOn, setSurpriseOn] = useState(false);
  const [sStep, setSStep] = useState(0);
  const [sAnswers, setSAnswers] = useState({});
  const [sPicks, setSPicks] = useState([]);
  const [revealed, setRevealed] = useState(0);
  const [sStage, setSStage] = useState(null);
  const [stage, setStage] = useState(null);

  // Location + Places state
  const [locationAsked, setLocationAsked]   = useState(false);
  const [showLocPrompt, setShowLocPrompt]   = useState(false);
  const [city, setCity]                     = useState("");
  const [cityInput, setCityInput]           = useState("");

  const [placesCache, setPlacesCache] = useState({}); // { "city|cat": [spots] }
  const [placesLoading, setPlacesLoading] = useState(false);
  const [realSpots, setRealSpots] = useState([]);
  const [enrichedDetails, setEnrichedDetails] = useState({}); // placeId -> extra details
  const [webView, setWebView] = useState(null); // {url, title}
  const openWeb = (url, title) => setWebView({url, title});
  const closeWeb = () => setWebView(null);

  const loadPlaces = async (cityVal, catVal) => {
    if (!cityVal) return;
    const effectiveCat = catVal === "all" ? "restaurants" : catVal;
    const key = `${cityVal}|${effectiveCat}`;
    if (placesCache[key]) { setRealSpots(placesCache[key]); return; }
    setPlacesLoading(true);
    const raw = await fetchPlacesByCity(cityVal, effectiveCat);
    const transformed = raw.map(p => transformGPlace(p, effectiveCat));
    setPlacesCache(prev => ({...prev, [key]: transformed}));
    setRealSpots(transformed);
    setPlacesLoading(false);
    // Fetch Place Details in background for first 6 spots — gets descriptions + extra photos
    transformed.slice(0, 6).forEach(spot => {
      if (!spot.id) return;
      fetchPlaceDetails(spot.id).then(d => {
        if (!d) return;
        const desc = d.editorial_summary?.overview || "";
        const photos = d.photos
          ? d.photos.slice(0,8).map(ph=>`https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${ph.photo_reference}&key=${PLACES_KEY}`)
          : null;
        const hoursText = d.opening_hours?.weekday_text || null;
        const isOpen = d.opening_hours?.open_now;
        const enriched = {desc, photos, hoursText, isOpen};
        setEnrichedDetails(prev => ({...prev, [spot.id]: d}));
        if (desc || photos) {
          const merge = s => s.id === spot.id ? {...s, ...(desc&&{desc}), ...(photos&&{photos}), ...(hoursText&&{hoursText}), ...(isOpen!==undefined&&{isOpen})} : s;
          setPlacesCache(prev => ({...prev, [key]: (prev[key]||[]).map(merge)}));
          setRealSpots(prev => prev.map(merge));
        }
      }).catch(()=>{});
    });
  };

  // Preload all categories in background after city is set
  const preloadAllCats = async (cityVal) => {
    const cats = ["restaurants","nightlife","experiences","dessert"];
    for (const cat of cats) {
      const key = `${cityVal}|${cat}`;
      if (!placesCache[key]) {
        const raw = await fetchPlacesByCity(cityVal, cat);
        const transformed = raw.map(p => transformGPlace(p, cat));
        setPlacesCache(prev => ({...prev, [key]: transformed}));
      }
    }
  };

  // Load on mount and when city/cat changes
  useEffect(() => { if(tab === "browse" || tab === "home") loadPlaces(city, browseCat); }, [city]);

  const inPlan  = id => plan.some(p => p.id === id);
  const isSaved = id => savedIds.includes(id);
  const addStop = v  => { if (!inPlan(v.id)) setPlan(p=>[...p,{...v,time:""}]); };
  const remStop = id => setPlan(p=>p.filter(x=>x.id!==id));
  const togSave = id => setSavedIds(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const setTime = (id,t) => setPlan(p=>p.map(x=>x.id===id?{...x,time:t}:x));

  // Merge real Places results with mock fallback
  const activeSpotsSource = realSpots.length > 0 ? realSpots : SPOTS;
  const browseSpots = activeSpotsSource.filter(v=>
    (browseCat==="all"||v.cat===browseCat)&&
    (!stage||v.stages?.includes(stage))&&
    (!search||v.name.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 20);

  const SURPRISE_QS = [
    {id:"timeofday",q:"When is your date happening?",opts:["Morning (before noon)","Afternoon (12–5pm)","Evening (5–9pm)","Late Night (9pm+)"]},
    {id:"budget",q:"What's your budget per person?",opts:["Under $30","$30–$60","$60–$100","No limit"]},
    {id:"energy",q:"What's the mood you're going for?",opts:["Cozy & low-key","Fun & playful","Romantic & intentional","Wild & spontaneous"]},
    {id:"noise",q:"How loud do you want it?",opts:["Quiet — we want to talk","Some ambiance","Lively is great","Louder the better"]},
  ];
  const timeLabels = {"Morning (before noon)":"your morning date ☀️","Afternoon (12–5pm)":"your afternoon date 🌤️","Evening (5–9pm)":"your evening ✨","Late Night (9pm+)":"your late night 🌙"};

  const answerSurprise = (qId,val) => {
    const next={...sAnswers,[qId]:val}; setSAnswers(next);
    if (sStep<SURPRISE_QS.length-1){setSStep(s=>s+1);return;}
    // Always use real Places data if available, fall back to mock
    const allSpots=[...(realSpots.length>0?realSpots:[...Object.values(placesCache).flat()].length>0?[...Object.values(placesCache).flat()]:SPOTS)];
    let pool=[...allSpots];
    if(sStage) pool=pool.filter(v=>!v.stages||v.stages.includes(sStage));
    // Time of day filtering + 1-hour buffer check
    const tod=next.timeofday||"";
    // Helper: parse "4:30 PM" → minutes since midnight
    const parseTime = (str) => {
      if(!str) return null;
      const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if(!m) return null;
      let h=parseInt(m[1]); const min=parseInt(m[2]); const ampm=m[3].toUpperCase();
      if(ampm==="PM"&&h!==12) h+=12;
      if(ampm==="AM"&&h===12) h=0;
      return h*60+min;
    };
    // Time window start in minutes
    const todStart = tod==="Morning (before noon)"?0:tod==="Afternoon (12–5pm)"?720:tod==="Evening (5–9pm)"?1020:1260;
    // Filter spots that would be open with at least 1 hour to enjoy
    pool=pool.filter(v=>{
      if(!v.hours||!Array.isArray(v.hours)) return true; // no hours data, keep it
      const closeMin = parseTime(v.hours[1]);
      if(!closeMin) return true;
      return closeMin >= todStart + 60; // must have at least 1hr before close
    });
    if(tod==="Morning (before noon)") pool=pool.filter(v=>v.cat!=="nightlife"&&v.noise!=="loud");
    else if(tod==="Afternoon (12–5pm)") pool=pool.filter(v=>v.cat!=="nightlife");
    else if(tod==="Late Night (9pm+)") pool=pool.filter(v=>["nightlife","dessert","restaurants"].includes(v.cat));
    // Budget
    if(next.budget==="Under $30") pool=pool.filter(v=>v.price==="$");
    else if(next.budget==="$30–$60") pool=pool.filter(v=>["$","$$"].includes(v.price));
    else if(next.budget==="$60–$100") pool=pool.filter(v=>["$","$$","$$$"].includes(v.price));
    // Noise
    if(next.noise==="Quiet — we want to talk") pool=pool.filter(v=>v.noise==="quiet");
    else if(next.noise==="Louder the better") pool=pool.filter(v=>v.noise==="loud");
    if(["Cozy & low-key","Romantic & intentional"].includes(next.energy)) pool=pool.filter(v=>v.noise!=="loud");
    const picks=pool.sort(()=>Math.random()-0.5).slice(0,3);
    setSPicks(picks.length?picks:allSpots.sort(()=>Math.random()-0.5).slice(0,3));
    setRevealed(0);setSStep(99);
    [0,1,2].forEach(i=>setTimeout(()=>setRevealed(r=>r+1),500+i*750));
  };
  const resetSurprise=()=>{setSurpriseOn(false);setSStep(0);setSAnswers({});setSPicks([]);setRevealed(0);setSStage(null);};
  const currentQs = QUESTIONS[qStage]||QUESTIONS.first;

  // Auth popup — show 1.5s after launch if not signed in
  const [showAuthSheet, setShowAuthSheet] = useState(false);
  const [authScreen, setAuthScreen] = useState("signup"); // signup | login | steps
  const [authForm, setAuthForm] = useState({name:"",email:"",password:""});
  const [authAnswers, setAuthAnswers] = useState({});
  const [authStepIdx, setAuthStepIdx] = useState(0);
  const [authErr, setAuthErr] = useState("");

  const authShownRef = typeof window !== 'undefined' ? (window.__fdAuthShown = window.__fdAuthShown || {val:false}) : {val:false};
  useEffect(() => {
    if (!user && !authShownRef.val) {
      const t = setTimeout(()=>{ authShownRef.val=true; setShowAuthSheet(true); }, 1500);
      return ()=>clearTimeout(t);
    }
  }, []);

  const closeAuth = () => setShowAuthSheet(false);

  // Show location prompt shortly after auth sheet (or on first load if already user)
  useEffect(() => {
    if (!locationAsked) {
      const t = setTimeout(() => {
        if (!showAuthSheet) { setShowLocPrompt(true); setLocationAsked(true); }
      }, 3000);
      return () => clearTimeout(t);
    }
  }, [showAuthSheet, locationAsked]);

  const handleAllowLocation = () => {
    setShowLocPrompt(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          // reverse geocode via allorigins proxy
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.coords.latitude},${pos.coords.longitude}&key=${PLACES_KEY}`;
          fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
            .then(r=>r.json()).then(d=>{
              const parsed = JSON.parse(d.contents);
              const comp = parsed.results?.[0]?.address_components?.find(a=>a.types.includes("locality"));
              const state = parsed.results?.[0]?.address_components?.find(a=>a.types.includes("administrative_area_level_1"));
              if (comp) {
                const detectedCity = `${comp.long_name}${state?", "+state.short_name:""}`;
                setCity(detectedCity); setCityInput(detectedCity);
                loadPlaces(detectedCity, browseCat);
                setTimeout(()=>preloadAllCats(detectedCity), 500);
              }
            }).catch(()=>{});
        },
        () => { setShowLocPrompt(false); }
      );
    }
  };
  const handleTypeCity = (typedCity) => {
    setShowLocPrompt(false);
    if (typedCity.trim()) {
      setCity(typedCity.trim()); setCityInput(typedCity.trim());
      loadPlaces(typedCity.trim(), browseCat);
      setTimeout(()=>preloadAllCats(typedCity.trim()), 500);
    }
  };

  const handleSignup = () => {
    if (!authForm.name.trim()) return setAuthErr("Please enter your name");
    if (!authForm.email.includes("@")) return setAuthErr("Please enter a valid email");
    if (authForm.password.length < 6) return setAuthErr("Password must be at least 6 characters");
    setAuthErr(""); setAuthScreen("steps");
  };
  const handleLogin = () => {
    if (!authForm.email.includes("@")) return setAuthErr("Please enter a valid email");
    setAuthErr("");
    setUser({...authForm, name: authForm.email.split("@")[0]||"You"});
    setShowAuthSheet(false);
  };
  const toggleAuthAns = (sid, oid, multi) => {
    if (multi) { const c=authAnswers[sid]||[]; setAuthAnswers(a=>({...a,[sid]:c.includes(oid)?c.filter(x=>x!==oid):[...c,oid]})); }
    else setAuthAnswers(a=>({...a,[sid]:oid}));
  };
  const authStep = ONBOARDING_STEPS[authStepIdx];
  const authCanNext = authStep?.type==="multi" ? (authAnswers[authStep?.id]||[]).length>0 : !!authAnswers[authStep?.id];
  const authNext = () => {
    if (authStepIdx < ONBOARDING_STEPS.length-1) setAuthStepIdx(i=>i+1);
    else { setUser({...authForm,...authAnswers}); setShowAuthSheet(false); if(authAnswers.stage) setStage(authAnswers.stage); }
  };

  if (showSettings) return <Settings T={T} onBack={()=>setShowSettings(false)} user={user}/>;

  // LocationPrompt moved outside App — rendered below with props

  const hamBtn = (
    <button onClick={()=>setShowSettings(true)} style={{background:T.red,border:"none",borderRadius:12,width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,flexDirection:"column",gap:4.5,padding:0}}>
      {[0,1,2].map(i=><div key={i} style={{width:16,height:1.5,background:"#fff",borderRadius:2}}/>)}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:T.bg,maxWidth:480,margin:"0 auto",position:"relative",paddingBottom:68,fontFamily:"'DM Sans',sans-serif",colorScheme:isDark?"dark":"light"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=Playfair+Display:ital,wght@0,700;0,800;1,700;1,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        html,body{width:100%;overflow-x:hidden;background:#250902;}
        #root{display:flex;flex-direction:column;align-items:center;min-height:100vh;background:#250902;}
        ::-webkit-scrollbar{width:2px;height:2px}
        ::-webkit-scrollbar-thumb{background:${T.border};border-radius:10px}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes popIn{0%{opacity:0;transform:scale(0.9)}70%{transform:scale(1.03)}100%{opacity:1;transform:scale(1)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes sheetUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%{opacity:0.35}50%{opacity:0.6}100%{opacity:0.35}}
        .fu{animation:fadeUp 0.38s ease forwards}
        .pop{animation:popIn 0.38s cubic-bezier(.34,1.56,.64,1) forwards}
        .pulse{animation:pulse 1.3s ease infinite}
        .tab-btn{display:flex;flex-direction:column;align-items:center;gap:2px;background:none;border:none;cursor:pointer;padding:4px 0;flex:1}
        .chip{cursor:pointer;border-radius:30px;padding:7px 14px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;border:1px solid ${T.borderSub};background:transparent;color:${T.muted};white-space:nowrap;flex-shrink:0;transition:all 0.16s}
        .chip.on{background:${T.grad};color:#fff;border-color:transparent;box-shadow:0 3px 12px rgba(128,14,19,0.3)}
        .cat-card{cursor:pointer;border-radius:18px;border:1px solid ${T.borderSub};transition:all 0.18s;overflow:hidden}
        .cat-card:hover{transform:scale(1.02);border-color:${T.border}}
        .stage-pill{cursor:pointer;border-radius:14px;padding:12px 16px;display:flex;align-items:center;gap:10px;border:1px solid ${T.border};background:transparent;transition:all 0.18s;width:100%}
        .q-opt{width:100%;background:${T.faint};border:1px solid ${T.border};border-radius:14px;padding:14px 18px;font-family:'DM Sans',sans-serif;font-size:13px;color:${T.text};font-weight:500;cursor:pointer;text-align:left;transition:all 0.18s}
        .q-opt:hover{background:rgba(128,14,19,0.1);border-color:${T.red};transform:translateX(4px)}
        input::placeholder,textarea::placeholder{color:${T.muted}}
      `}</style>
      <DetailSheet spot={detail} onClose={()=>setDetail(null)} T={T}
        inPlan={detail?inPlan(detail.id):false} onAdd={()=>detail&&addStop(detail)} onRemove={()=>detail&&remStop(detail.id)}
        saved={detail?isSaved(detail.id):false} onSave={()=>detail&&togSave(detail.id)}/>

      <LocationPrompt
        show={showLocPrompt}
        onClose={()=>setShowLocPrompt(false)}
        onAllow={handleAllowLocation}
        onTypeCity={handleTypeCity}
        T={T}
      />
      <AuthSheet
        show={showAuthSheet} onClose={closeAuth} T={T}
        authScreen={authScreen} setAuthScreen={setAuthScreen}
        authForm={authForm} setAuthForm={setAuthForm}
        authErr={authErr} setAuthErr={setAuthErr}
        handleSignup={handleSignup} handleLogin={handleLogin}
        authStep={authStep} authAnswers={authAnswers}
        toggleAuthAns={toggleAuthAns} authCanNext={authCanNext}
        authNext={authNext} authStepIdx={authStepIdx}
        ONBOARDING_STEPS={ONBOARDING_STEPS}
      />

      {/* ══ HOME ══ */}
      {tab==="home"&&(
        <div className="fu">
          <div style={{padding:"52px 20px 0"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <Logo T={T}/>{hamBtn}
            </div>
            <div style={{position:"relative",marginBottom:18}}>
              <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:14,color:T.muted}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} onFocus={()=>setTab("browse")} placeholder="First Date, Date Night, Etc."
                style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:26,padding:"11px 14px 11px 38px",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.text,outline:"none"}}/>
            </div>
          </div>
          <div style={{padding:"0 20px 20px"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.22em",textTransform:"uppercase",color:T.red,marginBottom:8}}>
              {user ? `Hey ${user.name} 👋` : "Your Ultimate Wingman"}
              {city
                ? <span onClick={()=>setShowLocPrompt(true)} style={{color:T.muted,fontWeight:600,cursor:"pointer"}}> · 📍 {city} <span style={{fontSize:9,color:T.red}}>✎</span></span>
                : <span onClick={()=>setShowLocPrompt(true)} style={{color:T.muted,fontWeight:600,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted"}}> · 📍 Set your location</span>
              }
            </div>
            <h1 style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"clamp(38px,10vw,54px)",fontWeight:700,lineHeight:1.05,color:T.text,marginBottom:10}}>
              Make Tonight<br/><em style={{color:T.red}}>Unforgettable.</em>
            </h1>
            <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,lineHeight:1.65,maxWidth:310}}>From first date nerves to rekindling the spark — every night covered.</p>
          </div>
          <div style={{padding:"0 20px 22px",display:"flex",flexDirection:"column",gap:12}}>
            <button onClick={()=>setTab("plan")} style={{background:T.grad,color:"#fff",border:"none",borderRadius:18,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:"0 6px 24px rgba(128,14,19,0.35)"}}>
              <div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>Plan a Date</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.72)",marginTop:1}}>Build your perfect night, step by step</div></div>
              <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>→</div>
            </button>
            <button onClick={()=>{setSurpriseOn(true);setTab("browse");}} style={{background:"#BF834E",color:"#fff",border:"none",borderRadius:18,padding:"15px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",boxShadow:"0 6px 20px rgba(191,131,78,0.28)",transition:"opacity 0.2s"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.9"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:700}}>✨ Surprise Me</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.75)",marginTop:1}}>Answer a few questions, we plan everything</div></div>
              <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(255,255,255,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>→</div>
            </button>
          </div>
          <div style={{padding:"0 20px 12px",display:"flex",alignItems:"center"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:T.muted}}>Browse</div>
            <div style={{height:1,flex:1,background:T.borderSub,marginLeft:12,marginRight:12}}/>
            <button onClick={()=>setTab("browse")} style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.red,background:"none",border:"none",cursor:"pointer"}}>See all →</button>
          </div>
          <div style={{padding:"0 20px 22px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {CATEGORIES.map(cat=>(
              <CatCard key={cat.id} cat={cat} T={T} onPress={()=>{cat.id==="questions"?setTab("questions"):(setBrowseCat(cat.id),setTab("browse"));}}/>
            ))}
          </div>
          <div style={{padding:"0 20px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:T.muted}}>Recommended Tonight</div>
          <div style={{display:"flex",gap:12,overflowX:"auto",padding:"4px 20px 16px",scrollbarWidth:"none"}}>
            {(realSpots.length>0?realSpots:SPOTS).slice(0,6).map(spot=>(
              <div key={spot.id} onClick={()=>setDetail(spot)} style={{flexShrink:0,width:148,borderRadius:16,overflow:"hidden",cursor:"pointer",border:`1px solid ${T.borderSub}`,background:T.isDark?spot.dg:spot.lg,transition:"all 0.18s"}}
                onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform=""}>
                <div style={{height:90,position:"relative",overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center",fontSize:36}}>
                  {spot.photoUrl
                    ?<img src={spot.photoUrl} alt={spot.name} style={{width:"100%",height:"100%",objectFit:"cover",position:"absolute",inset:0}} onError={e=>{e.target.style.display='none'}} />
                    :spot.emoji}
                </div>
                <div style={{padding:"6px 10px 12px"}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:T.muted,marginBottom:2}}>{spot.tag}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:14,fontWeight:700,color:T.text,lineHeight:1.2,marginBottom:4}}>{spot.name}</div>
                  <NoiseBadge noise={spot.noise}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ BROWSE ══ */}
      {tab==="browse"&&!surpriseOn&&(
        <div className="fu">
          <div style={{padding:"52px 20px 0",background:T.surface,borderBottom:`1px solid ${T.borderSub}`}}>
            {/* City search + Surprise on same compact row */}
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
              <CitySearch
                initialCity={cityInput}
                onCommit={(newCity)=>{
                  setCityInput(newCity); setCity(newCity);
                  loadPlaces(newCity, browseCat);
                  setTimeout(()=>preloadAllCats(newCity), 600);
                }}
                T={T}
                compact={true}
              />
              <button onClick={()=>setSurpriseOn(true)} style={{background:"#BF834E",color:"#fff",border:"none",borderRadius:22,padding:"10px 14px",fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,boxShadow:"0 4px 12px rgba(191,131,78,0.3)"}}>✨ Surprise</button>
            </div>
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:14,scrollbarWidth:"none"}}>
              <button className={`chip ${browseCat==="all"?"on":""}`} onClick={()=>setBrowseCat("all")}>✨ All</button>
              {CATEGORIES.filter(c=>c.id!=="questions").map(c=><button key={c.id} className={`chip ${browseCat===c.id?"on":""}`} onClick={()=>{setBrowseCat(c.id);loadPlaces(city,c.id);}}>{c.emoji} {c.label}</button>)}
            </div>
          </div>
          <div style={{padding:"10px 20px 8px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.muted,display:"flex",alignItems:"center",gap:6}}>
            {placesLoading
              ? <><span style={{display:"inline-block",width:12,height:12,border:`2px solid ${T.red}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> Loading spots in <strong style={{color:T.text,marginLeft:4}}>{city}</strong>…</>
              : <>{browseSpots.length} spot{browseSpots.length!==1?"s":""} in <strong style={{color:T.text,marginLeft:4}}>{city}</strong>{plan.length>0&&<span style={{color:T.red,fontWeight:700,marginLeft:6}}>· {plan.length} in plan</span>}</>
            }
          </div>
          {placesLoading ? (
            <div style={{padding:"0 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[1,2,3,4,5,6].map(i=>(
                <div key={i} style={{background:T.surface,borderRadius:18,overflow:"hidden",border:`1px solid ${T.borderSub}`}}>
                  <div style={{height:110,background:T.faint,animation:"shimmer 1.4s ease infinite"}}/>
                  <div style={{padding:"10px 12px 14px"}}>
                    <div style={{height:9,background:T.faint,borderRadius:5,marginBottom:7,width:"50%"}}/>
                    <div style={{height:14,background:T.faint,borderRadius:5,marginBottom:7}}/>
                    <div style={{height:9,background:T.faint,borderRadius:5,width:"70%"}}/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{padding:"0 20px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {browseSpots.length===0
                ? <div style={{gridColumn:"1/-1",textAlign:"center",padding:"48px 0"}}><div style={{fontSize:40,marginBottom:12}}>📍</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:T.muted}}>No spots found</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginTop:6}}>Try a different city or category</div></div>
                : <>

                  {browseSpots.map(spot=><SpotCard key={spot.id} spot={spot} T={T} inPlan={inPlan(spot.id)} onAdd={()=>addStop(spot)} onRemove={()=>remStop(spot.id)} saved={isSaved(spot.id)} onSave={()=>togSave(spot.id)} onClick={()=>setDetail(spot)}/>)}
                </>
              }
            </div>
          )}
          <div style={{height:16}}/>
        </div>
      )}

      {/* ══ SURPRISE ME ══ */}
      {tab==="browse"&&surpriseOn&&(
        <div className="fu" style={{padding:"52px 22px 24px"}}>
          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:26}}>
            <BackBtn onBack={resetSurprise} T={T}/>
            <span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:T.text}}>✨ Surprise Me</span>
          </div>
          {sStep<SURPRISE_QS.length&&(
            <>
              {sStep===0&&(
                <>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:T.text,marginBottom:5,lineHeight:1.2}}>Where are you in your relationship?</div>
                  <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:18}}>We'll tailor the night to your stage.</p>
                  <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:20}}>
                    {STAGES.map(s=>(
                      <button key={s.id} className="stage-pill" onClick={()=>setSStage(sStage===s.id?null:s.id)} style={{background:sStage===s.id?`${s.color}18`:"transparent",border:`1px solid ${sStage===s.id?s.color:T.border}`}}>
                        <span style={{fontSize:22}}>{s.emoji}</span>
                        <div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:T.text}}>{s.label}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted}}>{s.sub}</div></div>
                        {sStage===s.id&&<span style={{color:s.color,fontWeight:800,fontSize:16,marginLeft:"auto"}}>✓</span>}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>setSStep(1)} style={{width:"100%",background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"14px",fontSize:14,fontWeight:800,cursor:"pointer"}}>
                    {sStage?`Continue as ${STAGES.find(s=>s.id===sStage)?.label} →`:"Skip & Continue →"}
                  </button>
                </>
              )}
              {sStep>0&&(
                <>
                  <div style={{display:"flex",gap:4,marginBottom:22}}>{SURPRISE_QS.map((_,i)=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<sStep?T.red:T.faint,transition:"background 0.3s"}}/>)}</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:700,color:T.text,lineHeight:1.2,marginBottom:18}}>{SURPRISE_QS[sStep-1].q}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>{SURPRISE_QS[sStep-1].opts.map(opt=><button key={opt} className="q-opt" onClick={()=>answerSurprise(SURPRISE_QS[sStep-1].id,opt)}>{opt}</button>)}</div>
                </>
              )}
            </>
          )}
          {sStep===99&&(
            <>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:28,fontWeight:700,color:T.text,marginBottom:4}}>
                Here are your suggestions ✨
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,background:T.faint,borderRadius:20,padding:"4px 12px",marginBottom:4}}>
                <span style={{fontSize:12}}>{({"Morning (before noon)":"☀️","Afternoon (12–5pm)":"🌤️","Evening (5–9pm)":"✨","Late Night (9pm+)":"🌙"})[sAnswers.timeofday]||"✨"}</span>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.muted}}>{sAnswers.timeofday||"Anytime"}</span>
              </div>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.muted,marginBottom:18}}>
                {sStage?`Curated for: ${STAGES.find(s=>s.id===sStage)?.emoji} ${STAGES.find(s=>s.id===sStage)?.label}`:"Tap any suggestion to learn more, then add it to your plan"}
              </p>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {sPicks.map((v,i)=>(
                  <div key={v.id} style={{opacity:i<revealed?1:0,transform:i<revealed?"translateY(0)":"translateY(18px)",transition:"all 0.5s ease"}}>
                    <div style={{background:T.isDark?v.dg:v.lg,borderRadius:20,overflow:"hidden",border:`1px solid ${T.border}`}}>
                      <div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center",fontSize:44}}>{v.emoji}</div>
                      <div style={{padding:"14px 16px"}}>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:T.muted,marginBottom:4}}>Stop {i+1}</div>
                        <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:T.text,marginBottom:6}}>{v.name}</div>
                        <div style={{display:"flex",gap:7,flexWrap:"wrap",alignItems:"center",marginBottom:8}}><NoiseBadge noise={v.noise}/><Star r={v.rating} T={T}/><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.red}}>{v.price}</span></div>
                        {v.cat==="restaurants"&&v.hours&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.red,fontWeight:700,marginBottom:6}}>🕐 {v.hours[0]} – {v.hours[1]}</div>}
                        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.textMid,lineHeight:1.55,marginBottom:12}}>{v.desc}</p>
                        <button onClick={()=>inPlan(v.id)?remStop(v.id):addStop(v)} style={{width:"100%",background:inPlan(v.id)?"transparent":T.grad,color:inPlan(v.id)?T.red:"#fff",border:inPlan(v.id)?`1.5px solid ${T.red}`:"none",borderRadius:10,padding:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                          {inPlan(v.id)?"✓ Added to Plan":"+ Add to Date Plan"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {revealed<sPicks.length&&<div className="pulse" style={{textAlign:"center",fontSize:13,color:T.muted,padding:"10px 0"}}>Revealing your stops…</div>}
              </div>
              {revealed>=sPicks.length&&<div style={{display:"flex",gap:10,marginTop:22}}>
                <button onClick={()=>{
                  // Re-run with same answers — just reshuffle
                  const next=sAnswers;
                  const allSpots2=[...(realSpots.length>0?realSpots:[...Object.values(placesCache).flat()].length>0?[...Object.values(placesCache).flat()]:SPOTS)];
                  let pool2=[...allSpots2];
                  if(sStage) pool2=pool2.filter(v=>!v.stages||v.stages.includes(sStage));
                  const tod2=next.timeofday||"";
                  if(tod2==="Morning (before noon)") pool2=pool2.filter(v=>v.cat!=="nightlife"&&v.noise!=="loud");
                  else if(tod2==="Afternoon (12–5pm)") pool2=pool2.filter(v=>v.cat!=="nightlife");
                  else if(tod2==="Late Night (9pm+)") pool2=pool2.filter(v=>["nightlife","dessert","restaurants"].includes(v.cat));
                  if(next.budget==="Under $30") pool2=pool2.filter(v=>v.price==="$");
                  else if(next.budget==="$30–$60") pool2=pool2.filter(v=>["$","$$"].includes(v.price));
                  if(next.noise==="Quiet — we want to talk") pool2=pool2.filter(v=>v.noise==="quiet");
                  else if(next.noise==="Louder the better") pool2=pool2.filter(v=>v.noise==="loud");
                  if(["Cozy & low-key","Romantic & intentional"].includes(next.energy)) pool2=pool2.filter(v=>v.noise!=="loud");
                  // Exclude current picks to get fresh results
                  const curIds=sPicks.map(p=>p.id);
                  const fresh=pool2.filter(v=>!curIds.includes(v.id));
                  const newPicks=(fresh.length>=3?fresh:pool2).sort(()=>Math.random()-0.5).slice(0,3);
                  setSPicks(newPicks.length?newPicks:[...allSpots2].sort(()=>Math.random()-0.5).slice(0,3));
                  setRevealed(0);
                  [0,1,2].forEach(i=>setTimeout(()=>setRevealed(r=>r+1),400+i*650));
                }} style={{flex:1,background:T.faint,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px",fontSize:13,fontWeight:700,color:T.muted,cursor:"pointer"}}>🔄 Try Again</button>
                <button onClick={()=>{setSurpriseOn(false);setTab("plan");}} style={{flex:1,background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:800,cursor:"pointer"}}>View Plan →</button>
              </div>}
            </>
          )}
        </div>
      )}

      {/* ══ SAVED ══ */}
      {tab==="saved"&&(
        <div className="fu" style={{padding:"52px 20px 0"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:T.text,marginBottom:4}}>Saved <em style={{color:T.red}}>Spots</em></div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:20}}>{savedIds.length} saved</p>
          {savedIds.length===0?(<div style={{textAlign:"center",padding:"64px 0"}}><div style={{fontSize:52,marginBottom:14}}>🤍</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",color:T.muted}}>Nothing saved yet</div><p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginTop:8}}>Tap ❤️ on any venue to save it</p><button onClick={()=>setTab("browse")} style={{background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"12px 28px",fontSize:13,fontWeight:800,cursor:"pointer",marginTop:22}}>Browse Spots →</button></div>)
          :(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{SPOTS.filter(v=>savedIds.includes(v.id)).map(spot=><SpotCard key={spot.id} spot={spot} T={T} inPlan={inPlan(spot.id)} onAdd={()=>addStop(spot)} onRemove={()=>remStop(spot.id)} saved={true} onSave={()=>togSave(spot.id)} onClick={()=>setDetail(spot)}/>)}</div>)}
        </div>
      )}

      {/* ══ DATE PLAN ══ */}
      {tab==="plan"&&(
        <div className="fu" style={{padding:"52px 20px 0"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:T.text,marginBottom:4}}>Date <em style={{color:T.red}}>Plan</em></div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:22}}>{plan.length} stop{plan.length!==1?"s":""} tonight</p>
          {plan.length===0?(<div style={{textAlign:"center",padding:"64px 0"}}><div style={{fontSize:52,marginBottom:14}}>❤️</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontStyle:"italic",color:T.muted}}>Your plan is empty</div><p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,margin:"8px 0 28px"}}>Browse and add stops to build your night</p><button onClick={()=>setTab("browse")} style={{background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontSize:14,fontWeight:800,cursor:"pointer"}}>Browse Spots →</button></div>)
          :(<>
            {plan.map((v,i)=>(
              <div key={v.id} style={{display:"flex",marginBottom:14}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginRight:14,paddingTop:14}}>
                  <div style={{width:11,height:11,borderRadius:"50%",background:T.grad,flexShrink:0,boxShadow:`0 0 0 3px ${T.red}40`}}/>
                  {i<plan.length-1&&<div style={{width:1.5,flex:1,background:`linear-gradient(to bottom,${T.red}70,${T.faint})`,minHeight:18,marginTop:4}}/>}
                </div>
                <div style={{flex:1,background:T.surface,borderRadius:18,padding:"16px",border:`1px solid ${T.borderSub}`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                    <div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:T.muted,marginBottom:3}}>Stop {i+1}</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:700,color:T.text}}>{v.emoji} {v.name}</div></div>
                    <button onClick={()=>remStop(v.id)} style={{background:"transparent",border:`1px solid ${T.borderSub}`,borderRadius:8,padding:"3px 9px",fontSize:11,color:T.muted,cursor:"pointer"}}>✕</button>
                  </div>
                  <div style={{marginBottom:8}}><NoiseBadge noise={v.noise}/></div>
                  {v.cat==="restaurants"&&v.hours&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.red,fontWeight:700,marginBottom:6}}>🕐 {v.hours[0]} – {v.hours[1]}</div>}
                  <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}><Star r={v.rating} T={T}/><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,color:T.red}}>{v.price}</span></div>
                  <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                    <input type="time" value={v.time} onChange={e=>setTime(v.id,e.target.value)} style={{background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"7px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.text,outline:"none"}}/>
                  </div>
                </div>
              </div>
            ))}
            <div style={{background:T.grad,borderRadius:18,padding:"18px 22px",textAlign:"center",margin:"8px 0 16px"}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:"#fff",marginBottom:2}}>{plan.length} stop{plan.length>1?"s":""} · Tonight is sorted 🥂</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.65)"}}>Set times above to schedule each stop</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setTab("browse")} style={{flex:1,background:T.faint,border:`1px solid ${T.border}`,borderRadius:14,padding:"13px",fontSize:13,fontWeight:700,color:T.muted,cursor:"pointer"}}>+ Add More</button>
              <button style={{flex:1,background:T.grad,color:"#fff",border:"none",borderRadius:14,padding:"13px",fontSize:13,fontWeight:800,cursor:"pointer"}}>Share 🔗</button>
            </div>
          </>)}
        </div>
      )}

      {/* ══ QUESTIONS ══ */}
      {tab==="questions"&&(
        <div className="fu" style={{padding:"52px 20px 0"}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:700,color:T.text,marginBottom:4}}>Conversation <em style={{color:T.red}}>Starters</em></div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,marginBottom:18}}>Your built-in wingman for every quiet moment 💬</p>
          <div style={{display:"flex",gap:8,overflowX:"auto",marginBottom:20,paddingBottom:2,scrollbarWidth:"none"}}>
            {STAGES.map(s=><button key={s.id} onClick={()=>{setQStage(s.id);setQIdx(0);setQFlipped(false);}} style={{background:qStage===s.id?T.grad:"transparent",color:qStage===s.id?"#fff":T.muted,border:`1px solid ${qStage===s.id?"transparent":T.border}`,borderRadius:30,padding:"7px 16px",fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.18s"}}>{s.emoji} {s.label}</button>)}
          </div>
          <div key={`${qStage}-${qIdx}`} className="pop" onClick={()=>setQFlipped(!qFlipped)} style={{background:qFlipped?T.surface:T.grad,borderRadius:24,padding:"36px 28px",minHeight:188,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",cursor:"pointer",boxShadow:qFlipped?"none":"0 8px 32px rgba(128,14,19,0.3)",border:qFlipped?`1px solid ${T.border}`:"none",marginBottom:16,transition:"background 0.3s"}}>
            {!qFlipped?(<><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:21,fontWeight:600,fontStyle:"italic",color:"#fff",lineHeight:1.45}}>"{currentQs[qIdx]}"</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.48)",marginTop:18}}>Tap to flip</div></>)
            :(<><div style={{fontSize:36,marginBottom:12}}>💭</div><div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontStyle:"italic",color:T.text,marginBottom:8}}>Now really listen.</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.muted,lineHeight:1.6}}>Put the phone down and be present.</div></>)}
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
            <button onClick={()=>{setQIdx(i=>Math.max(0,i-1));setQFlipped(false);}} disabled={qIdx===0} style={{flex:1,background:T.faint,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,color:T.muted,cursor:qIdx===0?"not-allowed":"pointer",opacity:qIdx===0?0.4:1}}>← Prev</button>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.muted,whiteSpace:"nowrap"}}>{qIdx+1} / {currentQs.length}</span>
            <button onClick={()=>{setQIdx(i=>(i+1)%currentQs.length);setQFlipped(false);}} style={{flex:1,background:T.grad,color:"#fff",border:"none",borderRadius:12,padding:"12px",fontSize:13,fontWeight:800,cursor:"pointer"}}>Next →</button>
          </div>
          <button onClick={()=>{setQIdx(Math.floor(Math.random()*currentQs.length));setQFlipped(false);}} style={{width:"100%",background:T.faint,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px",fontSize:13,fontWeight:700,color:T.muted,cursor:"pointer"}}>🎲 Shuffle</button>
        </div>
      )}

      {/* ══ PROFILE ══ */}
      {tab==="profile"&&(
        <div className="fu" style={{padding:"52px 20px 0"}}>
          <div style={{background:T.grad,borderRadius:22,padding:"28px 22px",marginBottom:18,position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",right:-20,top:-20,fontSize:100,opacity:0.07}}>❤️</div>
            <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:12}}>👤</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,color:"#fff"}}>{user?.name||"Guest"}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"rgba(255,255,255,0.65)",marginTop:3}}>{user?.email||"Sign in to save your plans"}</div>
          </div>
          <div style={{background:T.surface,borderRadius:18,padding:"18px",border:`1px solid ${T.border}`,marginBottom:14}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:T.muted,marginBottom:14}}>Relationship Stage</div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {STAGES.map(s=>(
                <button key={s.id} className="stage-pill" onClick={()=>setStage(stage===s.id?null:s.id)} style={{background:stage===s.id?`${s.color}18`:"transparent",border:`1px solid ${stage===s.id?s.color:T.border}`}}>
                  <span style={{fontSize:22}}>{s.emoji}</span>
                  <div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:700,color:T.text}}>{s.label}</div><div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted}}>{s.sub}</div></div>
                  {stage===s.id&&<span style={{color:s.color,fontWeight:800,marginLeft:"auto"}}>✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            {[{icon:"🤍",label:"Saved Spots",val:savedIds.length},{icon:"❤️",label:"Stops in Plan",val:plan.length}].map(s=>(
              <div key={s.label} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:16,padding:"16px",textAlign:"center"}}>
                <div style={{fontSize:26,marginBottom:6}}>{s.icon}</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:30,fontWeight:700,color:T.red}}>{s.val}</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.muted,fontWeight:600}}>{s.label}</div>
              </div>
            ))}
          </div>
          <button onClick={()=>setShowSettings(true)} style={{width:"100%",background:T.surface,border:`1px solid ${T.borderSub}`,borderRadius:14,padding:"14px",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,color:T.text,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>⚙️ Settings & More</span><span style={{color:T.muted}}>›</span>
          </button>
        </div>
      )}

      {/* ══ BOTTOM NAV ══ */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:T.navBg,borderTop:`1px solid ${T.borderSub}`,display:"flex",padding:"7px 0 11px",zIndex:500,boxShadow:"0 -2px 16px rgba(0,0,0,0.2)"}}>
        {[{id:"home",icon:"🏠",label:"Home"},{id:"browse",icon:"🔍",label:"Explore"},{id:"plan",icon:"❤️",label:"Date Plan",badge:plan.length||null},{id:"profile",icon:"👤",label:"Profile"}].map(t=>(
          <button key={t.id} className="tab-btn" onClick={()=>{setTab(t.id);if(t.id!=="browse")setSurpriseOn(false);}} style={{color:tab===t.id?T.red:T.muted}}>
            <div style={{position:"relative"}}><span style={{fontSize:19}}>{t.icon}</span>{t.badge&&<span style={{position:"absolute",top:-3,right:-6,background:T.red,color:"#fff",borderRadius:"50%",width:14,height:14,fontSize:8,fontWeight:800,display:"flex",alignItems:"center",justifyContent:"center"}}>{t.badge}</span>}</div>
            <span style={{fontSize:9,fontWeight:tab===t.id?800:500,letterSpacing:"0.02em"}}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
