import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- CONFIGURATION ---
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
const storage = getStorage(app);

// --- THE ENGINE ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...config.headers },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`DVLA Error: ${response.status}`);
        return { data: await response.json() };
    }
};

// --- DESIGN SYSTEM (Modern & Fresh) ---
const theme = {
    est: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb',
    bg: '#0f172a', card: '#1e293b', text: '#f8fafc', textDim: '#94a3b8', danger: '#ef4444', border: '#334155'
};

const s = {
    card: (color) => ({ background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '15px', borderLeft: `6px solid ${color || theme.border}`, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }),
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '14px', borderRadius: '10px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.textDim, fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '5px', display: 'block' },
    btnG: (color) => ({ background: color || theme.deal, color: 'white', border: 'none', padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '12px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: `2px solid ${theme.border}`, zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [page, setPage] = useState('AUTH'); // AUTH, EST, WORK, DEAL, FIN, SET, HIST
    const [loading, setLoading] = useState(false);
    const [calc, setCalc] = useState(false);

    const [settings, setSettings] = useState({ coName: 'Triple MMM Body Repairs', address: '20A New Street, ML9 3LT', phone: '07501 728319', bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '0', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', terms: 'Payment due on collection.', password: '1234' });
    const [job, setJob] = useState({
        customer: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', phone: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', engine: '', fuel: '', mot: '', tax: '' },
        repair: { items: [], panelHrs: '', paintHrs: '', metHrs: '', paintMats: '', excess: '0', techNotes: '', damageReport: '' },
        vault: { auth: '', sat: '', tc: '', supInv: '' }
    });
    const [history, setHistory] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const paint = parseFloat(job.repair.paintMats || 0);
        const sub = partsPrice + labPrice + paint;
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const grand = sub + vat;
        const excess = parseFloat(job.repair.excess || 0);
        return { grand, sub, vat, customer: excess, insurer: grand - excess, profit: grand - (partsCost + paint), labPrice, labHrs };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus}});
        } catch (e) { alert("DVLA Link Down - Manual Entry Engaged"); }
        setLoading(false);
    };

    const handleUpload = async (e, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `vault/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (field === 'logo') setSettings({...settings, logoUrl: url});
        else setJob({...job, vault: {...job.vault, [field]: url}});
    };

    if (page === 'AUTH') return (
        <div style={{background:theme.bg, height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', padding:'30px'}}>
            <div style={{...s.card(theme.est), width:'100%', maxWidth:'400px', textAlign:'center'}}>
                <h1 style={{color:theme.est, letterSpacing:'-2px'}}>TRIPLE MMM <span style={{color:'white'}}>LOGIN</span></h1>
                <input type="password" id="p_in" style={s.input} placeholder="Workshop Password" />
                <button style={{...s.btnG(theme.est), width:'100%'}} onClick={() => document.getElementById('p_in').value === settings.password ? setPage('EST') : alert("Incorrect")}>Access Workshop</button>
            </div>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '140px' }}>
            {/* CALCULATOR TOGGLE */}
            {calc && <div style={{position:'fixed', top:'10%', right:'5%', background:theme.card, padding:'20px', border:`2px solid ${theme.est}`, zIndex:2000, borderRadius:'15px'}}>
                <input id="c1" style={s.input} placeholder="Value 1" /><input id="c2" style={s.input} placeholder="Value 2" />
                <button onClick={() => alert(parseFloat(document.getElementById('c1').value) + parseFloat(document.getElementById('c2').value))} style={s.btnG()}>ADD</button>
                <button onClick={() => setCalc(false)} style={{...s.btnG(theme.danger), marginLeft:'10px'}}>CLOSE</button>
            </div>}

            <div className="no-print" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px'}}>
                {settings.logoUrl ? <img src={settings.logoUrl} style={{height:'45px'}} /> : <h1 style={{color:theme.est, margin:0}}>MMM</h1>}
                <div style={{textAlign:'right'}}><span style={s.label}>Active Record</span><strong>{job.vehicle.reg || 'NO REG'}</strong></div>
            </div>

            {/* ESTIMATE PAGE */}
            {page === 'EST' && (
                <div className="no-print">
                    <div style={s.card(theme.est)}>
                        <span style={{...s.label, color:theme.est}}>1. Vehicle & Customer Data</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                            <input style={{...s.input, fontSize:'22px', fontWeight:'900', textAlign:'center', flex:2, marginBottom:0}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button onClick={runDVLA} style={{...s.btnG(theme.est), width:'80px'}}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Customer Name" value={job.customer.name} onChange={e=>setJob({...job, customer:{...job.customer, name:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <div style={{background:theme.bg, padding:'10px', borderRadius:'8px'}}><span style={s.label}>Make</span>{job.vehicle.make}</div>
                            <div style={{background:theme.bg, padding:'10px', borderRadius:'8px'}}><span style={s.label}>Year</span>{job.vehicle.year}</div>
                        </div>
                    </div>
                    <div style={s.card(theme.est)}>
                        <span style={{...s.label, color:theme.est}}>2. Repairs & Markups</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input id="p_n" style={{...s.input, flex:2}} placeholder="Part Name" />
                            <input id="p_c" style={{...s.input, flex:1}} placeholder="Cost £" />
                            <button onClick={() => {
                                const n=document.getElementById('p_n'), c=document.getElementById('p_c');
                                if(n.value && c.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:n.value, cost:c.value}]}});
                                n.value=''; c.value='';
                            }} style={s.btnG(theme.deal)}>+</button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginTop:'15px'}}>
                            <div><span style={s.label}>Labour Total Hrs</span><div style={{fontSize:'20px', fontWeight:'bold'}}>{totals.labHrs} hrs</div></div>
                            <div><span style={s.label}>Excess (£)</span><input style={{...s.input, color:theme.danger, fontWeight:'bold', marginBottom:0}} value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} /></div>
                        </div>
                    </div>
                    <div style={{...s.card(theme.est), background:theme.est, borderLeft:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{...s.label, color:'white'}}>Grand Total</span><h1 style={{margin:0}}>£{totals.grand.toFixed(2)}</h1></div>
                            <div style={{textAlign:'right'}}><span style={{...s.label, color:'white'}}>Net Profit</span><h2 style={{margin:0}}>£{totals.profit.toFixed(2)}</h2></div>
                        </div>
                    </div>
                </div>
            )}

            {/* WORKSHOP PAGE */}
            {page === 'WORK' && (
                <div className="no-print">
                    <h2 style={{color:theme.work}}>INTELLIGENT JOB CARD</h2>
                    <div style={s.card(theme.work)}>
                        <span style={s.label}>Technical Requirements</span>
                        <h3>{job.vehicle.make} | {job.vehicle.reg}</h3>
                        <p>VIN/Chassis: {job.vehicle.vin}</p>
                        <hr style={{borderColor:theme.border}}/>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', textAlign:'center'}}>
                            <div style={{background:theme.bg, padding:'10px', borderRadius:'8px'}}><span style={s.label}>MET</span><input style={{...s.input, textAlign:'center'}} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                            <div style={{background:theme.bg, padding:'10px', borderRadius:'8px'}}><span style={s.label}>PANEL</span><input style={{...s.input, textAlign:'center'}} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                            <div style={{background:theme.bg, padding:'10px', borderRadius:'8px'}}><span style={s.label}>PAINT</span><input style={{...s.input, textAlign:'center'}} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                        </div>
                        <textarea style={{...s.input, height:'120px', marginTop:'15px'}} placeholder="Technician Report: Issues, Supplements, Damage Found..." value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} />
                    </div>
                </div>
            )}

            {/* DOCK BAR */}
            <div className="no-print" style={s.dock}>
                <button onClick={() => setPage('EST')} style={{...s.btnG(theme.est), minWidth:'80px'}}>EST</button>
                <button onClick={() => setPage('WORK')} style={{...s.btnG(theme.work), minWidth:'80px'}}>WORK</button>
                <button onClick={() => setPage('DEAL')} style={{...s.btnG(theme.deal), minWidth:'80px'}}>VAULT</button>
                <button onClick={() => setPage('FIN')} style={{...s.btnG('#1e293b'), minWidth:'80px'}}>FIN</button>
                <button onClick={() => setPage('HIST')} style={{...s.btnG('#334155'), minWidth:'80px'}}>HIST</button>
                <button onClick={() => setPage('SET')} style={{...s.btnG(theme.set), minWidth:'80px'}}>SET</button>
                <button onClick={() => setCalc(!calc)} style={s.btnG()}>🧮</button>
                <button onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Synced to Triple MMM Firebase");
                }} style={{...s.btnG(theme.deal), minWidth:'120px'}}>SYNC</button>
            </div>

            {/* PRINT VIEW */}
            <div className="print-only" style={{display:'none', color:'black', padding:'40px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'3px solid orange', paddingBottom:'20px'}}>
                    <div>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px'}} />}<h1>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'orange'}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {job.vehicle.reg}</p></div>
                </div>
                <div style={{marginTop:'30px'}}>
                    <p><strong>Customer:</strong> {job.customer.name} | <strong>Claim No:</strong> {job.insurance.claim}</p>
                    <h3>Vehicle: {job.vehicle.make} (Chassis: {job.vehicle.vin})</h3>
                </div>
                <table style={{width:'100%', marginTop:'30px', borderCollapse:'collapse'}}>
                    <tr style={{background:'#eee'}}><th style={{padding:'10px', textAlign:'left'}}>Description</th><th style={{padding:'10px', textAlign:'right'}}>Total</th></tr>
                    <tr><td style={{padding:'10px'}}>Labour Breakdown ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'10px'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                    {job.repair.items.map((it, i) => (
                        <tr key={i}><td style={{padding:'10px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'10px'}}>£{(parseFloat(it.cost)*(1+(settings.markup/100))).toFixed(2)}</td></tr>
                    ))}
                </table>
                <div style={{textAlign:'right', marginTop:'40px'}}>
                    <p>Subtotal: £{totals.sub.toFixed(2)}</p>
                    <h2 style={{color:'orange'}}>Invoice Total: £{totals.grand.toFixed(2)}</h2>
                    <div style={{background:'#fff3e0', padding:'15px', border:'2px solid orange', textAlign:'left', marginTop:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Customer Excess:</span><strong>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px', color:'orange'}}><span>Insurer Balance Due:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
            </div>

            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
                ::-webkit-scrollbar { height: 8px; } ::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }
            `}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
