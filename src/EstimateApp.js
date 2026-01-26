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

const theme = { bg: '#0f172a', card: '#1e293b', accent: '#f97316', text: '#f8fafc', textDim: '#94a3b8', success: '#16a34a', danger: '#ef4444', border: '#334155' };
const s = {
    card: { background: theme.card, borderRadius: '16px', padding: '20px', marginBottom: '20px', border: `1px solid ${theme.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' },
    input: { width: '100%', background: '#0f172a', border: `1px solid ${theme.border}`, color: theme.text, padding: '12px', borderRadius: '8px', marginBottom: '10px', outline: 'none' },
    label: { color: theme.accent, fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px', display: 'block' },
    btnGreen: { background: theme.success, color: 'white', border: 'none', padding: '14px 24px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
    secondaryBtn: { background: '#334155', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }
};

const EstimateApp = ({ userId }) => {
    const [mode, setMode] = useState('ESTIMATE');
    const [loading, setLoading] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);
    const [expPhoto, setExpPhoto] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc',
        vatRate: '0', markup: '20', labourRate: '50', terms: 'Payment due on collection.'
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '', year: '', fuel: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '', photos: [] });
    const [savedJobs, setSavedJobs] = useState([]);
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        const draft = localStorage.getItem('triple_mmm_draft');
        if (draft) {
            try {
                const d = JSON.parse(draft);
                setCustomer(d.customer || {}); setVehicle(d.vehicle || {}); setRepair(d.repair || { items: [], photos: [] });
            } catch (e) {}
        }
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        const unsubJobs = onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubExp = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snap) => setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        return () => { unsubJobs(); unsubExp(); };
    }, []);

    useEffect(() => { localStorage.setItem('triple_mmm_draft', JSON.stringify({ customer, vehicle, repair })); }, [customer, vehicle, repair]);

    const totals = useMemo(() => {
        const pCost = (repair.items || []).reduce((a, b) => a + (parseFloat(b.cost) || 0), 0);
        const pPrice = pCost * (1 + (parseFloat(settings.markup || 20) / 100));
        const labour = (parseFloat(repair.labourHours) || 0) * (parseFloat(settings.labourRate || 50) || 0);
        const paint = parseFloat(repair.paintMaterials) || 0;
        const sub = pPrice + labour + paint;
        const vat = sub * (parseFloat(settings.vatRate || 0) / 100);
        const total = sub + vat;
        return { sub, vat, total, due: total - (parseFloat(repair.excess) || 0), netProfit: total - (pCost + paint), labourPrice: labour, paintPrice: paint };
    }, [repair, settings]);

    const lookupReg = async () => {
        if (!vehicle.reg) return;
        setLoading(true);
        const proxy = `https://corsproxy.io/?${encodeURIComponent('https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles')}`;
        try {
            const res = await axios.post(proxy, { registrationNumber: vehicle.reg }, { headers: { 'x-api-key': settings.dvlaKey } });
            setVehicle(v => ({ ...v, makeModel: `${res.data.make} ${res.data.colour}`, year: res.data.yearOfManufacture, fuel: res.data.fuelType }));
        } catch (e) { alert("DVLA Blocked. Manual Entry Enabled."); }
        setLoading(false);
    };

    const handleFileUpload = async (e, path) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `${path}/${Date.now()}_${file.name}`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        if (path === 'expenses') setExpPhoto(url);
        else setRepair(prev => ({ ...prev, photos: [...(prev.photos || []), url] }));
    };

    const exportCSV = (type) => {
        let csv = type === 'SALES' ? "Date,Reg,Customer,Amount\n" : "Date,Description,Amount,ReceiptURL\n";
        const list = type === 'SALES' ? savedJobs : expenses;
        list.forEach(i => {
            const d = new Date(i.date?.seconds * 1000 || Date.now()).toLocaleDateString();
            csv += type === 'SALES' ? `${d},${i.vehicle?.reg},${i.customer?.name},${i.totals?.due}\n` : `${d},${i.desc},${i.amount},${i.receiptUrl || ''}\n`;
        });
        const link = document.createElement("a");
        link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
        link.download = `TripleMMM_${type}.csv`; link.click();
    };

    if (mode === 'FINANCE') return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px' }}>
            <button onClick={() => setMode('ESTIMATE')} style={s.secondaryBtn}>← BACK</button>
            <h2 style={{ color: theme.accent, marginTop: '20px' }}>FINANCIAL DEPARTMENT</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={s.card}><span style={s.label}>Total Income</span><div style={{ fontSize: '24px', fontWeight: 'bold' }}>£{savedJobs.reduce((a, b) => a + (b.totals?.due || 0), 0).toFixed(2)}</div></div>
                <div style={s.card}><span style={s.label}>Net Profit</span><div style={{ fontSize: '24px', fontWeight: 'bold', color: theme.success }}>£{savedJobs.reduce((a, b) => a + (b.totals?.netProfit || 0), 0).toFixed(2)}</div></div>
            </div>
            <div style={s.card}>
                <span style={s.label}>Log Expenditure (Costs)</span>
                <input id="exD" placeholder="Stock/Materials/Rent" style={s.input} />
                <input id="exA" placeholder="Amount £" style={s.input} />
                <span style={s.label}>Upload Receipt Photo</span>
                <input type="file" onChange={(e) => handleFileUpload(e, 'expenses')} style={{marginBottom:'10px'}} />
                {expPhoto && <p style={{color:theme.success, fontSize:'10px'}}>Receipt Linked ✓</p>}
                <button onClick={async () => {
                    const d = document.getElementById('exD'), a = document.getElementById('exA');
                    await addDoc(collection(db, 'expenses'), { desc: d.value, amount: a.value, receiptUrl: expPhoto, date: serverTimestamp() });
                    d.value = ''; a.value = ''; setExpPhoto(null);
                }} style={{...s.btnGreen, width:'100%'}}>Save Expenditure</button>
            </div>
            <button onClick={() => exportCSV('SALES')} style={{ ...s.secondaryBtn, width: '100%', marginBottom: '10px' }}>Download Income CSV (Accountant)</button>
            <button onClick={() => exportCSV('EXPENSES')} style={{ ...s.secondaryBtn, width: '100%' }}>Download Expenditure CSV (Accountant)</button>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ color: theme.accent, letterSpacing: '-1px' }}>TRIPLE <span style={{color:'white'}}>MMM</span></h1>
                <div style={{ textAlign: 'right', fontSize: '10px' }}>{settings.coName}<br/>{settings.phone}</div>
            </div>

            <div className="no-print" style={s.card}>
                <span style={s.label}>Vehicle Intake (DVLA)</span>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input style={{ ...s.input, fontSize: '24px', fontWeight: '900', color: theme.accent, textAlign: 'center', marginBottom: 0 }} value={vehicle.reg} onChange={e => setVehicle({ ...vehicle, reg: e.target.value.toUpperCase() })} />
                    <button onClick={lookupReg} style={{...s.btnGreen, width: '80px'}}>{loading ? '...' : '🔎'}</button>
                </div>
                <input style={s.input} placeholder="Make & Model" value={vehicle.makeModel} onChange={e => setVehicle({...vehicle, makeModel: e.target.value})} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{background: '#0f172a', padding: '10px', borderRadius: '8px'}}><span style={s.label}>Year</span>{vehicle.year}</div>
                    <div style={{background: '#0f172a', padding: '10px', borderRadius: '8px'}}><span style={s.label}>Fuel</span>{vehicle.fuel}</div>
                </div>
                <div style={{marginTop:'10px'}}>
                    <span style={s.label}>Chassis / VIN (Manual Entry)</span>
                    <input style={s.input} placeholder="Enter Chassis Number" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                </div>
            </div>

            <div className="no-print" style={{ ...s.card, background: theme.accent }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div><span style={s.label}>Labour Hours</span><input type="number" style={{...s.input, background: 'rgba(0,0,0,0.2)'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                    <div><span style={s.label}>Paint & Mats £</span><input type="number" style={{...s.input, background: 'rgba(0,0,0,0.2)'}} value={repair.paintMaterials} onChange={e => setRepair({...repair, paintMaterials: e.target.value})} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '10px' }}>
                    <div><span style={s.label}>ESTIMATE TOTAL</span><div style={{ fontSize: '28px', fontWeight: 'bold' }}>£{totals.due.toFixed(2)}</div></div>
                    <div style={{ textAlign: 'right' }}><span style={s.label}>Profit Check</span><div style={{ color: theme.success, fontWeight: 'bold' }}>£{totals.netProfit.toFixed(2)}</div></div>
                </div>
            </div>

            <h3 className="no-print" style={s.label}>Workshop History</h3>
            <div className="no-print">
            {savedJobs.slice(0, 5).map(j => (
                <div key={j.id} onClick={() => { setCustomer(j.customer); setVehicle(j.vehicle); setRepair(j.repair); setCurrentJobId(j.id); }} style={{ ...s.card, padding: '15px', display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>{j.vehicle?.reg} - {j.customer?.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'estimates', j.id)); }} style={{ background: theme.danger, border: 'none', color: 'white', borderRadius: '50%', width: '30px', height: '30px' }}>✕</button>
                </div>
            ))}
            </div>

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '20px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={async () => { await setDoc(doc(db, 'estimates', currentJobId || Date.now().toString()), { customer, vehicle, repair, totals, createdAt: serverTimestamp() }); alert("Sync Successful"); }} style={{ ...s.btnGreen, flex: 2 }}>SYNC JOB</button>
                <button onClick={() => setMode('FINANCE')} style={s.secondaryBtn}>📊</button>
                <button onClick={() => window.print()} style={s.secondaryBtn}>🖨️</button>
                <button onClick={() => { localStorage.removeItem('triple_mmm_draft'); window.location.reload(); }} style={{ ...s.secondaryBtn, background: theme.danger }}>NEW</button>
            </div>
            
            <div className="print-only" style={{ display: 'none', color: 'black' }}>
                <div style={{ borderBottom: '3px solid #f97316', paddingBottom: '10px', marginBottom: '20px' }}>
                    <h1>{settings.coName}</h1>
                    <p>{settings.address} | {settings.phone}</p>
                </div>
                <h3>Estimate: {vehicle.reg} - {vehicle.makeModel}</h3>
                <p>Chassis: {vehicle.vin}</p>
                <div style={{ margin: '20px 0', border: '1px solid #ccc', padding: '15px' }}>
                    <p>Labour: £{totals.labourPrice.toFixed(2)}</p>
                    <p>Paint & Materials: £{totals.paintPrice.toFixed(2)}</p>
                    <hr/>
                    <h2 style={{ textAlign: 'right' }}>Total Due: £{totals.due.toFixed(2)}</h2>
                </div>
                <div style={{ fontSize: '12px' }}>
                    <strong>Bank:</strong> {settings.bank}<br/>
                    <strong>Terms:</strong> {settings.terms}
                </div>
            </div>

            <style>{`@media print { .no-print { display: none !important; } .print-only { display: block !important; } body { background: white !important; } }`}</style>
        </div>
    );
};

const App = () => {
    const [u, sU] = useState(null);
    useEffect(() => { onAuthStateChanged(auth, u => u ? sU(u.uid) : signInAnonymously(auth).catch(e => console.error(e))); }, []);
    return u ? <EstimateApp userId={u} /> : null;
};
export default App;
