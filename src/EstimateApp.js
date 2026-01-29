import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

// --- TITAN CONFIG ---
const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', bg: '#000', card: '#111', border: '#333', danger: '#ef4444', text: '#f8fafc' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '40px 30px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '25px', borderRadius: '22px', marginBottom: '20px', outline: 'none', fontSize: '26px', fontWeight: 'bold', boxSizing: 'border-box' },
    label: { color: '#94a3b8', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', display: 'block', letterSpacing: '2.5px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '24px 35px', borderRadius: '22px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.2s', fontSize: '18px', flexShrink: 0 }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '25px 20px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '5px solid #222', zIndex: 1000 },
    traffic: (active, color) => ({ width: '45px', height: '45px', borderRadius: '50%', opacity: active ? 1 : 0.1, border: '4px solid #fff', background: color, cursor: 'pointer' })
};

const EstimateApp = () => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [history, setHistory] = useState([]);
    
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, ML9 3LT', phone: '07501 728319', 
        markup: '20', labourRate: '50', vatRate: '20', dvlaKey: 'LXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc'
    });

    const INITIAL_JOB = {
        status: 'STRIPPING', lastSuccess: '',
        client: { name: '', phone: '' },
        vehicle: { reg: '', make: '', year: '', colour: '', mot: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0' }
    };

    const [job, setJob] = useState(INITIAL_JOB);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v145_FORENSIC');
        if (saved) setJob(JSON.parse(saved));
        
        const q = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v145_FORENSIC', JSON.stringify(job)); }, [job]);

    const totals = useMemo(() => {
        const n = (v) => parseFloat(v) || 0;
        const pCost = (job?.repair?.items || []).reduce((a, b) => a + n(b.cost), 0);
        const pPrice = pCost * (1 + (n(settings.markup) / 100));
        const lHrs = n(job?.repair?.panelHrs) + n(job?.repair?.paintHrs) + n(job?.repair?.metHrs);
        const lPrice = lHrs * n(settings.labourRate);
        const total = (pPrice + lPrice + n(job?.repair?.paintMats)) * (1 + (n(settings.vatRate) / 100));
        return { total, insurer: (total - n(job?.repair?.excess)), lHrs, lPrice };
    }, [job?.repair, settings]);

    const runDVLA = async () => {
        if (!job.vehicle.reg || !settings.dvlaKey) return alert("Missing Reg/Key");
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/\s+/g, '').toUpperCase();
        try {
            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`, {
                method: 'POST',
                headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ registrationNumber: cleanReg })
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.errors?.[0]?.detail || "DVLA Offline");
            setJob(prev => ({ ...prev, lastSuccess: new Date().toLocaleTimeString(), vehicle: { ...prev.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, mot: d.motStatus } }));
        } catch (e) { alert(e.message); }
        setLoading(false);
    };

    const saveMaster = async () => {
        const id = job.vehicle.reg || "TEMP-" + Date.now();
        await setDoc(doc(db, 'estimates', id), { ...job, totals, createdAt: serverTimestamp() });
        alert("Job Synchronised to Cloud.");
    };

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            <div className="no-print">
                {/* PRODUCTION DASHBOARD */}
                {view === 'DASHBOARD' && (
                    <div style={{maxWidth:'900px', margin:'0 auto'}}>
                        <h1 style={{color:theme.work, fontSize:'50px', textAlign:'center'}}>PRODUCTION LINE</h1>
                        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:'20px'}}>
                            {history.map((j, i) => (
                                <div key={i} style={s.card(j.status === 'QC' ? theme.deal : j.status === 'PAINT' ? theme.work : theme.danger)}>
                                    <h2 style={{margin:0}}>{j.vehicle.reg}</h2>
                                    <p style={{color:'#888'}}>{j.vehicle.make} - {j.status}</p>
                                    <button style={{...s.btnG('#333'), width:'100%'}} onClick={() => { setJob(j); setView('HUB'); }}>RESUME JOB</button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* HUB VIEW */}
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <h1 style={{color:theme.hub, fontSize:'58px', textAlign:'center'}}>COMMAND HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:4, fontSize:'54px', textAlign:'center', border:`5px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), flex:1}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            <div style={s.displayBox}>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', fontSize:'22px'}}>
                                    <div><span style={s.label}>Vehicle</span><strong>{job.vehicle.make || '---'}</strong></div>
                                    <div><span style={s.label}>MOT</span><strong style={{color: job.vehicle.mot === 'VALID' ? theme.deal : theme.danger}}>{job.vehicle.mot || '---'}</strong></div>
                                </div>
                            </div>
                            <span style={s.label}>Live Production Status</span>
                            <div style={{display:'flex', gap:'20px', justifyContent:'center', marginTop:'10px'}}>
                                <div onClick={()=>setJob({...job, status:'STRIPPING'})} style={s.traffic(job.status==='STRIPPING', theme.danger)} />
                                <div onClick={()=>setJob({...job, status:'PAINT'})} style={s.traffic(job.status==='PAINT', theme.work)} />
                                <div onClick={()=>setJob({...job, status:'QC'})} style={s.traffic(job.status==='QC', theme.deal)} />
                            </div>
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', padding:'40px', fontSize:'32px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                    </div>
                )}

                {/* ESTIMATOR VIEW */}
                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Parts & Materials</span>
                            {job.repair.items.map((item, i) => (
                                <div key={i} style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                    <input style={{...s.input, flex:3, marginBottom:0}} value={item.desc} placeholder="Item" onChange={e=>{
                                        const n = [...job.repair.items]; n[i].desc = e.target.value; setJob({...job, repair:{...job.repair, items:n}});
                                    }} />
                                    <input style={{...s.input, flex:1, marginBottom:0}} value={item.cost} placeholder="£" onChange={e=>{
                                        const n = [...job.repair.items]; n[i].cost = e.target.value; setJob({...job, repair:{...job.repair, items:n}});
                                    }} />
                                    <button style={{...s.btnG(theme.danger), padding:'10px'}} onClick={()=>{
                                        const n = job.repair.items.filter((_, idx)=>idx!==i); setJob({...job, repair:{...job.repair, items:n}});
                                    }}>X</button>
                                </div>
                            ))}
                            <button style={{...s.btnG(theme.work), width:'100%'}} onClick={()=>setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:'', cost:''}]}})}>+ ADD LINE</button>
                        </div>
                        <div style={s.card(theme.deal)}>
                            <h2 style={{fontSize:'40px'}}>Total: £{totals.total.toFixed(2)}</h2>
                            <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={()=>window.print()}>GENERATE DOCUMENTS</button>
                        </div>
                    </div>
                )}

                {/* SETTINGS */}
                {view === 'SET' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.card(theme.set)}>
                            <input style={s.input} placeholder="Company Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                            <input style={s.input} placeholder="DVLA Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                            <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={()=>setDoc(doc(db, 'settings', 'global'), settings).then(()=>alert("Saved"))}>SAVE SYSTEM CONFIG</button>
                        </div>
                    </div>
                )}

                {/* NAVIGATION DOCK */}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('DASHBOARD')} style={s.btnG(view==='DASHBOARD'?theme.work:'#222')}>LIVE</button>
                    <button onClick={()=>setView('HUB')} style={s.btnG(view==='HUB'?theme.hub:'#222')}>HUB</button>
                    <button onClick={()=>setView('EST')} style={s.btnG(view==='EST'?theme.hub:'#222')}>EST</button>
                    <button onClick={()=>setView('SET')} style={s.btnG(view==='SET'?theme.set:'#222')}>SET</button>
                    <button onClick={saveMaster} style={s.btnG(theme.deal)}>SAVE</button>
                </div>
            </div>

            {/* PRINT VIEW */}
            <div className="print-only" style={{display:'none', color:'black', padding:'40px', fontFamily:'Arial'}}>
                <h1 style={{color:theme.hub}}>{settings.coName}</h1>
                <p>Vehicle: {job.vehicle.reg} | {job.vehicle.make}</p>
                <hr/>
                {job.repair.items.map((it, i) => (
                    <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #eee'}}>
                        <span>{it.desc}</span><strong>£{parseFloat(it.cost || 0).toFixed(2)}</strong>
                    </div>
                ))}
                <h1 style={{textAlign:'right', marginTop:'40px'}}>TOTAL: £{totals.total.toFixed(2)}</h1>
            </div>
            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp /> : null;
};
export default App;
