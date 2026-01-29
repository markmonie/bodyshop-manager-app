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

// --- DESIGN SYSTEM: TUNGSTEN TITAN (V120 FINAL) ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', fin: '#8b5cf6', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '32px', padding: '40px 30px', marginBottom: '35px', border: `2px solid ${theme.border}`, borderTop: `14px solid ${color || theme.hub}`, boxShadow: '0 40px 100px rgba(0,0,0,0.9)' }),
    input: { width: '100%', background: '#000', border: '3px solid #666', color: '#fff', padding: '25px', borderRadius: '22px', marginBottom: '20px', outline: 'none', fontSize: '26px', fontWeight: 'bold', boxSizing: 'border-box' },
    label: { color: '#94a3b8', fontSize: '16px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', display: 'block', letterSpacing: '2.5px' },
    displayBox: { background: '#050505', padding: '25px', borderRadius: '22px', border: '2px solid #222', marginBottom: '20px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '24px 35px', borderRadius: '22px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', transition: '0.2s', fontSize: '18px', flexShrink: 0 }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '25px 20px', display: 'flex', gap: '15px', overflowX: 'auto', flexWrap: 'nowrap', borderTop: '5px solid #222', zIndex: 1000, WebkitOverflowScrolling: 'touch', paddingRight: '150px' },
    navBar: { display: 'flex', gap: '15px', marginBottom: '40px' },
    traffic: (active) => ({ width: '40px', height: '40px', borderRadius: '50%', opacity: active ? 1 : 0.1, border: '3px solid #fff' })
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    const [docType, setDocType] = useState('ESTIMATE'); 
    const [addressBook, setAddressBook] = useState([]);
    const [history, setHistory] = useState([]);
    
    const [settings, setSettings] = useState({ 
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319', 
        bank: 'Sort Code: 80-22-60 | Account: 06163462', markup: '20', labourRate: '50', vatRate: '20', 
        dvlaKey: 'LXqv1yDD1IatEPHlntk2w8MEuz9X57lE9TP9sxGc', logoUrl: '', paypalQr: '', password: '1234', terms: 'Standard 12-Month Guarantee.',
        calId: 'markmonie72@gmail.com'
    });

    const INITIAL_JOB = {
        status: 'STRIPPING', lastSuccess: '',
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', phone: '', email: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', colour: '', fuel: '', engine: '', mot: '', motExpiry: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0', techNotes: '' },
        vault: { photos: [], signature: '', expenses: [], invoices: [] },
        booking: { date: '', time: '' }
    };

    const [job, setJob] = useState(INITIAL_JOB);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const saved = localStorage.getItem('mmm_v120_ABSOLUTE');
        if (saved) setJob(JSON.parse(saved));
        onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), snap => setHistory(snap.docs.map(d => ({id:d.id, ...d.data()}))));
        onSnapshot(collection(db, 'addressBook'), snap => setAddressBook(snap.docs.map(d => ({id:d.id, ...d.data()}))));
    }, []);

    useEffect(() => { localStorage.setItem('mmm_v120_ABSOLUTE', JSON.stringify(job)); }, [job]);

    // --- MATH & AI ---
    const totals = useMemo(() => {
        const pCost = (job?.repair?.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup) / 100));
        const lHrs = (parseFloat(job?.repair?.panelHrs || 0) + parseFloat(job?.repair?.paintHrs || 0) + parseFloat(job?.repair?.metHrs || 0));
        const lPrice = lHrs * parseFloat(settings.labourRate);
        const total = (pPrice + lPrice + parseFloat(job?.repair?.paintMats || 0)) * (1 + (parseFloat(settings.vatRate) / 100));
        const customer = parseFloat(job?.repair?.excess || 0);
        return { total: total || 0, insurer: (total - customer) || 0, lHrs, lPrice, customer };
    }, [job?.repair, settings]);

    const projectedDate = useMemo(() => {
        const hrs = (parseFloat(job?.repair?.panelHrs || 0) + parseFloat(job?.repair?.paintHrs || 0) + parseFloat(job?.repair?.metHrs || 0));
        if (hrs <= 0) return "N/A";
        let daysNeeded = Math.ceil(hrs / 8); let date = new Date(); let count = 0;
        while(count < daysNeeded) { date.setDate(date.getDate() + 1); if(date.getDay() !== 0 && date.getDay() !== 6) count++; }
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }, [job?.repair]);

    // --- ABSOLUTE DVLA HANDSHAKE (LEGAL SPEC COMPLIANT) ---
    const runDVLA = async () => {
        if (!job?.vehicle?.reg || !settings.dvlaKey) return;
        setLoading(true);
        const cleanReg = job.vehicle.reg.replace(/\s+/g, '').toUpperCase();
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: { 
                    'x-api-key': settings.dvlaKey.trim(),
                    'Accept': 'application/json',
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
        } catch (e) { alert("DVLA Handshake Refused: Verify API Key in Settings."); }
        setLoading(false);
    };

    const saveMaster = async () => {
        const snap = { date: new Date().toLocaleDateString(), total: totals.total, status: job.status, type: docType, readyDate: projectedDate };
        await setDoc(doc(db, 'estimates', job?.vehicle?.reg || Date.now().toString()), { ...job, totals, vault: { ...job.vault, invoices: [...(job?.vault?.invoices || []), snap] }, createdAt: serverTimestamp() });
        alert("Titan Master Synchronised.");
    };

    const handleFileUpload = async (e, path, field) => {
        const file = e.target.files[0]; if (!file) return;
        setLoading(true);
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'branding') setSettings(prev => ({...prev, [field]: url}));
        else if (path === 'finances') setJob(prev => ({...prev, vault: {...prev.vault, expenses: [...(prev?.vault?.expenses || []), url]}}));
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
        <div style={{ background: '#000', minHeight: '100vh', color: '#fff', padding: '20px', paddingBottom: '180px' }}>
            <div className="no-print">
                {/* HUB - PRECISION UI */}
                {view === 'HUB' && (
                    <div style={{maxWidth:'850px', margin:'0 auto'}}>
                        <h1 style={{color:theme.hub, fontSize:'58px', letterSpacing:'-4px', marginBottom:'45px', textAlign:'center'}}>COMMAND HUB</h1>
                        <div style={s.card(theme.hub)}>
                            <span style={s.label}>Station 1: Technical Identification</span>
                            <div style={{display:'flex', gap:'12px', marginBottom:'20px', alignItems:'center'}}>
                                <input style={{...s.input, flex:4, fontSize:'54px', textAlign:'center', border:`5px solid ${theme.hub}`}} value={job?.vehicle?.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                                <button style={{...s.btnG(theme.hub), flex:1, fontSize:'20px', padding:'25px 15px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                            </div>
                            {job.lastSuccess && <div style={{background:theme.deal, color:'#000', padding:'10px', borderRadius:'10px', fontSize:'12px', textAlign:'center', marginBottom:'15px', fontWeight:'bold'}}>AUDIT LOG: DATA VERIFIED AT {job.lastSuccess}</div>}
                            <span style={s.label}>Station 2: Chassis / VIN Block</span>
                            <input style={{...s.input, fontSize:'20px', padding:'25px'}} placeholder="FULL CHASSIS BOX" value={job?.vehicle?.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                            <div style={s.displayBox}>
                                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px', fontSize:'22px'}}>
                                    <div><span style={s.label}>Vehicle</span><strong>{job.vehicle.make || 'Pending...'}</strong></div>
                                    <div><span style={s.label}>Spec</span><strong>{job.vehicle.year} | {job.vehicle.fuel}</strong></div>
                                    <div><span style={s.label}>Colour</span><strong>{job.vehicle.colour || '-'}</strong></div>
                                    <div><span style={s.label}>MOT Status</span><strong style={{color: job.vehicle.mot === 'VALID' ? theme.deal : theme.danger}}>{job.vehicle.mot || '-'}</strong></div>
                                    <div style={{gridColumn:'span 2'}}><span style={s.label}>MOT Expiry</span><strong>{job.vehicle.motExpiry || '-'}</strong></div>
                                </div>
                            </div>
                        </div>

                        <div style={s.card(theme.deal)}>
                            <span style={s.label}>Station 3: Stakeholder Directory</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px', marginBottom:'30px'}}>
                                <div style={s.displayBox}><span style={s.label}>Active Client</span><div style={{fontSize:'24px', fontWeight:'900', color:theme.deal}}>{job?.client?.name || 'N/A'}</div></div>
                                <div style={s.displayBox}><span style={s.label}>Active Insurer</span><div style={{fontSize:'24px', fontWeight:'900', color:theme.set}}>{job?.insurance?.co || 'Private'}</div></div>
                            </div>
                            <div style={{background:'#000', padding:'35px', borderRadius:'25px', border:'2px solid #333', height:'400px', overflowY:'auto'}}>
                                {(addressBook || []).map((c, i) => (
                                    <div key={i} style={{borderBottom:'1px solid #222', padding:'25px 0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div><div style={{fontWeight:'900', fontSize:'24px'}}>{c?.name}</div><div style={{fontSize:'14px', color:'#888'}}>{c?.phone}</div></div>
                                        <div style={{display:'flex', gap:'12px'}}>
                                            <button style={{...s.btnG(theme.deal), padding:'15px 25px', fontSize:'14px'}} onClick={() => { setJob({...job, client: { name: c.name, phone: c.phone, email: c.email, address: c.address }}); alert("Client Assigned."); }}>+ CLIENT</button>
                                            <button style={{...s.btnG(theme.set), padding:'15px 25px', fontSize:'14px'}} onClick={() => { setJob({...job, insurance: { co: c.name, phone: c.phone, email: c.email }}); alert("Insurer Assigned."); }}>+ INSURER</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={s.card(theme.work)}>
                            <span style={s.label}>Station 4: AI Shop Floor Intelligence</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px', marginBottom:'25px'}}>
                                <div style={s.displayBox}><span style={s.label}>Status</span><div style={{display:'flex', gap:'25px', marginTop:'15px'}}><div style={{...s.traffic(job.status==='STRIPPING'), background:theme.danger}} /><div style={{...s.traffic(job.status==='PAINT'), background:theme.work}} /><div style={{...s.traffic(job.status==='QC'), background:theme.deal}} /></div></div>
                                <div style={{...s.displayBox, background:theme.hub}}><span style={{...s.label, color:'#000'}}>AI READY DATE</span><div style={{color:'#000', fontSize:'38px', fontWeight:'900'}}>{projectedDate}</div></div>
                            </div>
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'40px', fontSize:'32px'}} onClick={()=>setView('EST')}>OPEN ESTIMATOR</button>
                        </div>
                    </div>
                )}

                {/* ESTIMATOR */}
                {view === 'EST' && (
                    <div>
                        <HeaderNav prev="HUB" /><h2 style={{color:theme.hub}}>ESTIMATING: {job?.vehicle?.reg}</h2>
                        <div style={s.card(theme.hub)}>
                            <div style={{...s.displayBox, fontSize:'14px', marginBottom:'30px', color:theme.text}}><strong>{job.vehicle.make} | {job.vehicle.year} | {job.vehicle.colour}</strong></div>
                            <span style={s.label}>Labour Qualified Hours</span>
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'15px', marginBottom:'30px'}}>
                                <div><span style={s.label}>MET</span><input style={s.input} value={job?.repair?.metHrs} onChange={e=>setJob({...job, repair:{...job.repair, metHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PANEL</span><input style={s.input} value={job?.repair?.panelHrs} onChange={e=>setJob({...job, repair:{...job.repair, panelHrs:e.target.value}})} /></div>
                                <div><span style={s.label}>PAINT</span><input style={s.input} value={job?.repair?.paintHrs} onChange={e=>setJob({...job, repair:{...job.repair, paintHrs:e.target.value}})} /></div>
                            </div>
                            <div style={{background:'#000', padding:'40px', borderRadius:'30px', border:'1px solid #333', marginBottom:'30px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:'32px'}}><span>Grand Total:</span><strong>£{totals.total.toFixed(2)}</strong></div>
                                <div style={{display:'flex', justifyContent:'space-between', color:theme.deal, borderTop:'2px solid #222', paddingTop:'20px', marginTop:'20px'}}><span>Insurer Balance:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                            </div>
                            <input style={{...s.input, color:theme.danger, border:`4px solid ${theme.danger}`}} placeholder="EXCESS -£" value={job?.repair?.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'25px'}}><button style={s.btnG('#333')} onClick={() => { setDocType('ESTIMATE'); setTimeout(() => window.print(), 100); }}>PRINT ESTIMATE</button><button style={s.btnG(theme.deal)} onClick={() => { setDocType('INVOICE'); setTimeout(() => window.print(), 100); }}>TO INVOICE</button></div>
                        </div>
                    </div>
                )}

                {view === 'RECENT' && (
                    <div>
                        <HeaderNav prev="HUB" /><h1 style={{color:theme.hub}}>REPAIR ARCHIVE</h1>
                        <div style={s.card('#222')}><div style={{height:'700px', overflowY:'auto'}}>
                            {(history || []).map((h, i) => (
                                <div key={i} style={{background:'#000', padding:'35px', borderRadius:'30px', border:'1px solid #333', marginBottom:'25px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                    <div><div style={{fontWeight:'900', fontSize:'32px'}}>{h?.vehicle?.reg}</div><div style={{fontSize:'16px', color:'#888'}}>{h?.client?.name || 'Private Client'}</div></div>
                                    <div style={{display:'flex', gap:'15px'}}><button style={{...s.btnG(theme.deal), padding:'18px 28px'}} onClick={() => { setJob(h); setView('HUB'); }}>LOAD</button><button style={{...s.btnG(theme.danger), padding:'18px 22px'}} onClick={async () => { if(window.confirm("Wipe Repair?")) await deleteDoc(doc(db, 'estimates', h.id)); }}>X</button></div>
                                </div>
                            ))}
                        </div></div>
                    </div>
                )}

                {view === 'SET' && (
                    <div>
                        <HeaderNav prev="HUB" /><h1 style={{color:theme.set}}>MASTER SETTINGS</h1>
                        <div style={s.card(theme.set)}>
                            <input style={s.input} placeholder="Business Name" value={settings.coName} onChange={e=>setSettings({...settings, coName:e.target.value})} />
                            <input style={s.input} placeholder="Bank Sort/Acc" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                            <input style={s.input} placeholder="DVLA API Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                            <button style={{...s.btnG(theme.deal), width:'100%', padding:'35px'}} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Locked."); }}>SAVE SETTINGS</button>
                        </div>
                    </div>
                )}

                {/* BOTTOM NAVIGATION DOCK */}
                <div className="no-print" style={s.dock}>
                    <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'110px'}}>HUB</button>
                    <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'110px'}}>EST</button>
                    <button onClick={()=>window.open('https://calendar.google.com/calendar/u/0/r?cid=markmonie72@gmail.com', '_blank')} style={{...s.btnG(theme.set), minWidth:'110px'}}>CAL</button>
                    <button onClick={()=>setView('RECENT')} style={{...s.btnG('#333'), minWidth:'110px'}}>JOBS</button>
                    <button onClick={()=>setView('SET')} style={{...s.btnG('#222'), minWidth:'110px'}}>SET</button>
                    <button style={{...s.btnG(theme.deal), minWidth:'220px'}} onClick={saveMaster}>SAVE MASTER</button>
                </div>
            </div>

            {/* PRINT VIEW (FLEX GRID LOCK) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'60px', fontFamily:'Arial', width:'100%', boxSizing:'border-box'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'10px solid #f97316', paddingBottom:'45px', width:'100%'}}>
                    <div style={{flex:1}}>
                        <h1 style={{margin:0, color:'#f97316', fontSize:'52px', fontWeight:'900'}}>{settings?.coName}</h1>
                        <p style={{fontSize:'20px'}}>{settings?.address}<br/>Tel: {settings?.phone}</p>
                    </div>
                    <div style={{textAlign:'right', flex:1}}>
                        <h2 style={{color:'#f97316', fontSize:'70px', margin:0}}>{docType}</h2>
                        <p style={{marginTop:'25px', fontSize:'24px'}}><strong>Reg:</strong> {job?.vehicle?.reg}<br/><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                        <p style={{fontSize:'18px', color:'#555'}}><strong>{job.vehicle.make} | {job.vehicle.year} | {job.vehicle.colour} | {job.vehicle.fuel}</strong></p>
                    </div>
                </div>
                <table style={{width:'100%', marginTop:'60px', borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f3f3f3', borderBottom:'6px solid #ddd'}}><th style={{padding:'30px', textAlign:'left', fontSize:'24px'}}>Description</th><th style={{padding:'30px', textAlign:'right', fontSize:'24px'}}>Amount</th></tr></thead>
                    <tbody>
                        {(job?.repair?.items || []).map((it, i) => (<tr key={i} style={{borderBottom:'2px solid #eee'}}><td style={{padding:'30px', fontSize:'20px'}}>{it?.desc}</td><td style={{textAlign:'right', padding:'30px', fontWeight:'bold', fontSize:'20px'}}>£{(parseFloat(it?.cost)*(1+(parseFloat(settings?.markup)/100))).toFixed(2)}</td></tr>))}
                        <tr style={{borderBottom:'2px solid #eee'}}><td style={{padding:'30px', fontSize:'20px'}}>Qualified Bodywork Labour ({totals?.lHrs} hrs)</td><td style={{textAlign:'right', padding:'30px', fontWeight:'bold', fontSize:'20px'}}>£{totals?.lPrice?.toFixed(2)}</td></tr>
                    </tbody>
                </table>
                <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:'50px', marginTop:'80px', width:'100%'}}>
                    <div style={{textAlign:'center'}}>
                        {docType === 'INVOICE' && settings?.paypalQr && (
                            <div>
                                <img src={settings.paypalQr} style={{width:'320px', height:'320px', objectFit:'contain', marginBottom:'20px'}} />
                                <div style={{fontSize:'22px', fontWeight:'900', background:'#fff3e0', padding:'35px', borderRadius:'30px', border:'4px solid #f97316'}}>PAYMENT TO: {settings?.bank}</div>
                            </div>
                        )}
                    </div>
                    <div style={{textAlign:'right'}}>
                        <h1 style={{color:'#f97316', fontSize:'80px', margin:'0 0 35px 0'}}>£{totals?.total?.toFixed(2)}</h1>
                        <div style={{background:'#fff3e0', padding:'45px', border:'5px solid #f97316', borderRadius:'40px', textAlign:'left'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px', fontSize:'22px'}}><span>CLIENT EXCESS:</span><strong style={{fontSize:'34px'}}>£{totals?.customer?.toFixed(2)}</strong></div>
                            <div style={{display:'flex', justifyContent:'space-between', color:'#f97316', borderTop:'4px solid #f97316', paddingTop:'30px', fontSize:'22px'}}><span>INSURER BALANCE:</span><strong style={{fontSize:'48px'}}>£{totals?.insurer?.toFixed(2)}</strong></div>
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
