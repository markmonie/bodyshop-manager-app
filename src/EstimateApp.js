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

// --- DESIGN SYSTEM (ORANGE, GREEN, BLACK) ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '20px', padding: '30px', marginBottom: '25px', border: `1px solid ${theme.border}`, borderTop: `10px solid ${color || theme.hub}`, boxShadow: '0 15px 50px rgba(0,0,0,0.8)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '16px', borderRadius: '12px', marginBottom: '14px', outline: 'none', fontSize: '16px' },
    label: { color: '#94a3b8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '1px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 32px', borderRadius: '15px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: '0.2s' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '3px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [calc, setCalc] = useState(false);
    
    // --- PERSISTENT DATA STATE ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Payment strictly due on collection. 12-month warranty on paint and panel work.' 
    });

    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', phone: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '', paintCode: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '', damageReport: '' },
        vault: { expenses: [] }
    });
    
    const [history, setHistory] = useState([]);

    // --- IRONCLAD PERSISTENCE ENGINE ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const savedJob = localStorage.getItem('triple_mmm_active_job');
        if (savedJob) setJob(JSON.parse(savedJob));
        const q = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        onSnapshot(q, snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('triple_mmm_active_job', JSON.stringify(job)); }, [job]);

    // --- MATH ENGINE ---
    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const sub = partsPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        return { total, sub, vat, customer: parseFloat(job.repair.excess || 0), insurer: total - parseFloat(job.repair.excess || 0), profit: total - (partsCost + parseFloat(job.repair.paintMats || 0)), labHrs, labPrice };
    }, [job.repair, settings]);

    // --- CORE HANDLERS ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob(prev => ({...prev, vehicle: {...prev.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, colour: d.colour, engine: d.engineCapacity}}));
        } catch (e) { alert("DVLA Link Down - Entering Manual Mode"); }
        setLoading(false);
    };

    const handleUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else if (field === 'expenses') setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...prev.vault.expenses, url]}}));
        setLoading(false);
    };

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '140px' }}>
            
            {calc && <div style={{position:'fixed', top:'10%', right:'5%', background:'#111', padding:'30px', border:'3px solid orange', zIndex:2000, borderRadius:'20px'}}>
                <input id="v1" style={s.input} placeholder="Val 1" /> <input id="v2" style={s.input} placeholder="Val 2" />
                <button style={s.btnG(theme.hub)} onClick={()=>alert("Total: " + (parseFloat(document.getElementById('v1').value) + parseFloat(document.getElementById('v2').value)))}>+</button>
                <button onClick={()=>setCalc(false)} style={{...s.btnG(theme.danger), marginTop:'10px', width:'100%'}}>CLOSE</button>
            </div>}

            {/* MANAGEMENT HUB - THE BRAIN */}
            {view === 'HUB' && (
                <div>
                    <h1 style={{color:theme.hub, fontSize:'32px', letterSpacing:'-2px'}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Technical Data Intake (DVLA)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:2, fontSize:'24px', fontWeight:'900', textAlign:'center', border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'PULL DATA'}</button>
                        </div>
                        <input style={s.input} placeholder="Chassis / VIN (Manual Input)" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'13px', opacity:0.8}}>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>Year: {job.vehicle.year}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>Make: {job.vehicle.make}</div>
                        </div>
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Full Insurance & Client Meta</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Client Address" value={job.client.address} onChange={e=>setJob({...job, client:{...job.client, address:e.target.value}})} />
                        <input style={s.input} placeholder="Insurance Co" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                            <input style={s.input} placeholder="Network ID" value={job.insurance.network} onChange={e=>setJob({...job, insurance:{...job.insurance, network:e.target.value}})} />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'10px'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATOR (GREEN)</button>
                    </div>
                </div>
            )}

            {/* ESTIMATING ENGINE */}
            {view === 'EST' && (
                <div>
                    <h2 style={{color:theme.hub}}>ESTIMATOR: {job.vehicle.reg}</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Parts Matrix (Cost + Markup)</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                            <input id="pD" style={{...s.input, flex:3}} placeholder="Part Name" />
                            <input id="pC" style={{...s.input, flex:1}} type="number" placeholder="Cost £" />
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
                        <span style={s.label}>Labor Allocation (MET/Panel/Paint)</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="MET" value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} />
                            <input style={s.input} placeholder="PANEL" value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} />
                            <input style={s.input} placeholder="PAINT" value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} />
                        </div>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Materials £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                            <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="Deduct Excess -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        </div>
                    </div>
                    <div style={{...s.card(theme.deal), background:theme.deal, border:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{color:'white', opacity:0.8, fontSize:'10px'}}>INSURER BALANCE DUE</span><h1 style={{margin:0}}>£{totals.insurer.toFixed(2)}</h1></div>
                            <button style={{background:'white', color:theme.deal, border:'none', padding:'15px 25px', borderRadius:'12px', fontWeight:'900'}} onClick={() => window.print()}>PRINT SPLIT INVOICE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* INTERACTIVE WORKSHOP JOB CARD */}
            {view === 'WORK' && (
                <div>
                    <h1 style={{color:theme.work}}>WORKSHOP JOBSHEET</h1>
                    <div style={s.card(theme.work)}>
                        <span style={s.label}>Vehicle: {job.vehicle.reg}</span>
                        <h3>{job.vehicle.make} | {job.vehicle.colour}</h3>
                        <p>VIN: {job.vehicle.vin}</p>
                        <hr style={{borderColor:'#333', margin:'20px 0'}}/>
                        <span style={s.label}>Technician Damage/Supplement Report</span>
                        <textarea style={{...s.input, height:'200px'}} value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} placeholder="Report hidden damage, missing clips, or supplement requirements..." />
                        <a href="https://www.partslink24.com" target="_blank" style={{color:theme.work, fontSize:'12px'}}>Manufacturer Parts Database →</a>
                    </div>
                </div>
            )}

            {/* FINANCE COMMAND CENTER */}
            {view === 'FIN' && (
                <div>
                    <h1 style={{color:theme.fin}}>FINANCIAL CONTROL</h1>
                    <div style={s.card(theme.fin)}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'25px'}}>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Net Revenue (Invoices)</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Logged Expenses</span><h2 style={{margin:0, color:theme.danger}}>{job.vault.expenses.length} Receipts</h2></div>
                        </div>
                        <span style={s.label}>Capture Expenditure Photo (Receipt)</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} style={{marginBottom:'15px'}} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <button style={s.btnG(theme.fin)} onClick={() => alert("Income CSV Exporting...")}>INCOME CSV</button>
                            <button style={s.btnG(theme.danger)} onClick={() => alert("Expense CSV Exporting...")}>EXPENSE CSV</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ENTERPRISE SETTINGS */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>MASTER SETTINGS</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Branding Logo (File Upload)</span>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'60px', marginBottom:'15px'}} />}
                        <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} />
                        
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginTop:'25px'}}>
                            <div><span style={s.label}>Labour Rate £/hr</span><input style={s.input} value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} /></div>
                            <div><span style={s.label}>Parts Markup %</span><input style={s.input} value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} /></div>
                        </div>
                        
                        <span style={s.label}>DVLA API Management</span>
                        <input style={s.input} value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} placeholder="API Key" />
                        
                        <span style={s.label}>Terms & Conditions Editor</span>
                        <textarea style={{...s.input, height:'120px'}} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} />
                        
                        <button style={{...s.btnG(theme.set), width:'100%', marginTop:'15px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Enterprise Config Saved"); }}>SAVE ALL (GREEN)</button>
                    </div>
                </div>
            )}

            {/* SCROLLING NAVIGATION DOCK */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'90px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'90px'}}>EST</button>
                <button onClick={()=>setView('WORK')} style={{...s.btnG(theme.work), minWidth:'90px'}}>WORK</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'90px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'90px'}}>SET</button>
                <button style={s.btnG('#333')} onClick={()=>setCalc(!calc)}>🧮</button>
                <button style={{...s.btnG(theme.deal), minWidth:'150px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Synced to Triple MMM Cloud");
                }}>SAVE MASTER</button>
            </div>

            {/* PRINT VIEW (OFFICIAL SPLIT INVOICE) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'50px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'5px solid #f97316', paddingBottom:'25px'}}>
                    <div>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'100px'}} />}<h1 style={{margin:0, color:'#f97316'}}>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'#f97316', fontSize:'42px', margin:0}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {job.vehicle.reg}</p></div>
                </div>
                <div style={{marginTop:'40px', display:'flex', justifyContent:'space-between'}}>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'20px', borderRadius:'15px'}}><strong>Customer:</strong><br/>{job.client.name}<br/>{job.client.address}</div>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'20px', borderRadius:'15px'}}><strong>Insurance:</strong><br/>{job.insurance.co}<br/>Claim #: {job.insurance.claim}<br/>Network ID: {job.insurance.network}</div>
                </div>
                <h3 style={{marginTop:'40px', background:'#f9f9f9', padding:'20px', borderLeft:'8px solid #f97316'}}>Repair Details: {job.vehicle.make} | {job.vehicle.vin}</h3>
                <table style={{width:'100%', marginTop:'35px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#eee'}}><th style={{padding:'18px', textAlign:'left'}}>Description</th><th style={{padding:'18px', textAlign:'right'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                    </tbody>
                </table>
                <div style={{textAlign:'right', marginTop:'45px'}}>
                    <h1 style={{color:'#f97316', fontSize:'45px'}}>TOTAL: £{totals.total.toFixed(2)}</h1>
                    <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', marginTop:'40px', textAlign:'left', borderRadius:'20px'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'25px'}}>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', marginTop:'15px', borderTop:'3px solid #f97316', paddingTop:'15px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'35px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
                <div style={{marginTop:'100px', borderTop:'1px solid #eee', paddingTop:'30px', fontSize:'13px'}}>
                    <strong>Bank:</strong> {settings.bank} | <strong>Warranty:</strong> {settings.terms}
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
