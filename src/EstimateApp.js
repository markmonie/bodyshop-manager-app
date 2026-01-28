import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc } from 'firebase/firestore';
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

// --- ENTERPRISE DESIGN SYSTEM ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '24px', padding: '30px', marginBottom: '25px', border: `1px solid ${theme.border}`, borderTop: `10px solid ${color || theme.hub}`, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '16px', borderRadius: '14px', marginBottom: '14px', outline: 'none', fontSize: '16px' },
    label: { color: '#94a3b8', fontSize: '12px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '1.2px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 32px', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: '0.2s' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '20px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: '3px solid #333', zIndex: 1000, justifyContent: 'center' }
};

// --- NATIVE SIGNATURE ENGINE ---
const NativeSignature = ({ onSave }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const getXY = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        return { x: clientX - rect.left, y: clientY - rect.top };
    };
    const start = (e) => {
        const { x, y } = getXY(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    const move = (e) => { if (!isDrawing) return; const { x, y } = getXY(e); canvasRef.current.getContext('2d').lineTo(x, y); canvasRef.current.getContext('2d').stroke(); };
    const end = () => { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); };
    return (
        <div style={{ background: '#fff', borderRadius: '15px', padding: '10px' }}>
            <canvas ref={canvasRef} width={400} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: '100%', height: '180px', touchAction: 'none' }} />
            <button style={{ ...s.btnG('#222'), width: '100%', marginTop: '10px', padding: '12px' }} onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,400,200); onSave(''); }}>RESET PAD</button>
        </div>
    );
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [addressBook, setAddressBook] = useState([]);
    
    // --- PERSISTENT DATA CORE ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Standard 12-Month Bodywork Warranty.',
        calId: 'markmonie72@gmail.com'
    });

    const INITIAL_JOB = {
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', phone: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { photos: [], signature: '', expenses: [], invoices: [] },
        booking: { date: '', time: '' }
    };

    const [job, setJob] = useState(INITIAL_JOB);
    const [history, setHistory] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v48_MASTER_LOCKED');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        onSnapshot(collection(db, 'addressBook'), snap => setAddressBook(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v48_MASTER_LOCKED', JSON.stringify(job)); }, [job]);

    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const sub = partsPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const total = sub * (1 + (parseFloat(settings.vatRate) / 100));
        const customer = parseFloat(job.repair.excess || 0);
        return { total, sub, customer, insurer: total - customer, profit: total - (partsCost + parseFloat(job.repair.paintMats || 0)), labHrs, labPrice };
    }, [job.repair, settings]);

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
        else if (path === 'finances') setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev.vault.expenses || []), url]}}));
        else if (field === 'photos') setJob(prev => ({...prev, vault: {...prev.vault, photos: [...prev.vault.photos, url]}}));
        else setJob(prev => ({...prev, vault: {...prev.vault, [field]: url}}));
        setLoading(false);
    };

    const saveMaster = async () => {
        const snap = { date: new Date().toLocaleDateString(), total: totals.total, insurer: totals.insurer, type: docType };
        const updatedJob = { ...job, totals, vault: { ...job.vault, invoices: [...(job.vault.invoices || []), snap] }, createdAt: serverTimestamp() };
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), updatedJob);
        alert("Synced & Snapshot Archived");
    };

    const addToAddressBook = async () => {
        if (job.client.name && (job.client.email || job.client.phone)) {
            await addDoc(collection(db, 'addressBook'), { name: job.client.name, email: job.client.email, phone: job.client.phone });
            alert("Contact Added");
        }
    };

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '140px' }}>
            
            <div className="no-print">
                {/* HUB */}
                {view === 'HUB' && (
                    <div>
                        <h1 style={{color:theme.hub, letterSpacing:'-2px'}}>MANAGEMENT HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>1. Technical Identification</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                                <input style={{...s.input, flex:2, fontSize:'24px', fontWeight:'900', textAlign:'center', border:`2px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), width:'120px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            <div style={{display:'flex', gap:'10px'}}>
                                <input style={{...s.input, flex:3}} placeholder="Manual VIN" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                                <button style={{...s.btnG(theme.set), padding:'12px'}} onClick={() => window.open(`https://www.google.com/search?q=${job.vehicle.make}+workshop+manual+${job.vehicle.year}`, '_blank')}>MANUAL</button>
                                <button style={{...s.btnG(theme.work), padding:'12px'}} onClick={() => window.open(`https://www.google.com/search?q=${job.vehicle.vin}+parts+lookup`, '_blank')}>PARTS</button>
                            </div>
                        </div>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>2. Address Book & Stakeholders</span>
                            <div style={{background:'#000', padding:'15px', borderRadius:'12px', border:'1px solid #333', marginBottom:'15px', height:'120px', overflowY:'auto'}}>
                                {addressBook.map((contact, i) => (
                                    <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #222', fontSize:'13px'}}>
                                        <span>{contact.name}</span>
                                        <button style={{color:theme.deal, background:'none', border:'none', fontWeight:'900', cursor:'pointer'}} onClick={() => setJob({...job, client: {...job.client, name: contact.name, email: contact.email, phone: contact.phone}})}>IMPORT</button>
                                    </div>
                                ))}
                            </div>
                            <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                            <input style={s.input} placeholder="Insurance Co" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                            <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATOR</button>
                            <button style={{color:'#94a3b8', background:'none', border:'none', fontSize:'11px', marginTop:'10px', width:'100%'}} onClick={addToAddressBook}>+ SAVE TO ADDRESS BOOK</button>
                        </div>
                    </div>
                )}

                {/* ESTIMATOR */}
                {view === 'EST' && (
                    <div>
                        <h2 style={{color:theme.hub}}>ESTIMATING: {job.vehicle.reg}</h2>
                        <div style={{background:'#222', padding:'15px', borderRadius:'15px', display:'flex', justifyContent:'space-between', marginBottom:'20px', fontSize:'12px', color:'#999'}}>
                            <span>Make: {job.vehicle.make || '-'}</span>
                            <span>Fuel: {job.vehicle.fuel || '-'}</span>
                            <span>MOT: {job.vehicle.mot || '-'}</span>
                        </div>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>1. Labour Hours</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} placeholder="MET" />
                                <input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} placeholder="PANEL" />
                                <input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} placeholder="PAINT" />
                            </div>
                            <span style={s.label}>2. Parts Matrix Grid</span>
                            <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                                <input id="pD" style={{...s.input, flex:3}} placeholder="Part Name" />
                                <input id="pC" style={{...s.input, flex:1}} type="number" placeholder="£ Cost" />
                                <button style={s.btnG(theme.deal)} onClick={()=>{
                                    const d=document.getElementById('pD'), c=document.getElementById('pC');
                                    if(d.value && c.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:d.value, cost:c.value}]}});
                                    d.value=''; c.value='';
                                }}>+</button>
                            </div>
                            <div style={{background:'#000', padding:'20px', borderRadius:'15px', border:'1px solid #333', marginBottom:'15px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px'}}><span>Total bill:</span><strong>£{totals.total.toFixed(2)}</strong></div>
                                <div style={{display:'flex', justifyContent:'space-between', color:theme.deal, borderTop:'1px solid #222', paddingTop:'8px'}}><span>Insurer Pays:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                            </div>
                            <input style={{...s.input, color:theme.danger, fontWeight:'bold'}} placeholder="DEDUCT EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginTop:'20px'}}>
                                <button style={s.btnG('#333')} onClick={() => { setDocType('ESTIMATE'); setTimeout(() => window.print(), 100); }}>PRINT ESTIMATE</button>
                                <button style={s.btnG(theme.deal)} onClick={() => { setDocType('INVOICE'); setTimeout(() => window.print(), 100); }}>CONVERT TO INVOICE</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DEAL FOLDER */}
                {view === 'DEAL' && (
                    <div>
                        <h1 style={{color:theme.deal}}>DEAL SUBMISSION FOLDER</h1>
                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>1. Satisfaction Sign-off</span>
                            <NativeSignature onSave={(data) => setJob({...job, vault: {...job.vault, signature: data}})} />
                            <span style={s.label} style={{marginTop:'25px'}}>2. Archive History</span>
                            <div style={{background:'#000', padding:'15px', borderRadius:'12px', marginBottom:'20px', fontSize:'13px'}}>
                                {(job.vault.invoices || []).map((inv, idx) => (
                                    <div key={idx} style={{borderBottom:'1px solid #333', padding:'10px 0', display:'flex', justifyContent:'space-between'}}>
                                        <span>{inv.type}: {inv.date}</span><span>£{inv.total?.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <input type="file" multiple onChange={(e) => handleFileUpload(e, 'claims', 'photos')} />
                        </div>
                    </div>
                )}

                {/* FINANCE VAULT (CSR LOG) */}
                {view === 'FIN' && (
                    <div>
                        <h1 style={{color:theme.fin}}>FINANCE VAULT</h1>
                        <div style={s.card(theme.fin)}>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'25px'}}>
                                <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Revenue</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                                <div style={{background:'#000', padding:'25px', borderRadius:'15px'}}><span style={s.label}>Expenditure</span><h2 style={{margin:0, color:theme.danger}}>{job.vault.expenses?.length || 0} Receipts</h2></div>
                            </div>
                            <span style={s.label}>Income & Expenditure CSR Log</span>
                            <div style={{background:'#000', padding:'15px', borderRadius:'12px', height:'200px', overflowY:'auto', border:'1px solid #333', marginBottom:'20px'}}>
                                {history.map((h, idx) => (
                                    <div key={`inc-${idx}`} style={{borderBottom:'1px solid #222', padding:'10px 0', fontSize:'13px', display:'flex', justifyContent:'space-between'}}>
                                        <span>{h.vehicle?.reg}</span><span style={{color:theme.deal}}>+£{h.totals?.total?.toFixed(2)}</span>
                                    </div>
                                ))}
                                {job.vault.expenses.map((exp, idx) => (
                                    <div key={`exp-${idx}`} style={{borderBottom:'1px solid #222', padding:'10px 0', fontSize:'13px', display:'flex', justifyContent:'space-between'}}>
                                        <span>Receipt #{idx + 1}</span><a href={exp} target="_blank" rel="noreferrer" style={{color:theme.danger, textDecoration:'none', fontWeight:'bold'}}>VIEW CSR</a>
                                    </div>
                                ))}
                            </div>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} />
                        </div>
                    </div>
                )}

                {/* SETTINGS */}
                {view === 'SET' && (
                    <div>
                        <h1 style={{color:theme.set}}>MASTER SETTINGS</h1>
                        <div style={s.card(theme.set)}>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', background:'#000', padding:'25px', borderRadius:'15px', border:'1px solid #333', marginBottom:'25px'}}>
                                <div><span style={s.label}>Logo</span>{settings.logoUrl && <img src={settings.logoUrl} style={{height:'40px', marginBottom:'10px'}} />}<input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'logoUrl')} /></div>
                                <div><span style={s.label}>PayPal QR</span>{settings.paypalQr && <img src={settings.paypalQr} style={{height:'40px', marginBottom:'10px'}} />}<input type="file" onChange={(e) => handleFileUpload(e, 'branding', 'paypalQr')} /></div>
                            </div>
                            <input style={s.input} placeholder="Bank Details" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                            <textarea style={{...s.input, height:'100px'}} value={settings.terms} onChange={e=>setSettings({...settings, terms:e.target.value})} />
                            <button style={{...s.btnG(theme.set), width:'100%'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Locked."); }}>SAVE SETTINGS (GREEN)</button>
                        </div>
                    </div>
                )}

                {/* NAVIGATION DOCK (NEW JOB CENTER COMMAND) */}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                    <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                    <button onClick={()=>{ if(window.confirm("Clear all fields and start NEW JOB?")) setJob(INITIAL_JOB); setView('HUB'); }} style={{...s.btnG(theme.deal), minWidth:'120px', boxShadow:'0 0 20px rgba(22, 163, 74, 0.4)'}}>NEW JOB</button>
                    <button onClick={()=>setView('RECENT')} style={{...s.btnG(view === 'RECENT' ? '#333' : '#222'), minWidth:'80px'}}>JOBS</button>
                    <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'80px'}}>FIN</button>
                    <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'80px'}}>SET</button>
                    <button style={{...s.btnG(theme.deal), minWidth:'150px'}} onClick={saveMaster}>SAVE MASTER</button>
                </div>
            </div>

            {/* --- MASTER CLEAN PRINT VIEW --- */}
            <div className="print-only" style={{display:'none', color:'black', padding:'60px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'6px solid #f97316', paddingBottom:'35px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'110px', marginBottom:'15px'}} />}
                        <h1 style={{margin:0, color:'#f97316', fontSize:'36px', fontWeight:'900'}}>{settings.coName}</h1>
                        <p>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', fontSize:'48px', margin:0}}>{docType}</h2>
                        <p style={{marginTop:'15px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop:'35px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'40px'}}>
                    <div style={{background:'#f9f9f9', padding:'25px', borderRadius:'15px', border:'1px solid #ddd'}}>
                        <h3 style={{margin:'10px 0'}}>{job.client.name}</h3>
                        <p style={{margin:0, fontSize:'14px'}}>{job.client.address}</p>
                    </div>
                    <div style={{background:'#f9f9f9', padding:'25px', borderRadius:'15px', border:'1px solid #ddd'}}>
                        <h3 style={{margin:'10px 0', color:'#f97316'}}>{job.vehicle.reg}</h3>
                        <div style={{fontSize:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', color:'#333'}}>
                            <span><strong>Make:</strong> {job.vehicle.make || '-'}</span><span><strong>Year:</strong> {job.vehicle.year || '-'}</span>
                            <span><strong>MOT:</strong> {job.vehicle.mot || '-'}</span><span><strong>Engine:</strong> {job.vehicle.engine || '-'}</span>
                            <span style={{gridColumn:'span 2'}}><strong>VIN:</strong> {job.vehicle.vin || 'Not Provided'}</span>
                        </div>
                    </div>
                </div>
                <table style={{width:'100%', marginTop:'30px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'4px solid #ddd'}}><th style={{padding:'18px', textAlign:'left'}}>Description</th><th style={{padding:'18px', textAlign:'right'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px', fontWeight:'bold'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px'}}>Qualified Bodywork Labour ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'18px', fontWeight:'bold'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:'40px'}}>
                    <div style={{textAlign:'center'}}>
                        {docType === 'INVOICE' && settings.paypalQr && (
                            <div>
                                <img src={settings.paypalQr} style={{height:'200px', marginBottom:'10px'}} />
                                <div style={{fontSize:'14px', fontWeight:'bold', background:'#f3f3f3', padding:'15px', borderRadius:'10px', border:'1px solid #ddd'}}>
                                    PAYMENT TO: {settings.bank}
                                </div>
                            </div>
                        )}
                        {job.vault.signature && <div style={{marginTop:'20px'}}><span style={{fontSize:'10px', textTransform:'uppercase', color:'#888'}}>Satisfaction Sign-off</span><br/><img src={job.vault.signature} style={{height:'80px'}} /></div>}
                    </div>
                    <div style={{width:'45%', textAlign:'right'}}>
                        <h1 style={{color:'#f97316', fontSize:'52px', margin:'0 0 20px 0'}}>£{totals.total.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', borderRadius:'25px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'12px', fontSize:'15px'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'22px'}}>£{totals.customer.toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'3px solid #f97316', paddingTop:'15px', fontSize:'15px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'34px'}}>£{totals.insurer.toFixed(2)}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }
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
