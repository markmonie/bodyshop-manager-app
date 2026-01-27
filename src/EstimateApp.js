import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, updatePassword } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- FIREBASE CONFIG ---
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

// --- STABLE DVLA ENGINE ---
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

// --- GLOBAL STYLES ---
const theme = {
    estimate: '#f97316', workshop: '#fbbf24', deal: '#16a34a', settings: '#2563eb',
    bg: '#0f172a', card: '#1e293b', text: '#f8fafc', textDim: '#94a3b8', danger: '#ef4444', border: '#334155'
};

const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '15px', border: `1px solid ${theme.border}` },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: '#94a3b8', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnG: { background: theme.deal, color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    btnR: { background: theme.danger, color: 'white', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' },
    scrollBar: { position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '10px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: `2px solid ${theme.border}`, zIndex: 1000 }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('AUTH'); // AUTH, ESTIMATE, WORKSHOP, DEAL, SETTINGS, FINANCE, HISTORY
    const [loading, setLoading] = useState(false);
    const [calcOpen, setCalcOpen] = useState(false);

    // --- STATE ---
    const [settings, setSettings] = useState({ coName: 'Triple MMM', address: '', phone: '', bank: '', markup: '20', labourRate: '50', vatRate: '0', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', terms: '' });
    const [job, setJob] = useState({ 
        customer: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', phone: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', engine: '', fuel: '', mot: '', tax: '' },
        repair: { items: [], panelHrs: 0, paintHrs: 0, metHrs: 0, paintMats: 0, excess: 0, techNotes: '', damageReport: '' },
        vault: { auth: '', sat: '', tc: '', supInv: '' }
    });
    const [allJobs, setAllJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setAllJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labTotal = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0)) * parseFloat(settings.labourRate);
        const sub = pPrice + labTotal + (parseFloat(job.repair.paintMats) || 0);
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const grand = sub + vat;
        return { grand, customer: parseFloat(job.repair.excess || 0), insurer: grand - parseFloat(job.repair.excess || 0), profit: grand - (pCost + parseFloat(job.repair.paintMats || 0)) };
    }, [job.repair, settings]);

    const handleDVLA = async () => {
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus}});
        } catch (e) { alert("Manual Entry Required"); }
        setLoading(false);
    };

    const nav = (m) => <button onClick={() => setMode(m)} style={{...s.btnG, background: mode === m ? theme[m.toLowerCase()] : '#334155', minWidth:'100px'}}>{m}</button>;

    if (mode === 'AUTH') return (
        <div style={{background:theme.bg, height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px'}}>
            <img src={settings.logoUrl} style={{height:'100px', marginBottom:'20px'}} />
            <h1 style={{color:theme.estimate}}>TRIPLE MMM SECURE</h1>
            <input type="password" id="pw" style={s.input} placeholder="Workshop Password" />
            <button style={{...s.btnG, width:'100%'}} onClick={() => document.getElementById('pw').value === '1234' ? setMode('ESTIMATE') : alert("Denied")}>Login</button>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div className="no-print" style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <img src={settings.logoUrl} style={{height:'40px'}} />
                <div style={{textAlign:'right'}}><span style={s.label}>Live Project</span>{job.vehicle.reg || 'NEW JOB'}</div>
            </div>

            {/* ESTIMATE PAGE (Orange/Green/Black) */}
            {mode === 'ESTIMATE' && (
                <div className="no-print">
                    <div style={s.card}>
                        <span style={{...s.label, color:theme.estimate}}>1. Intake & DVLA</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                            <input style={{...s.input, fontSize:'20px', fontWeight:'bold', flex:1}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button onClick={handleDVLA} style={s.btnG}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Make" value={job.vehicle.make} onChange={e=>setJob({...job, vehicle:{...job.vehicle, make:e.target.value}})} />
                            <input style={s.input} placeholder="VIN" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                        </div>
                    </div>
                    <div style={s.card}>
                        <span style={{...s.label, color:theme.estimate}}>2. Parts & Labour Allocation</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input id="pNm" style={{...s.input, flex:2}} placeholder="Part Name" />
                            <input id="pCs" style={{...s.input, flex:1}} placeholder="Cost £" />
                            <button onClick={() => {
                                const n=document.getElementById('pNm'), c=document.getElementById('pCs');
                                setJob({...job, repair:{...job.repair, items:[...job.repair.items, {name:n.value, cost:c.value}]}});
                                n.value=''; c.value='';
                            }} style={s.btnG}>+</button>
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'5px', marginTop:'10px'}}>
                            <input style={s.input} placeholder="Panel Hrs" type="number" value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} />
                            <input style={s.input} placeholder="Paint Hrs" type="number" value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} />
                            <input style={s.input} placeholder="MET Hrs" type="number" value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} />
                        </div>
                    </div>
                    <div style={{...s.card, background:theme.estimate}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                            <div><span style={s.label}>Grand Total</span><h1 style={{margin:0}}>£{totals.grand.toFixed(2)}</h1></div>
                            <div style={{textAlign:'right'}}><span style={s.label}>Profit Margin</span><h3 style={{margin:0, color:theme.deal}}>£{totals.profit.toFixed(2)}</h3></div>
                        </div>
                    </div>
                </div>
            )}

            {/* WORKSHOP PAGE (Amber/Black) */}
            {mode === 'WORKSHOP' && (
                <div className="no-print">
                    <h2 style={{color:theme.workshop}}>INTELLIGENT JOB CARD</h2>
                    <div style={{...s.card, borderLeft:`8px solid ${theme.workshop}`}}>
                        <span style={s.label}>Vehicle Information</span>
                        <h3>{job.vehicle.reg} | {job.vehicle.make}</h3>
                        <p>VIN: {job.vehicle.vin}</p>
                    </div>
                    <div style={s.card}>
                        <span style={s.label}>Labor Time tracking</span>
                        <p>Panel: {job.repair.panelHrs} hrs | Paint: {job.repair.paintHrs} hrs | MET: {job.repair.metHrs} hrs</p>
                        <textarea style={{...s.input, height:'100px'}} placeholder="Technician's Supplement/Issues Box..." value={job.repair.damageReport} onChange={e=>setJob({...job, repair:{...job.repair, damageReport:e.target.value}})} />
                    </div>
                </div>
            )}

            {/* FINANCE PAGE (No Financials for Customer) */}
            {mode === 'FINANCE' && (
                <div className="no-print">
                    <h2 style={{color:theme.deal}}>FINANCIAL VAULT</h2>
                    <div style={s.card}>
                        <span style={s.label}>Net Income Report</span>
                        <h2>Total Profit: £{allJobs.reduce((acc, j) => acc + (j.totals?.profit || 0), 0).toFixed(2)}</h2>
                        <button style={s.btnG} onClick={() => {
                             let csv = "Date,Reg,Grand,Profit\n";
                             allJobs.forEach(j => csv += `${new Date(j.createdAt?.seconds*1000).toLocaleDateString()},${j.vehicle?.reg},${j.totals?.grand},${j.totals?.profit}\n`);
                             const blob = new Blob([csv], {type:'text/csv'});
                             window.open(URL.createObjectURL(blob));
                        }}>Download Finance CSV</button>
                    </div>
                </div>
            )}

            {/* FOOTER SCROLL BAR */}
            <div className="no-print" style={s.scrollBar}>
                {nav('ESTIMATE')}
                {nav('WORKSHOP')}
                {nav('DEAL')}
                {nav('FINANCE')}
                {nav('HISTORY')}
                {nav('SETTINGS')}
                <button style={s.btnG} onClick={() => setCalcOpen(!calcOpen)}>🧮 CALC</button>
                <button style={s.btnG} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Synced to Triple MMM Database");
                }}>SAVE ALL</button>
                <button style={s.btnG} onClick={() => window.print()}>🖨️ PDF</button>
            </div>

            {/* PRINT VIEW (Professional Invoice) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'40px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'4px solid orange', paddingBottom:'20px'}}>
                    <div><img src={settings.logoUrl} style={{height:'80px'}} /><h1>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'orange', margin:0}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {job.vehicle.reg}</p></div>
                </div>
                <div style={{marginTop:'30px', display:'flex', justifyContent:'space-between'}}>
                    <div style={{width:'45%'}}><strong>Customer:</strong><br/>{job.customer.name}<br/>{job.customer.address}</div>
                    <div style={{width:'45%'}}><strong>Claim Details:</strong><br/>{job.insurance.co}<br/>Ref: {job.insurance.claim} | Network: {job.insurance.network}</div>
                </div>
                <table style={{width:'100%', marginTop:'40px', borderCollapse:'collapse'}}>
                    <tr style={{background:'#eee'}}><th style={{padding:'10px', textAlign:'left'}}>Description</th><th style={{padding:'10px', textAlign:'right'}}>Amount</th></tr>
                    <tr><td style={{padding:'10px', borderBottom:'1px solid #ddd'}}>Labour (Panel/Paint/MET)</td><td style={{textAlign:'right', padding:'10px', borderBottom:'1px solid #ddd'}}>£{((parseFloat(job.repair.panelHrs||0)+parseFloat(job.repair.paintHrs||0)+parseFloat(job.repair.metHrs||0))*settings.labourRate).toFixed(2)}</td></tr>
                    {job.repair.items.map((it, i) => (
                        <tr key={i}><td style={{padding:'10px', borderBottom:'1px solid #ddd'}}>{it.name}</td><td style={{textAlign:'right', padding:'10px', borderBottom:'1px solid #ddd'}}>£{(parseFloat(it.cost)*(1+(settings.markup/100))).toFixed(2)}</td></tr>
                    ))}
                </table>
                <div style={{textAlign:'right', marginTop:'40px'}}>
                    <h2>Total Due: £{totals.grand.toFixed(2)}</h2>
                    <div style={{background:'#fff3e0', padding:'20px', border:'2px solid orange', marginTop:'20px', textAlign:'left'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Customer Excess:</span><strong>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'orange', marginTop:'10px'}}><span>Insurer Balance:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div style={{marginTop:'60px', borderTop:'1px solid #ddd', paddingTop:'20px', fontSize:'12px'}}>
                    Bank: {settings.bank} | Terms: {settings.terms}
                </div>
            </div>

            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
                ::-webkit-scrollbar { height: 8px; }
                ::-webkit-scrollbar-thumb { background: #334155; borderRadius: 4px; }
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
