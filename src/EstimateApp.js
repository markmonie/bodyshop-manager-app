import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, addDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- TRIPLE MMM ENTERPRISE CONFIGURATION ---
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

// --- EXTERNAL DATA ENGINE (DVLA) ---
const axios = {
    post: async (url, data, config) => {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...config.headers },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`DVLA Handshake Error: ${response.status}`);
        return { data: await response.json() };
    }
};

// --- ENTERPRISE DESIGN SYSTEM (ORANGE, GREEN, BLACK) ---
const theme = {
    hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6',
    bg: '#000000', card: '#111111', text: '#f8fafc', border: '#333', danger: '#ef4444'
};

const s = {
    card: (color) => ({ background: theme.card, borderRadius: '18px', padding: '30px', marginBottom: '25px', border: `1px solid ${theme.border}`, borderTop: `10px solid ${color || theme.hub}`, boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '16px', borderRadius: '12px', marginBottom: '14px', outline: 'none', fontSize: '16px' },
    label: { color: '#94a3b8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '1.2px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 32px', borderRadius: '14px', fontWeight: '900', cursor: 'pointer', transition: '0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '3px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    // --- STATE MACHINE ---
    const [view, setView] = useState('AUTH'); // AUTH, HUB, EST, WORK, DEAL, FIN, SET
    const [loading, setLoading] = useState(false);
    const [calc, setCalc] = useState(false);

    // --- GLOBAL ENTERPRISE DATA ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', password: '1234', terms: 'Payment due strictly on collection.' 
    });

    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '', phone: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '', paintCode: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '', damageReport: '' },
        vault: { auth: '', sat: '', tc: '', photos: [], invoices: [] }
    });

    const [history, setHistory] = useState([]);
    const [expenditure, setExpenditure] = useState([]);

    // --- DATA HYDRATION ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const qJ = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        const qE = query(collection(db, 'expenditure'), orderBy('createdAt', 'desc'));
        const unsubJ = onSnapshot(qJ, snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        const unsubE = onSnapshot(qE, snap => setExpenditure(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        return () => { unsubJ(); unsubE(); };
    }, []);

    // --- HUB CALCULATIONS ---
    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const paintPrice = parseFloat(job.repair.paintMats || 0);
        const sub = pPrice + labPrice + paintPrice;
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        const excess = parseFloat(job.repair.excess || 0);
        return { total, sub, vat, customer: excess, insurer: total - excess, profit: total - (pCost + paintPrice), labHrs, labPrice };
    }, [job.repair, settings]);

    // --- DVLA & HANDSHAKE ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus, colour: d.colour}});
        } catch (e) { alert("DVLA Link Down. Manual Entry Engaged."); }
        setLoading(false);
    };

    const fileFlow = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if(path === 'branding') setSettings({...settings, logoUrl: url});
        else if(field === 'photos') setJob({...job, vault: {...job.vault, photos: [...job.vault.photos, url]}});
        else setJob({...job, vault: {...job.vault, [field]: url}});
    };

    // --- PAGES ---
    if (view === 'AUTH') return (
        <div style={{background:theme.bg, height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', padding:'40px'}}>
            <div style={{...s.card(theme.hub), width:'100%', maxWidth:'480px', textAlign:'center'}}>
                <h1 style={{color:theme.hub, fontSize:'34px', letterSpacing:'-2px'}}>TRIPLE MMM <span style={{color:'white'}}>SECURE</span></h1>
                <input type="password" id="sys_p" style={s.input} placeholder="Workshop Access Code" />
                <button style={{...s.btnG(theme.hub), width:'100%'}} onClick={() => document.getElementById('sys_p').value === settings.password ? setView('HUB') : alert("Denied")}>ACCESS WORKSHOP</button>
            </div>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '160px' }}>
            
            {/* CALCULATOR MODAL */}
            {calc && <div style={{position:'fixed', top:'10%', right:'5%', background:'#111', padding:'30px', border:'3px solid orange', zIndex:2000, borderRadius:'20px', boxShadow:'0 30px 60px #000'}}>
                <input id="clA" style={s.input} placeholder="Value A" /><input id="clB" style={s.input} placeholder="Value B" />
                <button style={s.btnG()} onClick={()=>alert("Total: " + (parseFloat(document.getElementById('clA').value) + parseFloat(document.getElementById('clB').value)))}>SUM TOTAL</button>
                <button onClick={()=>setCalc(false)} style={{...s.btnG(theme.danger), marginTop:'10px', width:'100%'}}>CLOSE</button>
            </div>}

            {/* MANAGEMENT HUB */}
            {view === 'HUB' && (
                <div className="no-print">
                    <h1 style={{color:theme.hub, fontSize:'30px'}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Technical Data Intake (DVLA)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input style={{...s.input, fontSize:'24px', fontWeight:'900', textAlign:'center', flex:2, marginBottom:0, border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="CHASSIS / VIN (MANUAL)" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', fontSize:'13px'}}>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}><span style={s.label}>Year</span>{job.vehicle.year}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}><span style={s.label}>MOT</span>{job.vehicle.mot}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}><span style={s.label}>Tax</span>{job.vehicle.tax}</div>
                        </div>
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Insurance & Client Stakeholders</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <hr style={{borderColor:theme.border, margin:'15px 0'}}/>
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                            <input style={s.input} placeholder="Network ID" value={job.insurance.network} onChange={e=>setJob({...job, insurance:{...job.insurance, network:e.target.value}})} />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'15px'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATOR (GREEN)</button>
                    </div>
                </div>
            )}

            {/* ESTIMATING ENGINE */}
            {view === 'EST' && (
                <div className="no-print">
                    <button onClick={()=>setView('HUB')} style={{background:'none', color:theme.hub, border:'none', marginBottom:'15px', fontWeight:'bold', cursor:'pointer'}}>← BACK TO HUB</button>
                    <h2 style={{color:theme.hub}}>ESTIMATING ENGINE: {job.vehicle.reg}</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Parts Matrix (Cost vs Markup)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input id="pD" style={{...s.input, flex:3, marginBottom:0}} placeholder="Part Name" />
                            <input id="pC" style={{...s.input, flex:1, marginBottom:0}} type="number" placeholder="Cost £" />
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
                        <span style={s.label}>Labour, Materials & Excess</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px'}}>
                            <input style={s.input} placeholder="MET Hrs" value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} />
                            <input style={s.input} placeholder="PANEL Hrs" value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} />
                            <input style={s.input} placeholder="PAINT Hrs" value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} />
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                            <input style={s.input} placeholder="Paint & Mats £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                            <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="DEDUCT EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        </div>
                    </div>
                    <div style={{...s.card(theme.deal), background:theme.deal, border:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{color:'white', opacity:0.8, fontSize:'10px'}}>INSURANCE BALANCE</span><h1 style={{margin:0}}>£{totals.insurer.toFixed(2)}</h1></div>
                            <button style={{background:'white', color:theme.deal, border:'none', padding:'14px 24px', borderRadius:'12px', fontWeight:'900'}} onClick={() => window.print()}>PRINT SPLIT INVOICE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SETTINGS (FIXED COMMAS) */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>SETTINGS</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Workshop Configuration</span>
                        <input style={s.input} placeholder="Labour Rate £/hr" value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} />
                        <input style={s.input} placeholder="Parts Markup %" value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} />
                        <input style={s.input} placeholder="Logo URL" value={settings.logoUrl} onChange={e=>setSettings({...settings, logoUrl:e.target.value})} />
                        <button style={{...s.btnG(theme.set), width:'100%'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved"); }}>SAVE SETTINGS (GREEN)</button>
                    </div>
                </div>
            )}

            {/* DOCK BAR */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'90px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'90px'}}>EST</button>
                <button onClick={()=>setView('WORK')} style={{...s.btnG(theme.work), minWidth:'90px'}}>WORK</button>
                <button onClick={()=>setView('DEAL')} style={{...s.btnG(theme.deal), minWidth:'90px'}}>DEAL</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'90px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'90px'}}>SET</button>
                <button style={s.btnG()} onClick={()=>setCalc(!calc)}>🧮</button>
                <button style={{...s.btnG(theme.deal), minWidth:'140px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Synced Successfully");
                }}>SAVE ALL</button>
            </div>

            {/* PRINT VIEW (COUNTINGUP STYLE) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'50px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'5px solid #f97316', paddingBottom:'25px'}}>
                    <div>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'100px'}} />}<h1>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'#f97316', fontSize:'40px'}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {job.vehicle.reg}</p></div>
                </div>
                <h3 style={{marginTop:'45px', background:'#f9f9f9', padding:'20px', borderLeft:'8px solid orange'}}>Vehicle: {job.vehicle.make} | Chassis: {job.vehicle.vin}</h3>
                <table style={{width:'100%', marginTop:'35px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'3px solid #ddd'}}><th style={{padding:'18px', textAlign:'left'}}>Description</th><th style={{padding:'18px', textAlign:'right'}}>Total</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                    </tbody>
                </table>
                <div style={{textAlign:'right', marginTop:'45px'}}>
                    <h1 style={{color:'#f97316', fontSize:'45px'}}>TOTAL: £{totals.total.toFixed(2)}</h1>
                    <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', marginTop:'40px', textAlign:'left', borderRadius:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'25px'}}>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', marginTop:'15px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'35px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
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
