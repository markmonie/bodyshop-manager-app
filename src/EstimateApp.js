import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, addDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- ENTERPRISE CONFIGURATION ---
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

// --- DVLA API ENGINE ---
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

// --- DESIGN SYSTEM ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '16px', padding: '25px', marginBottom: '20px', border: `1px solid ${theme.border}`, borderTop: `8px solid ${color || theme.hub}`, boxShadow: '0 10px 40px rgba(0,0,0,0.7)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '14px', borderRadius: '10px', marginBottom: '12px', outline: 'none' },
    label: { color: '#94a3b8', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', display: 'block' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '16px 28px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '18px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [calc, setCalc] = useState(false);
    
    // --- GLOBAL DATA ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Standard 12-Month Warranty. Payment due strictly on collection.' 
    });

    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '', phone: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { expenses: [] }
    });
    
    const [history, setHistory] = useState([]);

    // --- PERSISTENCE & CLOUD SYNC ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('triple_mmm_active_job');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('triple_mmm_active_job', JSON.stringify(job)); }, [job]);

    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const sub = pPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        return { total, sub, vat, customer: parseFloat(job.repair.excess || 0), insurer: total - parseFloat(job.repair.excess || 0), profit: total - (pCost + parseFloat(job.repair.paintMats || 0)), labHrs, labPrice };
    }, [job.repair, settings]);

    // --- UPLOAD HANDLER ---
    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else if (field === 'expenses') setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...prev.vault.expenses, url]}}));
        setLoading(false);
    };

    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob(prev => ({...prev, vehicle: {...prev.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, colour: d.colour}}));
        } catch (e) { alert("DVLA Link Down."); }
        setLoading(false);
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '140px' }}>
            
            {/* HUB PAGE */}
            {view === 'HUB' && (
                <div>
                    <h1 style={{color:theme.hub}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. DVLA Intake</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:2, fontSize:'20px', fontWeight:'bold'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'100px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Manual Chassis / VIN" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Stakeholders</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATE (GREEN)</button>
                    </div>
                </div>
            )}

            {/* INTERACTIVE JOB CARD */}
            {view === 'WORK' && (
                <div>
                    <h1 style={{color:theme.work}}>INTERACTIVE JOB CARD</h1>
                    <div style={s.card(theme.work)}>
                        <span style={s.label}>Active Vehicle: {job.vehicle.reg}</span>
                        <h3>{job.vehicle.make} | {job.vehicle.colour}</h3>
                        <p>VIN: {job.vehicle.vin}</p>
                        <hr style={{borderColor: '#333', margin: '20px 0'}} />
                        <span style={s.label}>Workshop Supplement/Report</span>
                        <textarea style={{...s.input, height:'180px'}} value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} placeholder="Log technical findings or missing parts here..." />
                    </div>
                </div>
            )}

            {/* FINANCE VAULT */}
            {view === 'FIN' && (
                <div>
                    <h1 style={{color:theme.fin}}>FINANCE VAULT</h1>
                    <div style={s.card(theme.fin)}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'20px'}}>
                            <div style={{background:'#000', padding:'20px', borderRadius:'12px'}}><span style={s.label}>Total Income (Synced)</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'20px', borderRadius:'12px'}}><span style={s.label}>Receipts Vaulted</span><h2 style={{margin:0, color:theme.danger}}>{job.vault.expenses.length} Photos</h2></div>
                        </div>
                        <span style={s.label}>Upload Expenditure Receipt</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} style={{marginBottom:'10px'}} />
                        <button style={{...s.btnG(theme.fin), width:'100%'}} onClick={() => alert("CSV Exporting...")}>DOWNLOAD PERFORMANCE CSV</button>
                    </div>
                </div>
            )}

            {/* SETTINGS */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>SETTINGS & BRANDING</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Letterhead Logo</span>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'60px', marginBottom:'15px'}} alt="Logo" />}
                        <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} />
                        
                        <span style={s.label} style={{marginTop:'25px'}}>DVLA API Key</span>
                        <input style={s.input} placeholder="API Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                        
                        <span style={s.label}>Terms & Conditions</span>
                        <textarea style={{...s.input, height:'120px'}} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} />
                        
                        <button style={{...s.btnG(theme.set), width:'100%', marginTop:'10px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("All Settings Saved"); }}>SAVE MASTER CONFIG (GREEN)</button>
                    </div>
                </div>
            )}

            {/* ESTIMATING ENGINE */}
            {view === 'EST' && (
                <div>
                    <h2 style={{color:theme.hub}}>ESTIMATOR: {job.vehicle.reg}</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Parts Management</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input id="pD" style={{...s.input, flex:2}} placeholder="Part Name" />
                            <input id="pC" style={{...s.input, flex:1}} placeholder="Cost £" />
                            <button style={s.btnG(theme.deal)} onClick={()=>{
                                const d=document.getElementById('pD'), c=document.getElementById('pC');
                                if(d.value && c.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:d.value, cost:c.value}]}});
                                d.value=''; c.value='';
                            }}>+</button>
                        </div>
                        {job.repair.items.map((it, i) => (
                            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid #333'}}>
                                <span>{it.desc}</span>
                                <strong>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Adjustments</span>
                        <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="Deduct Excess -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        <button style={{...s.btnG(theme.deal), width: '100%'}} onClick={() => window.print()}>PRINT SPLIT INVOICE</button>
                    </div>
                </div>
            )}

            {/* DOCK BAR */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                <button onClick={()=>setView('WORK')} style={{...s.btnG(theme.work), minWidth:'80px'}}>JOB</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'80px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'80px'}}>SET</button>
                <button style={{...s.btnG(theme.deal), minWidth:'140px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM System Synced");
                }}>SAVE ALL</button>
            </div>

            {/* PRINT VIEW (OFFICIAL INVOICE) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'50px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'5px solid orange', paddingBottom:'25px'}}>
                    <div>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'80px'}} />}<h1 style={{margin:0, color:'orange'}}>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'orange', fontSize:'40px', margin:0}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {job.vehicle.reg}</p></div>
                </div>
                <div style={{marginTop:'30px', border:'1px solid #ddd', padding:'15px'}}>Vehicle Specs: {job.vehicle.make} | {job.vehicle.colour} | VIN: {job.vehicle.vin}</div>
                <div style={{marginTop:'30px', fontWeight:'bold'}}>Technician Report:</div>
                <div style={{minHeight:'80px', border:'1px solid #eee', padding:'10px'}}>{job.repair.techNotes}</div>
                <table style={{width:'100%', marginTop:'40px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#eee'}}><th style={{padding:'15px', textAlign:'left'}}>Description of Repair</th><th style={{padding:'15px', textAlign:'right'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'15px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'15px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                    </tbody>
                </table>
                <div style={{textAlign:'right', marginTop:'40px'}}>
                    <h1 style={{color:'orange', fontSize:'40px'}}>TOTAL: £{totals.total.toFixed(2)}</h1>
                    <div style={{background:'#fff3e0', padding:'25px', border:'3px solid orange', marginTop:'30px', textAlign:'left', borderRadius:'15px'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>CLIENT EXCESS PORTION:</span><strong style={{fontSize:'25px'}}>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'orange', marginTop:'15px', borderTop:'2px solid orange', paddingTop:'15px'}}><span>BALANCE DUE FROM INSURER:</span><strong style={{fontSize:'35px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div style={{marginTop:'80px', borderTop:'1px solid #eee', paddingTop:'20px', fontSize:'13px'}}>
                    <strong>Legal:</strong> {settings.terms}<br/>
                    <strong>Bank:</strong> {settings.bank}
                </div>
            </div>

            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
