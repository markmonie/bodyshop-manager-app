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

// --- DESIGN SYSTEM: TITAN TUNGSTEN (V175 EMAIL-CONFIRMED) ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '40px 30px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '25px', borderRadius: '22px', marginBottom: '20px', outline: 'none', fontSize: '26px', fontWeight: 'bold', boxSizing: 'border-box' },
    label: { color: '#94a3b8', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', display: 'block', letterSpacing: '2.5px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '24px 35px', borderRadius: '22px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.2s', fontSize: '18px', flexShrink: 0 }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '25px 20px', display: 'flex', gap: '15px', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '5px solid #222', zIndex: 1000, paddingRight: '150px' },
    navBar: { display: 'flex', gap: '15px', marginBottom: '40px' },
    traffic: (active, color) => ({ width: '55px', height: '55px', borderRadius: '50%', opacity: active ? 1 : 0.1, border: '4px solid #fff', background: color, cursor: 'pointer' })
};

// --- NATIVE SIGNATURE COMPONENT (LOCKED) ---
const NativeSignature = ({ onSave }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const getXY = (e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const cX = e.clientX || (e.touches && e.touches[0].clientX);
        const cY = e.clientY || (e.touches && e.touches[0].clientY);
        return { x: cX - rect.left, y: cY - rect.top };
    };
    const start = (e) => {
        const { x, y } = getXY(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    const move = (e) => { if (!isDrawing) return; const { x, y } = getXY(e); canvasRef.current.getContext('2d').lineTo(x, y); canvasRef.current.getContext('2d').stroke(); };
    const end = () => { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); };
    return (
        <div style={{ background: '#fff', borderRadius: '25px', padding: '20px' }}>
            <canvas ref={canvasRef} width={400} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: '100%', height: '260px', touchAction: 'none' }} />
            <button style={{ ...s.btnG('#222'), width: '100%', marginTop: '15px', padding: '25px' }} onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,400,200); onSave(''); }}>RESET PAD</button>
        </div>
    );
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [addressBook, setAddressBook] = useState([]);
    const [history, setHistory] = useState([]);
    
    // --- SETTINGS (DEFAULTING TO EMAIL KEY) ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Acc: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'lXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc', paypalQr: ''
    });

    const INITIAL_JOB = {
        status: 'STRIPPING', lastSuccess: '',
        client: { name: '', phone: '', email: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '', motExpiry: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { signature: '', expenses: [] }
    };

    const [job, setJob] = useState(INITIAL_JOB);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v175_EMAIL');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        onSnapshot(collection(db, 'addressBook'), snap => setAddressBook(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v175_EMAIL', JSON.stringify(job)); }, [job]);

    // --- MATH ENGINE ---
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

    const projectedDate = useMemo(() => {
        const hrs = parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0);
        if (hrs <= 0) return "N/A";
        let daysNeeded = Math.ceil(hrs / 8); let date = new Date(); let count = 0;
        while(count < daysNeeded) { date.setDate(date.getDate() + 1); if(date.getDay() !== 0 && date.getDay() !== 6) count++; }
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }, [job.repair]);

    // --- DVLA HANDSHAKE: PYTHON MIRROR (HEADER MATCH) ---
    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) return;
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            // EXACT HEADERS FROM YOUR PYTHON SCRIPT
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 
                    'x-api-key': settings.dvlaKey.trim(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ registrationNumber: cleanReg })
            });
            if (!response.ok) throw new Error(`${response.status}`);
            const d = await response.json();
            setJob(prev => ({
                ...prev, 
                lastSuccess: new Date().toLocaleString('en-GB'),
                vehicle: {
                    ...prev.vehicle, 
                    make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, 
                    engine: d.engineCapacity, mot: d.motStatus, motExpiry: d.motExpiryDate
                }
            }));
        } catch (e) { alert("Handshake Refused: Verify Key in Settings."); }
        setLoading(false);
    };

    const saveMaster = async () => {
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
        alert("Titan Master Synchronised.");
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev.vault.expenses || []), url]}}));
        setLoading(false);
    };

    const HeaderNav = ({ prev }) => (
        <div style={s.navBar} className="no-print">
            <button style={{...s.btnG('#222'), flex:1}} onClick={() => setView(prev || 'HUB')}>⬅️ BACK</button>
            <button style={{...s.btnG(theme.hub), flex:1}} onClick={() => setView('HUB')}>🏠 HUB</button>
        </div>
    );

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            <div className="no-print">
                {/* HUB */}
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <h1 style={{color:theme.hub, fontSize:'65px', letterSpacing:'-4px', marginBottom:'45px', textAlign:'center'}}>COMMAND HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>Station 1: Technical Identification</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:4, fontSize:'55px', textAlign:'center', border:`5px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), flex:1, fontSize:'20px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            {job.lastSuccess && <div style={{background:theme.deal, color:'#000', padding:'10px', borderRadius:'10px', fontSize:'12px', textAlign:'center', marginBottom:'15px', fontWeight:'bold'}}>AUDIT LOG: DATA VERIFIED AT {job.lastSuccess}</div>}
                            <span style={s.label}>Station 2: Chassis / VIN Block</span>
                            <input style={{...s.input, fontSize:'22px'}} placeholder="FULL 17-DIGIT CHASSIS BOX" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                            <div style={s.displayBox}>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px', fontSize:'24px'}}>
                                    <div><span style={s.label}>Vehicle</span><strong>{job.vehicle.make || 'Pending...'}</strong></div>
                                    <div><span style={s.label}>Spec</span><strong>{job.vehicle.year} | {job.vehicle.fuel}</strong></div>
                                    <div><span style={s.label}>Colour</span><strong>{job.vehicle.colour || '-'}</strong></div>
                                    <div><span style={s.label}>Engine</span><strong>{job.vehicle.engine}cc</strong></div>
                                    <div><span style={s.label}>MOT Status</span><strong style={{color: job.vehicle.mot === 'VALID' ? theme.deal : theme.danger}}>{job.vehicle.mot || '-'}</strong></div>
                                    <div><span style={s.label}>MOT Expiry</span><strong>{job.vehicle.motExpiry || '-'}</strong></div>
                                </div>
                            </div>
                        </div>

                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>Station 3: CRM Directory</span>
                            <div style={{background:'#000', padding:'35px', borderRadius:'25px', border:'2px solid #333', height:'350px', overflowY:'auto'}}>
                                {addressBook.map((c, i) => (
                                    <div key={i} style={{borderBottom:'1px solid #222', padding:'20px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div><div style={{fontWeight:'900', fontSize:'24px'}}>{c.name}</div><div style={{fontSize:'14px', color:'#888'}}>{c.phone}</div></div>
                                        <button style={{...s.btnG(theme.deal), padding:'12px 20px', fontSize:'14px'}} onClick={() => setJob({...job, client: { name: c.name, phone: c.phone, email: c.email }})}>+ ASSIGN</button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Station 4: AI Shop Intelligence</span>
                            <div style={s.displayBox}><span style={s.label}>Status</span><div style={{display:'flex', gap:'25px', marginTop:'15px'}}><div style={{...s.traffic(job.status==='STRIPPING', theme.danger), background:job.status==='STRIPPING'?theme.danger:'transparent'}} onClick={()=>setJob({...job, status:'STRIPPING'})} /><div style={{...s.traffic(job.status==='PAINT', theme.work), background:job.status==='PAINT'?theme.work:'transparent'}} onClick={()=>setJob({...job, status:'PAINT'})} /><div style={{...s.traffic(job.status==='QC', theme.deal), background:job.status==='QC'?theme.deal:'transparent'}} onClick={()=>setJob({...job, status:'QC'})} /></div></div>
                            <div style={s.displayBox}><span style={s.label}>PROBABLE READY DATE</span><div style={{color:theme.hub, fontSize:'45px', fontWeight:'900'}}>{projectedDate}</div></div>
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px', fontSize:'32px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                        </div>
                    </div>
                )}

                {/* ESTIMATOR */}
                {view === 'EST' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav prev="HUB" />
                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Qualified Labour Hours</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', marginBottom:'35px'}}>
                                <div><span style={s.label}>MET</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PANEL</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PAINT</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                            </div>
                            <span style={s.label}>Authorized Parts / Line Items</span>
                            {job.repair.items.map((it, i) => (
                                <div key={i} style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                                    <input style={{...s.input, flex:3, marginBottom:0}} value={it.desc} placeholder="Item" onChange={e=>{ let n=[...job.repair.items]; n[i].desc=e.target.value; setJob({...job, repair:{...job.repair, items:n}}); }} />
                                    <input style={{...s.input, flex:1, marginBottom:0}} value={it.cost} placeholder="£" onChange={e=>{ let n=[...job.repair.items]; n[i].cost=e.target.value; setJob({...job, repair:{...job.repair, items:n}}); }} />
                                    <button style={{...s.btnG(theme.danger), padding:'15px'}} onClick={()=>{ let n=job.repair.items.filter((_, idx)=>idx!==i); setJob({...job, repair:{...job.repair, items:n}}); }}>X</button>
                                </div>
                            ))}
                            <button style={{...s.btnG(theme.work), width:'100%'}} onClick={()=>setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:'', cost:''}]}})}>+ ADD LINE ITEM</button>
                        </div>
                        <div style={s.card(theme.fin)}>
                            <span style={s.label}>Legal Authorisation Pad</span>
                            <NativeSignature onSave={(sig) => setJob({...job, vault: {...job.vault, signature: sig}})} />
                        </div>
                        <div style={s.card(theme.deal)}>
                            <h2 style={{fontSize:'45px', textAlign:'right'}}>GRAND TOTAL: £{totals.total.toFixed(2)}</h2>
                            <input style={{...s.input, color:theme.danger, border:`4px solid ${theme.danger}`}} placeholder="EXCESS -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginTop:'20px'}}>
                                <button style={s.btnG('#333')} onClick={() => { setDocType('ESTIMATE'); setTimeout(() => window.print(), 100); }}>PRINT ESTIMATE</button>
                                <button style={s.btnG(theme.deal)} onClick={() => { setDocType('INVOICE'); setTimeout(() => window.print(), 100); }}>PRINT INVOICE</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ARCHIVE */}
                {view === 'RECENT' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav prev="HUB" />
                        <div style={s.card('#222')}>
                            <div style={{height:'600px', overflowY:'auto'}}>
                                {history.map((h, i) => (
                                    <div key={i} style={{background:'#000', padding:'25px', borderRadius:'20px', marginBottom:'15px', border:'1px solid #333', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div><div style={{fontWeight:'900', fontSize:'24px'}}>{h.vehicle.reg}</div><div style={{fontSize:'14px', color:'#888'}}>{h.client?.name}</div></div>
                                        <div style={{display:'flex', gap:'10px'}}>
                                            <button style={s.btnG(theme.deal)} onClick={() => { setJob(h); setView('HUB'); }}>LOAD</button>
                                            <button style={s.btnG(theme.danger)} onClick={async () => { if(window.confirm("Wipe?")) await deleteDoc(doc(db, 'estimates', h.id)); }}>X</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* SETTINGS */}
                {view === 'SET' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav prev="HUB" />
                        <div style={s.card(theme.set)}>
                            <input style={s.input} placeholder="Business Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                            <input style={s.input} placeholder="Address" value={settings.address} onChange={e=>setSettings({...settings, address:e.target.value})} />
                            <input style={s.input} placeholder="Bank Sort/Acc" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                            <input style={s.input} placeholder="DVLA API Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Locked."); }}>SAVE GLOBAL SETTINGS</button>
                        </div>
                    </div>
                )}

                {/* FINANCE VAULT */}
                {view === 'FIN' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <HeaderNav prev="HUB" />
                        <div style={s.card(theme.fin)}>
                            <h1 style={{color:theme.fin, marginBottom:'30px'}}>FINANCE CSR VAULT</h1>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'30px', marginBottom:'40px'}}>
                                <div style={{...s.displayBox, background:'#000'}}><span style={s.label}>REVENUE</span><div style={{fontSize:'40px', fontWeight:'900'}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(0)}</div></div>
                                <div style={{...s.displayBox, background:'#000'}}><span style={s.label}>RECEIPTS</span><div style={{fontSize:'40px', fontWeight:'900', color:theme.danger}}>{job.vault?.expenses?.length || 0}</div></div>
                            </div>
                            <span style={s.label}>Upload Receipt</span>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} style={{marginBottom:'20px'}} />
                            <div style={{display:'flex', gap:'10px', overflowX:'auto'}}>
                                {(job.vault?.expenses || []).map((url, i) => <img key={i} src={url} style={{height:'100px', border:'2px solid #333'}} />)}
                            </div>
                        </div>
                    </div>
                )}

                {/* DOCK */}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={{...s.btnG(view==='HUB'?theme.hub:'#222'), minWidth:'110px'}}>HUB</button>
                    <button onClick={()=>setView('EST')} style={{...s.btnG(view==='EST'?theme.hub:'#222'), minWidth:'110px'}}>EST</button>
                    <button onClick={()=>window.open('https://calendar.google.com/calendar/u/0/r?cid=markmonie72@gmail.com', '_blank')} style={{...s.btnG(theme.set), minWidth:'110px'}}>CAL</button>
                    <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'110px'}}>FIN</button>
                    <button onClick={()=>setView('RECENT')} style={{...s.btnG('#333'), minWidth:'110px'}}>JOBS</button>
                    <button onClick={()=>setView('SET')} style={{...s.btnG('#222'), minWidth:'110px'}}>SET</button>
                    <button style={{...s.btnG(theme.deal), minWidth:'220px'}} onClick={saveMaster}>SAVE MASTER</button>
                </div>
            </div>

            {/* PRINT */}
            <div className="print-only" style={{display:'none', color:'black', padding:'50px', fontFamily:'Arial', width:'100%', boxSizing:'border-box'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'35px'}}>
                    <div><h1 style={{margin:0, color:'#f97316', fontSize:'45px'}}>{settings.coName}</h1><p style={{fontSize:'18px'}}>{settings.address}<br/>Tel: {settings.phone}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'#f97316', fontSize:'60px', margin:0}}>{docType}</h2><p style={{fontSize:'22px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p></div>
                </div>
                <table style={{width:'100%', marginTop:'40px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#eee', borderBottom:'4px solid #ddd'}}><th style={{padding:'20px', textAlign:'left'}}>Description</th><th style={{padding:'20px', textAlign:'right'}}>Amount</th></tr></thead>
                    <tbody>
                        {(job.repair.items || []).map((it, i) => (<tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'15px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'15px', fontWeight:'bold'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>))}
                        <tr><td style={{padding:'15px'}}>Qualified Bodywork Labour ({totals.lHrs} hrs)</td><td style={{textAlign:'right', padding:'15px', fontWeight:'bold'}}>£{totals.lPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:'40px', marginTop:'60px'}}>
                    <div style={{textAlign:'center', border:'2px solid #f97316', borderRadius:'25px', padding:'25px'}}>
                        <div style={{fontSize:'18px', fontWeight:'900', marginBottom:'15px'}}>BACS PAYMENT: {settings.bank}</div>
                        {job.vault?.signature && <img src={job.vault.signature} style={{width:'200px', marginTop:'15px'}} />}
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h1 style={{fontSize:'75px', margin:0, color:'#f97316'}}>£{totals.total.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'30px', border:'3px solid #f97316', borderRadius:'25px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><span>CLIENT EXCESS:</span><strong>£{parseFloat(job.repair.excess || 0).toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'2px solid #f97316', paddingTop:'15px'}}><span>INSURER BALANCE:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; overflow: visible !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
