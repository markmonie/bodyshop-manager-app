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
const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#22c55e', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}` },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btn: { background: theme.accent, color: 'white', border: 'none', padding: '14px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [loading, setLoading] = useState(false);
    const [saveStatus, setSaveStatus] = useState('IDLE');
    const [currentJobId, setCurrentJobId] = useState(null);

    // --- GLOBAL SETTINGS ---
    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs',
        address: '20A New Street, Stonehouse, ML9 3LT',
        phone: '07501 728319',
        email: 'markmonie72@gmail.com',
        dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc',
        vatRate: '0',
        markup: '20',
        labourRate: '50',
        terms: 'Payment due on vehicle collection. Vehicle remains property of Triple MMM until paid in full.'
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '' });
    const [insurance, setInsurance] = useState({ co: '', claim: '', network: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '', photos: [] });
    const [savedJobs, setSavedJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(snap.data()));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

    const lookupReg = async () => {
        if (!vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            setVehicle(v => ({ ...v, makeModel: `${res.data.make} ${res.data.colour}` }));
            alert("✅ Vehicle Found!");
        } catch (e) { alert("⚠️ Connection Blocked. Manual Entry Enabled."); }
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
        return { partsPrice, labourPrice, paintPrice, subtotal, vat, total, due: total - (parseFloat(repair.excess) || 0) };
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
    };

    if (mode === 'SETTINGS') return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px' }}>
            <button onClick={() => setMode('ESTIMATE')} style={s.secondaryBtn}>← BACK</button>
            <h2 style={{ color: theme.accent }}>SHOP SETTINGS</h2>
            <div style={s.card}>
                <span style={s.label}>Company Details</span>
                <input style={s.input} placeholder="Company Name" value={settings.coName} onChange={e => setSettings({...settings, coName: e.target.value})} />
                <textarea style={{...s.input, height: '60px'}} placeholder="Address / Letterhead" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input style={s.input} placeholder="VAT Rate %" value={settings.vatRate} onChange={e => setSettings({...settings, vatRate: e.target.value})} />
                    <input style={s.input} placeholder="Parts Markup %" value={settings.markup} onChange={e => setSettings({...settings, markup: e.target.value})} />
                </div>
                <input style={s.input} placeholder="Labour Rate £/hr" value={settings.labourRate} onChange={e => setSettings({...settings, labourRate: e.target.value})} />
                <span style={s.label}>DVLA API Key</span>
                <input style={s.input} value={settings.dvlaKey} onChange={e => setSettings({...settings, dvlaKey: e.target.value})} />
                <span style={s.label}>Terms & Conditions</span>
                <textarea style={{...s.input, height: '100px'}} value={settings.terms} onChange={e => setSettings({...settings, terms: e.target.value})} />
                <button onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Settings Saved"); }} style={s.btn}>SAVE GLOBAL SETTINGS</button>
            </div>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: theme.accent, letterSpacing: '-1px' }}>TRIPLE <span style={{ color: 'white' }}>MMM</span></h1>
                <div style={{ textAlign: 'right', fontSize: '10px', color: theme.textDim }}>{settings.coName}<br/>{settings.phone}</div>
            </div>

            <div style={s.card}>
                <span style={s.label}>Vehicle Intake</span>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input style={{ ...s.input, fontSize: '24px', fontWeight: '900', color: theme.accent, textAlign: 'center', marginBottom: 0 }} value={vehicle.reg} onChange={e => setVehicle({ ...vehicle, reg: e.target.value.toUpperCase() })} />
                    <button onClick={lookupReg} style={s.btn}>{loading ? '...' : '🔎'}</button>
                </div>
                <input style={s.input} placeholder="Make & Model" value={vehicle.makeModel} onChange={e => setVehicle({...vehicle, makeModel: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input style={s.input} placeholder="VIN" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                    <input style={s.input} placeholder="Paint Code" value={vehicle.paint} onChange={e => setVehicle({...vehicle, paint: e.target.value})} />
                </div>
            </div>

            <div style={s.card}>
                <span style={s.label}>Client & Insurance</span>
                <input style={s.input} placeholder="Customer Name" value={customer.name} onChange={e => setCustomer({...customer, name: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input style={s.input} placeholder="Insurer" value={insurance.co} onChange={e => setInsurance({...insurance, co: e.target.value})} />
                    <input style={s.input} placeholder="Claim #" value={insurance.claim} onChange={e => setInsurance({...insurance, claim: e.target.value})} />
                </div>
            </div>

            <div style={s.card}>
                <span style={s.label}>Estimating Breakdowns</span>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                    <input id="desc" placeholder="Repair Item" style={{ ...s.input, flex: 2, marginBottom: 0 }} />
                    <input id="cost" type="number" placeholder="Cost £" style={{ ...s.input, flex: 1, marginBottom: 0 }} />
                    <button onClick={() => { 
                        const d = document.getElementById('desc'), c = document.getElementById('cost'); 
                        setRepair({...repair, items: [...repair.items, { desc: d.value, cost: c.value }]}); 
                        d.value = ''; c.value = ''; 
                    }} style={s.btn}>+</button>
                </div>
                {repair.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #334155' }}>
                        <span>{it.desc}</span>
                        <span>£{(it.cost * (1 + (settings.markup/100))).toFixed(2)}</span>
                    </div>
                ))}
            </div>

            <div style={{ ...s.card, background: theme.accent }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div><span style={s.label}>Labour Hours</span><input type="number" style={{...s.input, background: 'rgba(0,0,0,0.2)'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                    <div><span style={s.label}>Paint & Materials</span><input type="number" style={{...s.input, background: 'rgba(0,0,0,0.2)'}} value={repair.paintMaterials} onChange={e => setRepair({...repair, paintMaterials: e.target.value})} /></div>
                </div>
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px' }}>
                    <div><span style={{ fontSize: '10px' }}>DUE TOTAL</span><div style={{ fontSize: '24px', fontWeight: 'bold' }}>£{totals.due.toFixed(2)}</div></div>
                    <div style={{ textAlign: 'right' }}><span style={{ fontSize: '10px' }}>EXCESS</span><input type="number" style={{ width: '80px', background: 'none', border: 'none', color: 'white', borderBottom: '1px solid white' }} value={repair.excess} onChange={e => setRepair({...repair, excess: e.target.value})} /></div>
                </div>
            </div>

            <h3 style={s.label}>Recent Jobs</h3>
            {savedJobs.map(j => (
                <div key={j.id} onClick={() => loadJob(j)} style={{ ...s.card, padding: '12px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>{j.vehicle?.reg} - {j.customer?.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'estimates', j.id)); }} style={{ background: theme.danger, border: 'none', color: 'white', borderRadius: '4px' }}>X</button>
                </div>
            ))}

            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '20px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={saveJob} style={{ ...s.btn, flex: 2 }}>{saveStatus === 'IDLE' ? 'SAVE ESTIMATE' : 'SAVED ✓'}</button>
                <button onClick={() => setMode('SETTINGS')} style={s.secondaryBtn}>⚙️</button>
                <button onClick={() => window.print()} style={s.secondaryBtn}>🖨️</button>
            </div>
            <style>{`@media print { .no-print, button, input[type="number"] { display: none !important; } body { background: white; color: black; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth)), []);
    return u ? <EstimateApp userId={u} /> : <div style={{ background: theme.bg, color: theme.accent, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>STARTING WORKSHOP ENGINE...</div>;
};
export default App;
