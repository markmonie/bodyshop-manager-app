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
    
    // --- PERSISTENT DATA CORE ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Warranty: 12 Months. Payment strictly due on collection.' 
    });

    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', phone: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '', paintCode: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { expenses: [] }
    });
    
    const [history, setHistory] = useState([]);

    // --- IRONCLAD PERSISTENCE ---
    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const savedJob = localStorage.getItem('triple_mmm_active_job');
        if (savedJob) setJob(JSON.parse(savedJob));
        const qJ = query(collection(db, 'estimates'), orderBy('createdAt', 'desc'));
        onSnapshot(qJ, snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
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

    // --- HANDLERS ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob(prev => ({...prev, vehicle: {...prev.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, colour: d.colour, mot: d.motStatus}}));
        } catch (e) { alert("DVLA Link Down."); }
        setLoading(false);
    };

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

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '140px' }}>
            
            {/* CALCULATOR */}
            {calc && <div style={{position:'fixed', top:'10%', right:'5%', background:'#111', padding:'30px', border:'3px solid orange', zIndex:2000, borderRadius:'20px'}}>
                <input id="v1" style={s.input} placeholder="Val 1" /> <input id="v2" style={s.input} placeholder="Val 2" />
                <button style={s.btnG(theme.hub)} onClick={()=>alert("Total: " + (parseFloat(document.getElementById('v1').value) + parseFloat(document.getElementById('v2').value)))}>+</button>
                <button onClick={()=>setCalc(false)} style={{...s.btnG(theme.danger), marginTop:'10px', width:'100%'}}>CLOSE</button>
            </div>}

            {/* HUB */}
            {view === 'HUB' && (
                <div>
                    <h1 style={{color:theme.hub}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Technical Intake (DVLA)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:2, fontSize:'24px', fontWeight:'900', textAlign:'center', border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="VIN / Chassis" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Customer & Insurance Profiles</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'10px'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATE (GREEN)</button>
                    </div>
                </div>
            )}

            {/* ESTIMATOR */}
            {view === 'EST' && (
                <div>
                    <h2 style={{color:theme.hub}}>ESTIMATOR: {job.vehicle.reg}</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Parts Management</span>
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
                        <span style={s.label}>Labour Breakdown</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="MET" value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} />
                            <input style={s.input} placeholder="PANEL" value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} />
                            <input style={s.input} placeholder="PAINT" value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} />
                        </div>
                        <input style={{...s.input, color:theme.danger, fontWeight:'bold', marginTop:'10px'}} placeholder="DEDUCT EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        <button style={{...s.btnG(theme.deal), width: '100%', marginTop:'10px'}} onClick={() => window.print()}>GENERATE OFFICIAL INVOICE</button>
                    </div>
                </div>
            )}

            {/* FINANCE */}
            {view === 'FIN' && (
                <div>
                    <h1 style={{color:theme.fin}}>FINANCE VAULT</h1>
                    <div style={s.card(theme.fin)}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'25px'}}>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Gross Income</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Profit Margins</span><h2 style={{margin:0, color:theme.deal}}>£{history.reduce((a,b)=>a+(b.totals?.profit||0),0).toFixed(2)}</h2></div>
                        </div>
                        <span style={s.label}>Log Supplier Receipt (Photo)</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} style={{marginBottom:'15px'}} />
                        <button style={{...s.btnG(theme.fin), width:'100%'}} onClick={() => alert("CSV Exporting...")}>DOWNLOAD REVENUE CSV</button>
                    </div>
                </div>
            )}

            {/* RECENT JOBS */}
            {view === 'RECENT' && (
                <div>
                    <h1 style={{color:theme.hub}}>RECENT JOBS</h1>
                    {history.map((h, i) => (
                        <div key={i} style={s.card('#444')}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div><h3 style={{margin:0}}>{h.vehicle?.reg}</h3><p style={{margin:0, fontSize:'12px'}}>{h.client?.name}</p></div>
                                <button style={s.btnG(theme.deal)} onClick={()=>{setJob(h); setView('HUB');}}>LOAD JOB</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* SETTINGS */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>SETTINGS</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Logo & QR (Upload Files)</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} />
                        <span style={s.label} style={{marginTop:'15px'}}>PayPal QR Code</span>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'paypalQr')} />
                        <hr style={{borderColor:'#333', margin:'20px 0'}}/>
                        <input style={s.input} placeholder="Bank Details" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                        <textarea style={{...s.input, height:'100px'}} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} placeholder="T&Cs" />
                        <button style={{...s.btnG(theme.set), width:'100%', marginTop:'10px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved"); }}>SAVE MASTER CONFIG</button>
                    </div>
                </div>
            )}

            {/* DOCK BAR */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                <button onClick={()=>setView('RECENT')} style={{...s.btnG('#444'), minWidth:'80px'}}>JOBS</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'80px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'80px'}}>SET</button>
                <button style={s.btnG('#333')} onClick={()=>setCalc(!calc)}>🧮</button>
                <button style={{...s.btnG(theme.deal), minWidth:'150px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM Cloud Synced");
                }}>SAVE MASTER</button>
            </div>

            {/* --- MASTER INVOICE (RE-AUDITED) --- */}
            <div className="print-only" style={{display:'none', color:'black', padding:'60px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'6px solid #f97316', paddingBottom:'30px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'100px', marginBottom:'15px'}} />}
                        <h1 style={{margin:0, color:'#f97316', fontSize:'36px'}}>{settings.coName}</h1>
                        <p>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', fontSize:'48px', margin:0}}>INVOICE</h2>
                        <p style={{marginTop:'15px'}}><strong>ID:</strong> {job.vehicle.reg}-{new Date().getFullYear()}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop:'40px', display:'flex', justifyContent:'space-between'}}>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'20px', borderRadius:'15px'}}><strong>Customer:</strong><br/>{job.client.name}<br/>{job.client.address}</div>
                    <div style={{width:'48%', border:'1px solid #ddd', padding:'20px', borderRadius:'15px'}}><strong>Claim Data:</strong><br/>{job.insurance.co}<br/>Claim #: {job.insurance.claim}</div>
                </div>
                <table style={{width:'100%', marginTop:'40px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'4px solid #ddd'}}><th style={{padding:'18px', textAlign:'left'}}>Repair Item</th><th style={{padding:'18px', textAlign:'right'}}>Total</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>Labour Breakdown ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'18px'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:'40px'}}>
                    <div style={{width:'40%'}}>
                        {settings.paypalQr && <img src={settings.paypalQr} style={{height:'120px'}} />}
                        <p style={{fontSize:'12px', marginTop:'10px'}}><strong>Terms:</strong> {settings.terms}</p>
                    </div>
                    <div style={{width:'50%', textAlign:'right'}}>
                        <h1 style={{color:'#f97316', fontSize:'48px'}}>£{totals.total.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', borderRadius:'20px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>CLIENT EXCESS:</span><strong>£{totals.customer.toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'3px solid #f97316', paddingTop:'15px'}}><span>INSURER BALANCE:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                        </div>
                    </div>
                </div>
                <div style={{marginTop:'80px', borderTop:'1px solid #eee', paddingTop:'20px'}}><strong>Bank Details:</strong> {settings.bank}</div>
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
