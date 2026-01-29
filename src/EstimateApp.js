import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';

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

const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', bg: '#000', card: '#111', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '40px 30px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '25px', borderRadius: '22px', marginBottom: '20px', outline: 'none', fontSize: '26px', fontWeight: 'bold', boxSizing: 'border-box' },
    label: { color: '#94a3b8', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', display: 'block', letterSpacing: '2.5px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '24px 35px', borderRadius: '22px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.2s', fontSize: '18px', flexShrink: 0 }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '25px 20px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '5px solid #222', zIndex: 1000 },
    traffic: (active, color) => ({ width: '55px', height: '55px', borderRadius: '50%', opacity: active ? 1 : 0.1, border: '4px solid #fff', background: color, cursor: 'pointer' })
};

const EstimateApp = () => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'LXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc'
    });

    const INITIAL_JOB = {
        status: 'STRIPPING', client: { name: '', phone: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', mot: '', motExpiry: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0' }
    };

    const [job, setJob] = useState(INITIAL_JOB);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(s => ({...s, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v148_STABLE');
        if (saved) setJob(JSON.parse(saved));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v148_STABLE', JSON.stringify(job)); }, [job]);

    const totals = useMemo(() => {
        const n = (v) => { let p = parseFloat(v); return isFinite(p) ? p : 0; };
        const pCost = (job.repair.items || []).reduce((a, b) => a + n(b.cost), 0);
        const pPrice = pCost * (1 + (n(settings.markup) / 100));
        const lHrs = n(job.repair.panelHrs) + n(job.repair.paintHrs) + n(job.repair.metHrs);
        const lPrice = lHrs * n(settings.labourRate);
        const subtotal = pPrice + lPrice + n(job.repair.paintMats);
        const total = subtotal * (1 + (n(settings.vatRate) / 100));
        return { total, insurer: (total - n(job.repair.excess)), lHrs, lPrice };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/\s+/g, '').toUpperCase();
        try {
            const res = await fetch(`https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`, {
                method: 'POST',
                headers: { 'x-api-key': settings.dvlaKey.trim(), 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ registrationNumber: cleanReg })
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.errors?.[0]?.detail || "API Access Denied");
            setJob(prev => ({ ...prev, vehicle: { ...prev.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, mot: d.motStatus, motExpiry: d.motExpiryDate } }));
        } catch (e) { alert("DVLA: " + e.message); }
        setLoading(false);
    };

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            <div className="no-print">
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <h1 style={{color:theme.hub, fontSize:'60px', textAlign:'center', marginBottom:'40px'}}>TITAN HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:4, fontSize:'50px', textAlign:'center', border:`4px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), flex:1}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            <div style={s.displayBox}>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', fontSize:'24px'}}>
                                    <div><span style={s.label}>Vehicle</span><strong>{job.vehicle.make || '---'}</strong></div>
                                    <div><span style={s.label}>MOT Status</span><strong style={{color: job.vehicle.mot === 'VALID' ? theme.deal : theme.danger}}>{job.vehicle.mot || '---'}</strong></div>
                                </div>
                            </div>
                            <div style={{display:'flex', gap:'25px', justifyContent:'center', padding:'10px'}}>
                                {['STRIPPING', 'PAINT', 'QC'].map((st, i) => (
                                    <div key={st} onClick={()=>setJob({...job, status:st})} style={s.traffic(job.status===st, [theme.danger, theme.work, theme.deal][i])} />
                                ))}
                            </div>
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', padding:'40px', fontSize:'32px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                    </div>
                )}

                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Labour Breakdown</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', marginBottom:'25px'}}>
                                {['metHrs', 'panelHrs', 'paintHrs'].map(f => (
                                    <div key={f}><span style={s.label}>{f.slice(0,3).toUpperCase()}</span><input style={s.input} value={job.repair[f]} onChange={e=>setJob({...job, repair:{...job.repair, [f]:e.target.value}})} /></div>
                                ))}
                            </div>
                            <span style={s.label}>Parts & Materials</span>
                            {job.repair.items.map((it, i) => (
                                <div key={i} style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                                    <input style={{...s.input, flex:3, marginBottom:0}} value={it.desc} placeholder="Item" onChange={e=>{ let n=[...job.repair.items]; n[i].desc=e.target.value; setJob({...job, repair:{...job.repair, items:n}}); }} />
                                    <input style={{...s.input, flex:1, marginBottom:0}} value={it.cost} placeholder="£" onChange={e=>{ let n=[...job.repair.items]; n[i].cost=e.target.value; setJob({...job, repair:{...job.repair, items:n}}); }} />
                                    <button style={{...s.btnG(theme.danger), padding:'10px'}} onClick={()=>{ let n=job.repair.items.filter((_, idx)=>idx!==i); setJob({...job, repair:{...job.repair, items:n}}); }}>X</button>
                                </div>
                            ))}
                            <button style={{...s.btnG(theme.work), width:'100%', marginTop:'10px'}} onClick={()=>setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:'', cost:''}]}})}>+ ADD LINE</button>
                        </div>
                        <div style={s.card(theme.deal)}>
                            <div style={{background:'#000', padding:'30px', borderRadius:'20px', marginBottom:'20px', border:'1px solid #333'}}>
                                <h2 style={{margin:0, fontSize:'40px'}}>TOTAL: £{totals.total.toFixed(2)}</h2>
                                <p style={{color:theme.deal, margin:'10px 0'}}>Insurer Balance: £{totals.insurer.toFixed(2)}</p>
                            </div>
                            <button style={{...s.btnG(theme.deal), width:'100%', fontSize:'24px'}} onClick={()=>window.print()}>GENERATE INVOICE</button>
                        </div>
                    </div>
                )}

                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={s.btnG(view==='HUB'?theme.hub:'#222')}>HUB</button>
                    <button onClick={()=>setView('EST')} style={s.btnG(view==='EST'?theme.hub:'#222')}>EST</button>
                    <button onClick={async () => { await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() }); alert("Saved."); }} style={s.btnG(theme.deal)}>SAVE MASTER</button>
                </div>
            </div>

            <div className="print-only" style={{display:'none', color:'black', padding:'40px', fontFamily:'Arial'}}>
                <h1 style={{color:theme.hub, fontSize:'45px', margin:0}}>{settings.coName}</h1>
                <p>{settings.address} | {settings.phone}</p>
                <hr style={{margin:'30px 0'}}/>
                <h2 style={{fontSize:'30px'}}>Vehicle: {job.vehicle.reg} ({job.vehicle.make})</h2>
                <table style={{width:'100%', borderCollapse:'collapse', marginTop:'30px'}}>
                    <thead><tr style={{background:'#eee'}}><th align="left" style={{padding:'15px'}}>Repair Description</th><th align="right" style={{padding:'15px'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (<tr key={i} style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'15px'}}>{it.desc}</td><td align="right" style={{padding:'15px'}}>£{parseFloat(it.cost || 0).toFixed(2)}</td></tr>))}
                        <tr><td style={{padding:'15px'}}>Qualified Labour ({totals.lHrs} hrs)</td><td align="right" style={{padding:'15px'}}>£{totals.lPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <h1 style={{textAlign:'right', fontSize:'60px', marginTop:'50px'}}>GRAND TOTAL: £{totals.total.toFixed(2)}</h1>
                <div style={{marginTop:'100px', fontSize:'14px', color:'#666'}}>{settings.bank}</div>
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
