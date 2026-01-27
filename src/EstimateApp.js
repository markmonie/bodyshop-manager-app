import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- CONFIGURATION ---
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

// --- THEME & STYLES ---
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '14px', padding: '25px', marginBottom: '20px', border: `1px solid ${theme.border}`, borderTop: `6px solid ${color || theme.hub}`, boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '14px', borderRadius: '10px', marginBottom: '12px', outline: 'none' },
    label: { color: '#94a3b8', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', display: 'block' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '16px 28px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '18px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    
    const [settings, setSettings] = useState({ coName: 'Triple MMM Body Repairs', address: '20A New Street, ML9 3LT', phone: '07501 728319', bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '' });
    const [job, setJob] = useState({
        client: { name: '', phone: '', address: '' },
        insurance: { co: '', claim: '', network: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0' }
    });
    const [history, setHistory] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const sub = partsPrice + labPrice + parseFloat(job.repair.paintMats || 0);
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        return { total, sub, vat, customer: parseFloat(job.repair.excess || 0), insurer: total - parseFloat(job.repair.excess || 0), profit: total - (partsCost + parseFloat(job.repair.paintMats || 0)), labPrice };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, mot: d.motStatus, tax: d.taxStatus, colour: d.colour}});
        } catch (e) { alert("DVLA Link Down."); }
        setLoading(false);
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '140px' }}>
            
            {/* VIEW: HUB */}
            {view === 'HUB' && (
                <div>
                    <h1 style={{color:theme.hub}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Vehicle Specs (DVLA)</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:2, fontSize:'20px', fontWeight:'bold'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'100px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Manual Chassis / VIN" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Stakeholders</span>
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                            <input style={s.input} placeholder="Network ID" value={job.insurance.network} onChange={e=>setJob({...job, insurance:{...job.insurance, network:e.target.value}})} />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATE (GREEN)</button>
                    </div>
                </div>
            )}

            {/* VIEW: ESTIMATOR */}
            {view === 'EST' && (
                <div>
                    <h2 style={{color:theme.hub}}>ESTIMATING ENGINE: {job.vehicle.reg}</h2>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Parts & Markup</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <input id="ptD" style={{...s.input, flex:2}} placeholder="Part Name" />
                            <input id="ptC" style={{...s.input, flex:1}} placeholder="Price £" />
                            <button style={s.btnG(theme.deal)} onClick={()=>{
                                const d=document.getElementById('ptD'), c=document.getElementById('ptC');
                                if(d.value && c.value) setJob({...job, repair:{...job.repair, items:[...job.repair.items, {desc:d.value, cost:c.value}]}});
                                d.value=''; c.value='';
                            }}>+</button>
                        </div>
                        {job.repair.items.map((it, i) => (
                            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #333'}}>
                                <span>{it.desc}</span>
                                <strong>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</strong>
                            </div>
                        ))}
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>Paint & Adjustments</span>
                        <input style={s.input} placeholder="Paint & Materials £" value={job.repair.paintMats} onChange={e=>setJob({...job, repair:{...job.repair, paintMats:e.target.value}})} />
                        <input style={{...s.input, color:theme.danger}} placeholder="Excess -£" value={job.repair.excess} onChange={e=>setJob({...job, repair:{...job.repair, excess:e.target.value}})} />
                    </div>
                    <div style={{...s.card(theme.deal), background:theme.deal, border:'none'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <div><span style={{color:'white', opacity:0.8, fontSize:'10px'}}>TOTAL DUE</span><h1 style={{margin:0}}>£{totals.total.toFixed(2)}</h1></div>
                            <button style={{background:'white', color:theme.deal, border:'none', padding:'10px 20px', borderRadius:'10px', fontWeight:'900'}} onClick={() => window.print()}>PRINT INVOICE</button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW: FINANCE */}
            {view === 'FIN' && (
                <div>
                    <h1 style={{color:theme.set}}>FINANCIAL VAULT</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Monthly Performance</span>
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'20px'}}>
                            <div style={{background:'#000', padding:'20px', borderRadius:'10px'}}><span style={s.label}>Total Income</span><h2 style={{margin:0}}>£{history.reduce((a,b)=>a+(b.totals?.total||0),0).toFixed(2)}</h2></div>
                            <div style={{background:'#000', padding:'20px', borderRadius:'10px'}}><span style={s.label}>Net Profit</span><h2 style={{margin:0, color:theme.deal}}>£{history.reduce((a,b)=>a+(b.totals?.profit||0),0).toFixed(2)}</h2></div>
                        </div>
                        <button style={s.btnG(theme.set)} onClick={() => alert("CSV Exporting...")}>DOWNLOAD REVENUE LOG (CSV)</button>
                    </div>
                </div>
            )}

            {/* VIEW: SETTINGS */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>SETTINGS</h1>
                    <div style={s.card(theme.set)}>
                        <input style={s.input} placeholder="Labour Rate £/hr" value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} />
                        <input style={s.input} placeholder="Parts Markup %" value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} />
                        <input style={s.input} placeholder="VAT Rate %" value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} />
                        <input style={s.input} placeholder="Bank Details" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                        <button style={s.btnG(theme.set)} onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved"); }}>SAVE SETTINGS (GREEN)</button>
                    </div>
                </div>
            )}

            {/* PRINT VIEW (SPLIT INVOICE) */}
            <div className="print-only" style={{display:'none', color:'black', padding:'40px', fontFamily:'Arial'}}>
                <div style={{display:'flex', justifyContent:'space-between', borderBottom:'4px solid orange', paddingBottom:'20px'}}>
                    <div><h1>{settings.coName}</h1><p>{settings.address}</p></div>
                    <div style={{textAlign:'right'}}><h2 style={{color:'orange'}}>INVOICE</h2><p>Date: {new Date().toLocaleDateString()}<br/>Reg: {job.vehicle.reg}</p></div>
                </div>
                <h3 style={{marginTop:'30px'}}>Vehicle: {job.vehicle.make} | Chassis: {job.vehicle.vin}</h3>
                <table style={{width:'100%', marginTop:'20px', borderCollapse:'collapse'}}>
                    <tr style={{background:'#eee'}}><th style={{padding:'10px', textAlign:'left'}}>Description</th><th style={{padding:'10px', textAlign:'right'}}>Total</th></tr>
                    {job.repair.items.map((it, i) => (
                        <tr key={i} style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'10px'}}>{it.desc}</td><td style={{textAlign:'right', padding:'10px'}}>£{(parseFloat(it.cost)*(1+(parseFloat(settings.markup)/100))).toFixed(2)}</td></tr>
                    ))}
                    <tr style={{borderBottom:'1px solid #ddd'}}><td style={{padding:'10px'}}>Paint & Specialist Materials</td><td style={{textAlign:'right', padding:'10px'}}>£{parseFloat(job.repair.paintMats || 0).toFixed(2)}</td></tr>
                </table>
                <div style={{textAlign:'right', marginTop:'30px'}}>
                    <h2>Grand Total: £{totals.total.toFixed(2)}</h2>
                    <div style={{background:'#fff3e0', padding:'20px', border:'2px solid orange', marginTop:'20px', textAlign:'left'}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}><span>Customer Excess:</span><strong>£{totals.customer.toFixed(2)}</strong></div>
                        <div style={{display:'flex', justifyContent:'space-between', color:'orange', marginTop:'10px'}}><span>Insurer Balance Due:</span><strong>£{totals.insurer.toFixed(2)}</strong></div>
                    </div>
                </div>
            </div>

            {/* DOCK BAR */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                <button onClick={()=>setView('FIN')} style={{...s.btnG(theme.set), minWidth:'80px'}}>FIN</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(theme.set), minWidth:'80px'}}>SET</button>
                <button style={{...s.btnG(theme.deal), minWidth:'120px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Synced Successfully");
                }}>SAVE ALL</button>
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
