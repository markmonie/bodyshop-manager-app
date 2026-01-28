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
    card: (color) => ({ background: theme.card, borderRadius: '24px', padding: '35px', marginBottom: '25px', border: `1px solid ${theme.border}`, borderTop: `12px solid ${color || theme.hub}`, boxShadow: '0 25px 70px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '1px solid #555', color: '#fff', padding: '22px', borderRadius: '18px', marginBottom: '16px', outline: 'none', fontSize: '20px' },
    label: { color: '#cbd5e1', fontSize: '15px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '12px', display: 'block', letterSpacing: '1.2px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '22px 35px', borderRadius: '20px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', transition: '0.2s', fontSize: '16px' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '15px', display: 'flex', gap: '10px', overflowX: 'auto', borderTop: '3px solid #333', zIndex: 1000, justifyContent: 'center' },
    navBar: { display: 'flex', gap: '12px', marginBottom: '30px' },
    tag: (bg) => ({ padding: '6px 12px', borderRadius: '10px', fontSize: '11px', background: bg, color: '#fff', fontWeight: 'bold' }),
    traffic: (active) => ({ width: '30px', height: '30px', borderRadius: '50%', opacity: active ? 1 : 0.15, border: '3px solid #fff' })
};

// --- NATIVE SIGNATURE PAD ---
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
        ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y);
        setIsDrawing(true);
    };
    const move = (e) => { if (!isDrawing) return; const { x, y } = getXY(e); canvasRef.current.getContext('2d').lineTo(x, y); canvasRef.current.getContext('2d').stroke(); };
    const end = () => { setIsDrawing(false); onSave(canvasRef.current.toDataURL()); };
    return (
        <div style={{ background: '#fff', borderRadius: '20px', padding: '15px' }}>
            <canvas ref={canvasRef} width={400} height={200} onMouseDown={start} onMouseMove={move} onMouseUp={end} onTouchStart={start} onTouchMove={move} onTouchEnd={end} style={{ width: '100%', height: '240px', touchAction: 'none' }} />
            <button style={{ ...s.btnG('#222'), width: '100%', marginTop: '15px', padding: '18px' }} onClick={() => { canvasRef.current.getContext('2d').clearRect(0,0,400,200); onSave(''); }}>RESET AUTHORISATION PAD</button>
        </div>
    );
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [addressBook, setAddressBook] = useState([]);
    
    // --- SETTINGS CORE ---
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Account: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Standard 12-Month Guarantee.',
        calId: 'markmonie72@gmail.com'
    });

    const INITIAL_JOB = {
        status: 'STRIPPING',
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
        const saved = localStorage.getItem('mmm_v61_MASTER_FINAL');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        onSnapshot(collection(db, 'addressBook'), snap => setAddressBook(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v61_MASTER_FINAL', JSON.stringify(job)); }, [job]);

    // --- MATH & AI ---
    const totals = useMemo(() => {
        const pCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const total = (pPrice + labPrice + parseFloat(job.repair.paintMats || 0)) * (1 + (parseFloat(settings.vatRate) / 100));
        const customer = parseFloat(job.repair.excess || 0);
        return { total, insurer: total - customer, labHrs, labPrice };
    }, [job.repair, settings]);

    const aiIntel = useMemo(() => {
        const matches = history.filter(h => h.vehicle?.make === job.vehicle.make);
        if (!matches.length) return null;
        return { 
            avgMet: matches.reduce((a,b)=>a+parseFloat(b.repair?.metHrs||0),0)/matches.length,
            avgPanel: matches.reduce((a,b)=>a+parseFloat(b.repair?.panelHrs||0),0)/matches.length,
            count: matches.length
        };
    }, [job.vehicle.make, history]);

    // --- ACTIONS ---
    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob(prev => ({...prev, vehicle: {...prev.vehicle, make: d.make, year: d.yearOfManufacture, colour: d.colour, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus}}));
        } catch (e) { alert("DVLA API Connection Error."); }
        setLoading(false);
    };

    const saveMaster = async () => {
        const snap = { date: new Date().toLocaleDateString(), total: totals.total, type: docType, status: job.status };
        await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, vault: { ...job.vault, invoices: [...(job.vault.invoices || []), snap] }, createdAt: serverTimestamp() });
        alert("Triple MMM System Intel Updated.");
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else if (path === 'finances') setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev.vault.expenses || []), url]}}));
        else if (field === 'photos') setJob(prev => ({...prev, vault: {...prev.vault, photos: [...(prev.vault.photos || []), url]}}));
        else setJob(prev => ({...prev, vault: {...prev.vault, [field]: url}}));
        setLoading(false);
    };

    const HeaderNav = ({ prev }) => (
        <div style={s.navBar} className="no-print">
            <button style={{...s.btnG('#222'), flex:1}} onClick={() => setView(prev || 'HUB')}>⬅️ BACK CENTRE</button>
            <button style={{...s.btnG(theme.hub), flex:1}} onClick={() => setView('HUB')}>🏠 HUB CENTRE</button>
        </div>
    );

    return (
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '140px' }}>
            
            <div className="no-print">
                {/* HUB Dashboard */}
                {view === 'HUB' && (
                    <div>
                        <h1 style={{color:theme.hub, fontSize:'48px', letterSpacing:'-3px'}}>MANAGEMENT HUB</h1>
                        
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>1. Technical Traffic Lights (Live Repairs)</span>
                            <div style={{background:'#000', padding:'25px', borderRadius:'20px', border:'2px solid #333', height:'250px', overflowY:'auto'}}>
                                {history.map((h, i) => (
                                    <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'18px 0', borderBottom:'1px solid #222'}}>
                                        <div><div style={{fontWeight:'900', fontSize:'22px'}}>{h.vehicle?.reg}</div><div style={{fontSize:'13px', color:'#888'}}>{h.client?.name}</div></div>
                                        <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                                            <div style={{...s.traffic(h.status==='STRIPPING'), background:theme.danger}} title="Stripping" />
                                            <div style={{...s.traffic(h.status==='PAINT'), background:theme.work}} title="In Paint" />
                                            <div style={{...s.traffic(h.status==='QC'), background:theme.deal}} title="Ready/QC" />
                                            <button style={{...s.btnG(theme.deal), padding:'12px 20px', marginLeft:'10px'}} onClick={()=>setJob(h)}>LOAD</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>2. Quick Vehicle Intake</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px'}}>
                                <input style={{...s.input, flex:2, fontSize:'38px', fontWeight:'900', textAlign:'center', border:`4px solid ${theme.hub}`}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), width:'160px', fontSize:'24px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            <div style={{display:'flex', gap:'12px'}}>
                                <input style={{...s.input, flex:3}} placeholder="VIN / Chassis Command" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                                <button style={{...s.btnG(theme.set), padding:'12px'}} onClick={() => window.open(`https://www.google.com/search?q=${job.vehicle.make}+workshop+manual+${job.vehicle.year}`, '_blank')}>MANUALS</button>
                                <button style={{...s.btnG(theme.work), padding:'12px'}} onClick={() => window.open(`https://www.google.com/search?q=${job.vehicle.vin}+parts+lookup`, '_blank')}>PARTS</button>
                            </div>
                        </div>

                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>3. Address CSR Pick & Import</span>
                            <div style={{background:'#000', padding:'25px', borderRadius:'20px', border:'2px solid #333', height:'280px', overflowY:'auto'}}>
                                {addressBook.map((c, i) => (
                                    <div key={i} style={{borderBottom:'1px solid #222', padding:'18px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div><div style={{fontWeight:'900', fontSize:'22px'}}>{c.name}</div><div style={{fontSize:'12px', color:'#888'}}>{c.email || c.phone}</div></div>
                                        <button style={{...s.btnG(theme.deal), padding:'15px 25px'}} onClick={() => {
                                            setJob({...job, client: { name: c.name, phone: c.phone, email: c.email }});
                                            alert(`${c.name} Imported.`);
                                        }}>IMPORT</button>
                                    </div>
                                ))}
                            </div>
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px', fontSize:'26px', marginTop:'20px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                        </div>
                    </div>
                )}

                {/* Estimator */}
                {view === 'EST' && (
                    <div>
                        <HeaderNav prev="HUB" />
                        <h2 style={{color:theme.hub}}>ESTIMATING CENTRE: {job.vehicle.reg}</h2>
                        {aiIntel && <div style={{background:'#fff3e0', color:'#000', padding:'20px', borderRadius:'15px', marginBottom:'20px', fontSize:'15px'}}>🧠 <strong>AI INTEL:</strong> For {job.vehicle.make}, you average {aiIntel.avgMet.toFixed(1)}h MET & {aiIntel.avgPanel.toFixed(1)}h Panel.</div>}
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>1. Labour Allocation (Qualified Hours)</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'20px'}}>
                                <div><span style={{fontSize:'10px', color:'#888'}}>MET</span><input style={s.input} value={job.repair.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                                <div><span style={{fontSize:'10px', color:'#888'}}>PANEL</span><input style={s.input} value={job.repair.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                                <div><span style={{fontSize:'10px', color:'#888'}}>PAINT</span><input style={s.input} value={job.repair.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                            </div>
                            <span style={s.label}>2. Parts Matrix Grid</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'15px'}}>
                                <input id="pD" style={{...s.input, flex:3}} placeholder="Part Name" />
                                <input id="pC" style={{...s.input, flex:1}} type="number" placeholder="£" />
                                <button style={s.btnG(theme.deal)} onClick={()=>{
                                    const d=document.getElementById('pD'), c=document.getElementById('pC');
                                    if(d.value && c.value) setJob({...job, repair:{...job.repair, items:[...(job.repair.items||[]), {desc:d.value, cost:c.value}]}});
                                    d.value=''; c.value='';
                                }}>+</button>
                            </div>
                            <div style={{background:'#000', padding:'35px', borderRadius:'25px', border:'1px solid #333', marginBottom:'20px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:'28px'}}><span>Grand Total:</span><strong>£{totals.total.toFixed(2)}</strong></div>
                                <div style={{display:'flex', justifyContent:'space-between', color:theme.deal, marginTop:'15px', borderTop:'2px solid #222', paddingTop:'15px'}}><span>Insurer Pays:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                            </div>
                            <input style={{...s.input, color:theme.danger, fontWeight:'bold', border:`3px solid ${theme.danger}`}} placeholder="CLIENT EXCESS DEDUCTION -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginTop:'25px'}}>
                                <button style={s.btnG('#333')} onClick={() => { setDocType('ESTIMATE'); setTimeout(() => window.print(), 100); }}>PRINT ESTIMATE</button>
                                <button style={s.btnG(theme.deal)} onClick={() => { setDocType('INVOICE'); setTimeout(() => window.print(), 100); }}>CONVERT TO INVOICE</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Workshop Job Card */}
                {view === 'WORK' && (
                    <div>
                        <HeaderNav prev="EST" />
                        <h1 style={{color:theme.work}}>ADVANCED JOB CARD</h1>
                        <div style={{display:'flex', gap:'20px', marginBottom:'25px'}}>
                            <button onClick={()=>setJob({...job, status:'STRIPPING'})} style={{...s.btnG(job.status==='STRIPPING'?theme.danger:'#222'), flex:1}}>🔴 STRIPPING</button>
                            <button onClick={()=>setJob({...job, status:'PAINT'})} style={{...s.btnG(job.status==='PAINT'?theme.work:'#222'), flex:1}}>🟡 PAINTING</button>
                            <button onClick={()=>setJob({...job, status:'QC'})} style={{...s.btnG(job.status==='QC'?theme.deal:'#222'), flex:1}}>🟢 QC / BUILT</button>
                        </div>
                        <div style={s.card(theme.work)}>
                            <h2 style={{margin:'0 0 25px 0', fontSize:'32px'}}>{job.vehicle.reg} | {job.vehicle.make}</h2>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px', background:'#000', padding:'30px', borderRadius:'25px', border:'1px solid #333'}}>
                                <div><span style={s.label}>Client Name</span>{job.client.name || 'N/A'}</div>
                                <div><span style={s.label}>Insurance/Fleet</span>{job.insurance.co || 'PRIVATE'}</div>
                                <div><span style={s.label}>Allocated MET</span>{job.repair.metHrs}h</div>
                                <div><span style={s.label}>Allocated Panel</span>{job.repair.panelHrs}h</div>
                                <div><span style={s.label}>Paint Hours</span>{job.repair.paintHrs}h</div>
                                <div><span style={s.label}>Chassis/VIN</span>{job.vehicle.vin || '-'}</div>
                            </div>
                            <textarea style={{...s.input, height:'250px', marginTop:'30px'}} value={job.repair.techNotes} onChange={e=>setJob({...job, repair:{...job.repair, techNotes:e.target.value}})} placeholder="Log damage report and supplemental findings for office..." />
                        </div>
                    </div>
                )}

                {/* Deal Folder Archive */}
                {view === 'DEAL' && (
                    <div>
                        <HeaderNav prev="WORK" />
                        <h1 style={{color:theme.deal}}>DEAL SUBMISSION VAULT</h1>
                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>1. Client Authorisation Pad</span>
                            <NativeSignature onSave={(data) => setJob({...job, vault: {...job.vault, signature: data}})} />
                            <span style={s.label} style={{marginTop:'35px'}}>2. Claim Asset Snapshot History</span>
                            <div style={{background:'#000', padding:'25px', borderRadius:'20px', border:'1px solid #333', marginBottom:'30px'}}>
                                {(job.vault.invoices || []).map((inv, idx) => (
                                    <div key={idx} style={{borderBottom:'1px solid #222', padding:'18px 0', display:'flex', justifyContent:'space-between', fontSize:'18px'}}>
                                        <span>{inv.type} Archive: {inv.date}</span><span style={{fontWeight:'bold'}}>£{inv.total?.toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <input type="file" multiple onChange={(e) => handleFileUpload(e, 'claims', 'photos')} />
                        </div>
                    </div>
                )}

                {/* Finance Vault */}
                {view === 'FIN' && (
                    <div>
                        <HeaderNav prev="HUB" />
                        <h1 style={{color:theme.fin}}>FINANCE AUDIT VAULT</h1>
                        <div style={s.card(theme.fin)}>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', marginBottom:'45px'}}>
                                <div style={{background:'#000', padding:'40px', borderRadius:'30px', border:'1px solid #333'}}><span style={s.label}>Gross Revenue</span><h2 style={{margin:0, fontSize:'42px'}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                                <div style={{background:'#000', padding:'40px', borderRadius:'30px', border:'1px solid #333'}}><span style={s.label}>Receipt Total</span><h2 style={{margin:0, color:theme.danger, fontSize:'42px'}}>{job.vault.expenses?.length || 0}</h2></div>
                            </div>
                            <span style={s.label}>Expenditure CSR Audit Trail</span>
                            <div style={{background:'#000', padding:'25px', borderRadius:'20px', height:'350px', overflowY:'auto', border:'2px solid #333', marginBottom:'35px'}}>
                                {(job.vault.expenses || []).map((exp, idx) => (
                                    <div key={idx} style={{borderBottom:'1px solid #222', padding:'20px 0', fontSize:'16px', display:'flex', justifyContent:'space-between'}}>
                                        <span>Triple MMM Receipt #{idx+1}</span><a href={exp} target="_blank" rel="noreferrer" style={{color:theme.danger, fontWeight:'bold', textDecoration:'none'}}>VIEW CSR</a>
                                    </div>
                                ))}
                            </div>
                            <input type="file" onChange={(e) => handleFileUpload(e, 'finances', 'expenses')} />
                        </div>
                    </div>
                )}

                {/* Navigation Dock */}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                    <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                    <button onClick={()=>setView('WORK')} style={{...s.btnG(theme.work), minWidth:'80px'}}>JOB</button>
                    <button onClick={()=>{ if(window.confirm("Complete System Reset for NEW JOB?")) setJob(INITIAL_JOB); setView('HUB'); }} style={{...s.btnG(theme.deal), minWidth:'140px', boxShadow:'0 0 40px rgba(22, 163, 74, 0.7)', fontSize:'20px'}}>NEW JOB</button>
                    <button onClick={()=>setView('CAL')} style={{...s.btnG(theme.set), minWidth:'80px'}}>CAL</button>
                    <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.fin), minWidth:'80px'}}>FIN</button>
                    <button onClick={()=>setView('RECENT')} style={{...s.btnG('#333'), minWidth:'80px'}}>JOBS</button>
                    <button style={{...s.btnG(theme.deal), minWidth:'180px'}} onClick={saveMaster}>SAVE MASTER</button>
                </div>
            </div>

            {/* Print View */}
            <div className="print-only" style={{display:'none', color:'black', padding:'60px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'8px solid #f97316', paddingBottom:'40px'}}>
                    <div>
                        {settings.logoUrl && <img src={settings.logoUrl} style={{height:'130px', marginBottom:'20px'}} />}
                        <h1 style={{margin:0, color:'#f97316', fontSize:'48px', fontWeight:'900'}}>{settings.coName}</h1>
                        <p style={{fontSize:'18px'}}>{settings.address}<br/>Tel: {settings.phone}</p>
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h2 style={{color:'#f97316', fontSize:'65px', margin:0}}>{docType}</h2>
                        <p style={{marginTop:'20px', fontSize:'22px'}}><strong>Reg:</strong> {job.vehicle.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
                <div style={{marginTop:'45px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'60px'}}>
                    <div style={{background:'#f9f9f9', padding:'35px', borderRadius:'25px', border:'1px solid #ddd'}}>
                        <h3 style={{margin:'0 0 15px 0', fontSize:'28px'}}>{job.client.name}</h3>
                        <p style={{margin:0, fontSize:'18px'}}>{job.client.address}<br/>{job.client.phone}</p>
                    </div>
                    <div style={{background:'#f9f9f9', padding:'35px', borderRadius:'25px', border:'1px solid #ddd'}}>
                        <h3 style={{margin:'0 0 15px 0', color:'#f97316', fontSize:'28px'}}>{job.vehicle.reg}</h3>
                        <div style={{fontSize:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                            <span><strong>Make:</strong> {job.vehicle.make || '-'}</span><span><strong>Year:</strong> {job.vehicle.year || '-'}</span>
                            <span style={{gridColumn:'span 2'}}><strong>VIN:</strong> {job.vehicle.vin || '-'}</span>
                        </div>
                    </div>
                </div>
                <table style={{width:'100%', marginTop:'50px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'5px solid #ddd'}}><th style={{padding:'25px', textAlign:'left', fontSize:'20px'}}>Qualified Technical Work</th><th style={{padding:'25px', textAlign:'right', fontSize:'20px'}}>Amount</th></tr></thead>
                    <tbody>
                        {(job.repair.items || []).map((it, i) => (
                            <tr key={i} style={{borderBottom:'1px solid #eee'}}><td style={{padding:'25px', fontSize:'18px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'25px', fontWeight:'bold', fontSize:'18px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                        ))}
                        <tr style={{borderBottom:'1px solid #eee'}}><td style={{padding:'25px', fontSize:'18px'}}>Bodywork Labour ({totals.labHrs} hrs)</td><td style={{textAlign:'right', padding:'25px', fontWeight:'bold', fontSize:'18px'}}>£{totals.labPrice.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{display:'flex', justifyContent:'space-between', marginTop:'60px'}}>
                    <div style={{textAlign:'center', width:'48%'}}>
                        {docType === 'INVOICE' && settings.paypalQr && (
                            <div>
                                <img src={settings.paypalQr} style={{height:'350px', width:'350px', objectFit:'contain', marginBottom:'20px'}} />
                                <div style={{fontSize:'22px', fontWeight:'900', background:'#fff3e0', padding:'35px', borderRadius:'30px', border:'4px solid #f97316'}}>
                                    PAYMENT TO: {settings.bank}
                                </div>
                            </div>
                        )}
                        {job.vault.signature && <div style={{marginTop:'45px'}}><span style={{fontSize:'12px', textTransform:'uppercase', color:'#888'}}>Client Satisfaction Authorisation</span><br/><img src={job.vault.signature} style={{height:'130px'}} /></div>}
                    </div>
                    <div style={{width:'45%', textAlign:'right'}}>
                        <h1 style={{color:'#f97316', fontSize:'80px', margin:'0 0 35px 0'}}>£{totals.total.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'45px', border:'5px solid #f97316', borderRadius:'35px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', fontSize:'22px'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'32px'}}>£{totals.customer.toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'5px solid #f97316', paddingTop:'25px', fontSize:'22px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'48px'}}>£{totals.insurer.toFixed(2)}</strong></div>
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
