import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- MASTER ENTERPRISE CONFIGURATION ---
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

// --- DVLA API HANDSHAKE ---
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

// --- ENTERPRISE DESIGN SYSTEM ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '24px', padding: '35px', marginBottom: '25px', border: `1px solid ${theme.border}`, borderTop: `12px solid ${color || theme.hub}`, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '18px', borderRadius: '15px', marginBottom: '16px', outline: 'none', fontSize: '16px' },
    label: { color: '#94a3b8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '1.5px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 32px', borderRadius: '18px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: '0.2s' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '25px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '3px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    
    // --- PERSISTENT DATA CORE ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', terms: 'Standard 12-Month Warranty. Payment due on collection.' 
    });

    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', phone: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { photos: [], satNote: '', expenses: [], invoices: [] }
    });
    
    const [history, setHistory] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_master_v29');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_master_v29', JSON.stringify(job)); }, [job]);

    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const sub = partsPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        const customer = parseFloat(job.repair.excess || 0);
        return { total, sub, vat, customer, insurer: total - customer, profit: total - (partsCost + parseFloat(job.repair.paintMats || 0)), labHrs, labPrice };
    }, [job.repair, settings]);

    // --- CORE HANDLERS ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob(prev => ({...prev, vehicle: {...prev.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus}}));
        } catch (e) { alert("DVLA Handshake Failed."); }
        setLoading(false);
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else setJob(prev => ({...prev, vault: {...prev.vault, [field]: field === 'photos' ? [...prev.vault.photos, url] : url}}));
        setLoading(false);
    };

    const saveMaster = async () => {
        const invoiceSnapshot = { date: new Date().toLocaleDateString(), total: totals.total, insurer: totals.insurer, customer: totals.customer };
        const updatedJob = { ...job, totals, vault: { ...job.vault, invoices: [...(job.vault.invoices || []), invoiceSnapshot] }, createdAt: serverTimestamp() };
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), updatedJob);
        alert("Triple MMM Cloud Synced & Invoice Archived");
    };

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '140px' }}>
            
            {/* VIEW 1: HUB */}
            {view === 'HUB' && (
                <div>
                    <h1 style={{color:theme.hub, fontSize:'32px'}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Technical Vehicle Identification (DVLA)</span>
                        <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:2, fontSize:'24px', fontWeight:'900', textAlign:'center', border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Manual VIN / Chassis" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'13px', opacity:0.8}}>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>Make: {job.vehicle.make}</div>
                            <div style={{background:'#222', padding:'12px', borderRadius:'10px'}}>MOT: {job.vehicle.mot}</div>
                        </div>
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Stakeholder Profiles</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <button style={{...s.btnG(theme.deal), width:'100%', marginTop:'10px'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATOR (GREEN)</button>
                    </div>
                </div>
            )}

            {/* VIEW 2: ESTIMATOR */}
            {view === 'EST' && (
                <div>
                    <h2 style={{color:theme.hub}}>ESTIMATOR: {job.vehicle.reg}</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Labour Hours Allocation</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                            <div><span style={s.label}>MET</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                            <div><span style={s.label}>Panel</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                            <div><span style={s.label}>Paint</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                        </div>
                        <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="DEDUCT EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                        <button style={{...s.btnG(theme.deal), width: '100%', marginTop:'10px'}} onClick={() => window.print()}>PRINT OFFICIAL INVOICE</button>
                    </div>
                </div>
            )}

            {/* VIEW 3: WORKSHOP CARD */}
            {view === 'WORK' && (
                <div>
                    <h1 style={{color:theme.work}}>WORKSHOP JOBSHEET</h1>
                    <div style={s.card(theme.work)}>
                        <h3>{job.vehicle.reg} | {job.vehicle.make}</h3>
                        <p>VIN: {job.vehicle.vin} | Colour: {job.vehicle.colour}</p>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', background:'#000', padding:'20px', borderRadius:'15px', border:'1px solid #333', margin:'20px 0'}}>
                            <div><span style={s.label}>MET</span>{job.repair.metHrs}h</div>
                            <div><span style={s.label}>Panel</span>{job.repair.panelHrs}h</div>
                            <div><span style={s.label}>Paint</span>{job.repair.paintHrs}h</div>
                        </div>
                        <textarea style={{...s.input, height:'180px'}} value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} placeholder="Log damage reports..." />
                    </div>
                </div>
            )}

            {/* VIEW 4: DEAL FOLDER */}
            {view === 'DEAL' && (
                <div>
                    <h1 style={{color:theme.deal}}>DEAL FOLDER</h1>
                    <div style={s.card(theme.deal)}>
                        <span style={s.label}>Archived Invoices (Auto-Imported)</span>
                        <div style={{background:'#000', padding:'15px', borderRadius:'12px', marginBottom:'20px', fontSize:'13px'}}>
                            {(job.vault.invoices || []).length > 0 ? job.vault.invoices.map((inv, idx) => (
                                <div key={idx} style={{borderBottom:'1px solid #333', padding:'10px 0', display:'flex', justifyContent:'space-between'}}>
                                    <span>{inv.date}</span><span>£{inv.total?.toFixed(2)}</span>
                                </div>
                            )) : <p>No invoices saved to this folder yet.</p>}
                        </div>
                        <span style={s.label}>Submission Assets</span>
                        <input type="file" multiple onChange={(e) => handleFileUpload(e, 'claims', 'photos')} style={{marginBottom:'20px'}} />
                        <input type="file" onChange={(e) => handleFileUpload(e, 'claims', 'satNote')} />
                    </div>
                </div>
            )}

            {/* VIEW 5: RECENT JOBS */}
            {view === 'RECENT' && (
                <div>
                    <h1 style={{color:theme.hub}}>RECENT JOBS</h1>
                    {history.map((h, i) => (
                        <div key={i} style={s.card('#444')}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                <div><h3 style={{margin:0}}>{h.vehicle?.reg}</h3><p style={{margin:0, fontSize:'12px'}}>{h.client?.name}</p></div>
                                <div style={{display:'flex', gap:'10px'}}>
                                    <button style={s.btnG(theme.deal)} onClick={()=>{setJob(h); setView('HUB');}}>LOAD</button>
                                    <button style={{...s.btnG(theme.danger), padding:'12px 20px'}} onClick={async () => { if(window.confirm("Wipe?")) await deleteDoc(doc(db, 'estimates', h.id)); }}>X</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* VIEW 6: FINANCE */}
            {view === 'FIN' && (
                <div>
                    <h1 style={{color:theme.fin}}>FINANCE VAULT</h1>
                    <div style={s.card(theme.fin)}>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'25px'}}>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Gross Income</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Receipts</span><h2 style={{margin:0, color:theme.danger}}>{job.vault.expenses.length}</h2></div>
                        </div>
                        <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} />
                    </div>
                </div>
            )}

            {/* VIEW 7: SETTINGS (EXECUTIVE ASSET GRID) */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>MASTER SETTINGS</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Executive Branding Grid</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', background:'#000', padding:'25px', borderRadius:'15px', border:'1px solid #333', marginBottom:'25px'}}>
                            <div>
                                <span style={s.label}>Business Logo</span>
                                {settings.logoUrl && <img src={settings.logoUrl} style={{height:'45px', marginBottom:'10px', display:'block'}} />}
                                <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} style={{fontSize:'11px'}} />
                            </div>
                            <div>
                                <span style={s.label}>PayPal QR Code</span>
                                {settings.paypalQr && <img src={settings.paypalQr} style={{height:'45px', marginBottom:'10px', display:'block'}} />}
                                <input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'paypalQr')} style={{fontSize:'11px'}} />
                            </div>
                        </div>
                        <input style={s.input} placeholder="Company Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                        <input style={s.input} placeholder="Address" value={settings.address} onChange={e=>setSettings({...settings, address:e.target.value})} />
                        <input style={s.input} placeholder="Bank Details" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                        <textarea style={{...s.input, height:'100px'}} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} placeholder="Warranty" />
                        <button style={{...s.btnG(theme.set), width:'100%'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Master Confirmed."); }}>SAVE ALL SETTINGS (GREEN)</button>
                    </div>
                </div>
            )}

            {/* DOCK */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                <button onClick={()=>setView('WORK')} style={{...s.btnG(theme.work), minWidth:'80px'}}>JOB</button>
                <button onClick={()=>setView('DEAL')} style={{...s.btnG(theme.deal), minWidth:'80px'}}>DEAL</button>
                <button onClick={()=>setView('RECENT')} style={{...s.btnG('#333'), minWidth:'80px'}}>JOBS</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'80px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'80px'}}>SET</button>
                <button style={{...s.btnG(theme.deal), minWidth:'150px'}} onClick={saveMaster}>SAVE MASTER</button>
            </div>

            {/* --- MASTER CLEAN PRINT VIEW (RE-ENGINEERED TECHNICAL BLOCK) --- */}
            <div className="print-only" style={{display:'none', color:'black', padding:'70px', fontFamily:'Arial, sans-serif'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'6px solid #f97316', paddingBottom:'35px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'120px', marginBottom:'15px'}} />}
                        <h1 style={{margin:0, color:'#f97316', fontSize:'38px', fontWeight:'900'}}>{settings.coName}</h1>
                        <p style={{fontSize:'15px', lineHeight:'1.6'}}>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', fontSize:'48px', margin:0}}>INVOICE</h2>
                        <p style={{marginTop:'15px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>

                <div style={{marginTop:'35px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'40px'}}>
                    <div style={{background:'#f9f9f9', padding:'25px', borderRadius:'15px', border:'1px solid #ddd'}}>
                        <span style={{fontSize:'10px', fontWeight:'900', color:'#888', textTransform:'uppercase'}}>Client Details</span>
                        <h3 style={{margin:'10px 0'}}>{job.client.name}</h3>
                        <p style={{margin:0, fontSize:'14px'}}>{job.client.address}</p>
                    </div>
                    {/* ENHANCED TECHNICAL BLOCK */}
                    <div style={{background:'#f9f9f9', padding:'25px', borderRadius:'15px', border:'1px solid #ddd'}}>
                        <span style={{fontSize:'10px', fontWeight:'900', color:'#888', textTransform:'uppercase'}}>Technical Vehicle Specification</span>
                        <h3 style={{margin:'10px 0', color:'#f97316'}}>{job.vehicle.reg}</h3>
                        <div style={{fontSize:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', color:'#333'}}>
                            <span><strong>Make:</strong> {job.vehicle.make || '-'}</span>
                            <span><strong>Year:</strong> {job.vehicle.year || '-'}</span>
                            <span><strong>Fuel:</strong> {job.vehicle.fuel || '-'}</span>
                            <span><strong>MOT:</strong> {job.vehicle.mot || '-'}</span>
                            <span><strong>Engine:</strong> {job.vehicle.engine || '-'}</span>
                            <span><strong>Colour:</strong> {job.vehicle.colour || '-'}</span>
                            <span style={{gridColumn:'span 2'}}><strong>VIN:</strong> {job.vehicle.vin || 'Not Provided'}</span>
                        </div>
                    </div>
                </div>

                <div style={{marginTop:'30px', fontWeight:'bold', textTransform:'uppercase', fontSize:'11px', color:'#777'}}>Technician Supplement Findings:</div>
                <div style={{minHeight:'60px', border:'1px solid #eee', padding:'15px', marginTop:'10px', borderRadius:'10px', fontSize:'14px', fontStyle:'italic'}}>{job.repair.techNotes || 'Standard repair procedure.'}</div>

                <table style={{width:'100%', marginTop:'30px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'4px solid #ddd'}}><th style={{padding:'18px', textAlign:'left'}}>Description of Services & Parts</th><th style={{padding:'18px', textAlign:'right'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px', fontWeight:'bold'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>Qualified Bodywork Labour ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'18px', fontWeight:'bold'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>

                <div style={{display:'flex', justifyContent:'space-between', marginTop:'40px'}}>
                    <div>{settings.paypalQr && <img src={settings.paypalQr} style={{height:'150px'}} />}</div>
                    <div style={{width:'55%', textAlign:'right'}}>
                        <h1 style={{color:'#f97316', fontSize:'52px', margin:'0 0 20px 0'}}>£{totals.total.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', borderRadius:'25px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'12px', fontSize:'15px'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'22px'}}>£{totals.customer.toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'3px solid #f97316', paddingTop:'20px', fontSize:'15px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'34px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                        </div>
                    </div>
                </div>
                <div style={{marginTop:'80px', borderTop:'1px solid #eee', paddingTop:'30px', fontSize:'13px'}}>Bank: {settings.bank} | Warranty: {settings.terms}</div>
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
