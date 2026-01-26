import React, { useState, useEffect, useRef, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, updateDoc, doc, onSnapshot, query, orderBy, serverTimestamp, where, getDocs, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyDVfPvFLoL5eqQ3WQB96n08K3thdclYXRQ",
  authDomain: "triple-mmm-body-repairs.firebaseapp.com",
  projectId: "triple-mmm-body-repairs",
  storageBucket: "triple-mmm-body-repairs.firebasestorage.app",
  messagingSenderId: "110018101133",
  appId: "1:110018101133:web:63b0996c7050c4967147c4",
  measurementId: "G-NRDPCR0SR2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// --- INTERNAL AXIOS ENGINE (The Stable 2:22 PM Logic) ---
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

// --- PREMIUM RACING THEME ---
const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}` },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnGreen: { background: theme.success, color: 'white', border: 'none', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    btnOrange: { background: theme.accent, color: 'white', border: 'none', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [currentJobId, setCurrentJobId] = useState(null);

    // --- GLOBAL SETTINGS ---
    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        email: 'markmonie72@gmail.com', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc',
        vatRate: '0', markup: '20', labourRate: '50', terms: 'Payment due on vehicle collection.'
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '', year: '', fuel: '', mot: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', network: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '', photos: [] });
    const [savedJobs, setSavedJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const lookupReg = async () => {
        if (!vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            const d = res.data;
            setVehicle(v => ({ ...v, makeModel: `${d.make} ${d.colour}`, year: d.yearOfManufacture, fuel: d.fuelType, mot: d.motStatus }));
            alert("✅ Vehicle Found!");
        } catch (e) { alert("⚠️ Connection Error. Manual Entry Enabled."); }
        setLoading(false);
    };

    const totals = useMemo(() => {
        const partsCost = repair.items.reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const partsPrice = partsCost * (1 + (parseFloat(settings.markup) / 100));
        const labourPrice = (parseFloat(repair.labourHours) || 0) * (parseFloat(settings.labourRate) || 0);
        const paintPrice = parseFloat(repair.paintMaterials) || 0;
        const subtotal = partsPrice + labourPrice + paintPrice;
        const vat = subtotal * (parseFloat(settings.vatRate) / 100);
        const total = subtotal + vat;
        return { 
            partsPrice, labourPrice, paintPrice, subtotal, vat, total, 
            due: total - (parseFloat(repair.excess) || 0),
            netProfit: total - (partsCost + paintPrice) // Actual Profit
        };
    }, [repair, settings]);

    const saveJob = async () => {
        setSaveStatus('SAVING');
        const data = { customer, vehicle, insurance, repair, totals, createdAt: serverTimestamp() };
        if (currentJobId) await updateDoc(doc(db, 'estimates', currentJobId), data);
        else { const res = await addDoc(collection(db, 'estimates'), data); setCurrentJobId(res.id); }
        setSaveStatus('SUCCESS'); setTimeout(() => setSaveStatus('IDLE'), 2000);
    };

    const loadJob = (j) => {
        setCurrentJobId(j.id);
        setCustomer(j.customer || {});
        setVehicle(j.vehicle || {});
        setInsurance(j.insurance || {});
        setRepair(j.repair || { items: [], photos: [] });
        setMode('ESTIMATE');
        window.scrollTo(0, 0);
    };

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: theme.accent, letterSpacing: '-1px' }}>TRIPLE <span style={{ color: 'white' }}>MMM</span></h1>
                <div style={{ textAlign: 'right', fontSize: '10px', color: theme.textDim }}>{settings.coName}<br/>{settings.phone}</div>
            </div>

            {/* VEHICLE INTAKE */}
            <div style={s.card}>
                <span style={s.label}>Vehicle Search</span>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input style={{ ...s.input, fontSize: '24px', fontWeight: '900', color: theme.accent, textAlign: 'center', marginBottom: 0 }} value={vehicle.reg} onChange={e => setVehicle({ ...vehicle, reg: e.target.value.toUpperCase() })} />
                    <button onClick={lookupReg} style={{...s.btnGreen, width: '80px'}}>{loading ? '...' : 'SEARCH'}</button>
                </div>
                <input style={s.input} placeholder="Make & Model" value={vehicle.makeModel} onChange={e => setVehicle({...vehicle, makeModel: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{background: '#0f172a', padding: '10px', borderRadius: '8px'}}><span style={s.label}>Year</span>{vehicle.year}</div>
                    <div style={{background: '#0f172a', padding: '10px', borderRadius: '8px'}}><span style={s.label}>Fuel</span>{vehicle.fuel}</div>
                </div>
                <div style={{marginTop: '10px'}}><span style={s.label}>Paint Code / VIN</span>
                    <input style={s.input} placeholder="Paint Code" value={vehicle.paint} onChange={e => setVehicle({...vehicle, paint: e.target.value})} />
                    <input style={s.input} placeholder="Chassis / VIN" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                </div>
            </div>

            {/* FINANCIAL PAGE / DASHBOARD */}
            <div style={{ ...s.card, background: theme.accent }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px' }}>
                    <div><span style={{ fontSize: '11px', opacity: 0.8 }}>ESTIMATED NET PROFIT</span><div style={{ fontSize: '32px', fontWeight: '900' }}>£{totals.netProfit.toFixed(2)}</div></div>
                    <div style={{ textAlign: 'right' }}><span style={{ fontSize: '11px', opacity: 0.8 }}>TOTAL DUE</span><div style={{ fontSize: '32px', fontWeight: '900' }}>£{totals.due.toFixed(2)}</div></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div><span style={s.label}>Labour Hours</span><input type="number" style={{...s.input, background: 'rgba(0,0,0,0.2)', border: 'none'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                    <div><span style={s.label}>Paint & Mats £</span><input type="number" style={{...s.input, background: 'rgba(0,0,0,0.2)', border: 'none'}} value={repair.paintMaterials} onChange={e => setRepair({...repair, paintMaterials: e.target.value})} /></div>
                </div>
            </div>

            {/* REPAIR ESTIMATOR */}
            <div style={s.card}>
                <span style={s.label}>Repair Items</span>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input id="desc" placeholder="Panel / Part" style={{ ...s.input, flex: 2, marginBottom: 0 }} />
                    <input id="cost" type="number" placeholder="Cost £" style={{ ...s.input, flex: 1, marginBottom: 0 }} />
                    <button onClick={() => { 
                        const d = document.getElementById('desc'), c = document.getElementById('cost'); 
                        if(!d.value) return;
                        setRepair({...repair, items: [...repair.items, { desc: d.value, cost: c.value }]}); 
                        d.value = ''; c.value = ''; 
                    }} style={{...s.btnGreen, padding: '0 20px'}}>+</button>
                </div>
                {repair.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #334155' }}>
                        <span>{it.desc}</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <strong>£{(it.cost * (1 + (settings.markup/100))).toFixed(2)}</strong>
                            <button onClick={()=>setRepair({...repair, items: repair.items.filter((_,idx)=>idx!==i)})} style={{color:theme.danger, background:'none', border:'none'}}>✕</button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={s.card}>
                <span style={s.label}>Customer & Insurance</span>
                <input style={s.input} placeholder="Customer Name" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                <input style={s.input} placeholder="Insurance Company" value={insurance.co} onChange={e => setInsurance({...insurance, co: e.target.value})} />
            </div>

            {/* RECENT JOBS */}
            <h3 style={s.label}>Workshop History</h3>
            {savedJobs.map(j => (
                <div key={j.id} onClick={() => loadJob(j)} style={{ ...s.card, padding: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                    <div><strong style={{color:theme.accent}}>{j.vehicle?.reg}</strong><br/><small>{j.customer?.name}</small></div>
                    <button onClick={(e) => { e.stopPropagation(); if(window.confirm("Delete?")) deleteDoc(doc(db, 'estimates', j.id)); }} style={{ background: theme.danger, border: 'none', color: 'white', borderRadius: '50%', width: '30px', height:'30px' }}>✕</button>
                </div>
            ))}

            {/* ACTION BAR */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '20px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={saveJob} style={{ ...s.btnGreen, flex: 2 }}>{saveStatus === 'IDLE' ? 'SAVE & SYNC' : 'SAVED ✓'}</button>
                <button onClick={() => setMode('SETTINGS')} style={s.secondaryBtn}>⚙️</button>
                <button onClick={() => window.location.reload()} style={{...s.secondaryBtn, background: theme.danger}}>NEW</button>
            </div>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)), []);
    return u ? <EstimateApp userId={u} /> : <div style={{ background: theme.bg, color: theme.accent, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>STARTING WORKSHOP ENGINE...</div>;
};
export default App;
