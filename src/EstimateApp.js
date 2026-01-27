import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc, doc } from 'firebase/firestore';
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

// --- STABLE DVLA HANDSHAKE ---
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
const theme = { hub: '#f97316', work: '#fbbf24', deal: '#16a34a', set: '#2563eb', bg: '#000', card: '#111', text: '#f8fafc', border: '#333', danger: '#ef4444' };
const s = {
    card: (color) => ({ background: theme.card, borderRadius: '14px', padding: '25px', marginBottom: '20px', border: `1px solid ${theme.border}`, borderTop: `6px solid ${color || theme.hub}`, boxShadow: '0 10px 40px rgba(0,0,0,0.6)' }),
    input: { width: '100%', background: '#000', border: '1px solid #444', color: '#fff', padding: '14px', borderRadius: '10px', marginBottom: '12px', outline: 'none', fontSize: '15px' },
    label: { color: '#94a3b8', fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '6px', display: 'block', letterSpacing: '0.8px' },
    btnG: (bg) => ({ background: bg || theme.deal, color: 'white', border: 'none', padding: '16px 28px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }),
    dock: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#111', padding: '18px', display: 'flex', gap: '15px', overflowX: 'auto', borderTop: '2px solid #333', zIndex: 1000, justifyContent: 'center' }
};

const EstimateApp = ({ userId }) => {
    const [view, setView] = useState('HUB'); 
    const [loading, setLoading] = useState(false);
    
    const [settings, setSettings] = useState({ coName: 'Triple MMM Body Repairs', address: '20A New Street, ML9 3LT', phone: '07501 728319', bank: '80-22-60 | 06163462', markup: '20', labourRate: '50', vatRate: '20', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc', logoUrl: '', password: '1234', terms: 'Payment due strictly on collection.' });
    const [job, setJob] = useState({
        client: { name: '', phone: '', email: '', address: '' },
        insurance: { co: '', claim: '', network: '', email: '', address: '' },
        vehicle: { reg: '', make: '', vin: '', year: '', fuel: '', engine: '', mot: '', tax: '', colour: '' },
        repair: { items: [], panelHrs: '0', paintHrs: '0', metHrs: '0', paintMats: '0', excess: '0' }
    });

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
    }, []);

    const totals = useMemo(() => {
        const partsCost = (job.repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labHrs = (parseFloat(job.repair.panelHrs || 0) + parseFloat(job.repair.paintHrs || 0) + parseFloat(job.repair.metHrs || 0));
        const labPrice = labHrs * parseFloat(settings.labourRate);
        const paintPrice = parseFloat(job.repair.paintMats || 0);
        const sub = partsPrice + labPrice + paintPrice;
        const vat = sub * (parseFloat(settings.vatRate) / 100);
        const total = sub + vat;
        return { total, sub, vat, customer: parseFloat(job.repair.excess || 0), insurer: total - parseFloat(job.repair.excess || 0) };
    }, [job.repair, settings]);

    const runDVLA = async () => {
        if (!job.vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: job.vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setJob({...job, vehicle: {...job.vehicle, make: d.make, year: d.yearOfManufacture, fuel: d.fuelType, engine: d.engineCapacity, mot: d.motStatus, tax: d.taxStatus, colour: d.colour}});
        } catch (e) { alert("DVLA Link Down."); }
        setLoading(false);
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '140px' }}>
            
            {/* HUB PAGE (DATA ACQUISITION) */}
            {view === 'HUB' && (
                <div>
                    <h1 style={{color:theme.hub}}>MANAGEMENT HUB</h1>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>1. Legal DVLA Data</span>
                        <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                            <input style={{...s.input, flex:2, fontSize:'20px', fontWeight:'bold'}} value={job.vehicle.reg} onChange={e=>setJob({...job, vehicle:{...job.vehicle, reg:e.target.value.toUpperCase()}})} placeholder="REG" />
                            <button style={{...s.btnG(theme.hub), width:'100px'}} onClick={runDVLA}>{loading ? '...' : 'FIND'}</button>
                        </div>
                        <input style={s.input} placeholder="Manual Chassis / VIN" value={job.vehicle.vin} onChange={e=>setJob({...job, vehicle:{...job.vehicle, vin:e.target.value}})} />
                    </div>
                    <div style={s.card(theme.hub)}>
                        <span style={s.label}>2. Client & Insurance Hub</span>
                        <input style={s.input} placeholder="Client Name" value={job.client.name} onChange={e=>setJob({...job, client:{...job.client, name:e.target.value}})} />
                        <input style={s.input} placeholder="Insurance Company" value={job.insurance.co} onChange={e=>setJob({...job, insurance:{...job.insurance, co:e.target.value}})} />
                        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px'}}>
                            <input style={s.input} placeholder="Claim #" value={job.insurance.claim} onChange={e=>setJob({...job, insurance:{...job.insurance, claim:e.target.value}})} />
                            <input style={s.input} placeholder="Network ID" value={job.insurance.network} onChange={e=>setJob({...job, insurance:{...job.insurance, network:e.target.value}})} />
                        </div>
                        <button style={{...s.btnG(theme.deal), width:'100%'}} onClick={()=>setView('EST')}>IMPORT TO ESTIMATOR (GREEN)</button>
                    </div>
                </div>
            )}

            {/* SETTINGS PAGE (NO LONGER BLANK) */}
            {view === 'SET' && (
                <div>
                    <h1 style={{color:theme.set}}>ENTERPRISE SETTINGS</h1>
                    <div style={s.card(theme.set)}>
                        <span style={s.label}>Workshop Configuration</span>
                        <input style={s.input} placeholder="Labour Rate £/hr" value={settings.labourRate} onChange={e=>setSettings({...settings, labourRate:e.target.value})} />
                        <input style={s.input} placeholder="Parts Markup %" value={settings.markup} onChange={e=>setSettings({...settings, markup:e.target.value})} />
                        <input style={s.input} placeholder="VAT Rate %" value={settings.vatRate} onChange={e=>setSettings({...settings, vatRate:e.target.value})} />
                        <span style={s.label}>Legal & Branding</span>
                        <input style={s.input} placeholder="DVLA API Key" value={settings.dvlaKey} onChange={e=>setSettings({...settings, dvlaKey:e.target.value})} />
                        <input style={s.input} placeholder="Bank Details" value={settings.bank} onChange={e=>setSettings({...settings, bank:e.target.value})} />
                        <button style={{...s.btnG(theme.set), width:'100%'}} onClick={async () => {
                            await setDoc(doc(db, 'settings', 'global'), settings);
                            alert("Settings Saved Successfully");
                        }}>SAVE ALL SETTINGS (GREEN)</button>
                    </div>
                </div>
            )}

            {/* DOCK BAR (VISIBLE & INTERACTIVE) */}
            <div className="no-print" style={s.dock}>
                <button onClick={()=>setView('HUB')} style={{...s.btnG(view === 'HUB' ? theme.hub : '#222'), minWidth:'80px'}}>HUB</button>
                <button onClick={()=>setView('EST')} style={{...s.btnG(view === 'EST' ? theme.hub : '#222'), minWidth:'80px'}}>EST</button>
                <button onClick={()=>setView('SET')} style={{...s.btnG(view === 'SET' ? theme.set : '#222'), minWidth:'80px'}}>SET</button>
                <button style={{...s.btnG(theme.deal), minWidth:'120px'}} onClick={async () => {
                    await setDoc(doc(db, 'estimates', job.vehicle.reg || Date.now().toString()), { ...job, totals, createdAt: serverTimestamp() });
                    alert("Triple MMM System Synced");
                }}>SAVE ALL</button>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
