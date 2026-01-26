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
    const [view, setView] = useState('WORKSHOP'); // WORKSHOP, INVOICE, JOBCARD
    const [loading, setLoading] = useState(false);
    const [currentJobId, setCurrentJobId] = useState(null);

    const [settings, setSettings] = useState({
        coName: 'Triple MMM Body Repairs', address: '20A New Street, Stonehouse, ML9 3LT', phone: '07501 728319',
        bank: '80-22-60 | 06163462', dvlaKey: 'IXqv1yDD1latEPHIntk2w8MEuz9X57IE9TP9sxGc',
        vatRate: '0', markup: '20', labourRate: '50', terms: 'Payment due on collection.', logoUrl: ''
    });

    const [customer, setCustomer] = useState({ name: '', phone: '', email: '', address: '' });
    const [vehicle, setVehicle] = useState({ reg: '', makeModel: '', vin: '', paint: '', year: '', fuel: '' });
    const [repair, setRepair] = useState({ items: [], labourHours: '', paintMaterials: '', excess: '', photos: [], dealFile: { authority: false, satNote: false, tcSigned: false } });
    const [savedJobs, setSavedJobs] = useState([]);

    useEffect(() => {
        getDoc(doc(db, 'settings', 'global')).then(snap => snap.exists() && setSettings(prev => ({...prev, ...snap.data()})));
        return onSnapshot(query(collection(db, 'estimates'), orderBy('createdAt', 'desc')), (snap) => setSavedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }, []);

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

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        const r = ref(storage, `settings/logo`);
        await uploadBytes(r, file);
        const url = await getDownloadURL(r);
        setSettings(prev => ({ ...prev, logoUrl: url }));
    };

    const sendEmail = () => {
        const subject = encodeURIComponent(`Estimate: ${vehicle.reg} - ${customer.name}`);
        const body = encodeURIComponent(`Hello,\n\nPlease find the estimate for ${vehicle.makeModel} (${vehicle.reg}).\nTotal Due: £${totals.due.toFixed(2)}\n\nRegards,\nTriple MMM Body Repairs`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    if (mode === 'SETTINGS') return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px' }}>
            <button onClick={() => setMode('ESTIMATE')} style={s.secondaryBtn}>← BACK</button>
            <h2 style={{ color: theme.accent }}>SETTINGS & BRANDING</h2>
            <div style={s.card}>
                <span style={s.label}>Company Logo</span>
                <input type="file" onChange={handleLogoUpload} style={{marginBottom:'10px'}} />
                {settings.logoUrl && <img src={settings.logoUrl} style={{height:'50px', marginBottom:'10px'}} />}
                <input style={s.input} placeholder="Company Name" value={settings.coName} onChange={e => setSettings({...settings, coName: e.target.value})} />
                <textarea style={{...s.input, height:'60px'}} placeholder="Address" value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} />
                <button onClick={async () => { await setDoc(doc(db, 'settings', 'global'), settings); alert("Saved"); }} style={s.btnGreen}>SAVE SETTINGS</button>
            </div>
        </div>
    );

    return (
        <div style={{ background: theme.bg, minHeight: '100vh', color: theme.text, padding: '20px', paddingBottom: '120px' }}>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                {settings.logoUrl ? <img src={settings.logoUrl} style={{height:'40px'}} /> : <h1 style={{ color: theme.accent }}>TRIPLE MMM</h1>}
                <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => setView('WORKSHOP')} style={view === 'WORKSHOP' ? s.btnGreen : s.secondaryBtn}>WORKSHOP</button>
                    <button onClick={() => setView('JOBCARD')} style={view === 'JOBCARD' ? s.btnGreen : s.secondaryBtn}>JOBCARD</button>
                </div>
            </div>

            {view === 'WORKSHOP' && (
                <>
                    <div style={s.card}>
                        <span style={s.label}>Deal File Checklist</span>
                        <div style={{display:'flex', gap:'10px'}}>
                            <button onClick={() => setRepair({...repair, dealFile: {...repair.dealFile, authority: !repair.dealFile?.authority}})} style={{...s.secondaryBtn, background: repair.dealFile?.authority ? theme.success : theme.border}}>AUTHORITY</button>
                            <button onClick={() => setRepair({...repair, dealFile: {...repair.dealFile, satNote: !repair.dealFile?.satNote}})} style={{...s.secondaryBtn, background: repair.dealFile?.satNote ? theme.success : theme.border}}>SAT NOTE</button>
                            <button onClick={() => setRepair({...repair, dealFile: {...repair.dealFile, tcSigned: !repair.dealFile?.tcSigned}})} style={{...s.secondaryBtn, background: repair.dealFile?.tcSigned ? theme.success : theme.border}}>T&Cs</button>
                        </div>
                    </div>

                    <div style={s.card}>
                        <span style={s.label}>Vehicle & Registration</span>
                        <input style={{...s.input, fontSize:'20px', color:theme.accent, textAlign:'center'}} value={vehicle.reg} onChange={e => setVehicle({...vehicle, reg: e.target.value.toUpperCase()})} />
                        <input style={s.input} placeholder="Make & Model" value={vehicle.makeModel} />
                        <input style={s.input} placeholder="Chassis / VIN" value={vehicle.vin} onChange={e => setVehicle({...vehicle, vin: e.target.value})} />
                    </div>

                    <div style={{...s.card, background: theme.accent}}>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                            <div><span style={s.label}>Labour</span><input type="number" style={{...s.input, background:'rgba(0,0,0,0.2)'}} value={repair.labourHours} onChange={e => setRepair({...repair, labourHours: e.target.value})} /></div>
                            <div style={{textAlign:'right'}}><span style={s.label}>Total Due</span><div style={{fontSize:'24px', fontWeight:'bold'}}>£{totals.due.toFixed(2)}</div></div>
                        </div>
                        <button onClick={sendEmail} style={{...s.btnGreen, width:'100%', marginTop:'10px'}}>✉ SEND TO INSURER</button>
                    </div>
                </>
            )}

            {view === 'JOBCARD' && (
                <div style={s.card}>
                    <h2 style={{color:theme.accent}}>WORKSHOP JOB CARD</h2>
                    <p><strong>REG:</strong> {vehicle.reg}</p>
                    <p><strong>VEHICLE:</strong> {vehicle.makeModel}</p>
                    <p><strong>VIN:</strong> {vehicle.vin}</p>
                    <hr style={{borderColor:theme.border}}/>
                    <span style={s.label}>Instruction</span>
                    <p>Repair & Paint as per estimate items. Excess to collect: £{repair.excess}</p>
                </div>
            )}

            <div className="no-print" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: theme.card, padding: '20px', display: 'flex', gap: '10px', borderTop: `1px solid ${theme.border}`, zIndex: 1000 }}>
                <button onClick={async () => { await setDoc(doc(db, 'estimates', currentJobId || Date.now().toString()), { customer, vehicle, repair, totals, createdAt: serverTimestamp() }); alert("Synced"); }} style={{ ...s.btnGreen, flex: 2 }}>SYNC</button>
                <button onClick={() => setMode('SETTINGS')} style={s.secondaryBtn}>⚙️</button>
                <button onClick={() => window.print()} style={s.secondaryBtn}>🖨️ INVOICE</button>
            </div>

            <div className="print-only" style={{ display: 'none', color: 'black' }}>
                {settings.logoUrl && <img src={settings.logoUrl} style={{height:'60px'}} />}
                <h1>{settings.coName} - INVOICE</h1>
                <p>{settings.address}</p>
                <hr/>
                <h3>Vehicle: {vehicle.reg} - {vehicle.makeModel}</h3>
                <p>Labour: £{totals.labourPrice.toFixed(2)}</p>
                <p>Paint/Mats: £{totals.paintPrice.toFixed(2)}</p>
                <h2>Total Due: £{totals.due.toFixed(2)}</h2>
                <p style={{fontSize:'10px', marginTop:'50px'}}>{settings.terms}</p>
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
