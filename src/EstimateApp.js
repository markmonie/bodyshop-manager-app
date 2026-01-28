import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore';
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

// --- ENTERPRISE DESIGN SYSTEM (S25 ULTRA OPTIMIZED) ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '24px', padding: '30px', marginBottom: '25px', border: `1px solid ${theme.border}`, borderTop: `12px solid ${color || theme.hub}`, boxShadow: '0 20px 60px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '1px solid #555', color: '#fff', padding: '18px', borderRadius: '14px', marginBottom: '14px', outline: 'none', fontSize: '18px' },
    label: { color: '#cbd5e1', fontSize: '14px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '10px', display: 'block', letterSpacing: '1.2px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '18px 32px', borderRadius: '16px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: '0.2s', fontSize: '16px' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '15px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: '3px solid #333', zIndex: 1000, justifyContent: 'center' },
    navBar: { display: 'flex', gap: '10px', marginBottom: '25px' },
    tag: (bg) => ({ padding: '4px 10px', borderRadius: '8px', fontSize: '10px', background: bg, color: '#fff', fontWeight: 'bold' })
};

// --- NATIVE SIGNATURE PAD ---
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
    const [contactType, setContactType] = useState('PRIVATE');
    
    // --- PERSISTENT SETTINGS ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Standard 12-Month Warranty.',
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
        const saved = localStorage.getItem('mmm_v56_MASTER_CRM');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        onSnapshot(collection(db, 'addressBook'), snap => setAddressBook(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v56_MASTER_CRM', JSON.stringify(job)); }, [job]);

    // --- MATH ---
    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const sub = pPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const total = sub * (1 + (parseFloat(settings.vatRate) / 100));
        const customer = parseFloat(job.repair.excess || 0);
        return { total, sub, customer, insurer: total - customer, profit: total - (pCost + parseFloat(job.repair.paintMats || 0)), labHrs, labPrice };
    }, [job.repair, settings]);

    // --- CRM LOGIC ---
    const getContactSpend = (name) => {
        return history.filter(h => h.client?.name === name || h.insurance?.co === name)
                      .reduce((acc, curr) => acc + (curr.totals?.total || 0), 0);
    };

    // --- HANDLERS ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob(prev => ({...prev, vehicle: {...prev.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus}}));
        } catch (e) { alert("DVLA Link Error."); }
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
        const snap = { date: new Date().toLocaleDateString(), total: totals.total, type: docType };
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, vault: { ...job.vault, invoices: [...(job.vault.invoices || []), snap] }, createdAt: serverTimestamp() });
        alert("Triple MMM System Synced");
    };

    const handleCSVImport = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (event) => {
            const rows = event.target.result.split('\n').slice(1);
            const batch = writeBatch(db);
            rows.forEach(row => {
                const [n, em, ph] = row.split(',');
                if (n) batch.set(doc(collection(db, 'addressBook')), { name: n, email: em, phone: ph, type: 'PRIVATE' });
            });
            await batch.commit();
            alert("Contacts Imported");
        };
        reader.readAsText(file);
    };

    const HeaderNav = ({ prev }) => (
        <div style={s.navBar} className="no-print">
            <button style={{...s.btnG('#222'), flex:1}} onClick={() => setView(prev || 'HUB')}>⬅️ BACK</button>
            <button style={{...s.btnG(theme.hub), flex:1}} onClick={() => setView('HUB')}>🏠 HUB</button>
        </div>
    );

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '140px' }}>
            
            <div className="no-print">
                {/* HUB */}
                {view === 'HUB' && (
                    <div>
                        <h1 style={{color:theme.hub, fontSize:'42px', letterSpacing:'-2px'}}>MANAGEMENT HUB</h1>
                        
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>1. Technical Intake</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                                <input style={{...s.input, flex:2, fontSize:'32px', fontWeight:'900', textAlign:'center', border:`3px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), width:'140px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            <div style={{display:'flex', gap:'12px'}}>
                                <input style={{...s.input, flex:3}} placeholder="VIN / Chassis" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                                <button style={{...s.btnG(theme.set), padding:'12px'}} onClick={() => window.open(`https://www.google.com/search?q=${job.vehicle.make}+manual+${job.vehicle.year}`, '_blank')}>MANUAL</button>
                                <button style={{...s.btnG(theme.work), padding:'12px'}} onClick={() => window.open(`https://www.google.com/search?q=${job.vehicle.vin}+parts`, '_blank')}>PARTS</button>
                            </div>
                        </div>

                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>2. Address CSR Folder (Samsung CRM)</span>
                            <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                                <input type="file" accept=".csv" onChange={handleCSVImport} style={{fontSize:'12px', flex:1}} />
                                <select style={{...s.input, flex:1, margin:0, padding:'10px'}} value={contactType} onChange={e=>setContactType(e.target.value)}>
                                    <option>PRIVATE</option><option>INSURER</option><option>FLEET</option>
                                </select>
                            </div>
                            
                            <div style={{background:'#000', padding:'20px', borderRadius:'15px', border:'2px solid #333', marginBottom:'15px', height:'350px', overflowY:'auto'}}>
                                {addressBook.map((c, i) => (
                                    <div key={i} style={{borderBottom:'1px solid #222', padding:'15px 0'}}>
                                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                                            <div>
                                                <div style={{fontWeight:'900', fontSize:'18px', display:'flex', alignItems:'center', gap:'10px'}}>
                                                    {c.name} 
                                                    <span style={s.tag(c.type === 'INSURER' ? theme.set : c.type === 'FLEET' ? theme.fin : theme.deal)}>{c.type || 'PRIVATE'}</span>
                                                </div>
                                                <div style={{fontSize:'12px', color:'#888', marginTop:'4px'}}>{c.email} | {c.phone}</div>
                                                <div style={{fontSize:'14px', color:theme.deal, fontWeight:'bold', marginTop:'6px'}}>Total Spend: £{getContactSpend(c.name).toFixed(2)}</div>
                                            </div>
                                            <div style={{display:'flex', gap:'8px'}}>
                                                {c.phone && <button style={{...s.btnG('#222'), padding:'10px'}} onClick={()=>window.location.href=`tel:${c.phone}`}>📞</button>}
                                                {c.email && <button style={{...s.btnG('#222'), padding:'10px'}} onClick={()=>window.location.href=`mailto:${c.email}`}>✉️</button>}
                                                <button style={{...s.btnG(theme.deal), padding:'10px 15px'}} onClick={() => {
                                                    const isIns = c.type === 'INSURER';
                                                    setJob({...job, 
                                                        client: isIns ? job.client : { name: c.name, email: c.email, phone: c.phone },
                                                        insurance: isIns ? { ...job.insurance, co: c.name, email: c.email, phone: c.phone } : job.insurance
                                                    });
                                                }}>IMPORT</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <input style={s.input} placeholder="Quick Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'25px', fontSize:'22px'}} onClick={()=>setView('EST')}>GO TO ESTIMATOR</button>
                            <button style={{color:'#888', background:'none', border:'none', width:'100%', marginTop:'10px', fontSize:'12px'}} onClick={async () => {
                                if(job.client.name) {
                                    await addDoc(collection(db, 'addressBook'), { name: job.client.name, email: job.client.email, phone: job.client.phone, type: contactType });
                                    alert("CRM Contact Locked.");
                                }
                            }}>+ SAVE ACTIVE CLIENT TO CRM</button>
                        </div>
                    </div>
                )}

                {/* ESTIMATOR (LOCKED DEPARTMENTS) */}
                {view === 'EST' && (
                    <div>
                        <HeaderNav prev="HUB" />
                        <h2 style={{color:theme.hub}}>ESTIMATING: {job.vehicle.reg}</h2>
                        <div style={{background:'#222', padding:'15px', borderRadius:'15px', display:'flex', justifyContent:'space-between', marginBottom:'20px', fontSize:'14px', color:'#fff', fontWeight:'900'}}>
                            <span>{job.vehicle.make || '-'}</span><span>{job.vehicle.fuel || '-'}</span><span>MOT: {job.vehicle.mot || '-'}</span>
                        </div>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>1. Labour Allocation (Hrs)</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'15px'}}>
                                <input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} placeholder="MET" />
                                <input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} placeholder="PANEL" />
                                <input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} placeholder="PAINT" />
                            </div>
                            <span style={s.label}>2. Parts Matrix Grid</span>
                            <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                                <input id="pD" style={{...s.input, flex:3}} placeholder="Part Name" />
                                <input id="pC" style={{...s.input, flex:1}} type="number" placeholder="£" />
                                <button style={s.btnG(theme.deal)} onClick={()=>{
                                    const d=document.getElementById('pD'), c=document.getElementById('pC');
                                    if(d.value && c.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:d.value, cost:c.value}]}});
                                    d.value=''; c.value='';
                                }}>+</button>
                            </div>
                            <div style={{background:'#000', padding:'25px', borderRadius:'15px', border:'1px solid #333', marginBottom:'15px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>Total bill:</span><strong>£{totals.total.toFixed(2)}</strong></div>
                                <div style={{display:'flex', justifyContent:'space-between', color:theme.deal, borderTop:'1px solid #222', paddingTop:'10px'}}><span>Insurer Pays:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
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
                        <HeaderNav prev="EST" />
                        <h1 style={{color:theme.deal}}>DEAL SUBMISSION FOLDER</h1>
                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>1. Digital Sign-off</span>
                            <NativeSignature onSave={(data) => setJob({...job, vault: {...job.vault, signature: data}})} />
                            <span style={s.label} style={{marginTop:'30px'}}>2. Claim Archive</span>
                            <div style={{background:'#000', padding:'20px', borderRadius:'15px', border:'1px solid #333', marginBottom:'25px'}}>
                                {(job.vault.invoices || []).map((inv, idx) => (
                                    <div key={idx} style={{borderBottom:'1px solid #222', padding:'15px 0', display:'flex', justifyContent:'space-between', fontSize:'16px'}}>
                                        <span>{inv.type}: {inv.date}</span><span style={{fontWeight:'bold'}}>£{inv.total?.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <input type="file" multiple onChange={(e) => handleFileUpload(e, 'claims', 'photos')} />
                        </div>
                    </div>
                )}

                {/* FINANCE VAULT (CSR LOG RESTORED) */}
                {view === 'FIN' && (
                    <div>
                        <HeaderNav prev="HUB" />
                        <h1 style={{color:theme.fin}}>FINANCE VAULT</h1>
                        <div style={s.card(theme.fin)}>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'30px'}}>
                                <div style={{background:'#000', padding:'30px', borderRadius:'20px', border:'1px solid #333'}}><span style={s.label}>Total Income</span><h2 style={{margin:0, fontSize:'32px'}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                                <div style={{background:'#000', padding:'30px', borderRadius:'20px', border:'1px solid #333'}}><span style={s.label}>Expenses</span><h2 style={{margin:0, color:theme.danger, fontSize:'32px'}}>{job.vault.expenses?.length || 0}</h2></div>
                            </div>
                            <span style={s.label}>Income & Expenditure CSR Log</span>
                            <div style={{background:'#000', padding:'20px', borderRadius:'15px', height:'250px', overflowY:'auto', border:'2px solid #333', marginBottom:'25px'}}>
                                {history.map((h, idx) => (
                                    <div key={`inc-${idx}`} style={{borderBottom:'1px solid #222', padding:'12px 0', fontSize:'14px', display:'flex', justifyContent:'space-between'}}>
                                        <span>{h.vehicle?.reg}</span><span style={{color:theme.deal, fontWeight:'bold'}}>+£{h.totals?.total?.toFixed(2)}</span>
                                    </div>
                                ))}
                                {(job.vault.expenses || []).map((exp, idx) => (
                                    <div key={`exp-${idx}`} style={{borderBottom:'1px solid #222', padding:'12px 0', fontSize:'14px', display:'flex', justifyContent:'space-between'}}>
                                        <span>Receipt CSR #{idx + 1}</span><a href={exp} target="_blank" rel="noreferrer" style={{color:theme.danger, textDecoration:'none', fontWeight:'bold'}}>VIEW CSR</a>
                                    </div>
                                ))}
                            </div>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} />
                        </div>
                    </div>
                )}

                {/* NAVIGATION DOCK */}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                    <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                    <button onClick={()=>{ if(window.confirm("Start NEW JOB?")) setJob(INITIAL_JOB); setView('HUB'); }} style={{...s.btnG(theme.deal), minWidth:'140px', boxShadow:'0 0 30px rgba(22, 163, 74, 0.6)'}}>NEW JOB</button>
                    <button onClick={()=>setView('RECENT')} style={{...s.btnG(view === 'RECENT' ? '#333' : '#222'), minWidth:'80px'}}>JOBS</button>
                    <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'80px'}}>FIN</button>
                    <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'90px'}}>SET</button>
                    <button style={{...s.btnG(theme.deal), minWidth:'150px'}} onClick={saveMaster}>SAVE MASTER</button>
                </div>
            </div>

            {/* --- MASTER CLEAN PRINT VIEW --- */}
            <div className="print-only" style={{display:'none', color:'black', padding:'60px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'6px solid #f97316', paddingBottom:'35px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'110px', marginBottom:'15px'}} />}
                        <h1 style={{margin:0, color:'#f97316', fontSize:'42px', fontWeight:'900'}}>{settings.coName}</h1>
                        <p style={{fontSize:'16px'}}>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', fontSize:'52px', margin:0}}>{docType}</h2>
                        <p style={{marginTop:'15px', fontSize:'18px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop:'40px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'50px'}}>
                    <div style={{background:'#f9f9f9', padding:'30px', borderRadius:'20px', border:'1px solid #ddd'}}>
                        <h3 style={{margin:'0 0 15px 0', fontSize:'24px'}}>{job.client.name}</h3>
                        <p style={{margin:0, fontSize:'16px'}}>{job.client.address}</p>
                    </div>
                    <div style={{background:'#f9f9f9', padding:'30px', borderRadius:'20px', border:'1px solid #ddd'}}>
                        <h3 style={{margin:'0 0 15px 0', color:'#f97316', fontSize:'24px'}}>{job.vehicle.reg}</h3>
                        <div style={{fontSize:'14px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px'}}>
                            <span><strong>Make:</strong> {job.vehicle.make || '-'}</span><span><strong>Year:</strong> {job.vehicle.year || '-'}</span>
                            <span style={{gridColumn:'span 2'}}><strong>VIN:</strong> {job.vehicle.vin || '-'}</span>
                        </div>
                    </div>
                </div>
                <table style={{width:'100%', marginTop:'40px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'4px solid #ddd'}}><th style={{padding:'18px', textAlign:'left', fontSize:'18px'}}>Description</th><th style={{padding:'18px', textAlign:'right', fontSize:'18px'}}>Amount</th></tr></thead>
                    <tbody>
                        {job.repair.items.map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px', fontSize:'16px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'18px', fontWeight:'bold', fontSize:'16px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'18px', fontSize:'16px'}}>Professional Bodywork Labour ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'18px', fontWeight:'bold', fontSize:'16px'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:'50px'}}>
                    <div style={{textAlign:'center', width:'42%'}}>
                        {docType === 'INVOICE' && settings.paypalQr && (
                            <div>
                                <img src={settings.paypalQr} style={{height:'280px', width:'280px', objectFit:'contain', marginBottom:'15px'}} />
                                <div style={{fontSize:'18px', fontWeight:'900', color:'#000', padding:'25px', borderRadius:'20px', border:'3px solid #f97316', background:'#fff3e0'}}>
                                    PAYMENT TO: {settings.bank}
                                </div>
                            </div>
                        )}
                        {job.vault.signature && <div style={{marginTop:'35px'}}><span style={{fontSize:'12px', textTransform:'uppercase', color:'#888'}}>Satisfaction Sign-off</span><br/><img src={job.vault.signature} style={{height:'110px'}} /></div>}
                    </div>
                    <div style={{width:'45%', textAlign:'right'}}>
                        <h1 style={{color:'#f97316', fontSize:'64px', margin:'0 0 25px 0'}}>£{totals.total.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'40px', border:'4px solid #f97316', borderRadius:'30px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', fontSize:'18px'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'28px'}}>£{totals.customer.toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'4px solid #f97316', paddingTop:'25px', fontSize:'18px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'44px'}}>£{totals.insurer.toFixed(2)}</strong></div>
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
